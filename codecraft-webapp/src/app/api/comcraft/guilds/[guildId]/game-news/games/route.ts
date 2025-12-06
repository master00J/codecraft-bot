import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/comcraft/guilds/:guildId/game-news/games
 * Get available games for news subscriptions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const { guildId } = params;

    // Fetch all available game sources
    const { data: games, error } = await supabaseAdmin
      .from('game_news_sources')
      .select('*')
      .eq('status', 'active')
      .order('game_name');

    if (error) {
      console.error('Error fetching games:', error);
      
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Game news tables not yet created. Please run the migration: game-news-schema.sql');
        return NextResponse.json({ 
          games: [], 
          warning: 'Game news feature not yet configured. Please run database migration.' 
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    return NextResponse.json({ games: games || [] });
  } catch (error) {
    console.error('Error in GET /api/comcraft/guilds/:guildId/game-news/games:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

