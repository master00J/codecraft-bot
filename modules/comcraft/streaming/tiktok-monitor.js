/**
 * Comcraft TikTok Video Monitor
 * Monitors TikTok accounts and sends notifications for new videos
 * 
 * Uses RapidAPI's TikTok API (requires RAPIDAPI_KEY)
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');

class TikTokMonitor {
  constructor(client, customBotManager = null, guildId = null) {
    this.client = client;
    this.customBotManager = customBotManager;
    this.guildId = guildId; // If set, only monitor this guild (for custom bots)
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.lastCheckedVideos = new Map(); // username -> last video id
  }

  /**
   * Get user info from TikTok
   */
  async getTikTokUser(username) {
    if (!process.env.RAPIDAPI_KEY) {
      console.error('❌ RAPIDAPI_KEY not configured for TikTok API!');
      return null;
    }

    try {
      const response = await axios.get('https://tiktok-api23.p.rapidapi.com/api/user/info', {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tiktok-api23.p.rapidapi.com'
        },
        params: {
          uniqueId: username.replace('@', '')
        }
      });

      if (response.data && response.data.userInfo) {
        return response.data.userInfo;
      }
      return null;
    } catch (error) {
      console.error(`❌ Error getting TikTok user ${username}:`, error.message);
      return null;
    }
  }

  /**
   * Get latest videos from a TikTok user
   */
  async getLatestVideos(username, limit = 5) {
    if (!process.env.RAPIDAPI_KEY) {
      console.error('❌ RAPIDAPI_KEY not configured for TikTok API!');
      return [];
    }

    try {
      const cleanUsername = username.replace('@', '');
      
      const response = await axios.get('https://tiktok-api23.p.rapidapi.com/api/user/posts', {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'tiktok-api23.p.rapidapi.com'
        },
        params: {
          uniqueId: cleanUsername,
          count: limit.toString()
        }
      });

      if (response.data && response.data.itemList) {
        return response.data.itemList.map(video => ({
          id: video.id,
          description: video.desc || 'No description',
          createTime: video.createTime * 1000, // Convert to ms
          stats: {
            plays: video.stats?.playCount || 0,
            likes: video.stats?.diggCount || 0,
            comments: video.stats?.commentCount || 0,
            shares: video.stats?.shareCount || 0
          },
          cover: video.video?.cover || video.video?.originCover,
          url: `https://www.tiktok.com/@${cleanUsername}/video/${video.id}`,
          author: {
            username: cleanUsername,
            nickname: video.author?.nickname || cleanUsername,
            avatar: video.author?.avatarLarger || video.author?.avatarMedium
          }
        }));
      }
      return [];
    } catch (error) {
      console.error(`❌ Error getting TikTok videos for ${username}:`, error.message);
      return [];
    }
  }

  /**
   * Start monitoring TikTok accounts
   */
  async start() {
    console.log('🎵 Starting TikTok Monitor...');

    if (!process.env.RAPIDAPI_KEY) {
      console.warn('⚠️ TikTok Monitor disabled: RAPIDAPI_KEY not configured');
      console.warn('   Get a free API key at: https://rapidapi.com/tikwm-tikwm-default/api/tiktok-api23');
      return;
    }

    console.log('🎵 TikTok Monitor: RAPIDAPI_KEY is configured');

    // Initial check
    console.log('🎵 TikTok Monitor: Running initial check...');
    await this.checkAllAccounts();

    // Set up interval
    console.log(`🎵 TikTok Monitor: Setting up interval (every ${this.checkInterval / 60000} minutes)`);
    setInterval(() => this.checkAllAccounts(), this.checkInterval);

    console.log(`✅ TikTok Monitor started (checking every ${this.checkInterval / 60000} minutes)`);
  }

  /**
   * Check all monitored TikTok accounts
   */
  async checkAllAccounts() {
    try {
      // Build query based on whether this is for a specific guild
      let query = this.supabase
        .from('tiktok_monitors')
        .select('*')
        .eq('enabled', true);

      if (this.guildId) {
        query = query.eq('guild_id', this.guildId);
      }

      const { data: monitors, error } = await query;

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          return; // Table doesn't exist, skip silently
        }
        console.error('Error fetching TikTok monitors:', error);
        return;
      }

      if (!monitors || monitors.length === 0) {
        console.log('🎵 TikTok Monitor: No monitors found');
        return;
      }

      console.log(`🎵 TikTok Monitor: Checking ${monitors.length} account(s)...`);

      for (const monitor of monitors) {
        await this.checkAccount(monitor);
        // Small delay between checks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      console.log('🎵 TikTok Monitor: Check cycle completed');
    } catch (error) {
      console.error('Error in TikTok check cycle:', error);
    }
  }

  /**
   * Check a specific TikTok account for new videos
   */
  async checkAccount(monitor) {
    try {
      console.log(`🎵 Checking @${monitor.tiktok_username}...`);
      
      const videos = await this.getLatestVideos(monitor.tiktok_username, 3);
      
      if (!videos || videos.length === 0) {
        console.log(`⚠️ No videos found for @${monitor.tiktok_username}`);
        return;
      }

      const latestVideo = videos[0];
      const lastNotifiedId = monitor.last_video_id;

      console.log(`📹 @${monitor.tiktok_username}: Latest video ID: ${latestVideo.id}, Last notified: ${lastNotifiedId || 'none'}`);

      // If this is a new video we haven't notified about
      if (latestVideo.id !== lastNotifiedId) {
        // Check if this is the first check (don't notify on first run)
        if (lastNotifiedId) {
          console.log(`🆕 New video detected for @${monitor.tiktok_username}! Sending notification...`);
          await this.sendNotification(monitor, latestVideo);
        } else {
          console.log(`📝 First check for @${monitor.tiktok_username}, storing baseline video ID (no notification)`);
        }

        // Update last video ID
        await this.supabase
          .from('tiktok_monitors')
          .update({ 
            last_video_id: latestVideo.id,
            last_checked: new Date().toISOString()
          })
          .eq('id', monitor.id);
      } else {
        console.log(`✅ No new videos for @${monitor.tiktok_username}`);
      }
    } catch (error) {
      console.error(`Error checking TikTok account ${monitor.tiktok_username}:`, error);
    }
  }

  /**
   * Send notification to Discord channel
   */
  async sendNotification(monitor, video) {
    try {
      // Determine which client to use
      let targetClient = this.client;
      
      if (this.customBotManager && monitor.custom_bot_id) {
        const customClient = this.customBotManager.getClient(monitor.custom_bot_id);
        if (customClient) {
          targetClient = customClient;
        }
      }

      const channel = await targetClient.channels.fetch(monitor.channel_id).catch(() => null);
      if (!channel) {
        console.error(`❌ TikTok notification channel not found: ${monitor.channel_id}`);
        return;
      }

      // Build notification message
      const customMessage = monitor.notification_message || '{username} just posted a new TikTok!';
      const formattedMessage = customMessage
        .replace('{username}', video.author.nickname || video.author.username)
        .replace('{url}', video.url);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor('#000000') // TikTok black
        .setAuthor({
          name: `${video.author.nickname || video.author.username}`,
          iconURL: video.author.avatar,
          url: `https://www.tiktok.com/@${video.author.username}`
        })
        .setTitle('🎵 New TikTok Video!')
        .setDescription(video.description.substring(0, 200) + (video.description.length > 200 ? '...' : ''))
        .setURL(video.url)
        .addFields(
          { name: '👁️ Views', value: this.formatNumber(video.stats.plays), inline: true },
          { name: '❤️ Likes', value: this.formatNumber(video.stats.likes), inline: true },
          { name: '💬 Comments', value: this.formatNumber(video.stats.comments), inline: true }
        )
        .setTimestamp(new Date(video.createTime))
        .setFooter({ text: 'TikTok', iconURL: 'https://www.tiktok.com/favicon.ico' });

      // Add thumbnail if available
      if (video.cover) {
        embed.setImage(video.cover);
      }

      // Ping role if configured
      let content = formattedMessage;
      if (monitor.ping_role_id) {
        content = `<@&${monitor.ping_role_id}> ${content}`;
      }

      await channel.send({
        content,
        embeds: [embed]
      });

      console.log(`📱 TikTok notification sent for @${video.author.username} in guild ${monitor.guild_id}`);
    } catch (error) {
      console.error('Error sending TikTok notification:', error);
    }
  }

  /**
   * Format large numbers (1000 -> 1K, 1000000 -> 1M)
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Add a TikTok account to monitor
   */
  async addMonitor(guildId, channelId, tiktokUsername, options = {}) {
    const cleanUsername = tiktokUsername.replace('@', '');

    // Verify the account exists
    const user = await this.getTikTokUser(cleanUsername);
    if (!user) {
      return { success: false, error: `TikTok user @${cleanUsername} not found` };
    }

    try {
      // Check if already monitoring
      const { data: existing } = await this.supabase
        .from('tiktok_monitors')
        .select('id')
        .eq('guild_id', guildId)
        .eq('tiktok_username', cleanUsername)
        .single();

      if (existing) {
        return { success: false, error: `Already monitoring @${cleanUsername}` };
      }

      // Get latest video to set as baseline
      const videos = await this.getLatestVideos(cleanUsername, 1);
      const lastVideoId = videos.length > 0 ? videos[0].id : null;

      // Add monitor
      const { error } = await this.supabase
        .from('tiktok_monitors')
        .insert({
          guild_id: guildId,
          channel_id: channelId,
          tiktok_username: cleanUsername,
          notification_message: options.message || '{username} just posted a new TikTok!',
          ping_role_id: options.pingRole || null,
          custom_bot_id: options.customBotId || null,
          enabled: true,
          last_video_id: lastVideoId
        });

      if (error) throw error;

      return { 
        success: true, 
        username: cleanUsername,
        user: user
      };
    } catch (error) {
      console.error('Error adding TikTok monitor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a TikTok monitor
   */
  async removeMonitor(guildId, tiktokUsername) {
    const cleanUsername = tiktokUsername.replace('@', '');

    try {
      const { error } = await this.supabase
        .from('tiktok_monitors')
        .delete()
        .eq('guild_id', guildId)
        .eq('tiktok_username', cleanUsername);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error removing TikTok monitor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List all TikTok monitors for a guild
   */
  async listMonitors(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('tiktok_monitors')
        .select('*')
        .eq('guild_id', guildId);

      if (error) throw error;

      return { success: true, monitors: data || [] };
    } catch (error) {
      console.error('Error listing TikTok monitors:', error);
      return { success: false, error: error.message, monitors: [] };
    }
  }

  /**
   * Toggle a TikTok monitor on/off
   */
  async toggleMonitor(guildId, tiktokUsername, enabled) {
    const cleanUsername = tiktokUsername.replace('@', '');

    try {
      const { error } = await this.supabase
        .from('tiktok_monitors')
        .update({ enabled })
        .eq('guild_id', guildId)
        .eq('tiktok_username', cleanUsername);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error toggling TikTok monitor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test notification for a TikTok monitor
   */
  async testNotification(guildId, tiktokUsername) {
    const cleanUsername = tiktokUsername.replace('@', '');

    try {
      // Get the monitor
      const { data: monitor, error } = await this.supabase
        .from('tiktok_monitors')
        .select('*')
        .eq('guild_id', guildId)
        .eq('tiktok_username', cleanUsername)
        .single();

      if (error || !monitor) {
        return { success: false, error: `Monitor for @${cleanUsername} not found` };
      }

      // Get the latest video
      const videos = await this.getLatestVideos(cleanUsername, 1);
      if (!videos || videos.length === 0) {
        return { success: false, error: `Could not fetch videos for @${cleanUsername}` };
      }

      // Send a test notification
      await this.sendNotification(monitor, videos[0]);

      return { success: true, video: videos[0] };
    } catch (error) {
      console.error('Error testing TikTok notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Force check a specific account (useful for debugging)
   */
  async forceCheck(guildId, tiktokUsername) {
    const cleanUsername = tiktokUsername.replace('@', '');

    try {
      const { data: monitor, error } = await this.supabase
        .from('tiktok_monitors')
        .select('*')
        .eq('guild_id', guildId)
        .eq('tiktok_username', cleanUsername)
        .single();

      if (error || !monitor) {
        return { success: false, error: `Monitor for @${cleanUsername} not found` };
      }

      console.log(`🔍 Force checking TikTok account: @${cleanUsername}`);
      
      const videos = await this.getLatestVideos(cleanUsername, 3);
      console.log(`📹 Found ${videos.length} videos for @${cleanUsername}`);
      
      if (videos.length > 0) {
        console.log(`📹 Latest video ID: ${videos[0].id}`);
        console.log(`📹 Stored last video ID: ${monitor.last_video_id}`);
        
        if (videos[0].id !== monitor.last_video_id) {
          console.log(`🆕 New video detected! Sending notification...`);
          await this.sendNotification(monitor, videos[0]);
          
          // Update last video ID
          await this.supabase
            .from('tiktok_monitors')
            .update({ 
              last_video_id: videos[0].id,
              last_checked: new Date().toISOString()
            })
            .eq('id', monitor.id);
            
          return { success: true, newVideo: true, video: videos[0] };
        } else {
          console.log(`✅ No new videos since last check`);
          return { success: true, newVideo: false };
        }
      }

      return { success: true, newVideo: false, noVideos: true };
    } catch (error) {
      console.error('Error force checking TikTok account:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = TikTokMonitor;
