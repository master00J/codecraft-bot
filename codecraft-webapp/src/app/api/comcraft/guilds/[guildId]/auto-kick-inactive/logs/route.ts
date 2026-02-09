/**
 * API Route: Auto Kick Inactive – Logs
 * GET /api/comcraft/guilds/[guildId]/auto-kick-inactive/logs
 * Returns recent members kicked by the auto-kick feature for dashboard display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuildAccess } from '@/lib/comcraft/access-control';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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

    const discordId = (session.user as any).discordId || (session.user as any).id || (session.user as any).sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const { data: logs, error } = await supabase
      .from('inactive_kick_logs')
      .select('id, user_id, username, inactive_days, kicked_at')
      .eq('guild_id', guildId)
      .order('kicked_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching inactive kick logs:', error);
      return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }

    return NextResponse.json({ logs: logs || [] });
  } catch (error) {
    console.error('Error in auto-kick-inactive logs GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
