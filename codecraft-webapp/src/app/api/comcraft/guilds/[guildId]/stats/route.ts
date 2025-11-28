/**
 * API Route: Stats configuration
 * /api/comcraft/guilds/[guildId]/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;

    // Get stats config
    const { data: config } = await supabase
      .from('stats_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    // Return config or defaults
    return NextResponse.json({
      config: config || {
        guild_id: guildId,
        card_background_url: null,
        card_border_color: '#5865F2',
        card_theme: 'dark',
        show_message_rank: true,
        show_voice_rank: true,
        show_top_channels: true,
        show_charts: true,
        show_1d: true,
        show_7d: true,
        show_14d: true,
        show_30d: false,
        lookback_days: 14,
        timezone: 'UTC',
        enabled: true
      }
    });
  } catch (error) {
    console.error('Error in stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    // Verify user has access to this guild
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    // Check if user is owner or authorized
    const isOwner = guild.owner_discord_id === discordId;
    
    const { data: authorized } = await supabase
      .from('authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('user_id', discordId)
      .maybeSingle();

    if (!isOwner && !authorized) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();

    // Get existing config
    const { data: existing } = await supabase
      .from('stats_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    const updateData = {
      guild_id: guildId,
      ...(body.card_background_url !== undefined && { card_background_url: body.card_background_url || null }),
      ...(body.card_border_color !== undefined && { card_border_color: body.card_border_color }),
      ...(body.card_theme !== undefined && { card_theme: body.card_theme }),
      ...(body.show_message_rank !== undefined && { show_message_rank: body.show_message_rank }),
      ...(body.show_voice_rank !== undefined && { show_voice_rank: body.show_voice_rank }),
      ...(body.show_top_channels !== undefined && { show_top_channels: body.show_top_channels }),
      ...(body.show_charts !== undefined && { show_charts: body.show_charts }),
      ...(body.show_1d !== undefined && { show_1d: body.show_1d }),
      ...(body.show_7d !== undefined && { show_7d: body.show_7d }),
      ...(body.show_14d !== undefined && { show_14d: body.show_14d }),
      ...(body.show_30d !== undefined && { show_30d: body.show_30d }),
      ...(body.lookback_days !== undefined && { lookback_days: body.lookback_days }),
      ...(body.timezone !== undefined && { timezone: body.timezone }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      updated_at: new Date().toISOString()
    };

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('stats_config')
        .update(updateData)
        .eq('guild_id', guildId)
        .select()
        .single();

      if (error) {
        console.error('Error updating stats config:', error);
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 });
      }

      return NextResponse.json({ config: data });
    } else {
      // Create new
      const { data, error } = await supabase
        .from('stats_config')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        console.error('Error creating stats config:', error);
        return NextResponse.json({ error: 'Failed to create configuration' }, { status: 500 });
      }

      return NextResponse.json({ config: data });
    }
  } catch (error) {
    console.error('Error in stats API PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

