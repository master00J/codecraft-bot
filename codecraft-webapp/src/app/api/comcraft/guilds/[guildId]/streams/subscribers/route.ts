/**
 * API Route: Twitch Subscriber notifications
 * /api/comcraft/guilds/[guildId]/streams/subscribers
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const supabase = supabaseAdmin;

/**
 * GET - Fetch subscriber events history for a notification
 * Query params: ?notificationId=xxx
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

    const { guildId } = params;
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');

    let query = supabase
      .from('twitch_subscriber_events')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (notificationId) {
      query = query.eq('notification_id', notificationId);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error fetching subscriber events:', error);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });
  } catch (error) {
    console.error('Error in subscriber events API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Enable subscriber notifications for a stream
 * Body: { notificationId: string, messageTemplate?: string }
 */
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

    const { guildId } = params;
    const body = await request.json();
    const { notificationId, messageTemplate } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    // Verify notification belongs to this guild
    const { data: notification, error: fetchError } = await supabase
      .from('stream_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('guild_id', guildId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Update message template if provided
    const updates: any = {
      subscriber_notifications_enabled: true
    };

    if (messageTemplate) {
      updates.subscriber_message_template = messageTemplate;
    }

    const { error: updateError } = await supabase
      .from('stream_notifications')
      .update(updates)
      .eq('id', notificationId);

    if (updateError) {
      console.error('Error enabling subscriber notifications:', updateError);
      return NextResponse.json({ error: 'Failed to enable notifications' }, { status: 500 });
    }

    // Send webhook to bot to register EventSub subscription
    try {
      const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
      
      if (botWebhookUrl) {
        const response = await fetch(`${botWebhookUrl}/api/twitch/enable-subscriber-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
          },
          body: JSON.stringify({
            data: {
              notification_id: notificationId,
              guild_id: guildId
            }
          })
        });

        if (!response.ok) {
          console.error('Failed to enable subscriber notifications in bot:', await response.text());
        }
      }
    } catch (webhookError) {
      console.error('Failed to notify bot:', webhookError);
      // Don't fail the request if webhook fails
    }

    console.log(`✅ Enabled subscriber notifications for ${notification.streamer_name} in guild ${guildId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Subscriber notifications enabled'
    });
  } catch (error) {
    console.error('Error in enable subscriber notifications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Disable subscriber notifications for a stream
 * Query params: ?notificationId=xxx
 */
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

    const { guildId } = params;
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');

    if (!notificationId) {
      return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
    }

    // Verify notification belongs to this guild
    const { data: notification, error: fetchError } = await supabase
      .from('stream_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('guild_id', guildId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Disable subscriber notifications
    const { error: updateError } = await supabase
      .from('stream_notifications')
      .update({
        subscriber_notifications_enabled: false,
        eventsub_subscription_id: null,
        eventsub_subscription_status: null
      })
      .eq('id', notificationId);

    if (updateError) {
      console.error('Error disabling subscriber notifications:', updateError);
      return NextResponse.json({ error: 'Failed to disable notifications' }, { status: 500 });
    }

    // Send webhook to bot to unregister EventSub subscription
    try {
      const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
      
      if (botWebhookUrl) {
        const response = await fetch(`${botWebhookUrl}/api/twitch/disable-subscriber-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
          },
          body: JSON.stringify({
            data: {
              notification_id: notificationId,
              guild_id: guildId,
              eventsub_subscription_id: notification.eventsub_subscription_id
            }
          })
        });

        if (!response.ok) {
          console.error('Failed to disable subscriber notifications in bot:', await response.text());
        }
      }
    } catch (webhookError) {
      console.error('Failed to notify bot:', webhookError);
      // Don't fail the request if webhook fails
    }

    console.log(`🔕 Disabled subscriber notifications for ${notification.streamer_name} in guild ${guildId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Subscriber notifications disabled'
    });
  } catch (error) {
    console.error('Error in disable subscriber notifications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

