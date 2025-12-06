/**
 * API Route: Event RSVP
 * /api/comcraft/guilds/[guildId]/events/[eventId]/rsvp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// POST - RSVP to event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; eventId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;
    const discordTag = session.user.name || session.user.email || 'Unknown';

    const { eventId } = params;
    const body = await request.json();
    const { status, notes } = body;

    if (!status || !['going', 'maybe', 'not_going'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get event to check requirements
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check RSVP deadline
    if (event.rsvp_deadline && new Date(event.rsvp_deadline) < new Date()) {
      return NextResponse.json({ error: 'RSVP deadline has passed' }, { status: 400 });
    }

    // Check max participants
    if (event.max_participants && status === 'going') {
      const { count } = await supabase
        .from('event_rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'going');

      if (count && count >= event.max_participants) {
        return NextResponse.json({ error: 'Event is full' }, { status: 400 });
      }
    }

    // Upsert RSVP
    const { data: rsvp, error } = await supabase
      .from('event_rsvps')
      .upsert({
        event_id: eventId,
        user_id: discordId,
        discord_tag: discordTag,
        status: status,
        notes: notes || null,
        rsvp_at: new Date().toISOString()
      }, {
        onConflict: 'event_id,user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating RSVP:', error);
      return NextResponse.json({ error: 'Failed to create RSVP' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rsvp
    });
  } catch (error) {
    console.error('Error in RSVP API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Get RSVPs for event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; eventId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = params;

    const { data: rsvps, error } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('rsvp_at', { ascending: false });

    if (error) {
      console.error('Error fetching RSVPs:', error);
      return NextResponse.json({ error: 'Failed to fetch RSVPs' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rsvps: rsvps || []
    });
  } catch (error) {
    console.error('Error in get RSVPs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

