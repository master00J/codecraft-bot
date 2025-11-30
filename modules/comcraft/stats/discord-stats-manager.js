const { ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

/**
 * Discord Stats Manager
 * Displays bot statistics (servers, members) as voice channel names
 */
class DiscordStatsManager {
  constructor(client) {
    this.client = client;
    this.supportServerId = process.env.DISCORD_SUPPORT_SERVER_ID || '1435653730799190058';
    this.statsCategoryId = process.env.DISCORD_STATS_CATEGORY_ID || null;
    this.updateInterval = null;
    this.updateIntervalMs = 5 * 60 * 1000; // Update every 5 minutes
    this.serversChannelId = null;
    this.usersChannelId = null;
    
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

    try {
      const guild = await this.client.guilds.fetch(this.supportServerId).catch(() => null);
      if (!guild) {
        console.error(`❌ [DiscordStats] Support server ${this.supportServerId} not found`);
        return;
      }

      // Check bot permissions
      const botMember = await guild.members.fetch(this.client.user.id).catch(() => null);
      if (!botMember) {
        console.error(`❌ [DiscordStats] Bot not found in support server`);
        return;
      }

      if (!botMember.permissions.has(['ManageChannels', 'ViewChannel'])) {
        console.error(`❌ [DiscordStats] Bot missing required permissions (ManageChannels, ViewChannel)`);
        return;
      }

      // Find or create stats category
      let statsCategory = null;
      if (this.statsCategoryId) {
        statsCategory = await guild.channels.fetch(this.statsCategoryId).catch(() => null);
      }

      if (!statsCategory) {
        // Try to find existing category with "stats" in name
        const existingCategories = guild.channels.cache.filter(
          ch => ch.type === ChannelType.GuildCategory && 
          (ch.name.toLowerCase().includes('stats') || ch.name.toLowerCase().includes('statistics'))
        );

        if (existingCategories.size > 0) {
          statsCategory = existingCategories.first();
          console.log(`✅ [DiscordStats] Found stats category: ${statsCategory.name}`);
        } else {
          // Create new category
          statsCategory = await guild.channels.create({
            name: '📊 Bot Statistics',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: ['Connect', 'Speak'], // Everyone can see but not join
              }
            ]
          });
          console.log(`✅ [DiscordStats] Created stats category: ${statsCategory.name}`);
        }
      }

      // Find or create "Servers" voice channel
      let serversChannel = guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildVoice && 
        ch.parentId === statsCategory.id && 
        ch.name.toLowerCase().startsWith('servers')
      );

      if (!serversChannel) {
        serversChannel = await guild.channels.create({
          name: 'Servers: Loading...',
          type: ChannelType.GuildVoice,
          parent: statsCategory.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: ['Connect', 'Speak'],
            }
          ]
        });
        console.log(`✅ [DiscordStats] Created "Servers" voice channel`);
      }
      this.serversChannelId = serversChannel.id;

      // Find or create "Users" voice channel
      let usersChannel = guild.channels.cache.find(
        ch => ch.type === ChannelType.GuildVoice && 
        ch.parentId === statsCategory.id && 
        ch.name.toLowerCase().startsWith('users')
      );

      if (!usersChannel) {
        usersChannel = await guild.channels.create({
          name: 'Users: Loading...',
          type: ChannelType.GuildVoice,
          parent: statsCategory.id,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: ['Connect', 'Speak'],
            }
          ]
        });
        console.log(`✅ [DiscordStats] Created "Users" voice channel`);
      }
      this.usersChannelId = usersChannel.id;

      console.log(`✅ [DiscordStats] Initialized for server ${guild.name}`);

      // Update stats immediately
      await this.updateStats();

      // Schedule periodic updates
      this.startAutoUpdate();
    } catch (error) {
      console.error('❌ [DiscordStats] Error initializing:', error);
    }
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
   * Update stats in Discord voice channels
   */
  async updateStats() {
    if (!this.serversChannelId || !this.usersChannelId) {
      return;
    }

    try {
      const stats = await this.fetchStats();

      // Update "Servers" voice channel name
      const serversChannel = await this.client.channels.fetch(this.serversChannelId).catch(() => null);
      if (serversChannel) {
        const newName = `Servers: ${stats.activeServers.toLocaleString()}`;
        if (serversChannel.name !== newName) {
          await serversChannel.setName(newName);
          console.log(`✅ [DiscordStats] Updated servers channel: ${newName}`);
        }
      }

      // Update "Users" voice channel name
      const usersChannel = await this.client.channels.fetch(this.usersChannelId).catch(() => null);
      if (usersChannel) {
        const newName = `Users: ${stats.totalMembers.toLocaleString()}`;
        if (usersChannel.name !== newName) {
          await usersChannel.setName(newName);
          console.log(`✅ [DiscordStats] Updated users channel: ${newName}`);
        }
      }

      console.log(`✅ [DiscordStats] Stats updated successfully`);
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

module.exports = DiscordStatsManager;

