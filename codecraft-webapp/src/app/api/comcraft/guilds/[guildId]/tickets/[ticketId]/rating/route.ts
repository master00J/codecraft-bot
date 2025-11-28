import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string; ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = session.user.discordId || session.user.id || session.user.sub;
    if (!discordId) {
      return NextResponse.json({ error: 'No Discord ID in session' }, { status: 400 });
    }

    const body = await request.json();
    const { rating, feedback } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Get ticket to verify ownership
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, guild_id, discord_user_id')
      .eq('id', params.ticketId)
      .eq('guild_id', params.guildId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.discord_user_id !== discordId) {
      return NextResponse.json({ error: 'You can only rate your own tickets' }, { status: 403 });
    }

    // Check if already rated
    const { data: existing } = await supabase
      .from('ticket_ratings')
      .select('id')
      .eq('ticket_id', params.ticketId)
      .eq('discord_user_id', discordId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You have already rated this ticket' }, { status: 400 });
    }

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .maybeSingle();

    // Insert rating
    const { data, error } = await supabase
      .from('ticket_ratings')
      .insert({
        ticket_id: params.ticketId,
        guild_id: params.guildId,
        user_id: userData?.id || null,
        discord_user_id: discordId,
        rating,
        feedback: feedback || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting rating:', error);
      return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 });
    }

    return NextResponse.json({ rating: data });
  } catch (error) {
    console.error('Error in rating POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string; ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('ticket_ratings')
      .select('*')
      .eq('ticket_id', params.ticketId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching rating:', error);
      return NextResponse.json({ error: 'Failed to fetch rating' }, { status: 500 });
    }

    return NextResponse.json({ rating: data || null });
  } catch (error) {
    console.error('Error in rating GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

