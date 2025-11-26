/**
 * Comcraft XP Manager
 * Handles XP calculation and leveling
 */

const { createClient } = require('@supabase/supabase-js');
const configManager = require('../config-manager');

class XPManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.cooldowns = new Map();
  }

  /**
   * Check if user can gain XP (cooldown check)
   */
  canGainXP(userId, guildId, cooldownSeconds = 60) {
    const key = `${guildId}:${userId}`;
    const now = Date.now();

    if (this.cooldowns.has(key)) {
      const lastGain = this.cooldowns.get(key);
      const timePassed = (now - lastGain) / 1000;
      
      if (timePassed < cooldownSeconds) {
        return false;
      }
    }

    this.cooldowns.set(key, now);
    return true;
  }

  /**
   * Calculate random XP amount
   */
  calculateXP(min = 15, max = 25, boost = 1.0) {
    const baseXP = Math.floor(Math.random() * (max - min + 1)) + min;
    return Math.floor(baseXP * boost);
  }

  /**
   * Calculate level from XP
   */
  calculateLevel(xp) {
    // Formula: level = floor(sqrt(xp / 100))
    // More gradual curve than MEE6
    return Math.floor(Math.sqrt(xp / 100));
  }

  /**
   * Calculate XP needed for next level
   */
  xpForNextLevel(currentLevel) {
    // Formula: (level + 1)^2 * 100
    return Math.pow(currentLevel + 1, 2) * 100;
  }

  /**
   * Add XP to user
   */
  async addXP(guild, user, message) {
    try {
      // Check if guild is active and leveling is enabled
      const guildConfig = await configManager.getGuildConfig(guild.id);
      if (!guildConfig) {
        console.log(`⚠️  [XP] No guild config found for ${guild.id}`);
        return null;
      }

      const subscriptionActive = typeof configManager.isSubscriptionActive === 'function'
        ? await configManager.isSubscriptionActive(guild.id)
        : true;
      if (!subscriptionActive) {
        console.log(`⚠️  [XP] Subscription inactive for ${guild.name} (${guild.id})`);
        return null;
      }
      
      if (!guildConfig.leveling_enabled) {
        console.log(`⚠️  [XP] Leveling disabled for ${guild.name} - enable it in the dashboard!`);
        return null;
      }

      // Get leveling config
      const levelingConfig = await configManager.getLevelingConfig(guild.id);
      if (!levelingConfig) {
        console.log(`⚠️  [XP] No leveling config found for ${guild.id}`);
        return null;
      }
      
      // Check cooldown
      if (!this.canGainXP(user.id, guild.id, levelingConfig.xp_cooldown)) {
        // Cooldown active - this is normal, don't log
        return null;
      }

      console.log(`✅ [XP] ${user.username} gained XP in ${guild.name}`);

      // Calculate XP with subscription tier boost
      const subscriptionLimits = await configManager.getSubscriptionLimits(guild.id);
      const xpBoost = subscriptionLimits?.xp_boost || 1.0;
      
      console.log(`   🚀 XP Boost: ${xpBoost}x (${guildConfig.subscription_tier || 'free'} tier)`);
      
      const xpGain = this.calculateXP(
        levelingConfig.xp_min,
        levelingConfig.xp_max,
        xpBoost
      );

      // Get or create user level record
      let { data: userLevel } = await this.supabase
        .from('user_levels')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('user_id', user.id)
        .single();

      if (!userLevel) {
        // Create new record
        console.log(`   💾 Creating new XP record for ${user.username}...`);
        const { data: newUser, error: insertError } = await this.supabase
          .from('user_levels')
          .insert({
            guild_id: guild.id,
            user_id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar_url: user.displayAvatarURL(),
            xp: xpGain,
            level: 0,
            total_messages: 1,
            last_xp_gain: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) {
          console.error(`   ❌ Failed to create XP record:`, insertError);
          return null;
        }

        console.log(`   ✅ New user record created: ${xpGain} XP gained`);
        return {
          xpGained: xpGain,
          leveledUp: false,
          newLevel: 0,
          totalXP: xpGain
        };
      }

      // Calculate old and new levels
      const oldLevel = userLevel.level;
      const newXP = userLevel.xp + xpGain;
      const newLevel = this.calculateLevel(newXP);
      const leveledUp = newLevel > oldLevel;

      console.log(`   💾 Updating XP: ${userLevel.xp} → ${newXP} (+${xpGain})`);
      console.log(`   📊 Messages: ${userLevel.total_messages} → ${userLevel.total_messages + 1}`);

      // Update user
      const { error: updateError } = await this.supabase
        .from('user_levels')
        .update({
          xp: newXP,
          level: newLevel,
          total_messages: userLevel.total_messages + 1,
          last_xp_gain: new Date().toISOString(),
          username: user.username,
          avatar_url: user.displayAvatarURL()
        })
        .eq('guild_id', guild.id)
        .eq('user_id', user.id);

      if (updateError) {
        console.error(`   ❌ Failed to update XP:`, updateError);
        return null;
      }

      console.log(`   ✅ XP updated successfully! ${leveledUp ? '🎉 LEVEL UP!' : ''}`);

      return {
        xpGained: xpGain,
        leveledUp,
        oldLevel,
        newLevel,
        totalXP: newXP,
        xpForNext: this.xpForNextLevel(newLevel),
        config: levelingConfig
      };

    } catch (error) {
      console.error('Error adding XP:', error);
      return null;
    }
  }

  /**
   * Remove XP from a user (for conversions, penalties, etc.)
   */
  async removeXP(guildId, userId, xpAmount) {
    try {
      if (xpAmount <= 0) {
        return { success: false, error: 'XP amount must be positive' };
      }

      // Get user level record
      const { data: userLevel, error: fetchError } = await this.supabase
        .from('user_levels')
        .select('*')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !userLevel) {
        return { success: false, error: 'User level data not found' };
      }

      if (userLevel.xp < xpAmount) {
        return { success: false, error: 'Insufficient XP' };
      }

      // Calculate new XP and level
      const newXP = userLevel.xp - xpAmount;
      const newLevel = this.calculateLevel(newXP);
      const levelChanged = newLevel !== userLevel.level;

      // Update user XP
      const { error: updateError } = await this.supabase
        .from('user_levels')
        .update({
          xp: newXP,
          level: newLevel,
        })
        .eq('guild_id', guildId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('Failed to remove XP:', updateError);
        return { success: false, error: 'Failed to update XP' };
      }

      console.log(`✅ [XP] Removed ${xpAmount} XP from user ${userId} in guild ${guildId}`);
      if (levelChanged) {
        console.log(`   📉 Level changed: ${userLevel.level} → ${newLevel}`);
      }

      return {
        success: true,
        xpRemoved: xpAmount,
        newXP,
        newLevel,
        oldLevel: userLevel.level,
        levelChanged,
      };
    } catch (error) {
      console.error('Error removing XP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user level info
   */
  async getUserLevel(guildId, userId) {
    const { data } = await this.supabase
      .from('user_levels')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (!data) {
      return {
        xp: 0,
        level: 0,
        rank: 0,
        totalMessages: 0,
        xpForNext: this.xpForNextLevel(0) // 100 XP for level 1
      };
    }

    // Get rank
    const { data: allUsers } = await this.supabase
      .from('user_levels')
      .select('user_id, xp')
      .eq('guild_id', guildId)
      .order('xp', { ascending: false });

    const rank = allUsers.findIndex(u => u.user_id === userId) + 1;

    return {
      xp: data.xp || 0,
      level: data.level || 0,
      rank,
      totalMessages: data.total_messages || 0,
      xpForNext: this.xpForNextLevel(data.level || 0)
    };
  }

  /**
   * Get guild leaderboard
   */
  async getLeaderboard(guildId, limit = 10) {
    const { data } = await this.supabase
      .from('user_levels')
      .select('*')
      .eq('guild_id', guildId)
      .order('xp', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Get level rewards for a specific level
   */
  async getLevelRewards(guildId, level) {
    const { data } = await this.supabase
      .from('level_rewards')
      .select('*')
      .eq('guild_id', guildId)
      .eq('level', level);

    return data || [];
  }

  /**
   * Give level rewards to user
   */
  async giveRewards(guild, member, level) {
    const rewards = await this.getLevelRewards(guild.id, level);
    
    const givenRewards = [];

    for (const reward of rewards) {
      if (reward.reward_type === 'role' || reward.reward_type === 'both') {
        if (reward.role_id) {
          try {
            const role = guild.roles.cache.get(reward.role_id);
            if (role) {
              await member.roles.add(role);
              givenRewards.push({
                type: 'role',
                value: role.name
              });
            }
          } catch (error) {
            console.error('Error giving role reward:', error);
          }
        }
      }

      if (reward.message) {
        givenRewards.push({
          type: 'message',
          value: reward.message
        });
      }
    }

    return givenRewards;
  }

  /**
   * Set user XP (admin command)
   */
  async setXP(guildId, userId, xp) {
    const newLevel = this.calculateLevel(xp);

    const { error } = await this.supabase
      .from('user_levels')
      .upsert({
        guild_id: guildId,
        user_id: userId,
        xp,
        level: newLevel
      }, {
        onConflict: 'guild_id,user_id'
      });

    return !error;
  }

  /**
   * Reset user XP
   */
  async resetXP(guildId, userId) {
    const { error } = await this.supabase
      .from('user_levels')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Reset entire guild leaderboard
   */
  async resetGuild(guildId) {
    const { error } = await this.supabase
      .from('user_levels')
      .delete()
      .eq('guild_id', guildId);

    return !error;
  }

  /**
   * Generate XP bar visualization based on customization settings
   * @param {number} progress - Progress percentage (0-100)
   * @param {object} config - Leveling config with customization settings
   * @returns {string} Visual representation of XP bar
   */
  generateXPBar(progress, config = {}) {
    const style = config.xp_bar_style || 'gradient';
    const filled = Math.floor(progress / 10); // 0-10 blocks
    const empty = 10 - filled;

    if (style === 'image' && config.xp_bar_image_url) {
      // For image style, return a text representation
      // The actual image will be used in embed.setImage() separately
      return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
    }

    // For gradient or solid, use emoji blocks
    const filledBlock = style === 'gradient' ? '█' : '▓';
    // Create a more visual bar without brackets for cleaner look
    return `${filledBlock.repeat(filled)}${'░'.repeat(empty)}`;
  }

  /**
   * Generate detailed XP bar with percentage and visual representation
   * @param {number} currentXP - Current XP
   * @param {number} xpForNext - XP needed for next level
   * @param {object} config - Leveling config with customization settings
   * @returns {string} Formatted XP bar string
   */
  generateDetailedXPBar(currentXP, xpForNext, config = {}) {
    const progress = Math.floor(((currentXP % xpForNext) / xpForNext) * 100);
    const xpBar = this.generateXPBar(progress, config);
    const currentLevelXP = currentXP % xpForNext;
    
    return `\`${xpBar}\` **${progress}%**\n\`${currentLevelXP.toLocaleString()} / ${xpForNext.toLocaleString()} XP\``;
  }
}

module.exports = new XPManager();

