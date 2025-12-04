/**
 * API Route: Voice Chat Role Configuration
 * /api/comcraft/guilds/[guildId]/voice-chat-role
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    // Get voice chat role config
    const { data: config, error } = await supabase
      .from('voice_chat_role_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching voice chat role config:', error);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    // If no config exists, return default
    if (!config) {
      return NextResponse.json({
        success: true,
        config: {
          enabled: false,
          role_id: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      config: {
        enabled: config.enabled || false,
        role_id: config.role_id || null
      }
    });
  } catch (error) {
    console.error('Error in voice chat role config API:', error);
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
      guild_id: guildId,
      enabled: body.enabled || false,
      role_id: body.role_id || null,
      updated_at: new Date().toISOString()
    };

    // Upsert config
    const { error: upsertError } = await supabase
      .from('voice_chat_role_config')
      .upsert(updateData, {
        onConflict: 'guild_id'
      });

    if (upsertError) {
      console.error('Error saving voice chat role config:', upsertError);
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in voice chat role config update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

