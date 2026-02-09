/**
 * Recurring giveaways: list and create templates. Bot starts a new giveaway when next_run_at is reached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

const MIN_INTERVAL_HOURS = 1;
const MAX_INTERVAL_HOURS = 8760; // 1 year

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();
  if (guild?.owner_discord_id === discordId) return true;
  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .single();
  if (authorized) return true;
  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .single();
  return !!user?.is_admin;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const discordId = (session.user as { discordId?: string }).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }
    const hasAccess = await assertAccess(guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('recurring_giveaways')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Recurring giveaways list error:', error);
      return NextResponse.json({ error: 'Failed to load recurring giveaways' }, { status: 500 });
    }

    return NextResponse.json({ recurring: data ?? [] });
  } catch (e) {
    console.error('Recurring giveaways GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
    const discordId = (session.user as { discordId?: string }).discordId;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }
    const hasAccess = await assertAccess(guildId, discordId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      prize,
      channelId,
      durationMinutes = 60,
      winnerCount = 1,
      intervalHours,
      requiredRoleId = null,
      firstRunAt = null,
      embedTitle,
      embedDescription,
      embedColor,
      embedFooter,
      embedImageUrl,
      embedThumbnailUrl,
      joinButtonLabel,
      ctaButtonLabel,
      ctaButtonUrl,
      rewardRoleId,
      rewardRoleRemoveAfter,
      rewardDmMessage,
      rewardChannelId,
      rewardChannelMessage,
    } = body;

    if (!prize || typeof prize !== 'string' || !prize.trim()) {
      return NextResponse.json({ error: 'Prize is required.' }, { status: 400 });
    }
    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'Channel is required.' }, { status: 400 });
    }

    const dur = Number(durationMinutes);
    if (!Number.isFinite(dur) || dur < 1 || dur > 10080) {
      return NextResponse.json({ error: 'Duration must be between 1 and 10080 minutes (1 week).' }, { status: 400 });
    }

    const winners = Number(winnerCount);
    if (!Number.isFinite(winners) || winners < 1 || winners > 25) {
      return NextResponse.json({ error: 'Winner count must be between 1 and 25.' }, { status: 400 });
    }

    const interval = Number(intervalHours);
    if (!Number.isFinite(interval) || interval < MIN_INTERVAL_HOURS || interval > MAX_INTERVAL_HOURS) {
      return NextResponse.json(
        { error: `Interval must be between ${MIN_INTERVAL_HOURS} and ${MAX_INTERVAL_HOURS} hours.` },
        { status: 400 }
      );
    }

    let nextRunAt: string;
    if (firstRunAt && typeof firstRunAt === 'string') {
      const t = new Date(firstRunAt);
      if (Number.isNaN(t.getTime())) {
        return NextResponse.json({ error: 'Invalid first run date.' }, { status: 400 });
      }
      nextRunAt = t.toISOString();
    } else {
      nextRunAt = new Date().toISOString();
    }

    const row = {
      guild_id: guildId,
      channel_id: channelId.trim(),
      created_by_discord_id: discordId,
      prize: prize.trim(),
      winner_count: winners,
      duration_minutes: dur,
      required_role_id: requiredRoleId && typeof requiredRoleId === 'string' ? requiredRoleId.trim() || null : null,
      interval_hours: interval,
      next_run_at: nextRunAt,
      enabled: true,
      embed_title: typeof embedTitle === 'string' ? embedTitle.trim() || null : null,
      embed_description: typeof embedDescription === 'string' ? embedDescription.trim() || null : null,
      embed_color: typeof embedColor === 'string' ? embedColor.trim() || null : null,
      embed_footer: typeof embedFooter === 'string' ? embedFooter.trim() || null : null,
      embed_image_url: typeof embedImageUrl === 'string' ? embedImageUrl.trim() || null : null,
      embed_thumbnail_url: typeof embedThumbnailUrl === 'string' ? embedThumbnailUrl.trim() || null : null,
      join_button_label: typeof joinButtonLabel === 'string' ? joinButtonLabel.trim() || null : null,
      cta_button_label: typeof ctaButtonLabel === 'string' ? ctaButtonLabel.trim() || null : null,
      cta_button_url: typeof ctaButtonUrl === 'string' && /^https?:\/\//i.test(ctaButtonUrl.trim()) ? ctaButtonUrl.trim() : null,
      reward_role_id: typeof rewardRoleId === 'string' ? rewardRoleId.trim() || null : null,
      reward_role_remove_after: rewardRoleRemoveAfter != null && Number.isFinite(Number(rewardRoleRemoveAfter)) ? Number(rewardRoleRemoveAfter) : null,
      reward_dm_message: typeof rewardDmMessage === 'string' ? rewardDmMessage.trim() || null : null,
      reward_channel_id: typeof rewardChannelId === 'string' ? rewardChannelId.trim() || null : null,
      reward_channel_message: typeof rewardChannelMessage === 'string' ? rewardChannelMessage.trim() || null : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('recurring_giveaways')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Recurring giveaway insert error:', error);
      return NextResponse.json({ error: 'Failed to create recurring giveaway.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, recurring: data });
  } catch (e) {
    console.error('Recurring giveaways POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
