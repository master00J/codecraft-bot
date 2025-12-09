/**
 * API Route: Guild configuration
 * /api/comcraft/guilds/[guildId]/config
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuildAccess } from '@/lib/comcraft/access-control';

export const dynamic = 'force-dynamic'

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


    // @ts-ignore - Try multiple ways to get Discord ID
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      console.error('No Discord ID found in session:', session.user);
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    console.log('Fetching config for guild:', guildId, 'user:', discordId);

    // Check access using centralized helper
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      console.warn(`[Config API] Access denied for user ${discordId} to guild ${guildId}: ${access.reason}`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get guild config
    const { data: guild, error: guildError } = await supabase
      .from('guild_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (guildError || !guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    // Get leveling config
    const { data: levelingConfig } = await supabase
      .from('leveling_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    // Get moderation config
    const { data: moderationConfig } = await supabase
      .from('moderation_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    // Get welcome config
    const { data: welcomeConfig } = await supabase
      .from('welcome_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    return NextResponse.json({
      guild,
      leveling: levelingConfig,
      moderation: moderationConfig,
      welcome: welcomeConfig
    });
  } catch (error) {
    console.error('Error in guild config API:', error);
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

    const body = await request.json();

    // @ts-ignore - Try multiple ways to get Discord ID
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    if (!discordId) {
      console.error('No Discord ID found in session:', session.user);
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    // Check access using centralized helper
    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      console.warn(`[Config API PATCH] Access denied for user ${discordId} to guild ${guildId}: ${access.reason}`);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify guild exists
    const { data: guild } = await supabase
      .from('guild_configs')
      .select('guild_id')
      .eq('guild_id', guildId)
      .single();

    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    // Update guild config
    const { error } = await supabase
      .from('guild_configs')
      .update(body)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error updating guild config:', error);
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in update config API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

