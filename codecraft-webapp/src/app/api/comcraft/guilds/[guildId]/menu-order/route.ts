/**
 * API Route: Dashboard Menu Order
 * /api/comcraft/guilds/[guildId]/menu-order
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGuildAccess } from '@/lib/comcraft/access-control';

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

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get menu order from guild config
    const { data: config, error } = await supabase
      .from('guild_configs')
      .select('menu_order')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error('Error fetching menu order:', error);
      return NextResponse.json({ error: 'Failed to fetch menu order' }, { status: 500 });
    }

    return NextResponse.json({ 
      menuOrder: config?.menu_order || null 
    });
  } catch (error: any) {
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

    const access = await getGuildAccess(guildId, discordId);
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { menuOrder } = body;

    if (!Array.isArray(menuOrder)) {
      return NextResponse.json({ error: 'menuOrder must be an array' }, { status: 400 });
    }

    // Update menu order in guild config
    const { error } = await supabase
      .from('guild_configs')
      .update({ menu_order: menuOrder })
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error updating menu order:', error);
      return NextResponse.json({ error: 'Failed to update menu order' }, { status: 500 });
    }

    return NextResponse.json({ success: true, menuOrder });
  } catch (error: any) {
    console.error('Error in menu order PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

