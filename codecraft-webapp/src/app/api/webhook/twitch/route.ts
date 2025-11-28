import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Twitch EventSub Webhook Endpoint
 * Receives subscriber notifications from Twitch
 * 
 * Docs: https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
 */

// Verify Twitch signature
function verifyTwitchSignature(request: NextRequest, body: string): boolean {
  const messageId = request.headers.get('twitch-eventsub-message-id');
  const timestamp = request.headers.get('twitch-eventsub-message-timestamp');
  const signature = request.headers.get('twitch-eventsub-message-signature');
  
  if (!messageId || !timestamp || !signature) {
    console.error('Missing Twitch headers');
    return false;
  }

  // Check if message is recent (prevent replay attacks)
  const messageTimestamp = new Date(timestamp).getTime();
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  
  if (Math.abs(now - messageTimestamp) > tenMinutes) {
    console.error('Message too old');
    return false;
  }

  // Verify signature
  const secret = process.env.TWITCH_EVENTSUB_SECRET || '';
  const message = messageId + timestamp + body;
  const expectedSignature = 'sha256=' + createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify Twitch signature (disabled for webhook_callback_verification)
    const messageType = request.headers.get('twitch-eventsub-message-type');
    
    console.log('📥 Twitch webhook received');
    console.log('   Message type:', messageType);
    console.log('   Body length:', body.length);
    
    if (messageType !== 'webhook_callback_verification') {
      if (!verifyTwitchSignature(request, body)) {
        console.error('❌ Invalid Twitch signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }

    const event = JSON.parse(body);
    console.log('   Event type:', event?.subscription?.type || 'unknown');

    // Handle different message types
    switch (messageType) {
      case 'webhook_callback_verification':
        // Twitch sends this to verify the webhook endpoint
        console.log('✅ Twitch webhook verification received');
        return new NextResponse(event.challenge, { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });

      case 'notification':
        // Actual event notification
        await handleEventNotification(event);
        return NextResponse.json({ success: true }, { status: 200 });

      case 'revocation':
        // Twitch revoked the subscription
        console.log('⚠️ Twitch EventSub subscription revoked:', event.subscription.id);
        await handleRevocation(event);
        return NextResponse.json({ success: true }, { status: 200 });

      default:
        console.log('❓ Unknown message type:', messageType);
        return NextResponse.json({ success: true }, { status: 200 });
    }
  } catch (error) {
    console.error('Error processing Twitch webhook:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function handleEventNotification(event: any) {
  const subscriptionType = event.subscription.type;
  
  if (subscriptionType === 'channel.subscribe') {
    await handleSubscriberEvent(event);
  } else if (subscriptionType === 'channel.subscription.gift') {
    await handleGiftedSubEvent(event);
  } else {
    console.log('ℹ️ Unhandled subscription type:', subscriptionType);
  }
}

async function handleSubscriberEvent(event: any) {
  try {
    const eventData = event.event;
    console.log('🎉 New subscriber event received:');
    console.log('   Broadcaster:', eventData.broadcaster_user_name);
    console.log('   Subscriber:', eventData.user_name);
    console.log('   Tier:', eventData.tier);
    console.log('   Is Gift:', eventData.is_gift);

    // Find the notification config for this broadcaster
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('stream_notifications')
      .select('*')
      .eq('platform', 'twitch')
      .eq('streamer_id', eventData.broadcaster_user_id)
      .eq('subscriber_notifications_enabled', true)
      .eq('enabled', true)
      .single();

    if (fetchError || !notification) {
      console.log('   ℹ️ No active subscriber notification found for this broadcaster');
      return;
    }

    console.log('   ✅ Found notification config for guild:', notification.guild_id);

    // Store the event in database
    const { data: storedEvent, error: insertError } = await supabaseAdmin
      .from('twitch_subscriber_events')
      .insert({
        notification_id: notification.id,
        guild_id: notification.guild_id,
        twitch_event_id: event.subscription.id + '_' + eventData.user_id,
        broadcaster_id: eventData.broadcaster_user_id,
        broadcaster_name: eventData.broadcaster_user_name,
        subscriber_id: eventData.user_id,
        subscriber_name: eventData.user_name,
        subscriber_display_name: eventData.user_name,
        tier: eventData.tier,
        is_gift: eventData.is_gift || false,
        cumulative_months: eventData.cumulative_months || 1,
        streak_months: eventData.streak_months || 1,
        subscribed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('   ❌ Error storing subscriber event:', insertError);
      
      // Check if it's a duplicate event
      if (insertError.code === '23505') {
        console.log('   ℹ️ Duplicate event, skipping notification');
        return;
      }
      return;
    }

    console.log('   💾 Event stored in database');

    // Send notification via webhook to bot
    await sendSubscriberNotificationToBot(notification, eventData, storedEvent.id);

    // Update stats
    await supabaseAdmin
      .from('stream_notifications')
      .update({
        total_subscriber_notifications_sent: (notification.total_subscriber_notifications_sent || 0) + 1,
        last_subscriber_notification_sent: new Date().toISOString(),
      })
      .eq('id', notification.id);

    console.log('   ✅ Subscriber notification processed successfully');
  } catch (error) {
    console.error('Error handling subscriber event:', error);
  }
}

async function handleGiftedSubEvent(event: any) {
  try {
    const eventData = event.event;
    console.log('🎁 New gifted subscription event received:');
    console.log('   Broadcaster:', eventData.broadcaster_user_name);
    console.log('   Gifter:', eventData.user_name || 'Anonymous');
    console.log('   Total gifts:', eventData.total);
    console.log('   Tier:', eventData.tier);
    console.log('   Is anonymous:', eventData.is_anonymous || false);

    // Find the notification config for this broadcaster
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('stream_notifications')
      .select('*')
      .eq('platform', 'twitch')
      .eq('streamer_id', eventData.broadcaster_user_id)
      .eq('subscriber_notifications_enabled', true)
      .eq('enabled', true)
      .single();

    if (fetchError || !notification) {
      console.log('   ℹ️ No active subscriber notification found for this broadcaster');
      return;
    }

    console.log('   ✅ Found notification config for guild:', notification.guild_id);

    // Store the gifted sub event in database
    const { data: storedEvent, error: insertError } = await supabaseAdmin
      .from('twitch_subscriber_events')
      .insert({
        notification_id: notification.id,
        guild_id: notification.guild_id,
        twitch_event_id: event.subscription.id + '_gift_' + (eventData.user_id || 'anonymous') + '_' + Date.now(),
        broadcaster_id: eventData.broadcaster_user_id,
        broadcaster_name: eventData.broadcaster_user_name,
        subscriber_id: null, // Gifted sub events don't have individual subscriber IDs
        subscriber_name: null,
        subscriber_display_name: null,
        tier: eventData.tier,
        is_gift: true,
        gifter_user_id: eventData.user_id || null,
        gifter_user_name: eventData.user_login || null,
        gifter_display_name: eventData.user_name || 'Anonymous',
        total_gifts: eventData.total,
        is_anonymous: eventData.is_anonymous || false,
        cumulative_months: 1, // Gifted subs start at 1 month
        streak_months: 1,
        subscribed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('   ❌ Error storing gifted sub event:', insertError);
      
      // Check if it's a duplicate event
      if (insertError.code === '23505') {
        console.log('   ℹ️ Duplicate event, skipping notification');
        return;
      }
      return;
    }

    console.log('   💾 Gifted sub event stored in database');

    // Send notification via webhook to bot
    await sendGiftedSubNotificationToBot(notification, eventData, storedEvent.id);

    // Update stats
    await supabaseAdmin
      .from('stream_notifications')
      .update({
        total_subscriber_notifications_sent: (notification.total_subscriber_notifications_sent || 0) + eventData.total,
        last_subscriber_notification_sent: new Date().toISOString(),
      })
      .eq('id', notification.id);

    console.log('   ✅ Gifted sub notification processed successfully');
  } catch (error) {
    console.error('Error handling gifted sub event:', error);
  }
}

async function sendGiftedSubNotificationToBot(notification: any, eventData: any, eventId: string) {
  try {
    // Send webhook to Discord bot
    const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
    
    if (!botWebhookUrl) {
      console.log('   ⚠️ BOT_WEBHOOK_URL not configured, skipping bot notification');
      return;
    }

    const response = await fetch(`${botWebhookUrl}/api/twitch/gifted-subscriber`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
      },
      body: JSON.stringify({
        data: {
          event_id: eventId,
          notification_id: notification.id,
          guild_id: notification.guild_id,
          channel_id: notification.channel_id,
          subscriber_channel_id: notification.subscriber_channel_id, // Optional custom channel
          role_to_ping: notification.role_to_ping,
          message_template: notification.gifted_sub_message_template || '🎁 {gifter} just gifted {amount} sub(s)!',
          broadcaster_name: eventData.broadcaster_user_name,
          gifter_id: eventData.user_id || null,
          gifter_name: eventData.user_name || 'Anonymous',
          gifter_display_name: eventData.user_name || 'Anonymous',
          total_gifts: eventData.total,
          tier: eventData.tier,
          is_anonymous: eventData.is_anonymous || false,
        }
      })
    });

    if (response.ok) {
      console.log('   ✅ Gifted sub notification sent to Discord bot');
    } else {
      const errorText = await response.text();
      console.error('   ❌ Failed to send gifted sub notification to bot:', response.status, errorText);
    }
  } catch (error) {
    console.error('   ❌ Error sending gifted sub notification to bot:', error);
  }
}

async function sendSubscriberNotificationToBot(notification: any, eventData: any, eventId: string) {
  try {
    // Send webhook to Discord bot
    const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
    
    if (!botWebhookUrl) {
      console.log('   ⚠️ BOT_WEBHOOK_URL not configured, skipping bot notification');
      return;
    }

    const response = await fetch(`${botWebhookUrl}/api/twitch/subscriber`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
      },
      body: JSON.stringify({
        data: {
          event_id: eventId,
          notification_id: notification.id,
          guild_id: notification.guild_id,
          channel_id: notification.channel_id,
          subscriber_channel_id: notification.subscriber_channel_id, // Optional custom channel
          role_to_ping: notification.role_to_ping,
          message_template: notification.subscriber_message_template,
          broadcaster_name: eventData.broadcaster_user_name,
          subscriber_name: eventData.user_name,
          subscriber_display_name: eventData.user_name,
          tier: eventData.tier,
          is_gift: eventData.is_gift || false,
          cumulative_months: eventData.cumulative_months || 1,
          streak_months: eventData.streak_months || 1,
        }
      })
    });

    if (response.ok) {
      console.log('   ✅ Notification sent to Discord bot');
    } else {
      const errorText = await response.text();
      console.error('   ❌ Failed to send notification to bot:', response.status, errorText);
    }
  } catch (error) {
    console.error('   ❌ Error sending notification to bot:', error);
  }
}

async function handleRevocation(event: any) {
  try {
    const subscriptionId = event.subscription.id;
    
    // Update the notification to mark subscription as revoked
    await supabaseAdmin
      .from('stream_notifications')
      .update({
        eventsub_subscription_status: 'revoked',
        eventsub_subscription_id: null,
      })
      .eq('eventsub_subscription_id', subscriptionId);

    console.log('✅ Marked subscription as revoked in database');
  } catch (error) {
    console.error('Error handling revocation:', error);
  }
}

