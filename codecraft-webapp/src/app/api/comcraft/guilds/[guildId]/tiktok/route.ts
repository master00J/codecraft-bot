/**
 * API Route: TikTok video notifications management
 * /api/comcraft/guilds/[guildId]/tiktok
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
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params;

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: monitors, error } = await supabase
      .from('tiktok_monitors')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ monitors: [] });
      }
      console.error('Error fetching TikTok monitors:', error);
      return NextResponse.json({ error: 'Failed to fetch TikTok monitors' }, { status: 500 });
    }

    return NextResponse.json({ monitors: monitors || [] });
  } catch (error) {
    console.error('Error in TikTok API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const limits = tierConfig?.limits || { tiktok_monitors: 1 };
    const maxMonitors = limits.tiktok_monitors || limits.stream_notifications || 1;

    // Count existing monitors
    const { count: monitorCount } = await supabase
      .from('tiktok_monitors')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId);

    // Check if limit reached (-1 means unlimited)
    if (maxMonitors !== -1 && (monitorCount || 0) >= maxMonitors) {
      return NextResponse.json({ 
        error: 'Subscription limit reached',
        message: `You reached your limit (${monitorCount}/${maxMonitors}). Upgrade to a higher tier for additional TikTok monitors.`,
        current: monitorCount,
        max: maxMonitors,
        tier: tier,
        upgradeUrl: 'https://codecraft-solutions.com/products/comcraft'
      }, { status: 403 });
    }

    // Clean username
    const cleanUsername = (body.tiktok_username || '').replace('@', '').trim();
    if (!cleanUsername) {
      return NextResponse.json({ error: 'TikTok username is required' }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from('tiktok_monitors')
      .select('id')
      .eq('guild_id', guildId)
      .eq('tiktok_username', cleanUsername)
      .single();

    if (existing) {
      return NextResponse.json({ error: `Already monitoring @${cleanUsername}` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tiktok_monitors')
      .insert({
        guild_id: guildId,
        channel_id: body.channel_id,
        tiktok_username: cleanUsername,
        notification_message: body.notification_message || '{username} just posted a new TikTok!',
        ping_role_id: body.ping_role_id || null,
        enabled: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating TikTok monitor:', error);
      
      await logActivity({
        action_type: 'tiktok.add_failed',
        action_category: 'tiktok',
        description: `Failed to add TikTok monitor for @${cleanUsername}`,
        actor_id: actorId,
        actor_name: actorName,
        target_type: 'tiktok_monitor',
        target_name: cleanUsername,
        guild_id: guildId,
        status: 'failed',
        error_message: error.message
      });
      
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log successful creation
    console.log(`✅ [TIKTOK] ${actorName} added @${cleanUsername} to guild ${guildId}`);
    
    await logActivity({
      action_type: 'tiktok.added',
      action_category: 'tiktok',
      description: `Added TikTok monitor for @${cleanUsername}`,
      actor_id: actorId,
      actor_name: actorName,
      target_type: 'tiktok_monitor',
      target_id: data.id,
      target_name: cleanUsername,
      guild_id: guildId,
      status: 'success',
      metadata: {
        channel_id: body.channel_id,
        notification_message: body.notification_message
      }
    });

    return NextResponse.json({ success: true, monitor: data });
  } catch (error) {
    console.error('Error in create TikTok monitor API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
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
    const monitorId = searchParams.get('id');
    const body = await request.json();

    if (!monitorId) {
      return NextResponse.json({ error: 'Monitor ID required' }, { status: 400 });
    }

    // Only allow updating specific fields
    const allowedFields = ['enabled', 'channel_id', 'notification_message', 'ping_role_id'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('tiktok_monitors')
      .update(updateData)
      .eq('id', monitorId)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating TikTok monitor:', error);
      return NextResponse.json({ error: 'Failed to update TikTok monitor' }, { status: 500 });
    }

    return NextResponse.json({ success: true, monitor: data });
  } catch (error) {
    console.error('Error in update TikTok monitor API:', error);
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
    const monitorId = searchParams.get('id');

    if (!monitorId) {
      return NextResponse.json({ error: 'Monitor ID required' }, { status: 400 });
    }

    // @ts-ignore
    const actorId = session.user.discordId || session.user.id || session.user.sub;
    const actorName = session.user.name || 'Unknown';

    // Get monitor info before deleting
    const { data: monitor } = await supabase
      .from('tiktok_monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    const { error } = await supabase
      .from('tiktok_monitors')
      .delete()
      .eq('id', monitorId);

    if (error) {
      console.error('Error deleting TikTok monitor:', error);
      return NextResponse.json({ error: 'Failed to delete TikTok monitor' }, { status: 500 });
    }

    // Log deletion
    if (monitor) {
      console.log(`🗑️ [TIKTOK] ${actorName} removed @${monitor.tiktok_username} from guild ${monitor.guild_id}`);
      
      await logActivity({
        action_type: 'tiktok.removed',
        action_category: 'tiktok',
        description: `Removed TikTok monitor for @${monitor.tiktok_username}`,
        actor_id: actorId,
        actor_name: actorName,
        target_type: 'tiktok_monitor',
        target_id: monitorId,
        target_name: monitor.tiktok_username,
        guild_id: monitor.guild_id,
        status: 'success'
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete TikTok monitor API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
