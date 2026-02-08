import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase, getGuildAccess, isAiFeatureEnabled, getAiUsageLimitInfo, getSystemPromptLimit } from './helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isAiFeatureEnabled(guildId);

    const { data: personaData } = await supabase
      .from('ai_personas')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    const { data: settingsData } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    const { data: documents } = await supabase
      .from('ai_documents')
      .select('id, title, content, is_pinned, updated_at, created_at')
      .eq('guild_id', guildId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    const { data: usageRows } = await supabase
      .from('ai_usage_logs')
      .select('id, created_at, provider, model, tokens_input, tokens_output, tokens_total, cost_usd, task_type, metadata')
      .eq('guild_id', guildId)
      .gte('created_at', periodStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    const usageTotals = (usageRows || []).reduce(
      (acc, row) => {
        acc.tokensInput += Number(row.tokens_input || 0);
        acc.tokensOutput += Number(row.tokens_output || 0);
        acc.tokensTotal += Number(row.tokens_total || 0);
        acc.costUsd += Number(row.cost_usd || 0);
        return acc;
      },
      {
        tokensInput: 0,
        tokensOutput: 0,
        tokensTotal: 0,
        costUsd: 0,
      }
    );

    const limitInfo = await getAiUsageLimitInfo(guildId);
    const limitTokens = limitInfo.limitTokens ?? -1;
    const quotaExceeded = limitTokens >= 0 && usageTotals.tokensTotal >= limitTokens;
    const systemPromptLimit = await getSystemPromptLimit(guildId);

    const usageSummary = {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      tokensInput: usageTotals.tokensInput,
      tokensOutput: usageTotals.tokensOutput,
      tokensUsed: usageTotals.tokensTotal,
      costUsd: Number(usageTotals.costUsd.toFixed(6)),
      limitTokens,
      remainingTokens: limitTokens >= 0 ? Math.max(limitTokens - usageTotals.tokensTotal, 0) : null,
      quotaExceeded,
      tierName: limitInfo.tierName,
      subscriptionActive: limitInfo.subscriptionActive,
      limitSource: limitInfo.source,
    };

    const usageHistory = (usageRows || []).slice(0, 40).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      provider: row.provider,
      model: row.model,
      taskType: row.task_type,
      tokensInput: Number(row.tokens_input || 0),
      tokensOutput: Number(row.tokens_output || 0),
      tokensTotal: Number(row.tokens_total || 0),
      costUsd: Number(row.cost_usd || 0),
      metadata: row.metadata ?? {},
    }));

    return NextResponse.json({
      featureEnabled,
      persona: personaData || {
        assistant_name: 'ComCraft AI',
        system_prompt: '',
        style_guidelines: '',
      },
      settings: settingsData || {
        allow_question_command: true,
        allow_moderation: false,
        default_provider: 'claude',
        chat_enabled: false,
        chat_channel_id: null,
        allowed_channel_ids: [],
        chat_reply_in_thread: true,
        memory_enabled: true,
        memory_max_entries: 200,
        memory_retention_days: 90,
        web_search_enabled: false,
      },
      documents: documents || [],
      usageSummary,
      systemPromptLimit,
      usageLogs: usageHistory,
    });
  } catch (error) {
    console.error('AI config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const body = await request.json();

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isAiFeatureEnabled(guildId);
    if (!featureEnabled) {
      return NextResponse.json({ error: 'AI assistant feature is not enabled for this tier.' }, { status: 403 });
    }

    const persona = body.persona ?? {};
    const settings = body.settings ?? {};

    console.log('[AI Config PATCH] incoming', {
      guildId,
      personaKeys: Object.keys(persona).filter((key) => persona[key] !== undefined),
      settings,
    });

    // Get tier-based limit for system prompt
    const systemPromptLimit = await getSystemPromptLimit(guildId);
    if (persona.system_prompt && persona.system_prompt.length > systemPromptLimit) {
      return NextResponse.json({ 
        error: `System prompt exceeds ${systemPromptLimit.toLocaleString()} characters (tier limit).` 
      }, { status: 400 });
    }

    if (persona.style_guidelines && persona.style_guidelines.length > 6000) {
      return NextResponse.json({ error: 'Style guidelines exceed 6000 characters.' }, { status: 400 });
    }

    if (persona.assistant_name && persona.assistant_name.length > 120) {
      return NextResponse.json({ error: 'Assistant name too long.' }, { status: 400 });
    }

    const personaPayload = {
      guild_id: guildId,
      assistant_name: persona.assistant_name ?? null,
      system_prompt: persona.system_prompt ?? null,
      style_guidelines: persona.style_guidelines ?? null,
      updated_at: new Date().toISOString(),
    };
    const shouldUpdatePersona = [
      persona.assistant_name,
      persona.system_prompt,
      persona.style_guidelines,
    ].some((value) => value !== undefined);

    const settingsPayload: any = {
      guild_id: guildId,
      allow_question_command: settings.allow_question_command !== undefined ? Boolean(settings.allow_question_command) : undefined,
      allow_moderation: settings.allow_moderation !== undefined ? Boolean(settings.allow_moderation) : undefined,
      chat_enabled: settings.chat_enabled !== undefined ? Boolean(settings.chat_enabled) : undefined,
      chat_channel_id: settings.chat_channel_id !== undefined ? settings.chat_channel_id : undefined,
      allowed_channel_ids: settings.allowed_channel_ids !== undefined ? (Array.isArray(settings.allowed_channel_ids) ? settings.allowed_channel_ids : []) : undefined,
      chat_reply_in_thread: settings.chat_reply_in_thread !== undefined ? Boolean(settings.chat_reply_in_thread) : undefined,
      memory_enabled: settings.memory_enabled !== undefined ? Boolean(settings.memory_enabled) : undefined,
      memory_max_entries: settings.memory_max_entries !== undefined ? Number(settings.memory_max_entries) : undefined,
      memory_retention_days: settings.memory_retention_days !== undefined ? Number(settings.memory_retention_days) : undefined,
      web_search_enabled: settings.web_search_enabled !== undefined ? Boolean(settings.web_search_enabled) : undefined,
      updated_at: new Date().toISOString(),
    };

    console.log('[AI Config PATCH] settings payload', settingsPayload);

    // Validate and accept default_provider if provided
    if (settings.default_provider !== undefined) {
      const provider = String(settings.default_provider || '').toLowerCase();
      if (provider && provider !== 'gemini' && provider !== 'claude' && provider !== 'deepseek') {
        return NextResponse.json({ error: 'Invalid default_provider. Use "gemini", "claude", or "deepseek".' }, { status: 400 });
      }
      settingsPayload.default_provider = provider || null;
      // Web search is now supported for all providers (Claude, Gemini, DeepSeek)
      // No need to disable it when switching providers
    }

    // Validate and accept ai_model if provided
    if (settings.ai_model !== undefined) {
      settingsPayload.ai_model = settings.ai_model || null;
    }

    if (shouldUpdatePersona) {
      await supabase
        .from('ai_personas')
        .upsert(personaPayload, { onConflict: 'guild_id' });
    }

    const settingsPayloadForUpsert = {
      ...settingsPayload,
      allow_question_command: settingsPayload.allow_question_command ?? true,
      allow_moderation: settingsPayload.allow_moderation ?? false,
      chat_enabled: settingsPayload.chat_enabled ?? false,
      chat_channel_id: settingsPayload.chat_channel_id ?? null,
      allowed_channel_ids: settingsPayload.allowed_channel_ids ?? [],
      chat_reply_in_thread: settingsPayload.chat_reply_in_thread ?? true,
      memory_enabled: settingsPayload.memory_enabled ?? true,
      memory_max_entries: settingsPayload.memory_max_entries ?? 200,
      memory_retention_days: settingsPayload.memory_retention_days ?? 90,
      web_search_enabled: settingsPayload.web_search_enabled ?? false,
      ai_model: settingsPayload.ai_model ?? null,
    };

    const { data: savedSettings, error: upsertError } = await supabase
      .from('ai_settings')
      .upsert(settingsPayloadForUpsert, { onConflict: 'guild_id' })
      .select('*')
      .maybeSingle();

    if (upsertError) {
      console.error('[AI Config PATCH] upsert failed', upsertError);
      return NextResponse.json({ error: 'Failed to save AI settings' }, { status: 500 });
    }

    const { data: updatedSettings, error: fetchError } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (fetchError) {
      console.error('[AI Config PATCH] failed to fetch updated settings', fetchError);
    } else {
      console.log('[AI Config PATCH] saved settings', updatedSettings);
    }

    return NextResponse.json({ success: true, settings: updatedSettings || savedSettings });
  } catch (error) {
    console.error('AI config PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

