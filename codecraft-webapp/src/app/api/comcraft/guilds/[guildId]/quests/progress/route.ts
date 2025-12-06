import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const questId = searchParams.get('quest_id');

    let query = supabaseAdmin
      .from('quest_progress')
      .select(`
        *,
        quests(*)
      `)
      .eq('guild_id', guildId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (questId) {
      query = query.eq('quest_id', questId);
    }

    const { data: progress, error } = await query;

    if (error) {
      console.error('Error fetching quest progress:', error);
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
    }

    return NextResponse.json({ progress: progress || [] });
  } catch (error) {
    console.error('Error in GET /quests/progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

