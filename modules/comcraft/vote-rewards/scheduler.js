/**
 * Vote Rewards Scheduler
 * Deducts points daily from active tier unlocks and deactivates expired unlocks
 */

const { createClient } = require('@supabase/supabase-js');

class VoteRewardsScheduler {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduler (runs daily at midnight)
   */
  start() {
    // Run immediately on start
    this.processDailyDeductions().catch(err => {
      console.error('❌ [VoteRewards] Error in initial deduction run:', err);
    });

    // Schedule to run every 24 hours
    this.interval = setInterval(() => {
      this.processDailyDeductions().catch(err => {
        console.error('❌ [VoteRewards] Error in scheduled deduction run:', err);
      });
    }, 24 * 60 * 60 * 1000); // 24 hours

    console.log('✅ [VoteRewards] Scheduler started (runs every 24 hours)');
  }

  /**
   * Process daily point deductions for active unlocks
   */
  async processDailyDeductions() {
    if (this.isRunning) {
      console.log('⚠️  [VoteRewards] Deduction process already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('🔄 [VoteRewards] Starting daily point deductions...');

    try {
      // Get all active unlocks
      const { data: unlocks, error: unlocksError } = await this.supabase
        .from('vote_tier_unlocks')
        .select('*')
        .eq('is_active', true);

      if (unlocksError) {
        throw unlocksError;
      }

      if (!unlocks || unlocks.length === 0) {
        console.log('ℹ️  [VoteRewards] No active unlocks to process');
        this.isRunning = false;
        return;
      }

      console.log(`📊 [VoteRewards] Processing ${unlocks.length} active unlock(s)...`);

      let processed = 0;
      let deactivated = 0;
      let errors = 0;

      for (const unlock of unlocks) {
        try {
          // Check if deduction is needed (hasn't been deducted today)
          const lastDeduction = new Date(unlock.last_deduction_at);
          const now = new Date();
          const hoursSinceLastDeduction = (now - lastDeduction) / (1000 * 60 * 60);

          // Only deduct if it's been at least 20 hours since last deduction (to account for timing variations)
          if (hoursSinceLastDeduction < 20) {
            console.log(`⏭️  [VoteRewards] Skipping unlock ${unlock.id} (deducted ${Math.round(hoursSinceLastDeduction)}h ago)`);
            continue;
          }

          // Get user's current points
          const { data: votePoints } = await this.supabase
            .from('vote_points')
            .select('*')
            .eq('discord_user_id', unlock.discord_user_id)
            .maybeSingle();

          const currentPoints = votePoints?.total_points || 0;

          if (currentPoints < unlock.points_per_day) {
            // Not enough points, deactivate unlock
            console.log(`❌ [VoteRewards] Insufficient points for unlock ${unlock.id}, deactivating...`);
            
            await this.deactivateUnlock(unlock, 'insufficient_points');
            deactivated++;
            continue;
          }

          // Deduct points
          const newTotalPoints = currentPoints - unlock.points_per_day;
          const newPointsSpent = (votePoints?.points_spent || 0) + unlock.points_per_day;

          const { error: updateError } = await this.supabase
            .from('vote_points')
            .upsert({
              user_id: votePoints?.user_id,
              discord_user_id: unlock.discord_user_id,
              total_points: newTotalPoints,
              points_earned: votePoints?.points_earned || 0,
              points_spent: newPointsSpent,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'discord_user_id'
            });

          if (updateError) {
            throw updateError;
          }

          // Log transaction
          await this.supabase
            .from('vote_points_transactions')
            .insert({
              user_id: unlock.user_id,
              discord_user_id: unlock.discord_user_id,
              transaction_type: 'deducted',
              points: -unlock.points_per_day,
              description: `Daily deduction for ${unlock.tier_name} tier (guild: ${unlock.guild_id})`,
              related_unlock_id: unlock.id
            });

          // Update unlock's last_deduction_at and recalculate expires_at
          const newExpiresAt = new Date();
          const daysRemaining = Math.floor(newTotalPoints / unlock.points_per_day);
          newExpiresAt.setDate(newExpiresAt.getDate() + daysRemaining);

          const { error: unlockUpdateError } = await this.supabase
            .from('vote_tier_unlocks')
            .update({
              last_deduction_at: new Date().toISOString(),
              expires_at: newExpiresAt.toISOString()
            })
            .eq('id', unlock.id);

          if (unlockUpdateError) {
            console.error(`⚠️  [VoteRewards] Error updating unlock ${unlock.id}:`, unlockUpdateError);
          }

          // Update guild config to ensure tier is still active
          await this.supabase
            .from('guild_configs')
            .update({
              subscription_tier: unlock.tier_name,
              subscription_status: 'active',
              subscription_expires_at: newExpiresAt.toISOString()
            })
            .eq('guild_id', unlock.guild_id);

          processed++;
          console.log(`✅ [VoteRewards] Deducted ${unlock.points_per_day} points from unlock ${unlock.id} (remaining: ${newTotalPoints})`);

        } catch (error) {
          console.error(`❌ [VoteRewards] Error processing unlock ${unlock.id}:`, error);
          errors++;
        }
      }

      // Check for expired unlocks (expires_at has passed)
      const { data: expiredUnlocks } = await this.supabase
        .from('vote_tier_unlocks')
        .select('*')
        .eq('is_active', true)
        .lt('expires_at', new Date().toISOString());

      if (expiredUnlocks && expiredUnlocks.length > 0) {
        console.log(`⏰ [VoteRewards] Found ${expiredUnlocks.length} expired unlock(s), deactivating...`);
        
        for (const expired of expiredUnlocks) {
          await this.deactivateUnlock(expired, 'expired');
          deactivated++;
        }
      }

      console.log(`✅ [VoteRewards] Daily deductions complete: ${processed} processed, ${deactivated} deactivated, ${errors} errors`);

    } catch (error) {
      console.error('❌ [VoteRewards] Error in processDailyDeductions:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Deactivate an unlock
   */
  async deactivateUnlock(unlock, reason) {
    try {
      // Deactivate unlock
      await this.supabase
        .from('vote_tier_unlocks')
        .update({ is_active: false })
        .eq('id', unlock.id);

      // Log transaction
      await this.supabase
        .from('vote_points_transactions')
        .insert({
          user_id: unlock.user_id,
          discord_user_id: unlock.discord_user_id,
          transaction_type: 'expired',
          points: 0,
          description: `Unlock expired: ${unlock.tier_name} tier (guild: ${unlock.guild_id}) - Reason: ${reason}`,
          related_unlock_id: unlock.id
        });

      // Get guild's previous tier (or default to 'free')
      const { data: guildConfig } = await this.supabase
        .from('guild_configs')
        .select('subscription_tier')
        .eq('guild_id', unlock.guild_id)
        .maybeSingle();

      // Reset guild tier to free (or keep current if it's not the unlocked tier)
      const newTier = guildConfig?.subscription_tier === unlock.tier_name ? 'free' : guildConfig?.subscription_tier || 'free';

      await this.supabase
        .from('guild_configs')
        .update({
          subscription_tier: newTier,
          subscription_status: newTier === 'free' ? 'active' : guildConfig?.subscription_status || 'active',
          subscription_expires_at: null
        })
        .eq('guild_id', unlock.guild_id);

      console.log(`✅ [VoteRewards] Deactivated unlock ${unlock.id} (reason: ${reason})`);
    } catch (error) {
      console.error(`❌ [VoteRewards] Error deactivating unlock ${unlock.id}:`, error);
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('🛑 [VoteRewards] Scheduler stopped');
  }
}

module.exports = VoteRewardsScheduler;

