/**
 * Comcraft Economy Manager
 * Handles user balances, transactions, daily rewards, and payments
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const FeatureGate = require('../feature-gate');
const configManager = require('../config-manager');

class EconomyManager {
  constructor() {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL environment variable is required for EconomyManager');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for EconomyManager');
    }
    
    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      this.featureGate = new FeatureGate(configManager);
      this.cooldowns = new Map(); // For daily rewards
    } catch (error) {
      console.error('Error creating EconomyManager:', error);
      throw error;
    }
  }

  /**
   * Get or create user economy record
   */
  async getUserEconomy(guildId, userId, username = null, avatarUrl = null) {
    const { data, error } = await this.supabase
      .from('user_economy')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // User doesn't exist, create it
      const { data: newData, error: insertError } = await this.supabase
        .from('user_economy')
        .insert({
          guild_id: guildId,
          user_id: userId,
          username: username,
          avatar_url: avatarUrl,
          balance: 0,
          total_earned: 0,
          total_spent: 0,
          daily_streak: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user economy:', insertError);
        return null;
      }

      return newData;
    }

    if (error) {
      console.error('Error fetching user economy:', error);
      return null;
    }

    // Update username/avatar if provided
    if (username || avatarUrl) {
      const updates = {};
      if (username) updates.username = username;
      if (avatarUrl) updates.avatar_url = avatarUrl;

      await this.supabase
        .from('user_economy')
        .update(updates)
        .eq('guild_id', guildId)
        .eq('user_id', userId);
    }

    return data;
  }

  /**
   * Get economy config for guild (with defaults)
   */
  async getEconomyConfig(guildId) {
    const { data, error } = await this.supabase
      .from('economy_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Create default config
      const { data: newData, error: insertError } = await this.supabase
        .from('economy_configs')
        .insert({
          guild_id: guildId,
          daily_reward_base: 100,
          daily_streak_bonus: 10,
          daily_max_streak: 30,
          xp_to_coins_rate: 0.1,
          xp_conversion_enabled: true,
          max_balance: 1000000000,
          min_pay_amount: 1,
          max_pay_amount: 1000000,
          economy_enabled: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating economy config:', insertError);
        return null;
      }

      return newData;
    }

    if (error) {
      console.error('Error fetching economy config:', error);
      return null;
    }

    return data;
  }

  /**
   * Check if economy is enabled for guild
   */
  async isEconomyEnabled(guildId) {
    const hasFeature = await configManager.hasFeature(guildId, 'economy');
    if (!hasFeature) return false;

    const config = await this.getEconomyConfig(guildId);
    return config?.economy_enabled !== false;
  }

  /**
   * Add coins to user balance
   */
  async addCoins(guildId, userId, amount, transactionType = 'admin_add', description = null, metadata = null) {
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };

    const user = await this.getUserEconomy(guildId, userId);
    if (!user) return { success: false, error: 'User not found' };

    const config = await this.getEconomyConfig(guildId);
    if (!config) return { success: false, error: 'Economy config not found' };

    const newBalance = BigInt(user.balance) + BigInt(amount);
    if (newBalance > BigInt(config.max_balance)) {
      return { success: false, error: `Balance would exceed maximum of ${config.max_balance.toLocaleString()}` };
    }

    const { error: updateError } = await this.supabase
      .from('user_economy')
      .update({
        balance: newBalance.toString(),
        total_earned: (BigInt(user.total_earned) + BigInt(amount)).toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return { success: false, error: 'Failed to update balance' };
    }

    // Log transaction
    await this.logTransaction(guildId, null, userId, amount, transactionType, description, metadata);

    // Track quest progress (coin_earn) - only for legitimate earnings (not admin_add, admin_remove)
    if (global.questManager && !['admin_add', 'admin_remove'].includes(transactionType)) {
      try {
        if (await global.questManager.isTracking(guildId, 'coin_earn')) {
          await global.questManager.updateProgress(guildId, userId, 'coin_earn', {
            amount: amount
          });
        }
      } catch (error) {
        console.error('[Economy] Error updating quest progress for coin_earn:', error.message);
      }
    }

    return { success: true, newBalance: newBalance.toString() };
  }

  /**
   * Remove coins from user balance
   */
  async removeCoins(guildId, userId, amount, transactionType = 'admin_remove', description = null, metadata = null) {
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };

    const user = await this.getUserEconomy(guildId, userId);
    if (!user) return { success: false, error: 'User not found' };

    if (BigInt(user.balance) < BigInt(amount)) {
      return { success: false, error: 'Insufficient balance' };
    }

    const newBalance = BigInt(user.balance) - BigInt(amount);

    const { error: updateError } = await this.supabase
      .from('user_economy')
      .update({
        balance: newBalance.toString(),
        total_spent: (BigInt(user.total_spent) + BigInt(amount)).toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return { success: false, error: 'Failed to update balance' };
    }

    // Log transaction
    await this.logTransaction(guildId, userId, null, amount, transactionType, description, metadata);

    // Track quest progress (coin_spend)
    if (global.questManager && !['admin_remove'].includes(transactionType)) {
      try {
        if (await global.questManager.isTracking(guildId, 'coin_spend')) {
          await global.questManager.updateProgress(guildId, userId, 'coin_spend', {
            amount: amount
          });
        }
      } catch (error) {
        console.error('[Economy] Error updating quest progress for coin_spend:', error.message);
      }
    }

    return { success: true, newBalance: newBalance.toString() };
  }

  /**
   * Transfer coins between users
   */
  async transferCoins(guildId, fromUserId, toUserId, amount, description = null) {
    if (amount <= 0) return { success: false, error: 'Amount must be positive' };

    const config = await this.getEconomyConfig(guildId);
    if (!config) return { success: false, error: 'Economy config not found' };

    if (amount < config.min_pay_amount) {
      return { success: false, error: `Minimum payment is ${config.min_pay_amount.toLocaleString()} coins` };
    }

    if (amount > config.max_pay_amount) {
      return { success: false, error: `Maximum payment is ${config.max_pay_amount.toLocaleString()} coins` };
    }

    // Remove from sender
    const removeResult = await this.removeCoins(guildId, fromUserId, amount, 'pay', `Payment to user ${toUserId}`, { to_user_id: toUserId });
    if (!removeResult.success) {
      return removeResult;
    }

    // Add to receiver
    const addResult = await this.addCoins(guildId, toUserId, amount, 'pay_received', `Payment from user ${fromUserId}`, { from_user_id: fromUserId });
    if (!addResult.success) {
      // Rollback - add back to sender
      await this.addCoins(guildId, fromUserId, amount, 'pay_rollback', 'Payment rollback', { original_to: toUserId });
      return { success: false, error: 'Failed to complete payment' };
    }

    return { success: true, fromBalance: removeResult.newBalance, toBalance: addResult.newBalance };
  }

  /**
   * Claim daily reward
   */
  async claimDaily(guildId, userId, username = null, avatarUrl = null) {
    const user = await this.getUserEconomy(guildId, userId, username, avatarUrl);
    if (!user) return { success: false, error: 'Failed to get user economy' };

    const config = await this.getEconomyConfig(guildId);
    if (!config) return { success: false, error: 'Economy config not found' };

    const now = new Date();
    const lastClaim = user.last_daily_claim ? new Date(user.last_daily_claim) : null;

    // Check if already claimed today
    if (lastClaim) {
      const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (lastClaimDate.getTime() === today.getTime()) {
        const nextClaim = new Date(today);
        nextClaim.setDate(nextClaim.getDate() + 1);
        nextClaim.setHours(0, 0, 0, 0);

        const hoursUntil = Math.ceil((nextClaim - now) / (1000 * 60 * 60));

        return {
          success: false,
          error: 'Daily reward already claimed',
          nextClaim: nextClaim.toISOString(),
          hoursUntil,
        };
      }

      // Check if streak continues (claimed yesterday)
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastClaimDate.getTime() === yesterday.getTime()) {
        // Streak continues
        const newStreak = Math.min(user.daily_streak + 1, config.daily_max_streak);
        const reward = config.daily_reward_base + (newStreak * config.daily_streak_bonus);

        await this.supabase
          .from('user_economy')
          .update({
            daily_streak: newStreak,
            last_daily_claim: now.toISOString(),
          })
          .eq('guild_id', guildId)
          .eq('user_id', userId);

        const addResult = await this.addCoins(guildId, userId, reward, 'daily', `Daily reward (streak: ${newStreak})`, {
          streak: newStreak,
          base_reward: config.daily_reward_base,
          streak_bonus: newStreak * config.daily_streak_bonus,
        });

        return {
          success: true,
          reward,
          streak: newStreak,
          newBalance: addResult.newBalance,
        };
      } else {
        // Streak broken, reset to 1
        const reward = config.daily_reward_base + config.daily_streak_bonus;

        await this.supabase
          .from('user_economy')
          .update({
            daily_streak: 1,
            last_daily_claim: now.toISOString(),
          })
          .eq('guild_id', guildId)
          .eq('user_id', userId);

        const addResult = await this.addCoins(guildId, userId, reward, 'daily', 'Daily reward (streak: 1)', {
          streak: 1,
          base_reward: config.daily_reward_base,
          streak_bonus: config.daily_streak_bonus,
        });

        return {
          success: true,
          reward,
          streak: 1,
          newBalance: addResult.newBalance,
          streakBroken: true,
        };
      }
    } else {
      // First claim
      const reward = config.daily_reward_base + config.daily_streak_bonus;

      await this.supabase
        .from('user_economy')
        .update({
          daily_streak: 1,
          last_daily_claim: now.toISOString(),
        })
        .eq('guild_id', guildId)
        .eq('user_id', userId);

      const addResult = await this.addCoins(guildId, userId, reward, 'daily', 'Daily reward (streak: 1)', {
        streak: 1,
        base_reward: config.daily_reward_base,
        streak_bonus: config.daily_streak_bonus,
      });

      return {
        success: true,
        reward,
        streak: 1,
        newBalance: addResult.newBalance,
      };
    }
  }

  /**
   * Convert XP to coins
   */
  async convertXP(guildId, userId, xpAmount, xpManager) {
    const config = await this.getEconomyConfig(guildId);
    if (!config) return { success: false, error: 'Economy config not found' };

    if (!config.xp_conversion_enabled) {
      return { success: false, error: 'XP conversion is disabled for this server' };
    }

    if (xpAmount <= 0) return { success: false, error: 'XP amount must be positive' };

    // Get user XP from leveling system
    const { data: userLevel, error: levelError } = await this.supabase
      .from('user_levels')
      .select('xp, level')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    if (levelError || !userLevel) {
      return { success: false, error: 'User level data not found' };
    }

    if (userLevel.xp < xpAmount) {
      return { success: false, error: `Insufficient XP. You have ${userLevel.xp} XP, need ${xpAmount} XP` };
    }

    const coinsToAdd = Math.floor(xpAmount * config.xp_to_coins_rate);
    if (coinsToAdd <= 0) {
      return { success: false, error: 'Conversion would result in 0 coins' };
    }

    // Remove XP first using XP Manager
    if (xpManager) {
      const removeResult = await xpManager.removeXP(guildId, userId, xpAmount);
      if (!removeResult.success) {
        return { success: false, error: removeResult.error };
      }
      
      // Add coins after successful XP removal
      const addResult = await this.addCoins(guildId, userId, coinsToAdd, 'xp_convert', `Converted ${xpAmount} XP to coins`, {
        xp_amount: xpAmount,
        conversion_rate: config.xp_to_coins_rate,
        old_level: userLevel.level,
        new_level: removeResult.newLevel,
      });

      if (!addResult.success) {
        // Rollback XP removal (add XP back)
        await xpManager.addXP({ id: guildId }, { id: userId }, null);
        return addResult;
      }

      return {
        success: true,
        coinsAdded: coinsToAdd,
        xpUsed: xpAmount,
        newBalance: addResult.newBalance,
        oldLevel: userLevel.level,
        newLevel: removeResult.newLevel,
        levelChanged: removeResult.levelChanged,
      };
    }

    // Fallback if no xpManager provided (shouldn't happen)
    return { success: false, error: 'XP Manager not available' };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(guildId, limit = 10) {
    const { data, error } = await this.supabase
      .from('user_economy')
      .select('user_id, username, balance, total_earned')
      .eq('guild_id', guildId)
      .order('balance', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Log transaction
   */
  async logTransaction(guildId, fromUserId, toUserId, amount, transactionType, description = null, metadata = null) {
    await this.supabase
      .from('economy_transactions')
      .insert({
        guild_id: guildId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: amount,
        transaction_type: transactionType,
        description: description,
        metadata: metadata || {},
      });
  }

  /**
   * Get user transaction history
   */
  async getTransactionHistory(guildId, userId, limit = 20) {
    const { data, error } = await this.supabase
      .from('economy_transactions')
      .select('*')
      .eq('guild_id', guildId)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Format coins amount
   */
  formatCoins(amount) {
    return BigInt(amount).toLocaleString();
  }
}

// Explicit export to ensure it's exported as a class
if (typeof EconomyManager === 'undefined') {
  throw new Error('EconomyManager class is not defined');
}

module.exports = EconomyManager;

