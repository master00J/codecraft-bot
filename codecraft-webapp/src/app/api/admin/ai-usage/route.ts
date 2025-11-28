/**
 * Admin API: AI Usage Analytics
 * GET /api/admin/ai-usage - Get AI token usage across all guilds
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function checkAdminAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { isAdmin: false, error: 'Unauthorized' };
  }

  const discordId = (session.user as any).discordId;
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (!user?.is_admin) {
    return { isAdmin: false, error: 'Admin access required' };
  }

  return { isAdmin: true };
}

export async function GET(request: NextRequest) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, week, day, all
    const sortBy = searchParams.get('sortBy') || 'tokens'; // tokens, cost, requests
    const limit = parseInt(searchParams.get('limit') || '100');

    // Calculate time range
    const now = new Date();
    let periodStart: Date;
    
    switch (period) {
      case 'day':
        periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        break;
      case 'all':
        periodStart = new Date('2020-01-01'); // Start of time
        break;
    }

    // Get AI usage logs
    let query = supabaseAdmin
      .from('ai_usage_logs')
      .select('guild_id, provider, model, tokens_input, tokens_output, tokens_total, cost_usd, task_type, created_at');

    if (period !== 'all') {
      query = query.gte('created_at', periodStart.toISOString());
    }

    const { data: usageLogs, error: logsError } = await query;

    if (logsError) {
      console.error('Error fetching AI usage logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch AI usage logs' }, { status: 500 });
    }

    // Get guild info
    const { data: guilds, error: guildsError } = await supabaseAdmin
      .from('guild_configs')
      .select('guild_id, guild_name, subscription_tier, subscription_status, owner_discord_id');

    if (guildsError) {
      console.error('Error fetching guilds:', guildsError);
    }

    // Create guild lookup
    const guildMap = new Map(
      (guilds || []).map(g => [g.guild_id, {
        name: g.guild_name,
        tier: g.subscription_tier,
        status: g.subscription_status,
        owner: g.owner_discord_id
      }])
    );

    // Aggregate by guild
    const guildUsage = new Map<string, {
      guildId: string;
      guildName: string;
      tier: string;
      status: string;
      tokensInput: number;
      tokensOutput: number;
      tokensTotal: number;
      costUsd: number;
      requestCount: number;
      providers: Set<string>;
      models: Set<string>;
      taskTypes: Set<string>;
      lastUsed: string;
    }>();

    for (const log of usageLogs || []) {
      if (!log.guild_id) continue;

      const existing = guildUsage.get(log.guild_id);
      const guildInfo = guildMap.get(log.guild_id);

      if (existing) {
        existing.tokensInput += Number(log.tokens_input || 0);
        existing.tokensOutput += Number(log.tokens_output || 0);
        existing.tokensTotal += Number(log.tokens_total || 0);
        existing.costUsd += Number(log.cost_usd || 0);
        existing.requestCount += 1;
        if (log.provider) existing.providers.add(log.provider);
        if (log.model) existing.models.add(log.model);
        if (log.task_type) existing.taskTypes.add(log.task_type);
        if (log.created_at > existing.lastUsed) {
          existing.lastUsed = log.created_at;
        }
      } else {
        guildUsage.set(log.guild_id, {
          guildId: log.guild_id,
          guildName: guildInfo?.name || 'Unknown Server',
          tier: guildInfo?.tier || 'free',
          status: guildInfo?.status || 'unknown',
          tokensInput: Number(log.tokens_input || 0),
          tokensOutput: Number(log.tokens_output || 0),
          tokensTotal: Number(log.tokens_total || 0),
          costUsd: Number(log.cost_usd || 0),
          requestCount: 1,
          providers: new Set(log.provider ? [log.provider] : []),
          models: new Set(log.model ? [log.model] : []),
          taskTypes: new Set(log.task_type ? [log.task_type] : []),
          lastUsed: log.created_at
        });
      }
    }

    // Convert to array and sort
    let usageArray = Array.from(guildUsage.values()).map(item => ({
      ...item,
      providers: Array.from(item.providers),
      models: Array.from(item.models),
      taskTypes: Array.from(item.taskTypes),
    }));

    // Sort
    switch (sortBy) {
      case 'cost':
        usageArray.sort((a, b) => b.costUsd - a.costUsd);
        break;
      case 'requests':
        usageArray.sort((a, b) => b.requestCount - a.requestCount);
        break;
      case 'tokens':
      default:
        usageArray.sort((a, b) => b.tokensTotal - a.tokensTotal);
        break;
    }

    // Limit results
    usageArray = usageArray.slice(0, limit);

    // Calculate totals
    const totals = {
      totalGuilds: guildUsage.size,
      totalTokens: usageArray.reduce((sum, g) => sum + g.tokensTotal, 0),
      totalCost: usageArray.reduce((sum, g) => sum + g.costUsd, 0),
      totalRequests: usageArray.reduce((sum, g) => sum + g.requestCount, 0),
    };

    // Get provider breakdown
    const providerBreakdown = new Map<string, { requests: number; tokens: number; cost: number }>();
    for (const log of usageLogs || []) {
      const provider = log.provider || 'unknown';
      const existing = providerBreakdown.get(provider) || { requests: 0, tokens: 0, cost: 0 };
      existing.requests += 1;
      existing.tokens += Number(log.tokens_total || 0);
      existing.cost += Number(log.cost_usd || 0);
      providerBreakdown.set(provider, existing);
    }

    return NextResponse.json({
      success: true,
      period: {
        type: period,
        start: periodStart.toISOString(),
        end: now.toISOString(),
      },
      totals,
      guilds: usageArray,
      providerBreakdown: Object.fromEntries(providerBreakdown),
    });

  } catch (error) {
    console.error('Error in AI usage admin API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

