/**
 * API Route: Ticket Categories Management
 * /api/comcraft/guilds/[guildId]/tickets/categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

async function assertAccess(guildId: string, discordId: string) {
  const { data: guild } = await supabase
    .from('guild_configs')
    .select('owner_discord_id')
    .eq('guild_id', guildId)
    .single();

  if (!guild) {
    throw NextResponse.json({ error: 'Guild not found' }, { status: 404 });
  }

  if (guild.owner_discord_id === discordId) {
    return true;
  }

  const { data: authorized } = await supabase
    .from('guild_authorized_users')
    .select('role')
    .eq('guild_id', guildId)
    .eq('discord_id', discordId)
    .maybeSingle();

  if (authorized) {
    return true;
  }

  const { data: user } = await supabase
    .from('users')
    .select('is_admin')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (user?.is_admin) {
    return true;
  }

  throw NextResponse.json({ error: 'Access denied' }, { status: 403 });
}

/**
 * GET - Fetch all ticket categories for a guild
 */
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

    await assertAccess(guildId, discordId);

    const { data: categories, error } = await supabase
      .from('ticket_categories')
      .select('*')
      .eq('guild_id', guildId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching ticket categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    return NextResponse.json({
      categories: categories || []
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket categories GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Create a new ticket category
 */
export async function POST(
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

    await assertAccess(guildId, discordId);

    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const categoryData: any = {
      guild_id: guildId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      emoji: body.emoji?.trim() || null,
      category_channel_id: body.categoryChannelId || null,
      support_role_id: body.supportRoleId || null,
      auto_response: body.autoResponse?.trim() || null,
      is_active: typeof body.isActive === 'boolean' ? body.isActive : true,
      required_role_ids: Array.isArray(body.requiredRoleIds) && body.requiredRoleIds.length > 0
        ? body.requiredRoleIds.filter((id: unknown) => typeof id === 'string' && id.trim())
        : null,
    };

    const { data, error } = await supabase
      .from('ticket_categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      console.error('Error creating ticket category:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket categories POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

