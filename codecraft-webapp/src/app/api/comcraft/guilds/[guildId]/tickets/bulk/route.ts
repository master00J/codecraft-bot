/**
 * API Route: Bulk Ticket Operations
 * /api/comcraft/guilds/[guildId]/tickets/bulk
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
 * POST - Bulk archive/delete tickets by category
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
    const { action, categoryId, ticketIds } = body;

    if (!action || !['archive', 'unarchive', 'delete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be archive, unarchive, or delete' }, { status: 400 });
    }

    if (!categoryId && !ticketIds) {
      return NextResponse.json({ error: 'Either categoryId or ticketIds must be provided' }, { status: 400 });
    }

    // Get user ID from discord_id
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    // Build query
    let query = supabase
      .from('tickets')
      .select('id')
      .eq('guild_id', guildId)
      .is('deleted_at', null); // Don't include already deleted tickets

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    } else if (ticketIds && Array.isArray(ticketIds)) {
      query = query.in('id', ticketIds);
    }

    const { data: tickets, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching tickets:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No tickets found to process' });
    }

    const ticketIdsToUpdate = tickets.map(t => t.id);
    const now = new Date().toISOString();

    let updates: Record<string, any> = {
      updated_at: now
    };

    switch (action) {
      case 'archive':
        updates = {
          ...updates,
          archived: true,
          archived_at: now,
          archived_by: user?.id || null
        };
        break;

      case 'unarchive':
        updates = {
          ...updates,
          archived: false,
          archived_at: null,
          archived_by: null
        };
        break;

      case 'delete':
        updates = {
          ...updates,
          deleted_at: now,
          deleted_by: user?.id || null
        };
        break;
    }

    // Update all tickets
    const { error: updateError } = await supabase
      .from('tickets')
      .update(updates)
      .in('id', ticketIdsToUpdate);

    if (updateError) {
      console.error('Error updating tickets:', updateError);
      return NextResponse.json({ error: 'Failed to update tickets' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: ticketIdsToUpdate.length,
      action,
      message: `Successfully ${action}d ${ticketIdsToUpdate.length} ticket(s)`
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in bulk tickets operation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

