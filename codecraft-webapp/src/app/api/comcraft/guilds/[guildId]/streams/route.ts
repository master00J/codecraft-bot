/**
 * API Route: Stream notifications management
 * /api/comcraft/guilds/[guildId]/streams
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

/**
 * Log activity to database
 */
async function logActivity(data: any) {
  try {
    await supabase.from('activity_logs').insert(data);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

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

    const { data: streams, error } = await supabase
      .from('stream_notifications')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching streams:', error);
      return NextResponse.json({ error: 'Failed to fetch streams' }, { status: 500 });
    }

    return NextResponse.json({ streams: streams || [] });
  } catch (error) {
    console.error('Error in streams API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { guildId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = params;
    const body = await request.json();

    // @ts-ignore
    const actorId = session.user.discordId || session.user.id || session.user.sub;
    const actorName = session.user.name || 'Unknown';

    // Check subscription limit
    const { data: config } = await supabase
      .from('guild_configs')
      .select('subscription_tier')
      .eq('guild_id', guildId)
      .single();

    const tier = config?.subscription_tier || 'free';
    
    // Get tier limits from database
    const { data: tierConfig } = await supabase
      .from('subscription_tiers')
      .select('limits')
      .eq('tier_name', tier)
      .eq('is_active', true)
      .single();

    const limits = tierConfig?.limits || { stream_notifications: 1 };
    const maxStreams = limits.stream_notifications || 1;

    // Count existing streams
    const { count: streamCount } = await supabase
      .from('stream_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);

    // Check if limit reached (-1 means unlimited)
    if (maxStreams !== -1 && (streamCount || 0) >= maxStreams) {
      return NextResponse.json({ 
        error: 'Subscription limit reached',
        message: `You reached your limit (${streamCount}/${maxStreams}). Upgrade to a higher tier for additional stream notifications.`,
        current: streamCount,
        max: maxStreams,
        tier: tier,
        upgradeUrl: 'https://codecraft-solutions.com/products/comcraft'
      }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('stream_notifications')
      .insert({
        guild_id: guildId,
        ...body
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stream notification:', error);
      
      // Log failed attempt
      await logActivity({
        action_type: 'stream.add_failed',
        action_category: 'stream',
        description: `Failed to add stream notification for ${body.streamer_name}`,
        actor_id: actorId,
        actor_name: actorName,
        target_type: 'stream',
        target_name: body.streamer_name,
        guild_id: guildId,
        status: 'failed',
        error_message: error.message,
        metadata: { platform: body.platform }
      });
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log successful creation
    console.log(`✅ [STREAM] ${actorName} added ${body.streamer_name} (${body.platform}) to guild ${guildId}`);
    
    await logActivity({
      action_type: 'stream.added',
      action_category: 'stream',
      description: `Added stream notification for ${body.streamer_name} (${body.platform})`,
      actor_id: actorId,
      actor_name: actorName,
      target_type: 'stream',
      target_id: data.id,
      target_name: body.streamer_name,
      guild_id: guildId,
      status: 'success',
      metadata: {
        platform: body.platform,
        channel_id: body.channel_id,
        message_template: body.message_template
      }
    });

    return NextResponse.json({ success: true, stream: data });
  } catch (error) {
    console.error('Error in create stream API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const streamId = searchParams.get('id');
    const body = await request.json();

    if (!streamId) {
      return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('stream_notifications')
      .update(body)
      .eq('id', streamId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating stream:', error);
      return NextResponse.json({ error: 'Failed to update stream' }, { status: 500 });
    }

    return NextResponse.json({ success: true, stream: data });
  } catch (error) {
    console.error('Error in update stream API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const streamId = searchParams.get('id');

    if (!streamId) {
      return NextResponse.json({ error: 'Stream ID required' }, { status: 400 });
    }

    // @ts-ignore
    const actorId = session.user.discordId || session.user.id || session.user.sub;
    const actorName = session.user.name || 'Unknown';

    // Get stream info before deleting
    const { data: stream } = await supabase
      .from('stream_notifications')
      .select('*')
      .eq('id', streamId)
      .single();

    const { error } = await supabase
      .from('stream_notifications')
      .delete()
      .eq('id', streamId);

    if (error) {
      console.error('Error deleting stream:', error);
      return NextResponse.json({ error: 'Failed to delete stream' }, { status: 500 });
    }

    // Log deletion
    if (stream) {
      console.log(`🗑️ [STREAM] ${actorName} removed ${stream.streamer_name} (${stream.platform}) from guild ${stream.guild_id}`);
      
      await logActivity({
        action_type: 'stream.removed',
        action_category: 'stream',
        description: `Removed stream notification for ${stream.streamer_name} (${stream.platform})`,
        actor_id: actorId,
        actor_name: actorName,
        target_type: 'stream',
        target_id: streamId,
        target_name: stream.streamer_name,
        guild_id: stream.guild_id,
        status: 'success',
        metadata: {
          platform: stream.platform,
          total_notifications_sent: stream.total_notifications_sent
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete stream API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

