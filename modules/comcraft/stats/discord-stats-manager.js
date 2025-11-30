const { EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

/**
 * Discord Stats Manager
 * Displays bot statistics (servers, members) in a Discord channel
 */
class DiscordStatsManager {
  constructor(client) {
    this.client = client;
    this.supportServerId = process.env.DISCORD_SUPPORT_SERVER_ID || '1435653730799190058';
    this.statsChannelId = process.env.DISCORD_STATS_CHANNEL_ID || null;
    this.updateInterval = null;
    this.updateIntervalMs = 5 * 60 * 1000; // Update every 5 minutes
    this.lastMessageId = null;
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [DiscordStats] Missing Supabase credentials');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Initialize the stats manager
   */
  async initialize() {
    if (!this.supabase) {
      console.error('❌ [DiscordStats] Supabase not initialized, cannot fetch stats');
      return;
    }

    // Find or use stats channel
    if (!this.statsChannelId) {
      // Try to find a channel named "stats" or "bot-stats" in support server
      try {
        const guild = await this.client.guilds.fetch(this.supportServerId).catch(() => null);
        if (!guild) {
          console.error(`❌ [DiscordStats] Support server ${this.supportServerId} not found`);
          return;
        }

        const channels = guild.channels.cache.filter(
          ch => ch.isTextBased() && 
          (ch.name.toLowerCase().includes('stats') || ch.name.toLowerCase().includes('bot-stats'))
        );

        if (channels.size > 0) {
          this.statsChannelId = channels.first().id;
          console.log(`✅ [DiscordStats] Found stats channel: #${channels.first().name} (${this.statsChannelId})`);
        } else {
          console.log('ℹ️ [DiscordStats] No stats channel found. Please set DISCORD_STATS_CHANNEL_ID or create a channel named "stats" or "bot-stats"');
          return;
        }
      } catch (error) {
        console.error('❌ [DiscordStats] Error finding stats channel:', error);
        return;
      }
    }

    // Verify channel exists and bot has permissions
    const channel = await this.client.channels.fetch(this.statsChannelId).catch(() => null);
    if (!channel) {
      console.error(`❌ [DiscordStats] Channel ${this.statsChannelId} not found or inaccessible`);
      return;
    }

    if (!channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks', 'ManageMessages'])) {
      console.error(`❌ [DiscordStats] Missing permissions in channel ${this.statsChannelId}`);
      return;
    }

    console.log(`✅ [DiscordStats] Initialized for channel ${channel.name} (${this.statsChannelId}) in server ${channel.guild.name}`);

    // Post initial stats
    await this.updateStats();

    // Schedule periodic updates
    this.startAutoUpdate();
  }

  /**
   * Start automatic updates
   */
  startAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateStats().catch(error => {
        console.error('❌ [DiscordStats] Error updating stats:', error);
      });
    }, this.updateIntervalMs);

    console.log(`⏰ [DiscordStats] Auto-update scheduled (every ${this.updateIntervalMs / 1000}s)`);
  }

  /**
   * Stop automatic updates
   */
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Fetch statistics from API
   */
  async fetchStats() {
    try {
      if (!this.supabase) {
        throw new Error('Supabase not initialized');
      }

      // Use the same logic as the public stats API
      const { data: guilds, error: guildsError } = await this.supabase
        .from('guild_configs')
        .select('guild_id, member_count, subscription_tier')
        .eq('is_active', true);

      if (guildsError) {
        console.error('[DiscordStats] Error fetching guilds:', guildsError);
        throw guildsError;
      }

      const activeServers = guilds?.length || 0;
      const totalMembers = guilds?.reduce((sum, guild) => sum + (guild.member_count || 0), 0) || 0;
      const premiumServers = guilds?.filter(g => 
        ['basic', 'premium', 'enterprise'].includes(g.subscription_tier)
      ).length || 0;

      // Also get the actual Discord guild count (more accurate)
      const discordServerCount = this.client.guilds.cache.size;
      
      // Calculate total Discord members (sum of all guild members, accounting for overlaps)
      // For simplicity, we'll use the sum from database which should be close enough
      // Or we could use client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0)
      const discordMemberCount = this.client.guilds.cache.reduce(
        (sum, guild) => sum + (guild.memberCount || 0), 
        0
      );

      return {
        activeServers: activeServers,
        discordServerCount: discordServerCount,
        totalMembers: totalMembers,
        discordMemberCount: discordMemberCount,
        premiumServers: premiumServers,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('[DiscordStats] Error fetching stats:', error);
      throw error;
    }
  }

  /**
   * Update stats in Discord channel
   */
  async updateStats() {
    if (!this.statsChannelId) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(this.statsChannelId).catch(() => null);
      if (!channel) {
        console.error(`❌ [DiscordStats] Channel ${this.statsChannelId} not found`);
        return;
      }

      const stats = await this.fetchStats();

      const embed = new EmbedBuilder()
        .setTitle('📊 ComCraft Bot Statistics')
        .setColor(0x5865F2) // Discord blurple
        .setDescription('Real-time statistics about the ComCraft bot')
        .addFields(
          {
            name: '🖥️ Active Servers',
            value: `${stats.activeServers.toLocaleString()}`,
            inline: true
          },
          {
            name: '👥 Total Members',
            value: `${stats.totalMembers.toLocaleString()}`,
            inline: true
          },
          {
            name: '⭐ Premium Servers',
            value: `${stats.premiumServers.toLocaleString()}`,
            inline: true
          }
        )
        .setFooter({ 
          text: `Last updated: ${stats.lastUpdated.toLocaleTimeString()} • Updated every 5 minutes` 
        })
        .setTimestamp();

      // Try to edit existing message, otherwise send new one
      if (this.lastMessageId) {
        try {
          const message = await channel.messages.fetch(this.lastMessageId);
          await message.edit({ embeds: [embed] });
          return;
        } catch (error) {
          // Message might have been deleted, continue to send new one
          this.lastMessageId = null;
        }
      }

      // Send new message
      const message = await channel.send({ embeds: [embed] });
      this.lastMessageId = message.id;

      // Clean up old messages (keep only the last 5)
      try {
        const messages = await channel.messages.fetch({ limit: 10 });
        const botMessages = messages.filter(msg => 
          msg.author.id === this.client.user.id && msg.id !== message.id
        );
        
        if (botMessages.size > 4) {
          const messagesToDelete = Array.from(botMessages.values()).slice(4);
          for (const msg of messagesToDelete) {
            await msg.delete().catch(() => {});
          }
        }
      } catch (error) {
        // Ignore cleanup errors
      }

      console.log(`✅ [DiscordStats] Stats updated in channel ${this.statsChannelId}`);
    } catch (error) {
      console.error('❌ [DiscordStats] Error updating stats:', error);
    }
  }

  /**
   * Manually trigger stats update
   */
  async refresh() {
    await this.updateStats();
  }
}

module.exports = DiscordStatsManager;

