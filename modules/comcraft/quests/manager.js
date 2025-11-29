/**
 * ComCraft Quest Manager
 * Handles quest creation, progress tracking, and completion
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');

class QuestManager {
  constructor(client = null) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials required for QuestManager');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.client = client; // Discord client for sending notifications
    this.economyManager = null; // Will be set from global
    this.xpManager = null; // Will be set from global

    // Cache for active quest types per guild (to avoid unnecessary DB queries)
    this.activeTrackers = new Map(); // guildId:questType -> boolean
    this.cacheExpiry = new Map(); // guildId:questType -> expiry timestamp
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    // Scheduled reset check (runs every hour)
    this.setupResetScheduler();
    
    // Setup deadline/timer checker (runs every 5 minutes)
    this.setupDeadlineChecker();
  }

  /**
   * Set Discord client (can be set later if not available at construction)
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * Set managers for rewards (called after initialization)
   */
  setManagers(economyManager, xpManager) {
    this.economyManager = economyManager;
    this.xpManager = xpManager;
  }

  /**
   * Setup scheduled job to reset daily/weekly/monthly quests
   */
  setupResetScheduler() {
    // Check for resets every hour
    setInterval(async () => {
      try {
        await this.processQuestResets();
      } catch (error) {
        console.error('Error in quest reset scheduler:', error);
      }
    }, 3600000); // Every hour

    // Also check immediately on startup
    setTimeout(() => this.processQuestResets(), 60000); // After 1 minute
  }

  /**
   * Check if we should track a specific quest type for a guild
   */
  async isTracking(guildId, questType) {
    const cacheKey = `${guildId}:${questType}`;
    const now = Date.now();

    // Check cache
    if (this.activeTrackers.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        return this.activeTrackers.get(cacheKey);
      }
    }

    // Query database
    try {
      const { data, error } = await this.supabase
        .from('quests')
        .select('id')
        .eq('guild_id', guildId)
        .eq('quest_type', questType)
        .eq('enabled', true)
        .limit(1);

      const hasActiveQuests = !error && data && data.length > 0;

      // Update cache
      this.activeTrackers.set(cacheKey, hasActiveQuests);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return hasActiveQuests;
    } catch (error) {
      console.error(`Error checking quest tracking for ${guildId}:${questType}:`, error);
      return false;
    }
  }

  /**
   * Invalidate cache for a guild (call after creating/updating/deleting quests)
   */
  invalidateCache(guildId, questType = null) {
    if (questType) {
      const cacheKey = `${guildId}:${questType}`;
      this.activeTrackers.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    } else {
      // Invalidate all quest types for this guild
      for (const key of this.activeTrackers.keys()) {
        if (key.startsWith(`${guildId}:`)) {
          this.activeTrackers.delete(key);
          this.cacheExpiry.delete(key);
        }
      }
    }
  }

  /**
   * Update progress for a quest type
   */
  async updateProgress(guildId, userId, questType, data) {
    try {
      // Get all active quests of this type for this user
      const { data: quests, error } = await this.supabase
        .from('quests')
        .select(`
          *,
          quest_progress!left(*)
        `)
        .eq('guild_id', guildId)
        .eq('quest_type', questType)
        .eq('enabled', true)
        .eq('visible', true);

      if (error) {
        console.error('Error fetching quests:', error);
        return;
      }

      if (!quests || quests.length === 0) {
        return;
      }

      for (const quest of quests) {
        // Get user's progress for this quest
        const progress = quest.quest_progress && quest.quest_progress.length > 0
          ? quest.quest_progress[0]
          : null;

        // Check if already completed and not repeatable
        if (progress && progress.completed && quest.reset_type === 'never' && !quest.max_completions) {
          continue;
        }

        // Check prerequisites
        if (!(await this.checkPrerequisites(guildId, userId, quest))) {
          continue;
        }

        // Check cooldown
        if (!(await this.checkCooldown(quest, userId, progress))) {
          continue;
        }

        // Validate requirements (channel, role, etc.)
        if (!this.validateRequirements(quest.requirements || {}, data)) {
          continue;
        }

        // Get or create progress
        let currentProgress = progress;
        if (!currentProgress) {
          currentProgress = await this.createProgress(quest, userId);
          if (!currentProgress) continue;
        }

        // Check if quest is expired/over deadline
        if (await this.isQuestExpired(quest, currentProgress)) {
          continue; // Quest expired, skip tracking
        }

        // Check if quest is available (start_date/end_date)
        if (!this.isQuestAvailable(quest)) {
          continue; // Quest not yet available or expired
        }

        // Calculate new progress
        const newProgress = this.calculateProgress(quest, currentProgress, data);

        // Update progress
        const { error: updateError } = await this.supabase
          .from('quest_progress')
          .update({
            current_progress: newProgress,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentProgress.id);

        if (updateError) {
          console.error('Error updating quest progress:', updateError);
          continue;
        }

        // Check milestones
        await this.checkMilestones(quest, userId, currentProgress.id, currentProgress.current_progress, newProgress);

        // Check if completed
        const target = quest.requirements?.target || 0;
        if (newProgress >= target) {
          await this.completeQuest(quest, userId, newProgress, currentProgress);
        }
      }
    } catch (error) {
      console.error('Error updating quest progress:', error);
    }
  }

  /**
   * Create initial progress record for a quest
   */
  async createProgress(quest, userId) {
    const target = quest.requirements?.target || 0;
    const resetAt = this.calculateResetTime(quest);

    const { data, error } = await this.supabase
      .from('quest_progress')
      .insert({
        quest_id: quest.id,
        guild_id: quest.guild_id,
        user_id: userId,
        current_progress: 0,
        target_progress: target,
        reset_at: resetAt ? resetAt.toISOString() : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating quest progress:', error);
      return null;
    }

    return data;
  }

  /**
   * Calculate new progress value
   */
  calculateProgress(quest, currentProgress, data) {
    const increment = data.increment || data.amount || 1;
    return Math.min(
      (currentProgress.current_progress || 0) + increment,
      currentProgress.target_progress
    );
  }

  /**
   * Check if user meets quest prerequisites
   */
  async checkPrerequisites(guildId, userId, quest) {
    // Check quest chain prerequisites first
    if (quest.chain_id && quest.chain_position) {
      // If this is not the first quest in the chain, check if previous quest is completed
      if (quest.chain_position > 1) {
        const { data: chainQuests } = await this.supabase
          .from('quests')
          .select('id')
          .eq('chain_id', quest.chain_id)
          .eq('chain_position', quest.chain_position - 1)
          .maybeSingle();

        if (chainQuests) {
          const { data: prevProgress } = await this.supabase
            .from('quest_progress')
            .select('completed')
            .eq('guild_id', guildId)
            .eq('user_id', userId)
            .eq('quest_id', chainQuests.id)
            .maybeSingle();

          if (!prevProgress || !prevProgress.completed) {
            return false; // Previous quest in chain not completed
          }
        }
      }
    }

    // Check regular prerequisites
    if (!quest.prerequisite_quest_ids || quest.prerequisite_quest_ids.length === 0) {
      return true;
    }

    // Check if user has completed all prerequisite quests
    const { data, error } = await this.supabase
      .from('quest_progress')
      .select('quest_id, completed')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .in('quest_id', quest.prerequisite_quest_ids);

    if (error) {
      console.error('Error checking prerequisites:', error);
      return false;
    }

    // All prerequisites must be completed
    const completedPrereqs = (data || []).filter(p => p.completed).length;
    return completedPrereqs === quest.prerequisite_quest_ids.length;
  }

  /**
   * Check if quest is on cooldown
   */
  async checkCooldown(quest, userId, progress) {
    if (!quest.completion_cooldown_hours || !progress || !progress.last_completed_at) {
      return true; // No cooldown
    }

    const lastCompleted = new Date(progress.last_completed_at);
    const now = new Date();
    const hoursSinceCompletion = (now - lastCompleted) / (1000 * 60 * 60);

    return hoursSinceCompletion >= quest.completion_cooldown_hours;
  }

  /**
   * Validate quest requirements (channel, role filters, etc.)
   */
  validateRequirements(requirements, data) {
    // Channel filter
    if (requirements.channel_ids && requirements.channel_ids.length > 0) {
      if (!data.channelId || !requirements.channel_ids.includes(data.channelId)) {
        return false;
      }
    }

    // Role filter (would need to be checked separately, not in data)
    // This is handled in getUserQuests instead

    // Level requirement (would need to be checked separately)
    // This is handled in getUserQuests instead

    return true;
  }

  /**
   * Complete a quest and give rewards
   */
  async completeQuest(quest, userId, finalProgress, progress) {
    try {
      const now = new Date();

      // Mark as completed
      await this.supabase
        .from('quest_progress')
        .update({
          completed: true,
          completed_at: now.toISOString(),
          current_progress: finalProgress,
          completion_count: (progress.completion_count || 0) + 1,
          last_completed_at: now.toISOString()
        })
        .eq('quest_id', quest.id)
        .eq('user_id', userId);

      // Get rewards to give
      const rewards = quest.rewards || {};

      // Give rewards
      await this.giveRewards(quest.guild_id, userId, rewards);

      // Log completion
      await this.supabase
        .from('quest_completions')
        .insert({
          quest_id: quest.id,
          guild_id: quest.guild_id,
          user_id: userId,
          progress_achieved: finalProgress,
          rewards_given: rewards,
          completion_number: (progress.completion_count || 0) + 1
        });

      // Check if quest should be reset for next cycle
      if (quest.reset_type !== 'never') {
        const maxCompletions = quest.max_completions;
        const currentCompletions = (progress.completion_count || 0) + 1;

        if (!maxCompletions || currentCompletions < maxCompletions) {
          // Will be reset by the scheduler
        }
      }

      // Send notification to user (optional)
      await this.sendCompletionNotification(quest, userId, rewards);

      // Check if quest is part of a chain and if chain is completed
      if (quest.chain_id) {
        await this.checkChainCompletion(quest.guild_id, userId, quest.chain_id, quest);
      }

      // Return rewards for the command handler to process
      return { success: true, rewards };
    } catch (error) {
      console.error('Error completing quest:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a quest chain is completed and give chain rewards
   */
  async checkChainCompletion(guildId, userId, chainId, completedQuest) {
    try {
      // Get chain info
      const { data: chain, error: chainError } = await this.supabase
        .from('quest_chains')
        .select('*')
        .eq('id', chainId)
        .eq('guild_id', guildId)
        .single();

      if (chainError || !chain || !chain.enabled) {
        return;
      }

      // Get all quests in chain
      const { data: chainQuests } = await this.supabase
        .from('quests')
        .select('id, chain_position')
        .eq('chain_id', chainId)
        .eq('guild_id', guildId)
        .order('chain_position', { ascending: true });

      if (!chainQuests || chainQuests.length === 0) {
        return;
      }

      // Check if user has completed all quests in chain
      const { data: progressRecords } = await this.supabase
        .from('quest_progress')
        .select('quest_id, completed')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .in('quest_id', chainQuests.map(q => q.id));

      if (!progressRecords) {
        return;
      }

      const completedQuests = progressRecords.filter(p => p.completed);
      
      // Check if all quests in chain are completed
      if (completedQuests.length === chainQuests.length) {
        // Check if chain was already completed by this user
        const { data: chainProgress } = await this.supabase
          .from('quest_chain_progress')
          .select('id, chain_rewards_given')
          .eq('chain_id', chainId)
          .eq('guild_id', guildId)
          .eq('user_id', userId)
          .maybeSingle();

        if (chainProgress && chainProgress.chain_rewards_given) {
          return; // Already completed and rewarded
        }

        // Mark chain as completed
        await this.supabase
          .from('quest_chain_progress')
          .upsert({
            chain_id: chainId,
            guild_id: guildId,
            user_id: userId,
            completed_quest_ids: chainQuests.map(q => q.id),
            completed_at: new Date().toISOString(),
            chain_rewards_given: true
          }, {
            onConflict: 'chain_id,user_id'
          });

        // Give chain completion rewards
        const chainRewards = chain.chain_rewards || {};
        if (chainRewards.coins || chainRewards.xp) {
          await this.giveRewards(guildId, userId, chainRewards);
        }

        // Send chain completion notification
        if (this.client) {
          try {
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
              const user = await this.client.users.fetch(userId).catch(() => null);
              if (user) {
                const embed = new EmbedBuilder()
                  .setColor('#FFD700')
                  .setTitle('🏆 Quest Chain Completed!')
                  .setDescription(`Congratulations! You've completed the entire quest chain: **${chain.name}**!`)
                  .addFields({
                    name: 'Chain Completion Rewards',
                    value: [
                      chainRewards.coins ? `💰 ${chainRewards.coins} coins` : '',
                      chainRewards.xp ? `⭐ ${chainRewards.xp} XP` : ''
                    ].filter(Boolean).join('\n') || 'Amazing job!',
                    inline: false
                  })
                  .setTimestamp();

                try {
                  await user.send({ embeds: [embed] });
                } catch (error) {
                  // User has DMs disabled - that's okay
                }
              }
            }
          } catch (error) {
            console.error('Error sending chain completion notification:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking chain completion:', error);
    }
  }

  /**
   * Give quest rewards
   */
  async giveRewards(guildId, userId, rewards) {
    try {
      // Give coins if economy manager available
      if (rewards.coins && rewards.coins > 0) {
        const economyMgr = this.economyManager || global.economyManager;
        if (economyMgr) {
          await economyMgr.addCoins(guildId, userId, rewards.coins, 'quest', 'Quest reward');
        }
      }
      
      // Give XP if XP manager available
      if (rewards.xp && rewards.xp > 0) {
        const xpMgr = this.xpManager || global.xpManager;
        if (xpMgr && this.client) {
          try {
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
              const user = await this.client.users.fetch(userId).catch(() => null);
              if (user) {
                // Use addXP which expects guild, user, message objects
                // For quest rewards, we'll need to add XP directly to the database
                const { data: userLevel } = await this.supabase
                  .from('user_levels')
                  .select('xp, level')
                  .eq('guild_id', guildId)
                  .eq('user_id', userId)
                  .single();

                if (userLevel) {
                  const newXP = userLevel.xp + rewards.xp;
                  const newLevel = this.calculateLevel(newXP);
                  
                  await this.supabase
                    .from('user_levels')
                    .update({
                      xp: newXP,
                      level: newLevel
                    })
                    .eq('guild_id', guildId)
                    .eq('user_id', userId);
                } else {
                  // Create new record
                  await this.supabase
                    .from('user_levels')
                    .insert({
                      guild_id: guildId,
                      user_id: userId,
                      username: user.username,
                      xp: rewards.xp,
                      level: this.calculateLevel(rewards.xp)
                    });
                }
              }
            }
          } catch (error) {
            console.error('Error giving XP reward:', error);
          }
        }
      }
      
      // Give role if client available
      if (rewards.role_id && this.client) {
        try {
          const guild = this.client.guilds.cache.get(guildId);
          if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            const role = guild.roles.cache.get(rewards.role_id);
            if (member && role) {
              await member.roles.add(role);
            }
          }
        } catch (error) {
          console.error('Error giving role reward:', error);
        }
      }
      
      // Give combat item if inventory manager available
      if (rewards.item_id) {
        const inventoryMgr = global.inventoryManager;
        if (inventoryMgr) {
          await inventoryMgr.addItem(guildId, userId, rewards.item_id, 1);
        }
      }
    } catch (error) {
      console.error('Error giving quest rewards:', error);
      // Don't fail quest completion if reward giving fails
    }
  }

  /**
   * Calculate level from XP (helper method)
   */
  calculateLevel(xp) {
    return Math.floor(Math.sqrt(xp / 100));
  }

  /**
   * Check if quest is expired (deadline passed)
   */
  async isQuestExpired(quest, progress) {
    if (!quest.deadline_at && !quest.time_limit_hours) {
      return false; // No deadline
    }

    const now = new Date();
    
    // Check absolute deadline
    if (quest.deadline_at) {
      const deadline = new Date(quest.deadline_at);
      if (now > deadline) {
        return true; // Deadline passed
      }
    }

    // Check time limit from start
    if (quest.time_limit_hours && progress && progress.started_at) {
      const startTime = new Date(progress.started_at);
      const elapsedHours = (now - startTime) / (1000 * 60 * 60);
      if (elapsedHours >= quest.time_limit_hours) {
        return true; // Time limit exceeded
      }
    }

    return false;
  }

  /**
   * Check if quest is available (start_date/end_date)
   */
  isQuestAvailable(quest) {
    const now = new Date();
    
    if (quest.start_date) {
      const startDate = new Date(quest.start_date);
      if (now < startDate) {
        return false; // Quest not started yet
      }
    }

    if (quest.end_date) {
      const endDate = new Date(quest.end_date);
      if (now > endDate) {
        return false; // Quest expired
      }
    }

    return true;
  }

  /**
   * Check milestones and give rewards
   */
  async checkMilestones(quest, userId, progressId, oldProgress, newProgress) {
    if (!quest.milestones || !Array.isArray(quest.milestones) || quest.milestones.length === 0) {
      return; // No milestones
    }

    const target = quest.requirements?.target || 0;
    
    for (const milestone of quest.milestones) {
      const milestoneProgress = Math.floor((milestone.progress / 100) * target);
      
      // Check if milestone was just reached
      if (oldProgress < milestoneProgress && newProgress >= milestoneProgress) {
        // Check if milestone was already completed
        const { data: existing } = await this.supabase
          .from('quest_milestones')
          .select('id')
          .eq('quest_progress_id', progressId)
          .eq('milestone_progress', milestoneProgress)
          .maybeSingle();

        if (existing) {
          continue; // Already completed
        }

        // Give milestone rewards
        if (milestone.rewards) {
          await this.giveRewards(quest.guild_id, userId, milestone.rewards);
        }

        // Log milestone completion
        await this.supabase
          .from('quest_milestones')
          .insert({
            quest_progress_id: progressId,
            milestone_progress: milestoneProgress,
            rewards_given: milestone.rewards || {}
          });

        // Send milestone notification
        await this.sendMilestoneNotification(quest, userId, milestone, newProgress, target);
      }
    }
  }

  /**
   * Send milestone notification
   */
  async sendMilestoneNotification(quest, userId, milestone, currentProgress, target) {
    if (!this.client) return;

    try {
      const guild = this.client.guilds.cache.get(quest.guild_id);
      if (!guild) return;

      const user = await this.client.users.fetch(userId).catch(() => null);
      if (!user) return;

      const percentage = Math.floor((currentProgress / target) * 100);
      
      const rewardsList = [];
      if (milestone.rewards?.coins) rewardsList.push(`💰 ${milestone.rewards.coins} coins`);
      if (milestone.rewards?.xp) rewardsList.push(`⭐ ${milestone.rewards.xp} XP`);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🎯 Milestone Reached!`)
        .setDescription(`Congratulations! You reached **${percentage}%** progress on **${quest.name}**!`)
        .addFields({
          name: 'Milestone Rewards',
          value: rewardsList.length > 0 ? rewardsList.join('\n') : 'Keep going!',
          inline: false
        })
        .setTimestamp();

      if (milestone.message) {
        embed.setDescription(`${milestone.message}\n\n**Progress:** ${currentProgress}/${target} (${percentage}%)`);
      }

      try {
        await user.send({ embeds: [embed] });
      } catch (error) {
        // User has DMs disabled - that's okay
      }
    } catch (error) {
      console.error('Error sending milestone notification:', error);
    }
  }

  /**
   * Setup deadline checker (runs every 5 minutes)
   */
  setupDeadlineChecker() {
    setInterval(async () => {
      try {
        await this.processExpiredQuests();
      } catch (error) {
        console.error('Error in deadline checker:', error);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Also check immediately
    setTimeout(() => this.processExpiredQuests(), 60000); // After 1 minute
  }

  /**
   * Process expired quests
   */
  async processExpiredQuests() {
    try {
      const now = new Date();

      // Get quests with deadlines that have passed
      const { data: expiredQuests, error } = await this.supabase
        .from('quests')
        .select('id, guild_id, name, deadline_at, time_limit_hours')
        .or(`deadline_at.lt.${now.toISOString()},time_limit_hours.not.is.null`)
        .eq('enabled', true);

      if (error || !expiredQuests) {
        return;
      }

      for (const quest of expiredQuests) {
        // Get all incomplete progress records for this quest
        const { data: progressRecords } = await this.supabase
          .from('quest_progress')
          .select('*')
          .eq('quest_id', quest.id)
          .eq('completed', false);

        if (!progressRecords) continue;

        for (const progress of progressRecords) {
          // Check if this specific progress is expired
          let isExpired = false;

          if (quest.deadline_at) {
            const deadline = new Date(quest.deadline_at);
            if (now > deadline) {
              isExpired = true;
            }
          }

          if (quest.time_limit_hours && progress.started_at) {
            const startTime = new Date(progress.started_at);
            const elapsedHours = (now - startTime) / (1000 * 60 * 60);
            if (elapsedHours >= quest.time_limit_hours) {
              isExpired = true;
            }
          }

          if (isExpired) {
            // Mark as expired (could send notification, but for now just mark)
            await this.supabase
              .from('quest_progress')
              .update({
                current_progress: 0, // Reset or keep current?
                updated_at: now.toISOString()
              })
              .eq('id', progress.id);

            // Optionally send expiration notification
            // await this.sendExpirationNotification(quest, progress.user_id);
          }
        }
      }
    } catch (error) {
      console.error('Error processing expired quests:', error);
    }
  }

  /**
   * Send quest completion notification to user
   */
  async sendCompletionNotification(quest, userId, rewards) {
    if (!this.client) return; // No client available

    try {
      const guild = this.client.guilds.cache.get(quest.guild_id);
      if (!guild) return;

      const user = await this.client.users.fetch(userId).catch(() => null);
      if (!user) return;

      // Build rewards text
      const rewardsList = [];
      if (rewards.coins) rewardsList.push(`💰 ${rewards.coins.toLocaleString()} coins`);
      if (rewards.xp) rewardsList.push(`⭐ ${rewards.xp.toLocaleString()} XP`);
      if (rewards.role_id) rewardsList.push(`🎭 Role reward`);
      if (rewards.item_id) rewardsList.push(`🎒 Item reward`);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`${quest.emoji || '🎯'} Quest Completed!`)
        .setDescription(`Congratulations! You completed the quest **${quest.name}**!`)
        .addFields({
          name: 'Rewards Received',
          value: rewardsList.length > 0 ? rewardsList.join('\n') : 'No rewards',
          inline: false
        })
        .setTimestamp()
        .setFooter({ text: guild.name });

      // Try to send DM
      try {
        await user.send({ embeds: [embed] });
      } catch (error) {
        // User has DMs disabled or blocked bot - that's okay
        console.log(`[Quests] Could not send DM to user ${userId} for quest completion`);
      }
    } catch (error) {
      console.error('Error sending quest completion notification:', error);
      // Don't fail quest completion if notification fails
    }
  }

  /**
   * Calculate reset time for a quest
   */
  calculateResetTime(quest) {
    if (quest.reset_type === 'never') {
      return null;
    }

    const now = new Date();
    const resetTime = new Date(now);

    if (quest.reset_type === 'daily' && quest.reset_time) {
      const [hours, minutes] = quest.reset_time.split(':').map(Number);
      resetTime.setHours(hours, minutes, 0, 0);
      
      // If reset time has passed today, set for tomorrow
      if (resetTime <= now) {
        resetTime.setDate(resetTime.getDate() + 1);
      }
    } else if (quest.reset_type === 'weekly' && quest.reset_day_of_week !== null && quest.reset_time) {
      const [hours, minutes] = quest.reset_time.split(':').map(Number);
      const daysUntilReset = (quest.reset_day_of_week - now.getDay() + 7) % 7;
      
      resetTime.setDate(now.getDate() + daysUntilReset);
      resetTime.setHours(hours, minutes, 0, 0);
      
      // If reset time has passed this week, set for next week
      if (daysUntilReset === 0 && resetTime <= now) {
        resetTime.setDate(resetTime.getDate() + 7);
      }
    } else if (quest.reset_type === 'monthly') {
      resetTime.setDate(1);
      resetTime.setMonth(resetTime.getMonth() + 1);
      resetTime.setHours(0, 0, 0, 0);
    } else {
      return null;
    }

    return resetTime;
  }

  /**
   * Get user's quests with progress
   */
  async getUserQuests(guildId, userId, category = null, includeCompleted = false) {
    try {
      let query = this.supabase
        .from('quests')
        .select(`
          *,
          quest_progress!left(*)
        `)
        .eq('guild_id', guildId)
        .eq('enabled', true)
        .eq('visible', true)
        .order('category', { ascending: true })
        .order('chain_position', { ascending: true })
        .order('created_at', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data: quests, error } = await query;

      if (error) {
        console.error('Error fetching user quests:', error);
        return [];
      }

      if (!quests) {
        return [];
      }

      // Filter out completed quests if needed
      const filteredQuests = quests.filter(quest => {
        const progress = quest.quest_progress && quest.quest_progress.length > 0
          ? quest.quest_progress[0]
          : null;

        if (!includeCompleted && progress && progress.completed && quest.reset_type === 'never' && !quest.max_completions) {
          return false;
        }

        return true;
      });

      return filteredQuests;
    } catch (error) {
      console.error('Error in getUserQuests:', error);
      return [];
    }
  }

  /**
   * Process quest resets (daily/weekly/monthly)
   */
  async processQuestResets() {
    try {
      const now = new Date();

      // Get all quests that need resetting
      const { data: quests, error } = await this.supabase
        .from('quests')
        .select('*')
        .in('reset_type', ['daily', 'weekly', 'monthly'])
        .eq('enabled', true);

      if (error || !quests) {
        return;
      }

      for (const quest of quests) {
        const resetTime = this.calculateResetTime(quest);
        
        if (!resetTime) continue;

        // Check if reset time has passed
        if (now >= resetTime) {
          // Get all progress records for this quest that need resetting
          const { data: progressRecords, error: progressError } = await this.supabase
            .from('quest_progress')
            .select('*')
            .eq('quest_id', quest.id)
            .lte('reset_at', now.toISOString());

          if (progressError || !progressRecords) {
            continue;
          }

          // Reset each progress record
          const newResetTime = this.calculateResetTime(quest);
          for (const progress of progressRecords) {
            const maxCompletions = quest.max_completions;
            const currentCompletions = progress.completion_count || 0;

            // Check if max completions reached
            if (maxCompletions && currentCompletions >= maxCompletions) {
              continue; // Don't reset, max completions reached
            }

            await this.supabase
              .from('quest_progress')
              .update({
                completed: false,
                current_progress: 0,
                completed_at: null,
                reset_at: newResetTime ? newResetTime.toISOString() : null
              })
              .eq('id', progress.id);
          }

          // Invalidate cache
          this.invalidateCache(quest.guild_id, quest.quest_type);
        }
      }
    } catch (error) {
      console.error('Error processing quest resets:', error);
    }
  }

  /**
   * Manually complete a quest (admin only)
   */
  async manualComplete(guildId, questId, userId) {
    try {
      const { data: quest, error: questError } = await this.supabase
        .from('quests')
        .select('*')
        .eq('id', questId)
        .eq('guild_id', guildId)
        .single();

      if (questError || !quest) {
        return { success: false, error: 'Quest not found' };
      }

      // Get or create progress
      let { data: progress, error: progressError } = await this.supabase
        .from('quest_progress')
        .select('*')
        .eq('quest_id', questId)
        .eq('user_id', userId)
        .maybeSingle();

      if (progressError && progressError.code !== 'PGRST116') {
        return { success: false, error: progressError.message };
      }

      if (!progress) {
        progress = await this.createProgress(quest, userId);
        if (!progress) {
          return { success: false, error: 'Failed to create progress' };
        }
      }

      const target = quest.requirements?.target || 0;
      const result = await this.completeQuest(quest, userId, target, progress);

      return result;
    } catch (error) {
      console.error('Error manually completing quest:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = QuestManager;

