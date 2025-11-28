import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/comcraft/guilds/:guildId/game-news/games/:gameId/latest
 * Get latest news for a game (for preview)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string; gameId: string } }
) {
  try {
    const { gameId } = params;

    const { data: news, error } = await supabaseAdmin
      .from('game_news_posts')
      .select('*')
      .eq('game_id', gameId)
      .order('published_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching latest news:', error);
      return NextResponse.json(
        { error: 'Failed to fetch news' },
        { status: 500 }
      );
    }

    return NextResponse.json({ news: news || [] });
  } catch (error) {
    console.error('Error in GET /api/comcraft/guilds/:guildId/game-news/games/:gameId/latest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

