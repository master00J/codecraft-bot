/**
 * ComCraft Cam-Only Voice Manager
 * Enforces camera requirement for voice channels
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class CamOnlyVoiceManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.monitoredChannels = new Map(); // channelId -> config
    this.userWarnings = new Map(); // userId -> { channelId, warnings, lastWarning }
    this.userJoinTimes = new Map(); // `${userId}-${channelId}` -> joinTimestamp
    this.checkInterval = null;
  }

  /**
   * Initialize the manager - load configs and start monitoring
   */
  async initialize() {
    try {
      // Load all enabled configs
      const { data: configs, error } = await this.supabase
        .from('cam_only_voice_config')
        .select('*')
        .eq('enabled', true);

      if (error) {
        console.error('❌ [Cam-Only Voice] Error loading configs:', error);
        return;
      }

      // Cache configs
      for (const config of configs || []) {
        if (config.channel_ids && Array.isArray(config.channel_ids)) {
          for (const channelId of config.channel_ids) {
            this.monitoredChannels.set(channelId, config);
          }
        }
      }

      console.log(`✅ [Cam-Only Voice] Loaded ${this.monitoredChannels.size} monitored channels`);

      // Start periodic checks
      this.startPeriodicChecks();
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Initialization error:', error);
    }
  }

  /**
   * Get configuration for a guild
   */
  async getConfig(guildId) {
    const { data, error } = await this.supabase
      .from('cam_only_voice_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ [Cam-Only Voice] Error fetching config:', error);
      return null;
    }

    return data || {
      guild_id: guildId,
      enabled: false,
      channel_ids: [],
      grace_period_seconds: 10,
      warning_enabled: true,
      max_warnings: 2,
      exempt_roles: [],
      exempt_users: [],
      log_channel_id: null,
      channel_log_channels: {},
      channel_timeouts: {}
    };
  }

  /**
   * Save configuration
   */
  async saveConfig(config) {
    const { data, error } = await this.supabase
      .from('cam_only_voice_config')
      .upsert(config, { onConflict: 'guild_id' })
      .select()
      .single();

    if (error) {
      console.error('❌ [Cam-Only Voice] Error saving config:', error);
      return null;
    }

    // Update cache
    if (data.enabled && data.channel_ids) {
      for (const channelId of data.channel_ids) {
        this.monitoredChannels.set(channelId, data);
      }
    } else {
      // Remove from cache if disabled
      for (const [channelId, cachedConfig] of this.monitoredChannels.entries()) {
        if (cachedConfig.guild_id === config.guild_id) {
          this.monitoredChannels.delete(channelId);
        }
      }
    }

    return data;
  }

  /**
   * Check if a user has video stream enabled
   */
  hasVideoStream(voiceState) {
    // Check if user has video enabled
    // In Discord.js, we check the video property
    return voiceState.selfVideo === true;
  }

  /**
   * Check if user is exempt from cam requirement
   */
  async isExempt(member, config) {
    if (!config) return false;

    // Check exempt roles
    if (config.exempt_roles && Array.isArray(config.exempt_roles)) {
      for (const roleId of config.exempt_roles) {
        if (member.roles.cache.has(roleId)) {
          return true;
        }
      }
    }

    // Check exempt users
    if (config.exempt_users && Array.isArray(config.exempt_users)) {
      if (config.exempt_users.includes(member.id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user is currently in timeout for a channel
   */
  async isUserInTimeout(guildId, userId, channelId) {
    try {
      const { data, error } = await this.supabase
        .from('cam_only_voice_timeouts')
        .select('expires_at')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('channel_id', channelId)
        .single();

      if (error || !data) return false;

      const expiresAt = new Date(data.expires_at);
      const now = new Date();

      // If timeout expired, delete it and return false
      if (expiresAt <= now) {
        await this.supabase
          .from('cam_only_voice_timeouts')
          .delete()
          .eq('guild_id', guildId)
          .eq('user_id', userId)
          .eq('channel_id', channelId);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error checking timeout:', error);
      return false;
    }
  }

  /**
   * Calculate timeout expiration time from duration and unit
   */
  calculateTimeoutExpiration(duration, unit) {
    const now = new Date();
    const msPerMinute = 60 * 1000;
    const msPerHour = 60 * msPerMinute;
    const msPerDay = 24 * msPerHour;

    let milliseconds = 0;
    switch (unit) {
      case 'minutes':
        milliseconds = duration * msPerMinute;
        break;
      case 'hours':
        milliseconds = duration * msPerHour;
        break;
      case 'days':
        milliseconds = duration * msPerDay;
        break;
      default:
        milliseconds = duration * msPerMinute;
    }

    return new Date(now.getTime() + milliseconds);
  }

  /**
   * Apply timeout to user for a channel
   */
  async applyTimeout(guildId, userId, channelId, duration, unit) {
    try {
      const expiresAt = this.calculateTimeoutExpiration(duration, unit);

      await this.supabase
        .from('cam_only_voice_timeouts')
        .upsert({
          guild_id: guildId,
          user_id: userId,
          channel_id: channelId,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'guild_id,user_id,channel_id'
        });

      return expiresAt;
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error applying timeout:', error);
      return null;
    }
  }

  /**
   * Handle voice state update
   */
  async handleVoiceStateUpdate(oldState, newState) {
    // User joined a channel
    if (!oldState.channelId && newState.channelId) {
      const config = this.monitoredChannels.get(newState.channelId);
      if (!config || !config.enabled) return;

      const member = newState.member;
      if (!member) return;

      // Check if exempt
      const exempt = await this.isExempt(member, config);
      if (exempt) return;

      // Check if user is in timeout
      const inTimeout = await this.isUserInTimeout(member.guild.id, member.id, newState.channelId);
      if (inTimeout) {
        // Get timeout config for this channel
        const channelTimeout = config.channel_timeouts?.[newState.channelId];
        if (channelTimeout && channelTimeout.enabled) {
          try {
            // Get timeout expiration and channel_id
            const { data: timeoutData } = await this.supabase
              .from('cam_only_voice_timeouts')
              .select('expires_at, channel_id')
              .eq('guild_id', member.guild.id)
              .eq('user_id', member.id)
              .eq('channel_id', newState.channelId)
              .single();

            if (timeoutData) {
              const expiresAt = new Date(timeoutData.expires_at);
              const now = new Date();
              const remainingMs = expiresAt.getTime() - now.getTime();
              
              // Calculate time remaining correctly (use floor, not ceil, to avoid rounding up)
              const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
              const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
              const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));

              let timeLeft;
              if (remainingDays >= 1) {
                timeLeft = `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
              } else if (remainingHours >= 1) {
                timeLeft = `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
              } else if (remainingMinutes >= 1) {
                timeLeft = `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
              } else {
                timeLeft = 'less than a minute';
              }

              // Get channelId from the timeout data or from newState (save before disconnect)
              const targetChannelId = timeoutData.channel_id || newState.channelId;

              // Disconnect user
              await member.voice.disconnect('You are timed out from this cam-only voice channel');

              const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚫 Timeout Active')
                .setDescription(
                  `You cannot join <#${targetChannelId}> because you are currently timed out.\n\n` +
                  `**Time remaining:** ${timeLeft}\n\n` +
                  `You were timed out for not having your camera enabled. Please wait until the timeout expires.`
                )
                .setTimestamp();

              await member.send({ embeds: [embed] }).catch(() => {});
              return;
            }
          } catch (error) {
            console.error('❌ [Cam-Only Voice] Error handling timeout check:', error);
          }
        }
      }

      // Check if user has video
      if (!this.hasVideoStream(newState)) {
        // Record join time for grace period tracking
        const key = `${newState.id}-${newState.channelId}`;
        this.userJoinTimes.set(key, Date.now());
      } else {
        // User has video - clear join time tracking
        const key = `${newState.id}-${newState.channelId}`;
        this.userJoinTimes.delete(key);
      }
    }

    // User switched channels
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const config = this.monitoredChannels.get(newState.channelId);
      if (!config || !config.enabled) return;

      const member = newState.member;
      if (!member) return;

      // Check if exempt
      const exempt = await this.isExempt(member, config);
      if (exempt) return;

      // Check if user is in timeout for the target channel
      const inTimeout = await this.isUserInTimeout(member.guild.id, member.id, newState.channelId);
      if (inTimeout) {
        // Get timeout config for this channel
        const channelTimeout = config.channel_timeouts?.[newState.channelId];
        if (channelTimeout && channelTimeout.enabled) {
          try {
            // Get timeout expiration
            const { data: timeoutData } = await this.supabase
              .from('cam_only_voice_timeouts')
              .select('expires_at')
              .eq('guild_id', member.guild.id)
              .eq('user_id', member.id)
              .eq('channel_id', newState.channelId)
              .single();

            if (timeoutData) {
              const expiresAt = new Date(timeoutData.expires_at);
              const now = new Date();
              const remainingMs = expiresAt.getTime() - now.getTime();
              
              // Calculate time remaining correctly (use floor, not ceil, to avoid rounding up)
              const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
              const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
              const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));

              let timeLeft;
              if (remainingDays >= 1) {
                timeLeft = `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
              } else if (remainingHours >= 1) {
                timeLeft = `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
              } else if (remainingMinutes >= 1) {
                timeLeft = `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
              } else {
                timeLeft = 'less than a minute';
              }

              // Get channelId from the timeout data or from newState (save before disconnect)
              const targetChannelId = timeoutData.channel_id || newState.channelId;

              // Disconnect user (move them back to their previous channel or disconnect)
              await member.voice.disconnect('You are timed out from this cam-only voice channel');

              const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚫 Timeout Active')
                .setDescription(
                  `You cannot join <#${targetChannelId}> because you are currently timed out.\n\n` +
                  `**Time remaining:** ${timeLeft}\n\n` +
                  `You were timed out for not having your camera enabled. Please wait until the timeout expires.`
                )
                .setTimestamp();

              await member.send({ embeds: [embed] }).catch(() => {});
              return;
            }
          } catch (error) {
            console.error('❌ [Cam-Only Voice] Error handling timeout check on channel switch:', error);
          }
        }
      }

      if (!this.hasVideoStream(newState)) {
        // Record join time for grace period tracking
        const key = `${newState.id}-${newState.channelId}`;
        this.userJoinTimes.set(key, Date.now());
      } else {
        // User has video - clear join time tracking
        const key = `${newState.id}-${newState.channelId}`;
        this.userJoinTimes.delete(key);
      }
    }

    // User turned video on/off while in channel
    if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
      const config = this.monitoredChannels.get(newState.channelId);
      if (!config || !config.enabled) return;

      const member = newState.member;
      if (!member) return;

      const exempt = await this.isExempt(member, config);
      if (exempt) return;

      const key = `${newState.id}-${newState.channelId}`;

      // Video was on, now off - start grace period
      if (oldState.selfVideo && !newState.selfVideo) {
        this.userJoinTimes.set(key, Date.now()); // Start grace period from now
      } else if (newState.selfVideo) {
        // User turned video on - clear join time tracking and warnings
        this.userJoinTimes.delete(key);
        this.userWarnings.delete(key);
      }
    }

    // User left channel - cleanup tracking
    if (oldState.channelId && !newState.channelId) {
      const oldConfig = this.monitoredChannels.get(oldState.channelId);
      if (oldConfig) {
        const key = `${oldState.id}-${oldState.channelId}`;
        this.userJoinTimes.delete(key);
        this.userWarnings.delete(key);
      }
    }
  }

  /**
   * Handle user without video
   */
  async handleNoVideo(member, voiceState, config) {
    const userId = member.id;
    const channelId = voiceState.channelId;
    const key = `${userId}-${channelId}`;

    // Get or create warning record
    let warnings = this.userWarnings.get(key) || { warnings: 0, lastWarning: 0 };

    // Check if warning is enabled
    if (config.warning_enabled !== false) {
      const maxWarnings = config.max_warnings || 2;
      
      if (warnings.warnings < maxWarnings) {
        // Send warning
        warnings.warnings++;
        warnings.lastWarning = Date.now();
        this.userWarnings.set(key, warnings);

        try {
          const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Camera Required')
            .setDescription(
              `You need to enable your camera to stay in <#${channelId}>.\n` +
              `**Warning ${warnings.warnings}/${maxWarnings}**\n\n` +
              `Please enable your camera within the next few seconds or you will be disconnected.`
            )
            .setTimestamp();

          await member.send({ embeds: [embed] }).catch(() => {
            // User has DMs disabled, try to send in channel
            const channel = voiceState.channel;
            if (channel) {
              channel.send({ content: `<@${member.id}>`, embeds: [embed] })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000))
                .catch(() => {});
            }
          });
        } catch (error) {
          console.error('❌ [Cam-Only Voice] Error sending warning:', error);
        }

        // Log action
        await this.logAction(member, voiceState, config, 'warning', warnings.warnings);
        return;
      }
    }

    // Max warnings reached or warnings disabled - disconnect user
    try {
      await member.voice.disconnect('Camera required in this voice channel');

      // Check if timeout is enabled for this channel
      const channelTimeout = config.channel_timeouts?.[channelId];
      let timeoutExpiresAt = null;
      let timeoutMessage = '';

      if (channelTimeout && channelTimeout.enabled) {
        // Apply timeout
        timeoutExpiresAt = await this.applyTimeout(
          member.guild.id,
          userId,
          channelId,
          channelTimeout.duration,
          channelTimeout.unit
        );

        if (timeoutExpiresAt) {
          const now = new Date();
          const remainingMs = timeoutExpiresAt.getTime() - now.getTime();
          
          // Calculate time remaining correctly (use floor, not ceil, to avoid rounding up)
          const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
          const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
          const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));

          let timeLeft;
          if (remainingDays >= 1) {
            timeLeft = `${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
          } else if (remainingHours >= 1) {
            timeLeft = `${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
          } else if (remainingMinutes >= 1) {
            timeLeft = `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
          } else {
            timeLeft = 'less than a minute';
          }

          timeoutMessage = `\n\n⏰ **Timeout:** You are timed out for ${channelTimeout.duration} ${channelTimeout.unit} (${timeLeft} remaining). You cannot rejoin this channel until the timeout expires.`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚫 Disconnected')
        .setDescription(
          `You were disconnected from <#${channelId}> because your camera is not enabled.${timeoutMessage}`
        )
        .setTimestamp();

      await member.send({ embeds: [embed] }).catch(() => {});

      // Clear warnings
      this.userWarnings.delete(key);

      // Log action
      await this.logAction(member, voiceState, config, 'disconnect');
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error disconnecting user:', error);
    }
  }

  /**
   * Log action to log channel
   */
  async logAction(member, voiceState, config, action, warningCount = null) {
    // First check for per-channel log channel, then fallback to global log channel
    let logChannelId = null;
    
    if (config.channel_log_channels && typeof config.channel_log_channels === 'object') {
      // Check if this voice channel has a specific log channel
      logChannelId = config.channel_log_channels[voiceState.channelId] || null;
    }
    
    // Fallback to global log channel if no per-channel log channel is set
    if (!logChannelId) {
      logChannelId = config.log_channel_id;
    }
    
    if (!logChannelId) {
      console.log('⚠️ [Cam-Only Voice] No log channel configured for action:', action);
      return;
    }

    try {
      // Try to get channel from cache first, then fetch if needed
      const guild = member.guild;
      let logChannel = guild.channels.cache.get(logChannelId);
      
      if (!logChannel) {
        logChannel = await this.client.channels.fetch(logChannelId);
      }
      
      if (!logChannel) {
        console.error('❌ [Cam-Only Voice] Log channel not found:', logChannelId);
        return;
      }

      // Check if channel supports sending messages (text channels)
      if (!logChannel.isTextBased()) {
        console.error('❌ [Cam-Only Voice] Log channel must be a text channel, got type:', logChannel.type);
        return;
      }

      // Check bot permissions
      const botMember = await guild.members.fetch(this.client.user.id);
      if (!logChannel.permissionsFor(botMember).has(['SendMessages', 'EmbedLinks'])) {
        console.error('❌ [Cam-Only Voice] Bot lacks permissions to send messages in log channel:', logChannelId);
        return;
      }

      const actionText = action === 'warning' 
        ? `⚠️ Warning ${warningCount}/${config.max_warnings || 2}`
        : '🚫 Disconnected';

      const embed = new EmbedBuilder()
        .setColor(action === 'warning' ? 0xFFA500 : 0xFF0000)
        .setTitle('Cam-Only Voice Action')
        .setDescription(
          `**User:** ${member.user.tag} (${member.id})\n` +
          `**Channel:** <#${voiceState.channelId}>\n` +
          `**Action:** ${actionText}\n` +
          `**Reason:** Camera not enabled`
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
      console.log(`✅ [Cam-Only Voice] Logged ${action} to channel ${logChannel.name} (${logChannelId})`);
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error logging action:', error);
      console.error('  - Channel ID:', logChannelId);
      console.error('  - Action:', action);
      console.error('  - Error message:', error.message);
      if (error.stack) {
        console.error('  - Stack:', error.stack);
      }
    }
  }

  /**
   * Start periodic checks for users in monitored channels
   */
  startPeriodicChecks() {
    // Check every 5 seconds
    this.checkInterval = setInterval(async () => {
      try {
        for (const [channelId, config] of this.monitoredChannels.entries()) {
          if (!config.enabled) continue;

          const channel = await this.client.channels.fetch(channelId).catch(() => null);
          if (!channel || !channel.members) continue;

          for (const [memberId, member] of channel.members.entries()) {
            const voiceState = member.voice;
            if (!voiceState || !voiceState.channelId || voiceState.channelId !== channelId) continue;

            const exempt = await this.isExempt(member, config);
            if (exempt) continue;

            const key = `${memberId}-${channelId}`;
            
            if (!this.hasVideoStream(voiceState)) {
              // Check if grace period has passed
              const joinTime = this.userJoinTimes.get(key);
              const gracePeriod = (config.grace_period_seconds || 10) * 1000;
              
              if (joinTime && (Date.now() - joinTime) >= gracePeriod) {
                // Grace period has passed - handle no video
                await this.handleNoVideo(member, voiceState, config);
              }
              // If grace period hasn't passed yet, do nothing (wait)
            } else {
              // User has video - clear warnings and join time tracking
              this.userWarnings.delete(key);
              this.userJoinTimes.delete(key);
            }
          }
        }
      } catch (error) {
        console.error('❌ [Cam-Only Voice] Error in periodic check:', error);
      }
    }, 5000);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

module.exports = CamOnlyVoiceManager;

