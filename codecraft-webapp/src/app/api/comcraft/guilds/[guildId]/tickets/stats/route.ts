/**
 * API Route: Ticket Statistics
 * /api/comcraft/guilds/[guildId]/tickets/stats
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
 * GET - Comprehensive ticket statistics
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

    // Get all tickets
    const { data: allTickets } = await supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId);

    if (!allTickets) {
      return NextResponse.json({ 
        error: 'Failed to fetch tickets' 
      }, { status: 500 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Basic counts
    const totalTickets = allTickets.length;
    const openTickets = allTickets.filter(t => t.status === 'open').length;
    const claimedTickets = allTickets.filter(t => t.status === 'claimed').length;
    const closedTickets = allTickets.filter(t => t.status === 'closed' || t.status === 'resolved').length;

    // 30 day stats
    const last30Days = allTickets.filter(t => new Date(t.created_at) > thirtyDaysAgo);
    const closedLast30Days = last30Days.filter(t => t.status === 'closed' || t.status === 'resolved');

    // Average resolution time (in hours)
    const closedWithTime = closedLast30Days.filter(t => t.closed_at);
    const avgResolutionTime = closedWithTime.length > 0
      ? closedWithTime.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const closed = new Date(t.closed_at!).getTime();
          return sum + (closed - created);
        }, 0) / closedWithTime.length / (1000 * 60 * 60) // Convert to hours
      : 0;

    // Average response time (time to claim)
    const claimedWithTime = allTickets.filter(t => t.claimed_at);
    const avgResponseTime = claimedWithTime.length > 0
      ? claimedWithTime.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const claimed = new Date(t.claimed_at!).getTime();
          return sum + (claimed - created);
        }, 0) / claimedWithTime.length / (1000 * 60) // Convert to minutes
      : 0;

    // Tickets by priority
    const priorityCounts = {
      low: allTickets.filter(t => t.priority === 'low').length,
      normal: allTickets.filter(t => t.priority === 'normal').length,
      high: allTickets.filter(t => t.priority === 'high').length,
      urgent: allTickets.filter(t => t.priority === 'urgent').length,
    };

    // Top staff members (by tickets handled)
    const staffStats = allTickets
      .filter(t => t.claimed_by_discord_id)
      .reduce((acc, ticket) => {
        const staffId = ticket.claimed_by_discord_id!;
        if (!acc[staffId]) {
          acc[staffId] = {
            discord_id: staffId,
            username: ticket.claimed_by_username || 'Unknown',
            tickets_handled: 0,
            tickets_closed: 0,
          };
        }
        acc[staffId].tickets_handled++;
        if (ticket.status === 'closed' || ticket.status === 'resolved') {
          acc[staffId].tickets_closed++;
        }
        return acc;
      }, {} as Record<string, any>);

    const topStaff = Object.values(staffStats)
      .sort((a: any, b: any) => b.tickets_handled - a.tickets_handled)
      .slice(0, 10);

    // Tickets over time (last 30 days, grouped by day)
    const ticketsOverTime = last30Days.reduce((acc, ticket) => {
      const date = new Date(ticket.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get ratings
    const { data: ratings } = await supabase
      .from('ticket_ratings')
      .select('rating')
      .in('ticket_id', allTickets.map(t => t.id));

    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : null;

    return NextResponse.json({
      overview: {
        total: totalTickets,
        open: openTickets,
        claimed: claimedTickets,
        closed: closedTickets,
        last30Days: last30Days.length,
      },
      performance: {
        avgResolutionTimeHours: Math.round(avgResolutionTime * 10) / 10,
        avgResponseTimeMinutes: Math.round(avgResponseTime * 10) / 10,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        totalRatings: ratings?.length || 0,
      },
      priority: priorityCounts,
      topStaff,
      ticketsOverTime,
    });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Error in tickets stats GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

