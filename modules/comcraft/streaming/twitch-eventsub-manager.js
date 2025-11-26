/**
 * Twitch EventSub Manager
 * Manages Twitch EventSub subscriptions for subscriber notifications
 * 
 * Documentation: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelsubscribe
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

class TwitchEventSubManager {
  constructor(twitchMonitor) {
    this.twitchMonitor = twitchMonitor;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.webhookUrl = process.env.TWITCH_WEBHOOK_URL || process.env.PUBLIC_URL + '/api/webhook/twitch';
    this.webhookSecret = process.env.TWITCH_EVENTSUB_SECRET;
  }

  /**
   * Get app access token (client credentials) for EventSub
   * EventSub webhooks require an app access token, not user token
   */
  async getAppAccessToken() {
    try {
      console.log('   🔑 Getting app access token for EventSub...');
      
      const response = await axios.post(
        'https://id.twitch.tv/oauth2/token',
        new URLSearchParams({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      console.log('   ✅ App access token retrieved');
      return response.data.access_token;
    } catch (error) {
      console.error('   ❌ Error getting app access token:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Verify that user has authorized the app (check if Twitch connection exists)
   */
  async verifyUserAuthorization(notificationId) {
    try {
      // Get notification with token
      const { data: notification, error } = await this.supabase
        .from('stream_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        console.error('❌ Notification not found');
        return { authorized: false, notification: null };
      }

      // Check if notification has Twitch connected
      if (!notification.twitch_access_token || !notification.twitch_user_id) {
        console.error('❌ No Twitch account connected to this notification');
        console.log('   ℹ️ User must connect their Twitch account via Dashboard → Streaming → Connect Twitch');
        return { authorized: false, notification: null };
      }

      console.log('   ✅ User authorization verified');
      console.log('   📺 Broadcaster:', notification.twitch_display_name);
      console.log('   🆔 User ID:', notification.twitch_user_id);
      
      return { authorized: true, notification };
    } catch (error) {
      console.error('Error verifying user authorization:', error);
      return { authorized: false, notification: null };
    }
  }

  /**
   * Refresh an expired access token using refresh token
   */
  async refreshNotificationToken(notification) {
    try {
      console.log('   🔄 Refreshing Twitch access token...');

      if (!notification.twitch_refresh_token) {
        console.error('   ❌ No refresh token available');
        return null;
      }

      const response = await axios.post(
        'https://id.twitch.tv/oauth2/token',
        new URLSearchParams({
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: notification.twitch_refresh_token,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      const expiresAtDate = new Date(Date.now() + expires_in * 1000);

      // Update notification with new tokens
      await this.supabase
        .from('stream_notifications')
        .update({
          twitch_access_token: access_token,
          twitch_refresh_token: refresh_token || notification.twitch_refresh_token, // Keep old refresh token if new one not provided
          twitch_token_expires_at: expiresAtDate.toISOString(),
        })
        .eq('id', notification.id);

      console.log('   ✅ Token refreshed successfully');
      return access_token;
    } catch (error) {
      console.error('   ❌ Error refreshing token:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Subscribe to channel.subscribe events for a broadcaster
   */
  async subscribeToChannelSubscribe(broadcasterId, broadcasterName, notificationId) {
    try {
      console.log(`📡 Creating EventSub subscription for ${broadcasterName}...`);

      if (!this.webhookSecret) {
        console.error('❌ TWITCH_EVENTSUB_SECRET not configured!');
        return { success: false, error: 'Webhook secret not configured' };
      }

      // Get app access token (required for EventSub webhooks)
      const token = await this.getAppAccessToken();
      if (!token) {
        return { success: false, error: 'Could not get app access token' };
      }

      const response = await axios.post(
        'https://api.twitch.tv/helix/eventsub/subscriptions',
        {
          type: 'channel.subscribe',
          version: '1',
          condition: {
            broadcaster_user_id: broadcasterId
          },
          transport: {
            method: 'webhook',
            callback: this.webhookUrl,
            secret: this.webhookSecret
          }
        },
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const subscription = response.data.data[0];
      
      console.log(`   ✅ EventSub subscription created!`);
      console.log(`      Subscription ID: ${subscription.id}`);
      console.log(`      Status: ${subscription.status}`);
      console.log(`      Callback URL: ${subscription.transport.callback}`);

      // Update notification with subscription ID
      await this.supabase
        .from('stream_notifications')
        .update({
          eventsub_subscription_id: subscription.id,
          eventsub_subscription_status: subscription.status
        })
        .eq('id', notificationId);

      return {
        success: true,
        subscription
      };
    } catch (error) {
      console.error(`   ❌ Error creating EventSub subscription:`, error.response?.data || error.message);
      
      if (error.response?.data?.message) {
        console.error(`      Twitch error: ${error.response.data.message}`);
      }

      // Check for specific errors
      if (error.response?.status === 409) {
        console.log('   ℹ️ Subscription already exists (continuing anyway)');
        return { success: true, subscription: { id: 'existing', status: 'enabled' } };
      }

      if (error.response?.data?.error === 'Forbidden') {
        console.error('   ⚠️ Your Twitch app may not have the required permissions');
        console.error('      Make sure to use a User Access Token with channel:read:subscriptions scope');
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Subscribe to channel.subscription.gift events for a broadcaster
   */
  async subscribeToChannelSubscriptionGift(broadcasterId, broadcasterName, notificationId) {
    try {
      console.log(`🎁 Creating EventSub subscription for gifted subs (${broadcasterName})...`);

      if (!this.webhookSecret) {
        console.error('❌ TWITCH_EVENTSUB_SECRET not configured!');
        return { success: false, error: 'Webhook secret not configured' };
      }

      // Get app access token (required for EventSub webhooks)
      const token = await this.getAppAccessToken();
      if (!token) {
        return { success: false, error: 'Could not get app access token' };
      }

      const response = await axios.post(
        'https://api.twitch.tv/helix/eventsub/subscriptions',
        {
          type: 'channel.subscription.gift',
          version: '1',
          condition: {
            broadcaster_user_id: broadcasterId
          },
          transport: {
            method: 'webhook',
            callback: this.webhookUrl,
            secret: this.webhookSecret
          }
        },
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const subscription = response.data.data[0];
      
      console.log(`   ✅ Gifted sub EventSub subscription created!`);
      console.log(`      Subscription ID: ${subscription.id}`);
      console.log(`      Status: ${subscription.status}`);

      // Update notification with gifted sub subscription ID
      await this.supabase
        .from('stream_notifications')
        .update({
          eventsub_gift_subscription_id: subscription.id
        })
        .eq('id', notificationId);

      return {
        success: true,
        subscription
      };
    } catch (error) {
      console.error(`   ❌ Error creating gifted sub EventSub subscription:`, error.response?.data || error.message);
      
      if (error.response?.status === 409) {
        console.log('   ℹ️ Gifted sub subscription already exists (continuing anyway)');
        return { success: true, subscription: { id: 'existing', status: 'enabled' } };
      }

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Unsubscribe from EventSub subscription
   */
  async unsubscribe(subscriptionId) {
    try {
      console.log(`🗑️ Deleting EventSub subscription ${subscriptionId}...`);

      const token = await this.twitchMonitor.getAccessToken();
      if (!token) {
        return { success: false, error: 'Could not get Twitch access token' };
      }

      await axios.delete(
        `https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscriptionId}`,
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('   ✅ EventSub subscription deleted');

      return { success: true };
    } catch (error) {
      console.error('   ❌ Error deleting EventSub subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Enable subscriber notifications for a stream notification
   */
  async enableSubscriberNotifications(notificationId) {
    try {
      console.log(`\n🔔 Enabling subscriber notifications for notification ${notificationId}...`);

      // Get notification details
      const { data: notification, error: fetchError } = await this.supabase
        .from('stream_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (fetchError || !notification) {
        console.error('   ❌ Notification not found');
        return { success: false, error: 'Notification not found' };
      }

      console.log(`   📋 Notification: ${notification.streamer_name || 'Not set'}`);

      // Verify user authorization (check if Twitch is connected)
      console.log('   🔐 Verifying user authorization...');
      const { authorized, notification: verifiedNotification } = await this.verifyUserAuthorization(notificationId);
      
      if (!authorized || !verifiedNotification) {
        console.error('   ❌ User has not authorized the app');
        console.log('   ℹ️ User must connect their Twitch account first:');
        console.log('      1. Go to Dashboard → Streaming');
        console.log('      2. Click "Connect Twitch" button');
        console.log('      3. Authorize with the broadcaster\'s Twitch account');
        return { 
          success: false, 
          error: 'No Twitch account connected. Please connect your Twitch account first.' 
        };
      }

      // Streamer ID and name should already be set from OAuth callback
      if (!verifiedNotification.streamer_id) {
        console.error('   ❌ Streamer ID not set (OAuth connection may be incomplete)');
        return { success: false, error: 'Streamer ID not found. Please reconnect your Twitch account.' };
      }

      // Create EventSub subscription for regular subs (using app access token)
      const result = await this.subscribeToChannelSubscribe(
        verifiedNotification.streamer_id,
        verifiedNotification.streamer_name,
        notificationId
      );

      if (!result.success) {
        return result;
      }

      // Also create EventSub subscription for gifted subs (using app access token)
      console.log('   🎁 Setting up gifted sub notifications...');
      const giftResult = await this.subscribeToChannelSubscriptionGift(
        verifiedNotification.streamer_id,
        verifiedNotification.streamer_name,
        notificationId
      );

      if (!giftResult.success) {
        console.warn('   ⚠️ Could not enable gifted sub notifications (continuing anyway)');
      }

      // Enable subscriber notifications in database
      await this.supabase
        .from('stream_notifications')
        .update({
          subscriber_notifications_enabled: true
        })
        .eq('id', notificationId);

      console.log('✅ Subscriber notifications enabled successfully!');
      
      return { success: true };
    } catch (error) {
      console.error('Error enabling subscriber notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable subscriber notifications for a stream notification
   */
  async disableSubscriberNotifications(notificationId) {
    try {
      console.log(`\n🔕 Disabling subscriber notifications for notification ${notificationId}...`);

      // Get notification details
      const { data: notification, error: fetchError } = await this.supabase
        .from('stream_notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (fetchError || !notification) {
        console.error('   ❌ Notification not found');
        return { success: false, error: 'Notification not found' };
      }

      // Delete EventSub subscriptions if they exist
      if (notification.eventsub_subscription_id) {
        await this.unsubscribe(notification.eventsub_subscription_id);
      }

      // Also delete gifted sub subscription
      if (notification.eventsub_gift_subscription_id) {
        console.log('   🎁 Deleting gifted sub subscription...');
        await this.unsubscribe(notification.eventsub_gift_subscription_id);
      }

      // Disable in database
      await this.supabase
        .from('stream_notifications')
        .update({
          subscriber_notifications_enabled: false,
          eventsub_subscription_id: null,
          eventsub_subscription_status: null,
          eventsub_gift_subscription_id: null
        })
        .eq('id', notificationId);

      console.log('✅ Subscriber notifications disabled successfully!');
      
      return { success: true };
    } catch (error) {
      console.error('Error disabling subscriber notifications:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all EventSub subscriptions (for debugging)
   */
  async listSubscriptions() {
    try {
      const token = await this.twitchMonitor.getAccessToken();
      if (!token) {
        console.error('❌ Could not get access token');
        return;
      }

      const response = await axios.get(
        'https://api.twitch.tv/helix/eventsub/subscriptions',
        {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID,
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log('\n📋 Active EventSub Subscriptions:');
      console.log(`   Total: ${response.data.total}`);
      console.log(`   Limit: ${response.data.total_cost}/${response.data.max_total_cost}`);
      
      if (response.data.data.length === 0) {
        console.log('   (none)');
      } else {
        response.data.data.forEach(sub => {
          console.log(`\n   • Type: ${sub.type}`);
          console.log(`     ID: ${sub.id}`);
          console.log(`     Status: ${sub.status}`);
          console.log(`     Callback: ${sub.transport.callback}`);
        });
      }

      return response.data;
    } catch (error) {
      console.error('Error listing subscriptions:', error.response?.data || error.message);
    }
  }
}

module.exports = TwitchEventSubManager;

