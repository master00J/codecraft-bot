import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getGuildAccess(guildId: string, discordId: string) {
  const { data: guild, error: guildError } = await supabaseAdmin
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .maybeSingle();

  if (guildError || !guild) {
    console.error('Guild lookup error:', guildError);
    return { allowed: false, reason: 'Guild not found' };
  }

  if (guild.owner_discord_id === discordId) {
    return { allowed: true };
  }

  const { data: authorized } = await supabaseAdmin
    .from('authorized_users')
    .select('user_id')
    .eq('guild_id', guildId)
    .eq('user_id', discordId)
    .maybeSingle();

  if (authorized) {
    return { allowed: true };
  }

  // Check if user is platform admin
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

  console.log('Access denied for user', discordId, 'to guild', guildId);
  return { allowed: false, reason: 'Access denied' };
}

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

    const { data: config, error } = await supabaseAdmin
      .from('moderation_configs')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching moderation config:', error);
      return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }

    return NextResponse.json({
      config: config || {
        automod_enabled: false,
        filter_spam: true,
        filter_links: false,
        filter_invites: true,
        filter_caps: false,
        filter_mention_spam: true,
        filter_emoji_spam: false,
        filter_duplicates: false,
        filter_words: [],
        ai_moderation_enabled: false,
        ai_image_moderation_enabled: false,
        spam_messages: 5,
        spam_interval: 5,
        caps_threshold: 70,
        caps_min_length: 10,
        max_mentions: 5,
        max_emojis: 10,
        duplicate_time_window: 60,
        auto_slowmode_enabled: false,
        auto_slowmode_duration: 5,
        auto_slowmode_reset: 300,
        anti_raid_enabled: false,
        raid_time_window: 10,
        raid_max_joins: 5,
        raid_kick_new_members: false,
        auto_ban_enabled: false,
        auto_ban_threshold: 3,
        auto_ban_duration: null,
        auto_warn_enabled: false,
        warning_decay_days_manual: 60,
        warning_decay_days_auto: 60,
        muted_role_id: null,
        mod_log_channel_id: null,
        mod_role_id: null,
        appeals_channel_id: null
      }
    });
  } catch (error: any) {
    console.error('Moderation config GET error:', error);
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

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('moderation_configs')
      .upsert({
        guild_id: guildId,
        ...body,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guild_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating moderation config:', error);
      return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, config: data });
  } catch (error: any) {
    console.error('Moderation config PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
