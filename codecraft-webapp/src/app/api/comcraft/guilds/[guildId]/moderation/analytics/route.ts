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

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return { allowed: true };
  }

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

    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const limit = 5000;

    let query = supabaseAdmin
      .from('moderation_logs')
      .select('action, moderator_id, moderator_name, created_at', { count: 'exact' })
      .eq('guild_id', guildId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, limit - 1);

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching moderation analytics:', error);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    const actions: Record<string, number> = {};
    const moderators: Record<string, { id: string; name: string; total: number }> = {};
    const daily: Record<string, { date: string; total: number }> = {};

    (data || []).forEach((row: any) => {
      actions[row.action] = (actions[row.action] || 0) + 1;

      if (row.moderator_id) {
        if (!moderators[row.moderator_id]) {
          moderators[row.moderator_id] = {
            id: row.moderator_id,
            name: row.moderator_name || row.moderator_id,
            total: 0
          };
        }
        moderators[row.moderator_id].total += 1;
      }

      const dateKey = new Date(row.created_at).toISOString().slice(0, 10);
      if (!daily[dateKey]) {
        daily[dateKey] = { date: dateKey, total: 0 };
      }
      daily[dateKey].total += 1;
    });

    const moderatorsList = Object.values(moderators).sort((a, b) => b.total - a.total);
    const dailyList = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalCases: count || 0,
      actions,
      moderators: moderatorsList,
      daily: dailyList,
      truncated: (count || 0) > limit
    });
  } catch (error: any) {
    console.error('Analytics GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
