/**
 * API Route: Events Management
 * /api/comcraft/guilds/[guildId]/events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Get all events for a guild
export async function GET(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get('upcoming') === 'true';
    const active = searchParams.get('active') !== 'false';

    let query = supabase
      .from('events')
      .select('*, event_rsvps(*)')
      .eq('guild_id', guildId);

    if (active) {
      query = query.eq('is_active', true);
    }

    if (upcoming) {
      query = query.gte('start_time', new Date().toISOString());
    }

    query = query.order('start_time', { ascending: true });

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      events: events || []
    });
  } catch (error) {
    console.error('Error in events API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new event
export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // @ts-ignore
    const discordId = session.user.discordId || session.user.id || session.user.sub;

    const { guildId } = params;
    const body = await request.json();

    const {
      title,
      description,
      event_type,
      start_time,
      end_time,
      timezone,
      location,
      channel_id,
      voice_channel_id,
      image_url,
      color,
      max_participants,
      is_recurring,
      recurrence_pattern,
      recurrence_end_date,
      requires_rsvp,
      rsvp_deadline,
      auto_remind,
      reminder_times,
      role_mentions,
      role_requirements,
      auto_create_voice,
      auto_delete_after_end,
      is_published
    } = body;

    if (!title || !start_time) {
      return NextResponse.json({ error: 'Title and start_time are required' }, { status: 400 });
    }

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        guild_id: guildId,
        title,
        description,
        event_type: event_type || 'general',
        start_time,
        end_time,
        timezone: timezone || 'UTC',
        location,
        channel_id,
        voice_channel_id,
        image_url,
        color: color || '#5865F2',
        max_participants,
        is_recurring: is_recurring || false,
        recurrence_pattern,
        recurrence_end_date,
        requires_rsvp: requires_rsvp !== undefined ? requires_rsvp : true,
        rsvp_deadline,
        auto_remind: auto_remind !== undefined ? auto_remind : true,
        reminder_times: reminder_times || [60, 15],
        role_mentions: role_mentions || [],
        role_requirements: role_requirements || [],
        auto_create_voice: auto_create_voice || false,
        auto_delete_after_end: auto_delete_after_end || false,
        is_published: is_published !== undefined ? is_published : true,
        created_by: discordId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating event:', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    // If event is published, send announcement via bot API (fire and forget)
    if (event.is_published) {
      // Don't await - fire and forget to avoid blocking the response
      const botApiUrl = process.env.COMCRAFT_BOT_API_URL || process.env.BOT_API_URL || 'http://localhost:3002';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      fetch(`${botApiUrl}/api/events/${event.id}/announce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
        },
        signal: controller.signal
      })
        .then(() => clearTimeout(timeoutId))
        .catch((error) => {
          clearTimeout(timeoutId);
          // Silently handle errors - don't block the response
          if (error.name !== 'AbortError') {
            console.error('Error calling bot API for event announcement:', error.message);
          }
        });
    }

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error in create event API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

