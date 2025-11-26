/**
 * Combat XP Manager
 * Handles combat XP gains, level calculations, and combat statistics
 */

const { createClient } = require('@supabase/supabase-js');

class CombatXPManager {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Calculate combat level from XP
   * Formula: XP = 50 * (level^2 - level)
   * Inverse: level = (1 + sqrt(1 + 8*XP/50)) / 2
   */
  calculateLevel(xp) {
    if (xp <= 0) return 1;
    const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / 50)) / 2);
    return Math.max(1, level);
  }

  /**
   * Calculate XP required for a specific level
   */
  xpForLevel(level) {
    return 50 * (level * level - level);
  }

  /**
   * Calculate XP required for next level
   */
  xpForNextLevel(currentLevel) {
    return this.xpForLevel(currentLevel + 1);
  }

  /**
   * Calculate XP gained for winning a duel
   * Base: 50 XP + bonus based on bet amount and opponent level
   */
  calculateWinXP(betAmount, opponentLevel, currentStreak = 0) {
    const baseXP = 50;
    const betBonus = Math.floor(betAmount / 10); // 1 XP per 10 coins bet
    const levelBonus = Math.floor(opponentLevel / 5); // Bonus for beating higher level opponents
    const streakBonus = Math.min(currentStreak * 5, 50); // Up to 50 bonus XP for streaks
    
    return Math.min(baseXP + betBonus + levelBonus + streakBonus, 200); // Cap at 200 XP
  }

  /**
   * Calculate XP gained for losing a duel (participation reward)
   */
  calculateLossXP(betAmount) {
    const baseXP = 15;
    const betBonus = Math.floor(betAmount / 20); // Half the win bonus
    
    return Math.min(baseXP + betBonus, 50); // Cap at 50 XP
  }

  /**
   * Get combat stats for a user
   */
  async getCombatStats(guildId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_economy')
        .select('combat_xp, combat_level, duels_won, duels_lost, total_duels, total_damage_dealt, total_damage_taken, highest_win_streak, current_win_streak')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User doesn't exist yet, return defaults
          return {
            combat_xp: 0,
            combat_level: 1,
            duels_won: 0,
            duels_lost: 0,
            total_duels: 0,
            total_damage_dealt: 0,
            total_damage_taken: 0,
            highest_win_streak: 0,
            current_win_streak: 0,
            win_rate: 0,
          };
        }
        throw error;
      }

      const winRate = data.total_duels > 0 
        ? ((data.duels_won / data.total_duels) * 100).toFixed(1)
        : 0;

      return {
        ...data,
        win_rate: parseFloat(winRate),
      };
    } catch (error) {
      console.error('Error getting combat stats:', error);
      return null;
    }
  }

  /**
   * Award combat XP and update stats after a duel
   */
  async awardDuelXP(guildId, winnerId, loserId, betAmount, duelId, damageDealt = {}, damageTaken = {}) {
    try {
      // Get current stats for both players
      const [winnerStats, loserStats] = await Promise.all([
        this.getCombatStats(guildId, winnerId),
        this.getCombatStats(guildId, loserId),
      ]);

      // Calculate XP
      const winnerXP = this.calculateWinXP(betAmount, loserStats.combat_level, winnerStats.current_win_streak);
      const loserXP = this.calculateLossXP(betAmount);

      // Calculate new levels
      const winnerNewXP = winnerStats.combat_xp + winnerXP;
      const loserNewXP = loserStats.combat_xp + loserXP;
      const winnerNewLevel = this.calculateLevel(winnerNewXP);
      const loserNewLevel = this.calculateLevel(loserNewXP);

      // Calculate new streaks
      const winnerNewStreak = winnerStats.current_win_streak + 1;
      const winnerHighestStreak = Math.max(winnerStats.highest_win_streak, winnerNewStreak);
      const loserNewStreak = 0; // Lost streak resets

      // Update winner stats
      await this.supabase
        .from('user_economy')
        .upsert({
          guild_id: guildId,
          user_id: winnerId,
          combat_xp: winnerNewXP,
          combat_level: winnerNewLevel,
          duels_won: winnerStats.duels_won + 1,
          total_duels: winnerStats.total_duels + 1,
          total_damage_dealt: winnerStats.total_damage_dealt + (damageDealt[winnerId] || 0),
          total_damage_taken: winnerStats.total_damage_taken + (damageTaken[winnerId] || 0),
          highest_win_streak: winnerHighestStreak,
          current_win_streak: winnerNewStreak,
        }, {
          onConflict: 'guild_id,user_id',
          ignoreDuplicates: false,
        });

      // Update loser stats
      await this.supabase
        .from('user_economy')
        .upsert({
          guild_id: guildId,
          user_id: loserId,
          combat_xp: loserNewXP,
          combat_level: loserNewLevel,
          duels_lost: loserStats.duels_lost + 1,
          total_duels: loserStats.total_duels + 1,
          total_damage_dealt: loserStats.total_damage_dealt + (damageDealt[loserId] || 0),
          total_damage_taken: loserStats.total_damage_taken + (damageTaken[loserId] || 0),
          current_win_streak: loserNewStreak,
        }, {
          onConflict: 'guild_id,user_id',
          ignoreDuplicates: false,
        });

      // Log XP history
      await this.supabase
        .from('combat_xp_history')
        .insert([
          {
            guild_id: guildId,
            user_id: winnerId,
            xp_gained: winnerXP,
            reason: winnerNewStreak > 1 ? `duel_win_streak_${winnerNewStreak}` : 'duel_win',
            duel_id: duelId,
            level_before: winnerStats.combat_level,
            level_after: winnerNewLevel,
          },
          {
            guild_id: guildId,
            user_id: loserId,
            xp_gained: loserXP,
            reason: 'duel_loss',
            duel_id: duelId,
            level_before: loserStats.combat_level,
            level_after: loserNewLevel,
          },
        ]);

      return {
        success: true,
        winner: {
          xp_gained: winnerXP,
          new_xp: winnerNewXP,
          old_level: winnerStats.combat_level,
          new_level: winnerNewLevel,
          leveled_up: winnerNewLevel > winnerStats.combat_level,
          win_streak: winnerNewStreak,
        },
        loser: {
          xp_gained: loserXP,
          new_xp: loserNewXP,
          old_level: loserStats.combat_level,
          new_level: loserNewLevel,
          leveled_up: loserNewLevel > loserStats.combat_level,
        },
      };
    } catch (error) {
      console.error('Error awarding duel XP:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get combat leaderboard for a guild
   */
  async getLeaderboard(guildId, limit = 10, sortBy = 'combat_level') {
    try {
      const validSortFields = ['combat_level', 'combat_xp', 'duels_won', 'total_duels'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'combat_level';

      const { data, error } = await this.supabase
        .from('user_economy')
        .select('user_id, username, avatar_url, combat_xp, combat_level, duels_won, duels_lost, total_duels, current_win_streak')
        .eq('guild_id', guildId)
        .gt('total_duels', 0) // Only show users who have participated in duels
        .order(sortField, { ascending: false })
        .order('combat_xp', { ascending: false }) // Tiebreaker
        .limit(limit);

      if (error) throw error;

      return data.map(user => ({
        ...user,
        win_rate: user.total_duels > 0 
          ? parseFloat(((user.duels_won / user.total_duels) * 100).toFixed(1))
          : 0,
      }));
    } catch (error) {
      console.error('Error getting combat leaderboard:', error);
      return [];
    }
  }

  /**
   * Calculate damage multiplier based on combat level
   */
  getDamageMultiplier(combatLevel) {
    // 1.0x at level 1, increases by 0.02x per level, caps at 2.0x
    return Math.min(1.0 + (combatLevel - 1) * 0.02, 2.0);
  }

  /**
   * Calculate defense multiplier based on combat level
   */
  getDefenseMultiplier(combatLevel) {
    // 0% damage reduction at level 1, increases by 0.5% per level, caps at 25%
    const reductionPercent = Math.min((combatLevel - 1) * 0.5, 25);
    return 1.0 - (reductionPercent / 100);
  }
}

module.exports = CombatXPManager;

