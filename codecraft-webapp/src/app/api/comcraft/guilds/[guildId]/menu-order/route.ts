/**
 * API Route: Dashboard Menu Order
 * /api/comcraft/guilds/[guildId]/menu-order
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function getGuildAccess(guildId: string, discordId: string) {
  // Check if user has access to this guild
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) {
    throw NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id !== discordId) {
    throw NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return true;
}

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

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    await getGuildAccess(params.guildId, discordId);

    // Get menu order from guild config
    const { data: config, error } = await supabase
      .from('guild_configs')
      .select('menu_order')
      .eq('guild_id', params.guildId)
      .single();

    if (error) {
      console.error('Error fetching menu order:', error);
      return NextResponse.json({ error: 'Failed to fetch menu order' }, { status: 500 });
    }

    return NextResponse.json({ 
      menuOrder: config?.menu_order || null 
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in menu order GET:', error);
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

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    await getGuildAccess(params.guildId, discordId);

    const body = await request.json();
    const { menuOrder } = body;

    if (!Array.isArray(menuOrder)) {
      return NextResponse.json({ error: 'menuOrder must be an array' }, { status: 400 });
    }

    // Update menu order in guild config
    const { error } = await supabase
      .from('guild_configs')
      .update({ menu_order: menuOrder })
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error updating menu order:', error);
      return NextResponse.json({ error: 'Failed to update menu order' }, { status: 500 });
    }

    return NextResponse.json({ success: true, menuOrder });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in menu order PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

