/**
 * API Route: Individual Ticket Category Actions
 * /api/comcraft/guilds/[guildId]/tickets/categories/[categoryId]
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
 * PATCH - Update a ticket category
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { guildId: string; categoryId: string } }
) {
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

    await assertAccess(params.guildId, discordId);

    const body = await request.json();

    const updates: any = {};

    if (body.name !== undefined) {
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }
    if (body.emoji !== undefined) {
      updates.emoji = body.emoji?.trim() || null;
    }
    if (body.categoryChannelId !== undefined) {
      updates.category_channel_id = body.categoryChannelId || null;
    }
    if (body.supportRoleId !== undefined) {
      updates.support_role_id = body.supportRoleId || null;
    }
    if (body.autoResponse !== undefined) {
      updates.auto_response = body.autoResponse?.trim() || null;
    }
    if (typeof body.isActive === 'boolean') {
      updates.is_active = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const { error } = await supabase
      .from('ticket_categories')
      .update(updates)
      .eq('id', params.categoryId)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error updating ticket category:', error);
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket category PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Delete a ticket category
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { guildId: string; categoryId: string } }
) {
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

    await assertAccess(params.guildId, discordId);

    const { error } = await supabase
      .from('ticket_categories')
      .delete()
      .eq('id', params.categoryId)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error deleting ticket category:', error);
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket category DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

