/**
 * API Route: Sync Historical Messages for a Ticket
 * /api/comcraft/guilds/[guildId]/tickets/[ticketId]/sync-messages
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
 * POST - Sync historical messages from Discord channel to database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; ticketId: string }> }
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

    await assertAccess(params.guildId, discordId);

    // Get ticket to verify it exists and get channel ID
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', params.ticketId)
      .eq('guild_id', params.guildId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (!ticket.discord_channel_id) {
      return NextResponse.json({ error: 'Ticket has no Discord channel' }, { status: 400 });
    }

    // Call bot API to sync messages
    if (!INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Internal API secret not configured' }, { status: 500 });
    }

    try {
      const response = await fetch(`${COMCRAFT_BOT_API}/internal/tickets/${params.ticketId}/sync-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET
        },
        body: JSON.stringify({
          guildId: params.guildId,
          channelId: ticket.discord_channel_id
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error: error || 'Failed to sync messages' }, { status: response.status });
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error: any) {
      console.error('Error calling bot API:', error);
      return NextResponse.json({ 
        error: 'Failed to connect to bot API. Make sure the bot is running and INTERNAL_API_SECRET is configured.' 
      }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in sync-messages POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

