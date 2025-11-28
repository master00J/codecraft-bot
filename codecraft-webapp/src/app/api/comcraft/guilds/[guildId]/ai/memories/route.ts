import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabase, getGuildAccess, isAiFeatureEnabled } from '../helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
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

    const { guildId } = params;
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const featureEnabled = await isAiFeatureEnabled(guildId);
    if (!featureEnabled) {
      return NextResponse.json({ memories: [], total: 0 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get('limit') || 25), 100);
    const offset = Number(searchParams.get('offset') || 0);
    const type = searchParams.get('type');

    let query = supabase
      .from('ai_memories')
      .select('*', { count: 'exact' })
      .eq('guild_id', guildId)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('AI memories fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
    }

    return NextResponse.json({
      memories: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('AI memories GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

