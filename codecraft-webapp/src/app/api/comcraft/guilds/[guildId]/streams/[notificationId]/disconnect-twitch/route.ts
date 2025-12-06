import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Disconnect Twitch Account
 * Revokes tokens and removes Twitch connection from notification
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string; notificationId: string }> }
) {

  const { guildId, notificationId } = await params;

  try {

    console.log('🔌 Disconnecting Twitch for notification:', notificationId);

    // Get notification with tokens
    const { data: notification, error: fetchError } = await supabaseAdmin
      .from('stream_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('guild_id', guildId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Revoke access token at Twitch (if exists)
    if (notification.twitch_access_token) {
      try {
        const revokeResponse = await fetch('https://id.twitch.tv/oauth2/revoke', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.TWITCH_CLIENT_ID!,
            token: notification.twitch_access_token,
          }),
        });

        if (revokeResponse.ok) {
          console.log('   ✅ Access token revoked at Twitch');
        } else {
          console.warn('   ⚠️ Could not revoke access token:', revokeResponse.status);
        }
      } catch (error: any) {
        console.warn('   ⚠️ Could not revoke access token:', error.message);
        // Continue anyway - we'll remove tokens from database
      }
    }

    // Disable subscriber notifications (which will also remove EventSub subscriptions)
    if (notification.subscriber_notifications_enabled) {
      console.log('   🔕 Disabling subscriber notifications...');
      
      // Call the bot to disable EventSub
      const botWebhookUrl = process.env.BOT_WEBHOOK_URL;
      if (botWebhookUrl) {
        try {
          await fetch(`${botWebhookUrl}/api/twitch/disable-subscriber-notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
            },
            body: JSON.stringify({
              data: {
                notification_id: notificationId,
                guild_id: guildId,
                eventsub_subscription_id: notification.eventsub_subscription_id,
                eventsub_gift_subscription_id: notification.eventsub_gift_subscription_id,
              },
            }),
          });
          console.log('   ✅ EventSub subscriptions disabled');
        } catch (error: any) {
          console.warn('   ⚠️ Could not disable EventSub:', error.message);
        }
      }
    }

    // Remove Twitch data from notification
    const { error: updateError } = await supabaseAdmin
      .from('stream_notifications')
      .update({
        twitch_user_id: null,
        twitch_access_token: null,
        twitch_refresh_token: null,
        twitch_token_expires_at: null,
        twitch_connected_at: null,
        twitch_display_name: null,
        subscriber_notifications_enabled: false,
        eventsub_subscription_id: null,
        eventsub_subscription_status: null,
        eventsub_gift_subscription_id: null,
      })
      .eq('id', notificationId);

    if (updateError) {
      console.error('   ❌ Error updating notification:', updateError);
      return NextResponse.json(
        { error: 'Failed to disconnect Twitch' },
        { status: 500 }
      );
    }

    console.log('✅ Twitch disconnected successfully');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error disconnecting Twitch:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

