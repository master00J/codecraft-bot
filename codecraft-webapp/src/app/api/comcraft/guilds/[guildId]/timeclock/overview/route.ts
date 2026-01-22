import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

type TimeEntry = {
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: 'active' | 'completed';
};

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

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const now = new Date();
    const start = startParam ? new Date(startParam) : new Date(now);
    if (!startParam) {
      start.setDate(start.getDate() - 30);
    }
    const end = endParam ? new Date(endParam) : now;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const { data: entries, error } = await supabaseAdmin
      .from('employee_time_entries')
      .select('user_id, clock_in_at, clock_out_at, status')
      .eq('guild_id', guildId)
      .gte('clock_in_at', start.toISOString())
      .lte('clock_in_at', end.toISOString());

    if (error) {
      console.error('Error fetching time clock entries:', error);
      return NextResponse.json({ error: 'Failed to fetch time clock data' }, { status: 500 });
    }

    const safeEntries = (entries || []) as TimeEntry[];
    const userIds = Array.from(new Set(safeEntries.map((entry) => entry.user_id)));

    let userProfiles: Record<string, { discord_tag: string | null; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('discord_id, discord_tag, avatar_url')
        .in('discord_id', userIds);

      userProfiles = (users || []).reduce((acc: any, user: any) => {
        acc[user.discord_id] = {
          discord_tag: user.discord_tag || null,
          avatar_url: user.avatar_url || null,
        };
        return acc;
      }, {});
    }

    const summaryMap = new Map<
      string,
      {
        totalMinutes: number;
        totalEntries: number;
        lastClockInAt: string | null;
        lastClockOutAt: string | null;
        active: boolean;
        activeSince: string | null;
      }
    >();

    for (const entry of safeEntries) {
      const existing = summaryMap.get(entry.user_id) || {
        totalMinutes: 0,
        totalEntries: 0,
        lastClockInAt: null,
        lastClockOutAt: null,
        active: false,
        activeSince: null,
      };

      const clockIn = new Date(entry.clock_in_at);
      const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : now;
      const minutes = Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));

      existing.totalMinutes += minutes;
      existing.totalEntries += 1;

      if (!existing.lastClockInAt || clockIn.getTime() > new Date(existing.lastClockInAt).getTime()) {
        existing.lastClockInAt = entry.clock_in_at;
      }

      if (entry.clock_out_at) {
        if (!existing.lastClockOutAt || clockOut.getTime() > new Date(existing.lastClockOutAt).getTime()) {
          existing.lastClockOutAt = entry.clock_out_at;
        }
      }

      if (entry.status === 'active') {
        existing.active = true;
        existing.activeSince = entry.clock_in_at;
      }

      summaryMap.set(entry.user_id, existing);
    }

    const employees = userIds.map((userId) => {
      const summary = summaryMap.get(userId) || {
        totalMinutes: 0,
        totalEntries: 0,
        lastClockInAt: null,
        lastClockOutAt: null,
        active: false,
        activeSince: null,
      };
      const profile = userProfiles[userId] || { discord_tag: null, avatar_url: null };

      return {
        user_id: userId,
        discord_tag: profile.discord_tag,
        avatar_url: profile.avatar_url,
        total_minutes: summary.totalMinutes,
        total_entries: summary.totalEntries,
        last_clock_in_at: summary.lastClockInAt,
        last_clock_out_at: summary.lastClockOutAt,
        active: summary.active,
        active_since: summary.activeSince,
      };
    });

    return NextResponse.json({
      employees,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/timeclock/overview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
