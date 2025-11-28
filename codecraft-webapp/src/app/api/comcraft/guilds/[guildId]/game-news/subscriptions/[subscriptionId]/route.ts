import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * PATCH /api/comcraft/guilds/:guildId/game-news/subscriptions/:subscriptionId
 * Update subscription
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string; subscriptionId: string } }
) {
  try {
    const { guildId, subscriptionId } = params;
    const body = await request.json();
    const { enabled, notificationRoleId, filters } = body;

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (typeof enabled === 'boolean') {
      updates.enabled = enabled;
    }
    if (notificationRoleId !== undefined) {
      updates.notification_role_id = notificationRoleId;
    }
    if (filters) {
      updates.filters = filters;
    }

    const { data: subscription, error } = await supabaseAdmin
      .from('game_news_configs')
      .update(updates)
      .eq('id', subscriptionId)
      .eq('guild_id', guildId)
      .select(`
        *,
        game_news_sources (
          game_name,
          game_icon_url
        )
      `)
      .single();

    if (error) {
      console.error('Error updating subscription:', error);
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Error in PATCH /api/comcraft/guilds/:guildId/game-news/subscriptions/:subscriptionId:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comcraft/guilds/:guildId/game-news/subscriptions/:subscriptionId
 * Delete subscription
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string; subscriptionId: string } }
) {
  try {
    const { guildId, subscriptionId } = params;

    const { error } = await supabaseAdmin
      .from('game_news_configs')
      .delete()
      .eq('id', subscriptionId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting subscription:', error);
      return NextResponse.json(
        { error: 'Failed to delete subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/comcraft/guilds/:guildId/game-news/subscriptions/:subscriptionId:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

