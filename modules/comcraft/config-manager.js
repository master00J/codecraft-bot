/**
 * Comcraft Configuration Manager
 * Cached config loader voor performance
 */

const { createClient } = require('@supabase/supabase-js');

class ConfigManager {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('⚠️ ConfigManager: Supabase environment variables not set. Some features may not work.');
    }
    
    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      );
      
      this.cache = new Map();
      this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    } catch (error) {
      console.error('Error initializing ConfigManager:', error);
      throw error;
    }
  }

  /**
   * Get guild configuration with caching
   */
  async getGuildConfig(guildId) {
    const cacheKey = `guild:${guildId}`;
    
    if (this.cache.has(cacheKey)) {
      const { config, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return config;
      }
    }

    const { data, error } = await this.supabase
      .from('guild_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error || !data) {
      return null;
    }

    this.cache.set(cacheKey, {
      config: data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Get guild's custom bot personalization settings for embeds
   * @param {string} guildId 
   * @returns {Object} Bot personalization settings
   */
  async getBotPersonalization(guildId) {
    const config = await this.getGuildConfig(guildId);
    
    if (!config) {
      return {
        name: 'ComCraft',
        avatarURL: null,
        color: 0x5865F2, // Discord blue (hex to decimal)
        footer: 'Powered by ComCraft'
      };
    }

    // Convert hex color to decimal for Discord embeds
    let colorInt = 0x5865F2;
    if (config.custom_embed_color) {
      try {
        colorInt = parseInt(config.custom_embed_color.replace('#', ''), 16);
      } catch (e) {
        console.error('Invalid embed color:', config.custom_embed_color);
      }
    }

    return {
      name: config.custom_bot_name || 'ComCraft',
      avatarURL: config.custom_bot_avatar_url || null,
      color: colorInt,
      footer: config.custom_embed_footer || 'Powered by ComCraft'
    };
  }

  /**
   * Get leveling configuration
   */
  async getLevelingConfig(guildId) {
    const cacheKey = `leveling:${guildId}`;
    
    if (this.cache.has(cacheKey)) {
      const { config, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return config;
      }
    }

    const { data, error } = await this.supabase
      .from('leveling_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        xp_min: 15,
        xp_max: 25,
        xp_cooldown: 60,
        levelup_message_enabled: true,
        levelup_message_template: 'Congratulations {user}! You are now level {level}!',
        levelup_dm_enabled: false,
        voice_xp_enabled: false,
        // Customization defaults
        xp_bar_color: '#5865F2',
        xp_bar_style: 'gradient',
        xp_bar_position: 'bottom',
        rank_card_border_color: '#5865F2',
        rank_card_background_url: null,
        levelup_animation: 'confetti'
      };
    }

    this.cache.set(cacheKey, {
      config: data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Clear leveling config cache for a specific guild
   * Call this after updating leveling config to ensure fresh data
   */
  clearLevelingConfigCache(guildId) {
    const cacheKey = `leveling:${guildId}`;
    this.cache.delete(cacheKey);
    console.log(`[ConfigManager] Cleared leveling config cache for guild ${guildId}`);
  }

  /**
   * Get moderation configuration
   */
  async getModerationConfig(guildId) {
    const cacheKey = `moderation:${guildId}`;
    
    if (this.cache.has(cacheKey)) {
      const { config, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return config;
      }
    }

    const { data, error } = await this.supabase
      .from('moderation_configs')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching moderation config:', error);
    }

    const config = data || {
      automod_enabled: false,
      filter_spam: true,
      filter_links: false,
      filter_invites: true,
      filter_caps: false,
      filter_words: [],
      filter_mention_spam: true,
      filter_emoji_spam: false,
      filter_duplicates: false,
      ai_moderation_enabled: false,
      spam_messages: 5,
      spam_interval: 5,
      caps_threshold: 70,
      caps_min_length: 10,
      max_mentions: 5,
      max_emojis: 10,
      duplicate_time_window: 60,
      auto_slowmode_enabled: false,
      auto_slowmode_duration: 5,
      auto_slowmode_reset: 300,
      anti_raid_enabled: false,
      raid_time_window: 10,
      raid_max_joins: 5,
      raid_kick_new_members: false,
      auto_ban_enabled: false,
      auto_ban_threshold: 3,
      auto_ban_duration: null,
      muted_role_id: null,
      mod_log_channel_id: null,
      mod_role_id: null
    };

    this.cache.set(cacheKey, {
      config,
      timestamp: Date.now()
    });

    return config;
  }

  /**
   * Get channel-specific moderation rules
   */
  async getChannelModerationRules(guildId, channelId) {
    const cacheKey = `channel_mod_rules:${guildId}:${channelId}`;
    
    if (this.cache.has(cacheKey)) {
      const { rules, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return rules;
      }
    }

    const { data, error } = await this.supabase
      .from('channel_moderation_rules')
      .select('*')
      .eq('guild_id', guildId)
      .eq('channel_id', channelId)
      .eq('enabled', true)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching channel moderation rules:', error);
    }

    const rules = data || null;

    if (rules) {
      this.cache.set(cacheKey, {
        rules,
        timestamp: Date.now()
      });
    }

    return rules;
  }

  /**
   * Clear channel moderation rules cache
   */
  clearChannelModRulesCache(guildId, channelId = null) {
    if (channelId) {
      this.cache.delete(`channel_mod_rules:${guildId}:${channelId}`);
    } else {
      // Clear all channel rules for this guild
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`channel_mod_rules:${guildId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Get welcome configuration
   */
  async getWelcomeConfig(guildId) {
    const cacheKey = `welcome:${guildId}`;
    
    if (this.cache.has(cacheKey)) {
      const { config, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return config;
      }
    }

    const { data } = await this.supabase
      .from('welcome_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    const config = data || { welcome_enabled: false };

    this.cache.set(cacheKey, {
      config,
      timestamp: Date.now()
    });

    return config;
  }

  async getGuildLicense(guildId) {
    const cacheKey = `license:${guildId}`;

    if (this.cache.has(cacheKey)) {
      const { config, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return config;
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('comcraft_license_guilds')
        .select('license:comcraft_licenses(*)')
        .eq('guild_id', guildId)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching license for guild ${guildId}:`, error);
        return null;
      }

      const rawLicense = data?.license || null;
      let license = null;

      if (rawLicense && rawLicense.status === 'active') {
        if (!rawLicense.expires_at) {
          license = rawLicense;
        } else {
          const expires = new Date(rawLicense.expires_at).getTime();
          if (Date.now() < expires) {
            license = rawLicense;
          }
        }
      }

      this.cache.set(cacheKey, {
        config: license,
        timestamp: Date.now()
      });

      return license;
    } catch (error) {
      console.error(`Unexpected error fetching license for guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Check if guild has feature enabled based on subscription
   */
  async hasFeature(guildId, feature) {
    const config = await this.getGuildConfig(guildId);
    if (!config) return false;

    // If the guild is disabled at platform level, block everything.
    if (config.is_active === false) return false;

    const tier = await this.getEffectiveTier(guildId);

    // If subscription_tiers row exists, it is authoritative.
    const tierConfig = await this.getTierConfig(tier);
    if (tierConfig && tierConfig.features) {
      // Allow an explicit "everything" override if configured in DB.
      if (tierConfig.features.everything === true) return true;
      return Boolean(tierConfig.features[feature]);
    }

    // Fallback only if tier config is missing in DB (backwards compatibility).
    const fallback = {
      free: {
        leveling: true,
        moderation_basic: true,
        custom_commands: 5,
        stream_notifications: 1,
        welcome: false,
        analytics: false,
        custom_branding: false,
        support_tickets: false,
        auto_roles: true,
        birthday_manager: false,
        feedback_queue: false,
        embed_builder: false,
        giveaways: false,
        ai_assistant: false,
        ai_tokens_monthly: 50000,
        economy: false,
        casino: false,
        quests: false,
      },
      basic: {
        leveling: true,
        moderation_advanced: true,
        custom_commands: 25,
        stream_notifications: 5,
        welcome: true,
        analytics: true,
        custom_branding: false,
        support_tickets: true,
        auto_roles: true,
        birthday_manager: true,
        feedback_queue: false,
        embed_builder: true,
        giveaways: false,
        ai_assistant: false,
        ai_tokens_monthly: 250000,
        economy: false,
        casino: false,
        quests: false,
        polls: false,
      },
      premium: {
        leveling: true,
        moderation_advanced: true,
        custom_commands: -1,
        stream_notifications: -1,
        welcome: true,
        analytics: true,
        custom_branding: true,
        xp_boost: 1.5,
        support_tickets: true,
        auto_roles: true,
        birthday_manager: true,
        feedback_queue: true,
        embed_builder: true,
        giveaways: true,
        ai_assistant: true,
        ai_tokens_monthly: 1000000,
        economy: true,
        casino: true,
        quests: true,
        polls: true,
      },
      enterprise: {
        // NOTE: do NOT force everything=true here; admin tier config should control this.
        leveling: true,
        moderation_advanced: true,
        custom_commands: -1,
        stream_notifications: -1,
        multi_guild: 5,
        api_access: true,
        support_tickets: true,
        auto_roles: true,
        birthday_manager: true,
        feedback_queue: true,
        embed_builder: true,
        giveaways: true,
        ai_assistant: true,
        ai_tokens_monthly: -1,
        economy: true,
        casino: true,
        quests: true,
        polls: true,
      }
    };

    return (fallback[tier] && fallback[tier][feature]) || false;
  }

  /**
   * Get effective tier for a guild (vote unlock > license > trial > subscription flags)
   */
  async getEffectiveTier(guildId) {
    const config = await this.getGuildConfig(guildId);
    if (!config) return 'free';
    if (config.is_active === false) return 'free';

    // Vote tier unlocks (trial-like) take precedence
    const voteTier = await this.getVoteTierUnlock(guildId);
    if (voteTier) return voteTier;

    const license = await this.getGuildLicense(guildId);
    if (license?.tier) return String(license.tier);

    // DB trial flag
    if (config.is_trial && config.trial_ends_at) {
      const trialEnd = new Date(config.trial_ends_at).getTime();
      if (Date.now() < trialEnd) {
        return 'enterprise';
      }

      // Trial expired - downgrade to free tier
      try {
        await this.supabase
          .from('guild_configs')
          .update({
            subscription_tier: 'free',
            subscription_active: false,
            is_trial: false
          })
          .eq('guild_id', guildId);
        this.invalidateGuild(guildId);
      } catch (e) {
        // best-effort
      }
      return 'free';
    }

    // Respect subscription_active/is_active. If inactive/disabled => free.
    if (config.subscription_active === false) return 'free';

    return String(config.subscription_tier || 'free');
  }

  /**
   * Get active vote tier unlock for a guild (if any)
   */
  async getVoteTierUnlock(guildId) {
    const cacheKey = `vote_unlock:${guildId}`;

    if (this.cache.has(cacheKey)) {
      const { tier, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < 60 * 1000) {
        return tier;
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('vote_tier_unlocks')
        .select('tier_name, expires_at, is_active')
        .eq('guild_id', guildId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        this.cache.set(cacheKey, { tier: null, timestamp: Date.now() });
        return null;
      }

      if (!data) {
        this.cache.set(cacheKey, { tier: null, timestamp: Date.now() });
        return null;
      }

      if (data.expires_at) {
        const expires = new Date(data.expires_at).getTime();
        if (Date.now() >= expires) {
          this.cache.set(cacheKey, { tier: null, timestamp: Date.now() });
          return null;
        }
      }

      const tier = data.tier_name ? String(data.tier_name) : null;
      this.cache.set(cacheKey, { tier, timestamp: Date.now() });
      return tier;
    } catch (e) {
      this.cache.set(cacheKey, { tier: null, timestamp: Date.now() });
      return null;
    }
  }

  /**
   * Get subscription limits
   */
  async getSubscriptionLimits(guildId) {
    const config = await this.getGuildConfig(guildId);
    if (!config) return null;

    if (config.is_active === false) {
      return { custom_commands: 0, stream_notifications: 0, xp_boost: 1.0 };
    }

    const tier = await this.getEffectiveTier(guildId);

    // If subscription_tiers row exists, it is authoritative.
    const tierConfig = await this.getTierConfig(tier);
    if (tierConfig && tierConfig.limits) {
      return tierConfig.limits;
    }

    const fallback = {
      free: { custom_commands: 5, stream_notifications: 1, twitter_monitors: 0, twitter_tweets_per_check: 5, twitter_check_interval: 120, xp_boost: 1.0, ai_tokens_monthly: 50000 },
      basic: { custom_commands: 25, stream_notifications: 5, twitter_monitors: 2, twitter_tweets_per_check: 10, twitter_check_interval: 60, xp_boost: 1.2, ai_tokens_monthly: 250000 },
      premium: { custom_commands: -1, stream_notifications: -1, twitter_monitors: 5, twitter_tweets_per_check: 25, twitter_check_interval: 30, xp_boost: 1.5, ai_tokens_monthly: 1000000 },
      enterprise: { custom_commands: -1, stream_notifications: -1, twitter_monitors: -1, twitter_tweets_per_check: 50, twitter_check_interval: 10, xp_boost: 2.0, ai_tokens_monthly: -1 }
    };

    return fallback[tier] || fallback.free;
  }

  /**
   * Get trial information for a guild
   */
  async getTrialInfo(guildId) {
    const config = await this.getGuildConfig(guildId);
    if (!config) return null;

    if (!config.is_trial || !config.trial_ends_at) {
      return { isTrial: false, daysRemaining: 0, trialEndsAt: null };
    }

    const trialEnd = new Date(config.trial_ends_at);
    const now = new Date();
    const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    return {
      isTrial: true,
      isActive: daysRemaining > 0,
      daysRemaining: Math.max(0, daysRemaining),
      trialEndsAt: config.trial_ends_at
    };
  }

  /**
   * Get tier configuration from database (cached)
   */
  async getTierConfig(tierName) {
    const cacheKey = `tier:${tierName}`;
    
    if (this.cache.has(cacheKey)) {
      const { config, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return config;
      }
    }

    try {
      const { data, error } = await this.supabase
        .from('subscription_tiers')
        .select('features, limits')
        .eq('tier_name', tierName)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      this.cache.set(cacheKey, {
        config: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      console.error(`Error fetching tier config for ${tierName}:`, error);
      return null;
    }
  }

  /**
   * Invalidate cache for specific guild
   */
  invalidateGuild(guildId) {
    this.cache.delete(`guild:${guildId}`);
    this.cache.delete(`leveling:${guildId}`);
    this.cache.delete(`moderation:${guildId}`);
    this.cache.delete(`welcome:${guildId}`);
    this.cache.delete(`license:${guildId}`);
  }

  /**
   * Clear entire cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Ensure guild exists in database and owner is authorized
   */
  async ensureGuild(guild, ownerId) {
    const { data: existing } = await this.supabase
      .from('guild_configs')
      .select('id')
      .eq('guild_id', guild.id)
      .single();

    if (existing) {
      // Update guild info including member count
      await this.supabase
        .from('guild_configs')
        .update({
          guild_name: guild.name,
          guild_icon_url: guild.iconURL(),
          owner_discord_id: ownerId,
          member_count: guild.memberCount || 0,
          is_active: true
        })
        .eq('guild_id', guild.id);
      
      // Ensure owner is in authorized users (for existing guilds too)
      await this.supabase
        .from('guild_authorized_users')
        .upsert({
          guild_id: guild.id,
          discord_id: ownerId,
          role: 'owner'
        }, {
          onConflict: 'guild_id,discord_id'
        })
        .catch(err => console.warn('Could not ensure owner in authorized users:', err));
      
      return existing;
    }

    // Create new guild with 30-day Premium trial
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const { data, error } = await this.supabase
      .from('guild_configs')
      .insert({
        guild_id: guild.id,
        guild_name: guild.name,
        guild_icon_url: guild.iconURL(),
        owner_discord_id: ownerId,
        member_count: guild.memberCount || 0,
        is_active: true,
        subscription_tier: 'enterprise',
        subscription_active: true,
        trial_ends_at: trialEndDate.toISOString(),
        is_trial: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating guild config:', error);
      return null;
    }

    // Add owner to authorized users
    await this.supabase
      .from('guild_authorized_users')
      .insert({
        guild_id: guild.id,
        discord_id: ownerId,
        role: 'owner'
      })
      .catch(err => console.warn('Could not add owner to authorized users:', err));

    // Defaults worden automatisch gecreëerd door database trigger
    return data;
  }

  /**
   * Check if a guild's subscription/license is active
   */
  async isSubscriptionActive(guildId) {
    try {
      const license = await this.getGuildLicense(guildId);
      if (license) {
        return true;
      }

      const { data, error } = await this.supabase
        .from('guild_configs')
        .select('subscription_active, is_active, subscription_tier, subscription_notes, subscription_updated_at')
        .eq('guild_id', guildId)
        .single();

      if (error || !data) {
        console.warn(`Could not fetch subscription status for guild ${guildId}`, error);
        const cached = await this.getGuildConfig(guildId);
        if (!cached) return false;
        const status = cached.subscription_active !== false && cached.is_active !== false;
        console.log(`[License] Fallback status for guild ${guildId}: ${status ? 'active' : 'inactive'} (from cache)`);
        return status;
      }

      const cacheKey = `guild:${guildId}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        this.cache.set(cacheKey, {
          config: { ...cached.config, ...data },
          timestamp: cached.timestamp
        });
      } else {
        const guildConfig = await this.getGuildConfig(guildId);
        if (guildConfig) {
          this.cache.set(cacheKey, {
            config: { ...guildConfig, ...data },
            timestamp: Date.now()
          });
        }
      }

      if (data.subscription_active === false) {
        console.log(`[License] Guild ${guildId} license disabled (subscription_active=false).`);
        return false;
      }
      if (data.is_active === false) {
        console.log(`[License] Guild ${guildId} platform disabled (is_active=false).`);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`Error checking license for guild ${guildId}:`, error);
      const cached = await this.getGuildConfig(guildId);
      if (!cached) return false;
      const status = cached.subscription_active !== false && cached.is_active !== false;
      console.log(`[License] Fallback (error) status for guild ${guildId}: ${status ? 'active' : 'inactive'} (from cache)`);
      return status;
    }
  }
}

module.exports = new ConfigManager();
