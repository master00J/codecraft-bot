import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

const supabase = supabaseAdmin;

async function logActivity(guildId: string, userId: string, action: string, details: string) {
  try {
    await supabase.from('activity_logs').insert({
      guild_id: guildId,
      user_id: userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

// GET - Fetch Twitter monitors for guild
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
      .from('twitter_monitors')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ monitors: [], limits: { current: 0, max: 0, tier: 'free' } });
      }
      console.error('Error fetching Twitter monitors:', error);
      return NextResponse.json({ error: 'Failed to fetch monitors' }, { status: 500 });
    }

    // Fetch subscription limits
    const { data: config } = await supabase
      .from('guild_configs')
      .select('subscription_tier')
      .eq('guild_id', guildId)
      .single();

    const tier = config?.subscription_tier || 'free';
    const tierLimits: Record<string, number> = {
      free: 0,
      basic: 2,
      premium: 5,
      enterprise: -1
    };

    const maxMonitors = tierLimits[tier] || 0;
    const currentCount = monitors?.length || 0;

    return NextResponse.json({ 
      monitors: monitors || [],
      limits: {
        current: currentCount,
        max: maxMonitors,
        tier
      }
    });
  } catch (error) {
    console.error('Error in Twitter GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add new Twitter monitor
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

    const userId = session.user?.id || session.user?.sub || 'unknown';
    const body = await request.json();
    const { 
      channel_id, 
      twitter_username, 
      enabled = true,
      include_retweets = false,
      include_replies = false,
      notification_message,
      mention_role_id
    } = body;

    if (!channel_id || !twitter_username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Clean username
    const cleanUsername = twitter_username.replace('@', '').trim();

    // Check if already exists
    const { data: existing } = await supabase
      .from('twitter_monitors')
      .select('id')
      .eq('guild_id', guildId)
      .eq('twitter_username', cleanUsername)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'This Twitter account is already being monitored' }, { status: 400 });
    }

    // Insert new monitor
    const { data: monitor, error } = await supabase
      .from('twitter_monitors')
      .insert({
        guild_id: guildId,
        channel_id,
        twitter_username: cleanUsername,
        enabled,
        include_retweets,
        include_replies,
        notification_message,
        mention_role_id
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding Twitter monitor:', error);
      return NextResponse.json({ error: 'Failed to add monitor' }, { status: 500 });
    }

    await logActivity(
      guildId,
      userId,
      'twitter_monitor_added',
      `Added Twitter monitor for @${cleanUsername}`
    );

    return NextResponse.json({ monitor });
  } catch (error) {
    console.error('Error in Twitter POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update Twitter monitor
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

    const userId = session.user?.id || session.user?.sub || 'unknown';
    const body = await request.json();
    const { monitor_id, ...updates } = body;

    if (!monitor_id) {
      return NextResponse.json({ error: 'Missing monitor_id' }, { status: 400 });
    }

    const { data: monitor, error } = await supabase
      .from('twitter_monitors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', monitor_id)
      .eq('guild_id', guildId)
      .select()
      .single();

    if (error) {
      console.error('Error updating Twitter monitor:', error);
      return NextResponse.json({ error: 'Failed to update monitor' }, { status: 500 });
    }

    await logActivity(
      guildId,
      userId,
      'twitter_monitor_updated',
      `Updated Twitter monitor for @${monitor.twitter_username}`
    );

    return NextResponse.json({ monitor });
  } catch (error) {
    console.error('Error in Twitter PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove Twitter monitor
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user?.id || session.user?.sub || 'unknown';
    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get('monitorId');
    const guildId = searchParams.get('guildId');

    if (!monitorId || !guildId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Get monitor info before deleting
    const { data: monitor } = await supabase
      .from('twitter_monitors')
      .select('twitter_username')
      .eq('id', monitorId)
      .eq('guild_id', guildId)
      .single();

    const { error } = await supabase
      .from('twitter_monitors')
      .delete()
      .eq('id', monitorId)
      .eq('guild_id', guildId);

    if (error) {
      console.error('Error deleting Twitter monitor:', error);
      return NextResponse.json({ error: 'Failed to delete monitor' }, { status: 500 });
    }

    if (monitor) {
      await logActivity(
        guildId,
        userId,
        'twitter_monitor_deleted',
        `Deleted Twitter monitor for @${monitor.twitter_username}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in Twitter DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
