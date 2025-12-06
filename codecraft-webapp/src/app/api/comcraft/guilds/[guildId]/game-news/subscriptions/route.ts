import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/comcraft/guilds/:guildId/game-news/subscriptions
 * Get guild's game news subscriptions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const { guildId } = params;

    const { data: subscriptions, error } = await supabaseAdmin
      .from('game_news_configs')
      .select(`
        *,
        game_news_sources (
          game_name,
          game_icon_url
        )
      `)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscriptions:', error);
      
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Game news tables not yet created. Please run the migration: game-news-schema.sql');
        return NextResponse.json({ 
          subscriptions: [], 
          warning: 'Game news feature not yet configured. Please run database migration.' 
        });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscriptions: subscriptions || [] });
  } catch (error) {
    console.error('Error in GET /api/comcraft/guilds/:guildId/game-news/subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comcraft/guilds/:guildId/game-news/subscriptions
 * Create new game news subscription
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const { guildId } = params;
    const body = await request.json();
    const { channelId, gameId, notificationRoleId, filters } = body;

    if (!channelId || !gameId) {
      return NextResponse.json(
        { error: 'channelId and gameId are required' },
        { status: 400 }
      );
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('game_news_configs')
      .insert({
        guild_id: guildId,
        channel_id: channelId,
        game_id: gameId,
        notification_role_id: notificationRoleId || null,
        filters: filters || { types: ['all'] },
        enabled: true,
      })
      .select(`
        *,
        game_news_sources (
          game_name,
          game_icon_url
        )
      `)
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      
      // Check if duplicate
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Subscription for this game already exists' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscription }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/comcraft/guilds/:guildId/game-news/subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

