/**
 * ComCraft Maid Jobs Manager
 * Handles maid job system: clock in/out, channel cleaning, rewards
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class MaidJobManager {
  constructor(client = null) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials required for MaidJobManager');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    this.client = client;
    this.economyManager = null;
    this.xpManager = null;

    // Default roleplay messages
    this.defaultRoleplayMessages = [
      "You cleaned behind some dusty paintings",
      "You swiped the floor clean",
      "You dusted off the old bookshelf",
      "You organized the scattered papers",
      "You polished the windows until they sparkled",
      "You vacuumed the carpets thoroughly",
      "You wiped down all the surfaces",
      "You mopped the floors with care",
      "You cleaned the cobwebs from the corners",
      "You straightened up the decorations",
      "You scrubbed the bathroom tiles",
      "You emptied and cleaned the trash bins",
      "You sanitized all the doorknobs",
      "You cleaned the baseboards meticulously",
      "You dusted the ceiling fan",
      "You organized the storage closet",
      "You polished the furniture until it shined",
      "You washed and folded the curtains",
      "You cleaned the window sills",
      "You swept away all the crumbs"
    ];

    // Cache for configs and roleplay messages
    this.configCache = new Map();
    this.messagesCache = new Map();
    this.cooldownCache = new Map(); // user:channel -> timestamp

    // Setup cleanup scheduler for abandoned sessions
    this.setupCleanupScheduler();
  }

  setClient(client) {
    this.client = client;
  }

  setManagers(economyManager, xpManager) {
    this.economyManager = economyManager;
    this.xpManager = xpManager;
  }

  setupCleanupScheduler() {
    // Clean up abandoned sessions every 30 minutes (sessions older than 2 hours)
    setInterval(async () => {
      try {
        await this.cleanupAbandonedSessions();
      } catch (error) {
        console.error('Error cleaning up abandoned maid sessions:', error);
      }
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  async cleanupAbandonedSessions() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { error } = await this.supabase
      .from('maid_sessions')
      .update({ 
        status: 'abandoned',
        completed_at: new Date().toISOString()
      })
      .eq('status', 'active')
      .lt('last_cleaning_at', twoHoursAgo)
      .is('last_cleaning_at', null)
      .or(`clocked_in_at.lt.${twoHoursAgo}`);

    if (error) {
      console.error('Error cleaning up abandoned sessions:', error);
    }
  }

  /**
   * Get or create maid job config for guild
   */
  async getConfig(guildId) {
    // Check cache first
    if (this.configCache.has(guildId)) {
      return this.configCache.get(guildId);
    }

    const { data, error } = await this.supabase
      .from('maid_jobs_config')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Config doesn't exist
      return null;
    }

    if (error) {
      console.error('Error fetching maid job config:', error);
      return null;
    }

    // Cache for 5 minutes
    this.configCache.set(guildId, data);
    setTimeout(() => this.configCache.delete(guildId), 5 * 60 * 1000);

    return data;
  }

  /**
   * Initialize maid jobs for a guild (first time setup)
   */
  async initializeConfig(guildId, maidQuartersChannelId) {
    const { data, error } = await this.supabase
      .from('maid_jobs_config')
      .insert({
        guild_id: guildId,
        maid_quarters_channel_id: maidQuartersChannelId,
        enabled: true
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Add default roleplay messages
    await this.addDefaultRoleplayMessages(guildId);

    // Clear cache
    this.configCache.delete(guildId);

    return data;
  }

  async addDefaultRoleplayMessages(guildId) {
    const messages = this.defaultRoleplayMessages.map(msg => ({
      guild_id: guildId,
      message: msg,
      enabled: true,
      weight: 1
    }));

    await this.supabase
      .from('maid_roleplay_messages')
      .insert(messages);

    // Clear cache
    this.messagesCache.delete(guildId);
  }

  /**
   * Get roleplay messages for guild
   */
  async getRoleplayMessages(guildId) {
    // Check cache
    if (this.messagesCache.has(guildId)) {
      return this.messagesCache.get(guildId);
    }

    const { data, error } = await this.supabase
      .from('maid_roleplay_messages')
      .select('*')
      .eq('guild_id', guildId)
      .eq('enabled', true);

    if (error) {
      console.error('Error fetching roleplay messages:', error);
      return this.defaultRoleplayMessages;
    }

    const messages = data && data.length > 0
      ? data.flatMap(msg => Array(msg.weight || 1).fill(msg.message))
      : this.defaultRoleplayMessages;

    // Cache for 10 minutes
    this.messagesCache.set(guildId, messages);
    setTimeout(() => this.messagesCache.delete(guildId), 10 * 60 * 1000);

    return messages;
  }

  /**
   * Get random roleplay message
   */
  async getRandomRoleplayMessage(guildId) {
    const messages = await this.getRoleplayMessages(guildId);
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Clock in user (start maid session)
   */
  async clockIn(guildId, userId) {
    // Check if config exists
    const config = await this.getConfig(guildId);
    if (!config || !config.enabled) {
      throw new Error('Maid jobs are not enabled for this server.');
    }

    // Check if user already has active session
    const { data: existingSession } = await this.supabase
      .from('maid_sessions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (existingSession) {
      throw new Error('You are already clocked in! Use `/maid clock-out` to end your current session.');
    }

    // Create new session
    const { data: session, error } = await this.supabase
      .from('maid_sessions')
      .insert({
        guild_id: guildId,
        user_id: userId,
        status: 'active',
        channels_cleaned: 0
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Update statistics
    await this.supabase
      .from('maid_statistics')
      .upsert({
        guild_id: guildId,
        user_id: userId,
        total_sessions: 1,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guild_id,user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()
      .then(({ data }) => {
        if (data) {
          // Increment total_sessions
          this.supabase
            .from('maid_statistics')
            .update({ 
              total_sessions: data.total_sessions + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', data.id);
        }
      });

    return session;
  }

  /**
   * Clock out user (end maid session)
   */
  async clockOut(guildId, userId) {
    const { data: session, error } = await this.supabase
      .from('maid_sessions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error || !session) {
      throw new Error('You are not currently clocked in.');
    }

    // Update session
    const { error: updateError } = await this.supabase
      .from('maid_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return session;
  }

  /**
   * Get active session for user
   */
  async getActiveSession(guildId, userId) {
    const { data, error } = await this.supabase
      .from('maid_sessions')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }

    if (error) {
      console.error('Error fetching active session:', error);
      return null;
    }

    return data;
  }

  /**
   * Clean a channel
   */
  async cleanChannel(guildId, userId, channelId, channelName = null) {
    // Check if user is clocked in
    const session = await this.getActiveSession(guildId, userId);
    if (!session) {
      throw new Error('You must clock in first! Go to the maid quarters channel and use `/maid clock-in`.');
    }

    // Get config
    const config = await this.getConfig(guildId);
    if (!config || !config.enabled) {
      throw new Error('Maid jobs are not enabled for this server.');
    }

    // Check if channel is in allowed list (if list is not empty)
    if (config.channels_to_clean && config.channels_to_clean.length > 0) {
      if (!config.channels_to_clean.includes(channelId)) {
        throw new Error('This channel cannot be cleaned.');
      }
    }

    // Check cooldown
    const cooldownKey = `${userId}:${channelId}`;
    const cooldownMinutes = config.cooldown_minutes || 5;
    const lastClean = this.cooldownCache.get(cooldownKey);
    
    if (lastClean) {
      const cooldownMs = cooldownMinutes * 60 * 1000;
      const timeLeft = cooldownMs - (Date.now() - lastClean);
      if (timeLeft > 0) {
        const minutesLeft = Math.ceil(timeLeft / 60000);
        throw new Error(`This channel was recently cleaned. Please wait ${minutesLeft} minute(s) before cleaning it again.`);
      }
    }

    // Check if user already cleaned this channel in this session
    const { data: existingCleaning } = await this.supabase
      .from('maid_cleanings')
      .select('id')
      .eq('session_id', session.id)
      .eq('channel_id', channelId)
      .single();

    if (existingCleaning) {
      throw new Error('You have already cleaned this channel in your current session.');
    }

    // Get random roleplay message
    const roleplayMessage = await this.getRandomRoleplayMessage(guildId);

    // Calculate rewards
    const coinsEarned = config.coins_per_cleaning || 10;
    const xpEarned = config.xp_per_cleaning || 5;

    // Record cleaning
    const { data: cleaning, error: cleaningError } = await this.supabase
      .from('maid_cleanings')
      .insert({
        session_id: session.id,
        guild_id: guildId,
        user_id: userId,
        channel_id: channelId,
        channel_name: channelName,
        roleplay_message: roleplayMessage,
        coins_earned: coinsEarned,
        xp_earned: xpEarned
      })
      .select()
      .single();

    if (cleaningError) {
      throw new Error(cleaningError.message);
    }

    // Update session
    const newChannelsCleaned = session.channels_cleaned + 1;
    await this.supabase
      .from('maid_sessions')
      .update({
        channels_cleaned: newChannelsCleaned,
        last_cleaning_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // Set cooldown
    this.cooldownCache.set(cooldownKey, Date.now());
    setTimeout(() => this.cooldownCache.delete(cooldownKey), cooldownMinutes * 60 * 1000);

    // Give rewards
    if (this.economyManager) {
      await this.economyManager.addCoins(guildId, userId, coinsEarned, 'maid_job_cleaning').catch(console.error);
    }

    if (this.xpManager) {
      await this.xpManager.addXP(guildId, userId, xpEarned, 'maid_job_cleaning').catch(console.error);
    }

    // Check for role upgrades
    await this.checkRoleUpgrades(guildId, userId, newChannelsCleaned);

    return {
      cleaning,
      channelsCleaned: newChannelsCleaned,
      coinsEarned,
      xpEarned,
      roleplayMessage
    };
  }

  /**
   * Check and apply role upgrades based on total cleanings
   */
  async checkRoleUpgrades(guildId, userId, channelsCleanedInSession) {
    const config = await this.getConfig(guildId);
    if (!config || !config.role_rewards) return;

    // Get total cleanings for user
    const { data: stats } = await this.supabase
      .from('maid_statistics')
      .select('total_cleanings, current_role_level')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (!stats) return;

    const totalCleanings = stats.total_cleanings;
    const roleRewards = config.role_rewards || {};

    // Get guild
    const guild = this.client?.guilds.cache.get(guildId);
    if (!guild) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    // Check each role reward threshold
    const thresholds = Object.keys(roleRewards)
      .map(Number)
      .sort((a, b) => b - a); // Sort descending

    for (const threshold of thresholds) {
      if (totalCleanings >= threshold) {
        const roleId = roleRewards[threshold.toString()];
        const role = guild.roles.cache.get(roleId);

        if (role && !member.roles.cache.has(roleId)) {
          // User reached threshold and doesn't have role yet
          await member.roles.add(roleId).catch(console.error);
          
          // Update role level in stats
          await this.supabase
            .from('maid_statistics')
            .update({ 
              current_role_level: threshold,
              updated_at: new Date().toISOString()
            })
            .eq('guild_id', guildId)
            .eq('user_id', userId);

          // Notify user
          try {
            await member.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🎉 Maid Job Promotion!')
                  .setDescription(`Congratulations! You've cleaned ${totalCleanings} channels and earned the **${role.name}** role!`)
                  .setColor(0x00FF00)
                  .setTimestamp()
              ]
            });
          } catch (error) {
            // Can't DM user, that's okay
          }

          break; // Only give highest role they qualify for
        }
      }
    }
  }

  /**
   * Get user maid statistics
   */
  async getUserStats(guildId, userId) {
    const { data, error } = await this.supabase
      .from('maid_statistics')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // User has no stats yet
      return {
        total_sessions: 0,
        total_cleanings: 0,
        total_channels_cleaned: 0,
        total_coins_earned: 0,
        total_xp_earned: 0,
        current_role_level: 0
      };
    }

    if (error) {
      console.error('Error fetching maid stats:', error);
      return null;
    }

    return data;
  }

  /**
   * Get maid leaderboard
   */
  async getLeaderboard(guildId, limit = 10) {
    const { data, error } = await this.supabase
      .from('maid_statistics')
      .select('*')
      .eq('guild_id', guildId)
      .order('total_cleanings', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching maid leaderboard:', error);
      return [];
    }

    return data || [];
  }
}

module.exports = MaidJobManager;

