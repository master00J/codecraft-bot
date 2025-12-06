/**
 * API Route: Individual Ticket Actions
 * /api/comcraft/guilds/[guildId]/tickets/[ticketId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;
const COMCRAFT_BOT_API = process.env.COMCRAFT_BOT_API_URL || 'http://localhost:25836';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

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
 * GET - Fetch single ticket with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; ticketId: string }> }
) {
  const { guildId, ticketId } = await params;

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

    // Get ticket
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('guild_id', guildId)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Get messages
    const { data: messages } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    // Get rating if exists
    const { data: rating } = await supabase
      .from('ticket_ratings')
      .select('*')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    return NextResponse.json({
      ticket,
      messages: messages || [],
      rating: rating || null
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH - Update ticket (claim, close, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; ticketId: string }> }
) {
  const { guildId, ticketId } = await params;

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
    const action = body.action as string;

    // Get ticket first
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('guild_id', guildId)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    let updates: Record<string, any> = {};

    switch (action) {
      case 'claim':
        if (ticket.status !== 'open') {
          return NextResponse.json({ error: 'Ticket already claimed or closed' }, { status: 400 });
        }
        updates = {
          status: 'claimed',
          claimed_by_discord_id: discordId,
          claimed_by_username: session.user?.name || 'Dashboard User',
          claimed_at: new Date().toISOString()
        };
        break;

      case 'close':
        if (ticket.status === 'closed' || ticket.status === 'resolved') {
          return NextResponse.json({ error: 'Ticket already closed' }, { status: 400 });
        }
        updates = {
          status: 'closed',
          closed_by_discord_id: discordId,
          closed_by_username: session.user?.name || 'Dashboard User',
          closed_at: new Date().toISOString(),
          close_reason: body.reason || 'Closed from dashboard'
        };
        break;

      case 'reopen':
        if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
          return NextResponse.json({ error: 'Ticket is not closed' }, { status: 400 });
        }
        updates = {
          status: 'open',
          closed_by_discord_id: null,
          closed_by_username: null,
          closed_at: null,
          close_reason: null
        };
        break;

      case 'update_priority':
        if (!['low', 'normal', 'high', 'urgent'].includes(body.priority)) {
          return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
        }
        updates = {
          priority: body.priority
        };
        break;

      case 'archive':
        if (ticket.archived) {
          return NextResponse.json({ error: 'Ticket already archived' }, { status: 400 });
        }
        // Get user ID from discord_id
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('discord_id', discordId)
          .maybeSingle();
        
        updates = {
          archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user?.id || null
        };
        break;

      case 'unarchive':
        if (!ticket.archived) {
          return NextResponse.json({ error: 'Ticket is not archived' }, { status: 400 });
        }
        updates = {
          archived: false,
          archived_at: null,
          archived_by: null
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update ticket
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
    }

    // If closing via dashboard, notify bot to close the Discord channel
    if (action === 'close' && INTERNAL_SECRET && ticket.discord_channel_id) {
      try {
        const botResponse = await fetch(`${COMCRAFT_BOT_API}/internal/tickets/${ticketId}/close`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_SECRET
          },
          body: JSON.stringify({
            guildId: guildId,
            channelId: ticket.discord_channel_id,
            reason: body.reason || 'Closed from dashboard',
            closedBy: discordId,
            closedByUsername: session.user?.name || 'Dashboard User'
          })
        });

        if (!botResponse.ok) {
          console.error('Bot API error closing ticket:', await botResponse.text());
          // Continue anyway - database is already updated
        }
      } catch (err) {
        console.error('Error notifying bot to close ticket:', err);
        // Continue anyway - database is already updated
      }
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Soft delete ticket (sets deleted_at timestamp)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; ticketId: string }> }
) {
  const { guildId, ticketId } = await params;

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

    // Get ticket first
    const { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('guild_id', guildId)
      .single();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.deleted_at) {
      return NextResponse.json({ error: 'Ticket already deleted' }, { status: 400 });
    }

    // Get user ID from discord_id
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    // Soft delete: set deleted_at timestamp
    const { error } = await supabase
      .from('tickets')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting ticket:', error);
      return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in ticket DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

