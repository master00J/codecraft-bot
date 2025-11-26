/**
 * Comcraft YouTube Stream Monitor
 * Monitors YouTube live streams and sends notifications
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

class YouTubeMonitor {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.checkInterval = 120000; // Check every 2 minutes (YouTube has stricter rate limits)
  }

  /**
   * Get channel ID from username
   */
  async getChannelId(username) {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          forUsername: username,
          part: 'id,snippet'
        }
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      return {
        id: response.data.items[0].id,
        title: response.data.items[0].snippet.title,
        thumbnail: response.data.items[0].snippet.thumbnails.high.url
      };
    } catch (error) {
      console.error('Error getting YouTube channel:', error);
      return null;
    }
  }

  /**
   * Check if channel is live
   */
  async getChannelLiveStream(channelId) {
    try {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          channelId: channelId,
          part: 'snippet',
          eventType: 'live',
          type: 'video',
          maxResults: 1
        }
      });

      if (!response.data.items || response.data.items.length === 0) {
        return { isLive: false };
      }

      const video = response.data.items[0];

      // Get additional stream details
      const videoResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          id: video.id.videoId,
          part: 'snippet,liveStreamingDetails,statistics'
        }
      });

      if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
        return { isLive: false };
      }

      const videoDetails = videoResponse.data.items[0];

      return {
        isLive: true,
        videoId: video.id.videoId,
        title: videoDetails.snippet.title,
        description: videoDetails.snippet.description,
        thumbnailUrl: videoDetails.snippet.thumbnails.maxres?.url || 
                      videoDetails.snippet.thumbnails.high.url,
        viewerCount: videoDetails.liveStreamingDetails?.concurrentViewers || 0,
        startedAt: videoDetails.liveStreamingDetails?.actualStartTime
      };
    } catch (error) {
      console.error('Error getting YouTube stream:', error);
      return { isLive: false };
    }
  }

  /**
   * Start monitoring all YouTube streams
   */
  startMonitoring() {
    console.log('📺 Starting YouTube stream monitoring...');

    setInterval(async () => {
      await this.checkAllStreams();
    }, this.checkInterval);

    // Initial check
    this.checkAllStreams();
  }

  /**
   * Check all active YouTube notifications
   */
  async checkAllStreams() {
    try {
      const { data: notifications } = await this.supabase
        .from('stream_notifications')
        .select('*')
        .eq('platform', 'youtube')
        .eq('enabled', true);

      if (!notifications || notifications.length === 0) return;

      for (const notif of notifications) {
        await this.checkStream(notif);
        // Add small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error checking YouTube streams:', error);
    }
  }

  /**
   * Check individual stream
   */
  async checkStream(notification) {
    try {
      // Get channel ID if not stored
      let channelId = notification.streamer_id;
      
      if (!channelId || channelId.startsWith('@')) {
        const channelData = await this.getChannelId(notification.streamer_name);
        if (!channelData) return;
        
        channelId = channelData.id;
        
        // Update database with channel ID
        await this.supabase
          .from('stream_notifications')
          .update({
            streamer_id: channelId,
            streamer_avatar_url: channelData.thumbnail
          })
          .eq('id', notification.id);
      }

      const streamData = await this.getChannelLiveStream(channelId);

      if (streamData.isLive && !notification.is_live) {
        // Channel went LIVE!
        await this.sendNotification(notification, streamData);

        // Update database
        await this.supabase
          .from('stream_notifications')
          .update({
            is_live: true,
            current_stream_id: streamData.videoId,
            last_notification_sent: new Date().toISOString(),
            total_notifications_sent: notification.total_notifications_sent + 1
          })
          .eq('id', notification.id);

        // Log to stream history
        await this.supabase
          .from('stream_history')
          .insert({
            notification_id: notification.id,
            stream_id: streamData.videoId,
            title: streamData.title,
            viewer_count: streamData.viewerCount,
            started_at: streamData.startedAt
          });

      } else if (!streamData.isLive && notification.is_live) {
        // Channel went OFFLINE
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
    } catch (error) {
      console.error('Error checking YouTube stream:', error);
    }
  }

  /**
   * Send live notification to Discord
   */
  async sendNotification(notification, streamData) {
    try {
      const guild = this.client.guilds.cache.get(notification.guild_id);
      if (!guild) return;

      const channel = guild.channels.cache.get(notification.channel_id);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor('#FF0000') // YouTube red
        .setTitle(`🔴 ${notification.streamer_name} is nu LIVE!`)
        .setURL(`https://youtube.com/watch?v=${streamData.videoId}`)
        .setDescription(streamData.title || 'Geen titel')
        .setImage(streamData.thumbnailUrl)
        .addFields(
          { name: '👥 Viewers', value: streamData.viewerCount.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'YouTube', iconURL: 'https://www.youtube.com/s/desktop/f506bd45/img/favicon_32.png' });

      if (notification.streamer_avatar_url) {
        embed.setThumbnail(notification.streamer_avatar_url);
      }

      // Parse message template
      let content = notification.message_template || notification.custom_message || '🔴 Stream is live!';
      content = content
        .replace('{streamer}', notification.streamer_name)
        .replace('{viewers}', streamData.viewerCount.toString());

      // Add role ping if configured
      if (notification.role_to_ping) {
        content = `<@&${notification.role_to_ping}> ${content}`;
      }

      const message = await channel.send({
        content,
        embeds: [embed]
      });

      // Store message ID
      await this.supabase
        .from('stream_notifications')
        .update({
          notification_message_id: message.id
        })
        .eq('id', notification.id);

      console.log(`✅ Sent YouTube notification for ${notification.streamer_name}`);
    } catch (error) {
      console.error('Error sending YouTube notification:', error);
    }
  }

  /**
   * Test notification
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

    // Send test notification
    const testStreamData = {
      isLive: true,
      videoId: 'dQw4w9WgXcQ',
      title: 'Test Stream Title',
      viewerCount: 123,
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      startedAt: new Date().toISOString()
    };

    await this.sendNotification(notification, testStreamData);

    return { success: true };
  }
}

module.exports = YouTubeMonitor;

