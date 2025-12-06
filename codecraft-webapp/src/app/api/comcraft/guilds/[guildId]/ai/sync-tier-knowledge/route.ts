/**
 * API Route: Sync Tier Knowledge to AI Documents
 * POST /api/comcraft/guilds/[guildId]/ai/sync-tier-knowledge
 * 
 * Automatically creates/updates a knowledge document with current subscription tier information
 * This allows the AI bot to have real-time information about tiers and their features/limits
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '../helpers';

const COMCRAFT_SERVER_ID = '1435653730799190058';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

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

export async function POST(
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

    // Fetch all active subscription tiers
    const { data: tiers, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (tiersError) {
      console.error('Error fetching tiers:', tiersError);
      return NextResponse.json({ error: 'Failed to fetch tier information' }, { status: 500 });
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
      const { data, error } = await supabase
        .from('ai_documents')
        .update({
          content: knowledgeContent,
          is_pinned: true, // Always pin tier knowledge
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDoc.id)
        .select('id, title, content, is_pinned, updated_at')
        .single();

      if (error) {
        console.error('Error updating tier knowledge document:', error);
        return NextResponse.json({ error: 'Failed to update tier knowledge document' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Tier knowledge document updated successfully',
        document: data,
      });
    } else {
      // Create new document
      const { data, error } = await supabase
        .from('ai_documents')
        .insert({
          guild_id: guildId,
          title: 'Subscription Tiers Information',
          content: knowledgeContent,
          is_pinned: true, // Pin tier knowledge so it's always included
          tags: ['tiers', 'subscription', 'pricing', 'features', 'limits'],
        })
        .select('id, title, content, is_pinned, created_at, updated_at')
        .single();

      if (error) {
        console.error('Error creating tier knowledge document:', error);
        return NextResponse.json({ error: 'Failed to create tier knowledge document' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Tier knowledge document created successfully',
        document: data,
      });
    }
  } catch (error: any) {
    console.error('Sync tier knowledge error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

