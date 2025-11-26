/**
 * Comcraft Twitch Stream Monitor
 * Monitors Twitch streams and sends notifications
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class TwitchMonitor {
  constructor(client, customBotManager = null, guildId = null) {
    this.client = client;
    this.customBotManager = customBotManager;
    this.guildId = guildId; // If set, only monitor this guild (for custom bots)
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.checkInterval = 60000; // Check every minute
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get Twitch OAuth token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    console.log('🔑 Requesting new Twitch API access token...');

    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
      console.error('❌ Twitch API credentials not configured!');
      console.error('   Please set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables');
      return null;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);

      const expiryMinutes = Math.floor(response.data.expires_in / 60);
      console.log(`✅ Twitch API token received (expires in ${expiryMinutes} minutes)`);

      return this.accessToken;
    } catch (error) {
      console.error('❌ Error getting Twitch access token:', error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('   ⚠️  Invalid Twitch API credentials - check your TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
      }
      return null;
    }
  }

  /**
   * Get stream info by username
   */
  async getStreamByUsername(username) {
    try {
      const token = await this.getAccessToken();
      if (!token) return null;

      // First get user ID
      const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        },
        params: {
          login: username
        }
      });

      if (!userResponse.data.data || userResponse.data.data.length === 0) {
        return null;
      }

      const userId = userResponse.data.data[0].id;
      const userInfo = userResponse.data.data[0];

      // Get stream info
      const streamResponse = await axios.get('https://api.twitch.tv/helix/streams', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        },
        params: {
          user_id: userId
        }
      });

      if (!streamResponse.data.data || streamResponse.data.data.length === 0) {
        return { isLive: false, userId, userInfo };
      }

      const stream = streamResponse.data.data[0];

      return {
        isLive: true,
        userId,
        userInfo,
        streamId: stream.id,
        title: stream.title,
        gameName: stream.game_name,
        viewerCount: stream.viewer_count,
        thumbnailUrl: stream.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080'),
        startedAt: stream.started_at
      };
    } catch (error) {
      console.error('Error getting Twitch stream:', error);
      return null;
    }
  }

  /**
   * Start monitoring all Twitch streams
   */
  startMonitoring() {
    console.log('🎮 Starting Twitch stream monitoring...');
    console.log(`⏱️  Check interval: ${this.checkInterval / 1000} seconds`);

    setInterval(async () => {
      await this.checkAllStreams();
    }, this.checkInterval);

    // Initial check
    console.log('🔍 Running initial stream check...');
    this.checkAllStreams();
  }

  /**
   * Check all active Twitch notifications
   */
  async checkAllStreams() {
    try {
      // Build query - filter by guild_id for custom bots
      let query = this.supabase
        .from('stream_notifications')
        .select('*')
        .eq('platform', 'twitch')
        .eq('enabled', true);
      
      // If this is a custom bot, only check notifications for its guild
      if (this.guildId) {
        query = query.eq('guild_id', this.guildId);
      }

      const { data: notifications, error: fetchError } = await query;

      if (fetchError) {
        console.error('❌ Error fetching notifications from database:', fetchError);
        return;
      }

      if (!notifications || notifications.length === 0) {
        return; // Silently return if no notifications
      }

      // Auto-enable streaming module if notifications exist
      const guildsToEnable = [...new Set(notifications.map(n => n.guild_id))];
      for (const guildId of guildsToEnable) {
        await this.supabase
          .from('guild_configs')
          .update({ streaming_enabled: true })
          .eq('guild_id', guildId)
          .eq('streaming_enabled', false);
      }

      for (const notif of notifications) {
        await this.checkStream(notif);
      }
    } catch (error) {
      console.error('❌ Error checking Twitch streams:', error);
    }
  }

  /**
   * Check individual stream
   */
  async checkStream(notification) {
    try {
      const streamData = await this.getStreamByUsername(notification.streamer_name);

      if (!streamData) {
        return; // Silently return if no stream data
      }

      const wasLive = notification.is_live || false;
      const isNowLive = streamData.isLive;
      
      // Extra safety: Don't send notification if we sent one in the last 5 minutes
      if (notification.last_notification_sent) {
        const lastSent = new Date(notification.last_notification_sent);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (lastSent > fiveMinutesAgo && isNowLive) {
          return; // Silently skip if recently sent
        }
      }

      if (isNowLive && !wasLive) {
        // Streamer went LIVE! - Only log important events
        console.log(`🔴 [Twitch] ${notification.streamer_name} is now LIVE! (${streamData.viewerCount} viewers)`);
        
        // Update database FIRST to prevent duplicate notifications
        const { error: updateError } = await this.supabase
          .from('stream_notifications')
          .update({
            is_live: true,
            current_stream_id: streamData.streamId,
            last_notification_sent: new Date().toISOString(),
            total_notifications_sent: (notification.total_notifications_sent || 0) + 1
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error(`❌ [Twitch] Failed to update database for ${notification.streamer_name}:`, updateError);
          return;
        }

        // Send notification
        await this.sendNotification(notification, streamData);

        // Log to stream history
        await this.supabase
          .from('stream_history')
          .insert({
            notification_id: notification.id,
            stream_id: streamData.streamId,
            title: streamData.title,
            game_name: streamData.gameName,
            viewer_count: streamData.viewerCount,
            started_at: streamData.startedAt
          });

      } else if (!isNowLive && wasLive) {
        // Streamer went OFFLINE - update database silently
        await this.supabase
          .from('stream_notifications')
          .update({
            is_live: false,
            current_stream_id: null
          })
          .eq('id', notification.id);

        // Update stream history
        if (notification.current_stream_id) {
          await this.supabase
            .from('stream_history')
            .update({
              ended_at: new Date().toISOString()
            })
            .eq('notification_id', notification.id)
            .eq('stream_id', notification.current_stream_id);
        }
      }
      // No logging for "still live" or "still offline" states
    } catch (error) {
      console.error(`      ❌ Error checking stream ${notification.streamer_name}:`, error.message);
    }
  }

  /**
   * Send live notification to Discord
   */
  async sendNotification(notification, streamData) {
    try {
      // Check if this guild uses a custom bot
      let botClient = this.client; // Default to main bot
      if (this.customBotManager) {
        const customBotClient = this.customBotManager.customBots.get(notification.guild_id);
        if (customBotClient && customBotClient.isReady && customBotClient.isReady()) {
          botClient = customBotClient;
        } else {
          console.log(`            🏢 Using main bot for guild ${notification.guild_id}`);
        }
      } else {
        console.log(`            🏢 No custom bot manager, using main bot for guild ${notification.guild_id}`);
      }

      const guild = botClient.guilds.cache.get(notification.guild_id);
      if (!guild) {
        console.error(`            ❌ Guild not found! Bot is not in guild ${notification.guild_id}`);
        console.error(`            📊 Bot can see ${botClient.guilds.cache.size} guild(s): ${Array.from(botClient.guilds.cache.keys()).join(', ')}`);
        return;
      }
      console.log(`            ✅ Guild found: ${guild.name}`);

      const channel = guild.channels.cache.get(notification.channel_id);
      if (!channel) {
        console.error(`            ❌ Channel not found! Channel ${notification.channel_id} doesn't exist or bot has no access`);
        return;
      }
      console.log(`            ✅ Channel found: #${channel.name}`);

      const embed = new EmbedBuilder()
        .setColor('#9146FF') // Twitch purple
        .setTitle(`🔴 ${notification.streamer_name} is nu LIVE!`)
        .setURL(`https://twitch.tv/${notification.streamer_name}`)
        .setDescription(streamData.title || 'Geen titel')
        .setThumbnail(streamData.userInfo.profile_image_url)
        .setImage(streamData.thumbnailUrl)
        .addFields(
          { name: '🎮 Game', value: streamData.gameName || 'Niet ingesteld', inline: true },
          { name: '👥 Viewers', value: streamData.viewerCount.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Twitch', iconURL: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png' });

      // Parse message template
      let content = notification.message_template || notification.custom_message || '🔴 Stream is live!';
      content = content
        .replace('{streamer}', notification.streamer_name)
        .replace('{game}', streamData.gameName || 'Unknown')
        .replace('{viewers}', streamData.viewerCount.toString());

      // Add role ping if configured
      if (notification.role_to_ping) {
        content = `<@&${notification.role_to_ping}> ${content}`;
        console.log(`            🔔 Adding role ping: ${notification.role_to_ping}`);
      }

      console.log(`            💬 Message content: "${content}"`);
      console.log(`            🎨 Embed color: Twitch purple`);
      console.log(`            🚀 Attempting to send message...`);

      // Check if bot has permission to send embeds
      const botPermissions = channel.permissionsFor(botClient.user);
      const canEmbed = botPermissions && botPermissions.has('EmbedLinks');

      // Send message (with or without embed based on permissions)
      let message;
      if (canEmbed) {
        message = await channel.send({
          content,
          embeds: [embed]
        });
        console.log(`            ✅ Message sent successfully with embed! Message ID: ${message.id}`);
      } else {
        // Fallback: send rich text without embed
        const fallbackContent = `${content}\n\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `🔴 **${notification.streamer_name} is nu LIVE!**\n\n` +
          `📝 **${streamData.title || 'Geen titel'}**\n\n` +
          `🎮 **Game:** ${streamData.gameName || 'Niet ingesteld'}\n` +
          `👥 **Viewers:** ${streamData.viewerCount}\n\n` +
          `🔗 **Watch:** https://twitch.tv/${notification.streamer_name}\n` +
          `━━━━━━━━━━━━━━━━`;
        
        message = await channel.send({ content: fallbackContent });
        console.log(`            ⚠️ Message sent without embed (missing Embed Links permission). Message ID: ${message.id}`);
      }

      // Store message ID for potential editing later
      await this.supabase
        .from('stream_notifications')
        .update({
          notification_message_id: message.id
        })
        .eq('id', notification.id);

      console.log(`         ✅ Notification sent for ${notification.streamer_name}`);
    } catch (error) {
      console.error(`         ❌ Error sending notification:`, error);
      if (error.code === 50013) {
        console.error(`            ⚠️  Bot missing permissions in channel #${channel?.name || 'unknown'}`);
        console.error(`            💡 Grant bot 'Send Messages' and 'Embed Links' permissions`);
      } else if (error.code === 50001) {
        console.error(`            ⚠️  Bot doesn't have access to channel`);
      } else {
        console.error(`            Error details:`, error.message);
      }
    }
  }

  /**
   * Test notification (for dashboard)
   */
  async testNotification(notificationId) {
    const { data: notification } = await this.supabase
      .from('stream_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (!notification) {
      return { success: false, error: 'Notification not found' };
    }

    const streamData = await this.getStreamByUsername(notification.streamer_name);

    if (!streamData) {
      return { success: false, error: 'Streamer not found' };
    }

    // Send test notification regardless of live status
    const testStreamData = {
      ...streamData,
      isLive: true,
      title: streamData.title || 'Test Stream Title',
      gameName: streamData.gameName || 'Test Game',
      viewerCount: streamData.viewerCount || 123,
      thumbnailUrl: streamData.thumbnailUrl || 'https://static-cdn.jtvnw.net/ttv-static/404_preview-1920x1080.jpg'
    };

    await this.sendNotification(notification, testStreamData);

    return { success: true };
  }
}

module.exports = TwitchMonitor;

