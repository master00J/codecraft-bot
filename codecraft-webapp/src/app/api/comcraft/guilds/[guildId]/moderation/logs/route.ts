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

  return { allowed: false, reason: 'Access denied' };
}

function toInt(value: string | null, fallback: number) {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function csvEscape(v: any) {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
    const action = url.searchParams.get('action');
    const userId = url.searchParams.get('user_id');
    const active = url.searchParams.get('active'); // "true" | "false" | null
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const format = url.searchParams.get('format'); // "csv" | "json" | null

    const limit = Math.min(500, Math.max(1, toInt(url.searchParams.get('limit'), 50)));
    const offset = Math.max(0, toInt(url.searchParams.get('offset'), 0));

    let query = supabaseAdmin
      .from('moderation_logs')
      .select('*', { count: 'exact' })
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('user_id', userId);
    if (active === 'true') query = query.eq('active', true);
    if (active === 'false') query = query.eq('active', false);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: logs, error, count } = await query;
    if (error) {
      console.error('Error fetching moderation logs:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    if (format === 'json') {
      return new NextResponse(JSON.stringify(logs || [], null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="moderation-logs-${guildId}.json"`
        }
      });
    }

    if (format === 'csv') {
      const header = [
        'created_at',
        'case_id',
        'action',
        'active',
        'user_id',
        'username',
        'moderator_id',
        'moderator_name',
        'reason',
        'duration',
        'expires_at'
      ].join(',');

      const lines = (logs || []).map((l: any) =>
        [
          csvEscape(l.created_at),
          csvEscape(l.case_id),
          csvEscape(l.action),
          csvEscape(l.active),
          csvEscape(l.user_id),
          csvEscape(l.username),
          csvEscape(l.moderator_id),
          csvEscape(l.moderator_name),
          csvEscape(l.reason),
          csvEscape(l.duration),
          csvEscape(l.expires_at)
        ].join(',')
      );

      const csv = [header, ...lines].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="moderation-logs-${guildId}.csv"`
        }
      });
    }

    return NextResponse.json({
      logs: logs || [],
      count: count || 0,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('Moderation logs GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

