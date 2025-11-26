/**
 * Game News Manager
 * Manages game news subscriptions and deliveries
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class GameNewsManager {
  constructor(client) {
    this.client = client;
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ [GameNews] Supabase credentials missing, game news disabled');
      this.supabase = null;
      return;
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize API sources
    this.sources = {};
    this.initializeSources();
    
    console.log('✅ [GameNews] Manager initialized');
  }

  /**
   * Initialize all game API sources
   */
  initializeSources() {
    try {
      // Import source modules
      const RiotSource = require('./sources/riot-api');
      const FortniteSource = require('./sources/fortnite-api');
      const MinecraftSource = require('./sources/minecraft-rss');
      const SteamSource = require('./sources/steam-api');

      this.sources = {
        lol: new RiotSource('lol'),
        valorant: new RiotSource('valorant'),
        fortnite: new FortniteSource(),
        minecraft: new MinecraftSource(),
        cs2: new SteamSource('730'), // CS2 app ID
      };

      console.log('✅ [GameNews] All sources initialized:', Object.keys(this.sources).join(', '));
    } catch (error) {
      console.error('❌ [GameNews] Error initializing sources:', error);
    }
  }

  /**
   * Get all available games
   */
  async getAvailableGames() {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('game_news_sources')
      .select('*')
      .eq('status', 'active')
      .order('game_name');

    if (error) {
      console.error('[GameNews] Error fetching games:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get guild's game news subscriptions
   */
  async getGuildSubscriptions(guildId) {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('game_news_configs')
      .select(`
        *,
        game_news_sources (
          game_name,
          game_icon_url
        )
      `)
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GameNews] Error fetching subscriptions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Create new game subscription
   */
  async createSubscription(guildId, { channelId, gameId, notificationRoleId, filters }) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await this.supabase
      .from('game_news_configs')
      .insert({
        guild_id: guildId,
        channel_id: channelId,
        game_id: gameId,
        notification_role_id: notificationRoleId || null,
        filters: filters || { types: ['all'] },
        enabled: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[GameNews] Error creating subscription:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  }

  /**
   * Update subscription
   */
  async updateSubscription(subscriptionId, updates) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await this.supabase
      .from('game_news_configs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId)
      .select()
      .single();

    if (error) {
      console.error('[GameNews] Error updating subscription:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(subscriptionId) {
    if (!this.supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { error } = await this.supabase
      .from('game_news_configs')
      .delete()
      .eq('id', subscriptionId);

    if (error) {
      console.error('[GameNews] Error deleting subscription:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Check for new news from all sources
   */
  async checkForUpdates() {
    if (!this.supabase) return;

    for (const [gameId, source] of Object.entries(this.sources)) {
      try {
        await this.checkGameUpdates(gameId, source);
      } catch (error) {
        // Update source status
        await this.updateSourceStatus(gameId, 'error', error.message);
      }
    }
  }

  /**
   * Check updates for specific game
   */
  async checkGameUpdates(gameId, source) {
    // Fetch latest news from source
    const newsItems = await source.fetchLatestNews();

    if (!newsItems || newsItems.length === 0) {
      await this.updateSourceStatus(gameId, 'active');
      return;
    }

    // Process each news item
    for (const item of newsItems) {
      await this.processNewsItem(gameId, item);
    }

    await this.updateSourceStatus(gameId, 'active');
  }

  /**
   * Process and deliver news item
   */
  async processNewsItem(gameId, item) {
    // Check if already posted
    const { data: existing } = await this.supabase
      .from('game_news_posts')
      .select('id')
      .eq('game_id', gameId)
      .eq('external_id', item.externalId)
      .single();

    if (existing) {
      return; // Already posted
    }

    // Save to database
    const { data: newsPost, error } = await this.supabase
      .from('game_news_posts')
      .insert({
        game_id: gameId,
        external_id: item.externalId,
        title: item.title,
        content: item.content,
        url: item.url,
        image_url: item.imageUrl,
        thumbnail_url: item.thumbnailUrl,
        news_type: item.type || 'news',
        published_at: item.publishedAt,
        metadata: item.metadata || {},
      })
      .select()
      .single();

    if (error) {
      return;
    }

    // Deliver to subscribed guilds
    await this.deliverNews(newsPost);
  }

  /**
   * Deliver news to subscribed guilds
   */
  async deliverNews(newsPost) {
    // Get all active subscriptions for this game
    const { data: configs } = await this.supabase
      .from('game_news_configs')
      .select('*')
      .eq('game_id', newsPost.game_id)
      .eq('enabled', true);

    if (!configs || configs.length === 0) {
      return;
    }

    console.log(`     Delivering to ${configs.length} guild(s)...`);

    for (const config of configs) {
      try {
        // Check if already delivered
        const { data: delivered } = await this.supabase
          .from('game_news_deliveries')
          .select('id')
          .eq('news_post_id', newsPost.id)
          .eq('guild_id', config.guild_id)
          .single();

        if (delivered) {
          continue; // Already delivered
        }

        // Check filters
        if (!this.matchesFilters(newsPost, config.filters)) {
          continue;
        }

        // Send to Discord
        const messageId = await this.sendToDiscord(config, newsPost);

        if (messageId) {
          // Track delivery
          await this.supabase
            .from('game_news_deliveries')
            .insert({
              news_post_id: newsPost.id,
              guild_id: config.guild_id,
              channel_id: config.channel_id,
              message_id: messageId,
              config_id: config.id,
            });

          console.log(`       ✅ Delivered to guild ${config.guild_id}`);
        }
      } catch (error) {
        console.error(`       ❌ Error delivering to guild ${config.guild_id}:`, error);
      }
    }
  }

  /**
   * Check if news matches config filters
   */
  matchesFilters(newsPost, filters) {
    if (!filters || !filters.types) return true;
    
    // "all" means no filtering
    if (filters.types.includes('all')) return true;
    
    // Check if news type matches any filter
    return filters.types.includes(newsPost.news_type);
  }

  /**
   * Send news to Discord channel
   */
  async sendToDiscord(config, newsPost) {
    try {
      // Check if bot has access to the guild
      const guild = this.client.guilds.cache.get(config.guild_id);
      if (!guild) {
        return null;
      }

      // Try to fetch the channel
      const channel = await this.client.channels.fetch(config.channel_id).catch(() => null);
      if (!channel) {
        return null;
      }

      // Check if bot can send messages in this channel
      if (!channel.permissionsFor(this.client.user).has(['SendMessages', 'EmbedLinks'])) {
        return null;
      }

      const embed = this.buildEmbed(newsPost, config.game_id);
      
      const messageOptions = { embeds: [embed] };
      
      // Add role ping if configured
      if (config.notification_role_id) {
        messageOptions.content = `<@&${config.notification_role_id}>`;
      }

      const message = await channel.send(messageOptions);
      return message.id;
    } catch (error) {
      return null;
    }
  }

  /**
   * Build Discord embed for news
   */
  buildEmbed(newsPost, gameId) {
    const gameIcons = {
      lol: '🎮',
      valorant: '🎯',
      fortnite: '🏝️',
      minecraft: '⛏️',
      cs2: '🔫',
    };

    const gameColors = {
      lol: '#0AC8B9',
      valorant: '#FF4655',
      fortnite: '#00D7FF',
      minecraft: '#6A9920',
      cs2: '#E89C3A',
    };

    const embed = new EmbedBuilder()
      .setColor(gameColors[gameId] || '#0099ff')
      .setTitle(`${gameIcons[gameId] || '📰'} ${newsPost.title}`)
      .setTimestamp(new Date(newsPost.published_at));

    if (newsPost.content) {
      // Truncate content to 300 chars
      const content = newsPost.content.length > 300 
        ? newsPost.content.substring(0, 297) + '...' 
        : newsPost.content;
      embed.setDescription(content);
    }

    if (newsPost.url) {
      embed.setURL(newsPost.url);
    }

    if (newsPost.image_url) {
      embed.setImage(newsPost.image_url);
    }

    if (newsPost.thumbnail_url) {
      embed.setThumbnail(newsPost.thumbnail_url);
    }

    // Add type badge
    const typeBadges = {
      patch: '🔧 Patch Notes',
      event: '🎉 Event',
      maintenance: '⚙️ Maintenance',
      hotfix: '🚨 Hotfix',
      news: '📰 News',
    };

    if (newsPost.news_type && typeBadges[newsPost.news_type]) {
      embed.addFields({
        name: 'Type',
        value: typeBadges[newsPost.news_type],
        inline: true,
      });
    }

    return embed;
  }

  /**
   * Update source status
   */
  async updateSourceStatus(gameId, status, errorMessage = null) {
    if (!this.supabase) return;

    const updates = {
      status,
      last_check_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (status === 'active') {
      updates.last_success_at = new Date().toISOString();
      updates.last_error = null;
    } else if (status === 'error' && errorMessage) {
      updates.last_error = errorMessage;
    }

    await this.supabase
      .from('game_news_sources')
      .update(updates)
      .eq('game_id', gameId);
  }

  /**
   * Get latest news for preview (dashboard)
   */
  async getLatestNews(gameId, limit = 5) {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('game_news_posts')
      .select('*')
      .eq('game_id', gameId)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[GameNews] Error fetching latest news:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Start scheduler (check for updates every X minutes)
   */
  startScheduler() {
    if (!this.supabase) {
      console.log('⚠️ [GameNews] Scheduler disabled (Supabase not configured)');
      return;
    }

    // Initial check
    this.checkForUpdates();

    // Schedule checks every 30 minutes
    this.schedulerInterval = setInterval(() => {
      this.checkForUpdates();
    }, 30 * 60 * 1000); // 30 minutes

    console.log('✅ [GameNews] Scheduler started (checks every 30 minutes)');
  }

  /**
   * Stop scheduler
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      console.log('🛑 [GameNews] Scheduler stopped');
    }
  }
}

module.exports = GameNewsManager;

