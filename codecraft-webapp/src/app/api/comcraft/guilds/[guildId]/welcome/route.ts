/**
 * API Route: Welcome System Configuration
 * /api/comcraft/guilds/[guildId]/welcome
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

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

    const { guildId } = params;

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    // Check guild access
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guild.owner_discord_id === discordId;
    
    const { data: authorized } = await supabase
      .from('authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('user_id', discordId)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    const isPlatformAdmin = user?.is_admin === true;

    if (!isOwner && !authorized && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get welcome config
    const { data: welcomeConfig, error } = await supabase
      .from('welcome_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching welcome config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    // If no config exists, return default
    if (!welcomeConfig) {
      return NextResponse.json({
        success: true,
        config: {
          welcome_enabled: false,
          welcome_embed_enabled: false,
          welcome_embed_color: '#5865F2',
          welcome_embed_fields: [],
          welcome_buttons_enabled: false,
          welcome_buttons: [],
          welcome_dm_enabled: false,
          welcome_dm_embed_enabled: false,
          welcome_dm_embed_color: '#5865F2',
          leave_enabled: false,
          leave_embed_enabled: false,
          leave_embed_color: '#FF0000',
          autorole_enabled: false,
          autorole_ids: [],
          autorole_delay: 0,
          autorole_remove_on_leave: false,
          autorole_ignore_bots: false,
          unverified_role_id: null,
          welcome_delete_after: 0,
          welcome_mention_user: true,
          welcome_mention_roles: [],
          welcome_mention_everyone: false,
          welcome_mention_here: false,
          welcome_stats_enabled: false,
          welcome_show_account_age: false,
          welcome_show_join_position: true,
        }
      });
    }

    return NextResponse.json({
      success: true,
      config: welcomeConfig
    });
  } catch (error) {
    console.error('Error in welcome config API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    // Check guild access
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('owner_discord_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guild.owner_discord_id === discordId;
    
    const { data: authorized } = await supabase
      .from('authorized_users')
      .select('role')
      .eq('guild_id', guildId)
      .eq('user_id', discordId)
      .maybeSingle();

    const { data: user } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .maybeSingle();

    const isPlatformAdmin = user?.is_admin === true;

    if (!isOwner && !authorized && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString()
    };

    // Check if config exists
    const { data: existing } = await supabase
      .from('welcome_configs')
      .select('id')
      .eq('guild_id', guildId)
      .single();

    let result;
    if (existing) {
      // Update existing
      result = await supabase
        .from('welcome_configs')
        .update(updateData)
        .eq('guild_id', guildId);
    } else {
      // Create new
      result = await supabase
        .from('welcome_configs')
        .insert({
          guild_id: guildId,
          ...updateData
        });
    }

    if (result.error) {
      console.error('Error saving welcome config:', result.error);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in welcome config update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

