/**
 * API Route: Single Event Management
 * /api/comcraft/guilds/[guildId]/events/[eventId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Get single event
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

    const { data: event, error } = await supabase
      .from('events')
      .select('*, event_rsvps(*)')
      .eq('id', eventId)
      .single();

    if (error) {
      console.error('Error fetching event:', error);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error in get event API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update event
export async function PATCH(
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
    const body = await request.json();

    const { data: event, error } = await supabase
      .from('events')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Error updating event:', error);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    // If event is being published or was just published, send announcement (fire and forget)
    if (body.is_published && event.is_published) {
      // Don't await - fire and forget to avoid blocking the response
      const botApiUrl = process.env.COMCRAFT_BOT_API_URL || process.env.BOT_API_URL || 'http://localhost:3002';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      fetch(`${botApiUrl}/api/events/${eventId}/announce`, {
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
    console.error('Error in update event API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete event
export async function DELETE(
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

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete event API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

