/**
 * API Route: Schedule Embeds
 * /api/comcraft/guilds/[guildId]/embeds/schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const supabase = supabaseAdmin;

// GET - Fetch all scheduled embeds
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

    const { data: schedules, error } = await supabase
      .from('scheduled_embeds')
      .select(`
        *,
        embed:saved_embeds(*)
      `)
      .eq('guild_id', params.guildId)
      .order('next_send_at', { ascending: true });

    if (error) {
      console.error('Error fetching schedules:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules || [] });
  } catch (error) {
    console.error('Error in schedule API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create schedule
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

    const body = await request.json();

    const { data: schedule, error } = await supabase
      .from('scheduled_embeds')
      .insert({
        guild_id: params.guildId,
        embed_id: body.embed_id,
        channel_id: body.channel_id,
        schedule_type: body.schedule_type,
        scheduled_for: body.scheduled_for,
        time_of_day: body.time_of_day,
        day_of_week: body.day_of_week,
        day_of_month: body.day_of_month,
        mention_role_id: body.mention_role_id,
        pin_message: body.pin_message || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating schedule:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Cancel schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {

  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 });
    }

    // Mark as cancelled instead of deleting
    const { error } = await supabase
      .from('scheduled_embeds')
      .update({ status: 'cancelled' })
      .eq('id', scheduleId)
      .eq('guild_id', params.guildId);

    if (error) {
      console.error('Error cancelling schedule:', error);
      return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling schedule:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

