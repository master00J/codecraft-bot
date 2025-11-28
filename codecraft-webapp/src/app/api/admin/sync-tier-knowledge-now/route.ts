/**
 * Quick Admin Endpoint: Sync Tier Knowledge Now
 * GET /api/admin/sync-tier-knowledge-now
 * 
 * Simple GET endpoint to trigger tier knowledge sync for ComCraft server
 * Useful for quick manual syncs without needing to make POST requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const COMCRAFT_SERVER_ID = '1435653730799190058';

async function checkAdminAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return { isAdmin: false, error: 'Unauthorized' };
  }

  const discordId = (session.user as any).discordId;
  
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();

  if (!user?.is_admin) {
    return { isAdmin: false, error: 'Admin access required' };
  }

  return { isAdmin: true };
}

async function formatTierKnowledge(tiers: any[]): Promise<string> {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return 'No subscription tiers are currently available.';
  }

  const activeTiers = tiers.filter(tier => tier.is_active !== false);
  
  if (activeTiers.length === 0) {
    return 'No active subscription tiers are currently available.';
  }

  let content = `# ComCraft Subscription Tiers Information\n\n`;
  content += `This document contains up-to-date information about all available subscription tiers, their features, limits, and pricing.\n\n`;
  content += `**Last Updated:** ${new Date().toISOString()}\n\n`;
  content += `---\n\n`;

  for (const tier of activeTiers.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))) {
    content += `## ${tier.display_name || tier.tier_name}\n\n`;
    
    if (tier.description) {
      content += `${tier.description}\n\n`;
    }

    // Pricing
    if (tier.price_monthly || tier.price_yearly) {
      content += `### Pricing\n`;
      if (tier.price_monthly) {
        const currency = tier.currency === 'EUR' ? '€' : '$';
        content += `- Monthly: ${currency}${tier.price_monthly}\n`;
      }
      if (tier.price_yearly) {
        const currency = tier.currency === 'EUR' ? '€' : '$';
        content += `- Yearly: ${currency}${tier.price_yearly}\n`;
      }
      content += `\n`;
    }

    // Features
    if (tier.features && typeof tier.features === 'object') {
      const enabledFeatures = Object.entries(tier.features)
        .filter(([_, enabled]) => enabled === true)
        .map(([key]) => key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      
      if (enabledFeatures.length > 0) {
        content += `### Features\n`;
        enabledFeatures.forEach(feature => {
          content += `- ✅ ${feature}\n`;
        });
        content += `\n`;
      }
    }

    // Limits
    if (tier.limits && typeof tier.limits === 'object') {
      const limitEntries = Object.entries(tier.limits)
        .filter(([_, value]) => value !== null && value !== undefined)
        .map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const displayValue = value === -1 ? 'Unlimited' : typeof value === 'number' ? value.toLocaleString() : String(value);
          return { label, value: displayValue };
        });
      
      if (limitEntries.length > 0) {
        content += `### Limits\n`;
        limitEntries.forEach(({ label, value }) => {
          content += `- ${label}: ${value}\n`;
        });
        content += `\n`;
      }
    }

    content += `---\n\n`;
  }

  content += `\n## Important Notes\n\n`;
  content += `- Tier information is automatically synchronized and kept up-to-date.\n`;
  content += `- When users ask about tiers, pricing, features, or limits, refer to this information.\n`;
  content += `- Always mention the exact tier name and pricing when discussing subscription options.\n`;
  content += `- If a user asks about upgrading, explain the benefits of higher tiers based on the features listed above.\n`;

  return content;
}

async function syncTierKnowledgeForGuild(guildId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch all active subscription tiers
    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (tiersError) {
      console.error(`[Sync Tier Knowledge] Error fetching tiers for guild ${guildId}:`, tiersError);
      return { success: false, error: 'Failed to fetch tier information' };
    }

    // Format tier information as knowledge content
    const knowledgeContent = await formatTierKnowledge(tiers || []);

    // Check if a tier knowledge document already exists for this guild
    const { data: existingDoc } = await supabase
      .from('ai_documents')
      .select('id')
      .eq('guild_id', guildId)
      .eq('title', 'Subscription Tiers Information')
      .maybeSingle();

    if (existingDoc) {
      // Update existing document
      const { error } = await supabase
        .from('ai_documents')
        .update({
          content: knowledgeContent,
          is_pinned: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDoc.id);

      if (error) {
        console.error(`[Sync Tier Knowledge] Error updating document for guild ${guildId}:`, error);
        return { success: false, error: 'Failed to update tier knowledge document' };
      }

      return { success: true };
    } else {
      // Create new document
      const { error } = await supabase
        .from('ai_documents')
        .insert({
          guild_id: guildId,
          title: 'Subscription Tiers Information',
          content: knowledgeContent,
          is_pinned: true,
          tags: ['tiers', 'subscription', 'pricing', 'features', 'limits'],
        });

      if (error) {
        console.error(`[Sync Tier Knowledge] Error creating document for guild ${guildId}:`, error);
        return { success: false, error: 'Failed to create tier knowledge document' };
      }

      return { success: true };
    }
  } catch (error: any) {
    console.error(`[Sync Tier Knowledge] Error for guild ${guildId}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { isAdmin, error } = await checkAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error }, { status: 403 });
    }

    const result = await syncTierKnowledgeForGuild(COMCRAFT_SERVER_ID);
    
    if (!result.success) {
      return NextResponse.json({ 
        success: false,
        error: result.error 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Tier knowledge synced successfully for ComCraft server (${COMCRAFT_SERVER_ID})`,
      guildId: COMCRAFT_SERVER_ID,
    });
  } catch (error: any) {
    console.error('Sync tier knowledge error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

