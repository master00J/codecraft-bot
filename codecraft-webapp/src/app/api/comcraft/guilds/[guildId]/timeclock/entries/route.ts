import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getGuildAccess } from '@/lib/comcraft/access-control';

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
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data: entries, error } = await supabaseAdmin
      .from('employee_time_entries')
      .select('id, user_id, clock_in_at, clock_out_at, status')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('clock_in_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching time clock entries:', error);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    const now = new Date();
    const hydrated = (entries || []).map((entry: any) => {
      const clockIn = new Date(entry.clock_in_at);
      const clockOut = entry.clock_out_at ? new Date(entry.clock_out_at) : now;
      const durationMinutes = Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));

      return {
        ...entry,
        duration_minutes: durationMinutes,
      };
    });

    return NextResponse.json({ entries: hydrated });
  } catch (error: any) {
    console.error('Error in GET /api/comcraft/guilds/[guildId]/timeclock/entries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
