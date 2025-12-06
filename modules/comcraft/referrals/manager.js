/**
 * ComCraft Discord Referral Manager
 * Tracks referrals when members join via invites and gives rewards
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder } = require('discord.js');
const configManager = require('../config-manager');

class DiscordReferralManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.inviteCache = new Map(); // Cache invites per guild
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get referral configuration for a guild
   */
  async getConfig(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('discord_referral_config')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[DiscordReferral] Error fetching config:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('[DiscordReferral] Error in getConfig:', error);
      return null;
    }
  }

  /**
   * Check if referral system is enabled for a guild
   */
  async isEnabled(guildId) {
    const config = await this.getConfig(guildId);
    return config?.enabled || false;
  }

  /**
   * Get or refresh invite cache for a guild
   */
  async getInvites(guild) {
    const cacheKey = guild.id;
    const cached = this.inviteCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.invites;
    }

    try {
      const invites = await guild.invites.fetch();
      const inviteMap = new Map();

      for (const [code, invite] of invites) {
        inviteMap.set(code, {
          code: invite.code,
          inviter: invite.inviter?.id,
          uses: invite.uses || 0,
          maxUses: invite.maxUses,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt
        });
      }

      this.inviteCache.set(cacheKey, {
        invites: inviteMap,
        timestamp: Date.now()
      });

      return inviteMap;
    } catch (error) {
      console.error(`[DiscordReferral] Error fetching invites for ${guild.id}:`, error);
      return cached?.invites || new Map();
    }
  }

  /**
   * Find which invite was used by comparing invite uses
   */
  async findUsedInvite(guild, oldInvites, newInvites) {
    for (const [code, newInvite] of newInvites) {
      const oldInvite = oldInvites.get(code);
      
      if (!oldInvite) {
        // New invite, check if it was just used
        if (newInvite.uses === 1) {
          return newInvite;
        }
        continue;
      }

      // Invite exists, check if uses increased
      if (newInvite.uses > oldInvite.uses) {
        return newInvite;
      }
    }

    return null;
  }

  /**
   * Handle member join - check for referral and give rewards
   */
  async handleMemberJoin(member) {
    try {
      const guildId = member.guild.id;
      const config = await this.getConfig(guildId);

      if (!config || !config.enabled) {
        return;
      }

      // Ignore bots if configured
      if (config.ignore_bots && member.user.bot) {
        return;
      }

      // Get cached invites (from before this member joined)
      const cacheKey = guildId;
      let cached = this.inviteCache.get(cacheKey);
      let oldInvites = cached?.invites || new Map();

      // If cache is empty or expired, fetch invites first to establish baseline
      if (!cached || oldInvites.size === 0) {
        console.log(`[DiscordReferral] Cache empty for ${guildId}, fetching invites to establish baseline...`);
        oldInvites = await this.getInvites(member.guild);
        // Store in cache
        this.inviteCache.set(cacheKey, {
          invites: oldInvites,
          timestamp: Date.now()
        });
        // Wait a moment for Discord to update invite uses
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get current invites (after member joined)
      const currentInvites = await this.getInvites(member.guild);

      // Find which invite was used
      const usedInvite = await this.findUsedInvite(member.guild, oldInvites, currentInvites);

      if (!usedInvite || !usedInvite.inviter) {
        // Couldn't determine inviter - might be vanity URL or widget invite
        console.log(`[DiscordReferral] Could not determine inviter for ${member.user.id} in ${guildId}`);
        return;
      }

      // Don't allow self-referrals
      if (usedInvite.inviter === member.user.id) {
        return;
      }

      // Check if already tracked
      const { data: existing } = await this.supabase
        .from('discord_referrals')
        .select('*')
        .eq('guild_id', guildId)
        .eq('new_member_user_id', member.user.id)
        .single();

      if (existing) {
        return; // Already tracked
      }

      // Check account age requirement
      const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
      if (accountAgeDays < (config.require_min_account_age_days || 0)) {
        console.log(`[DiscordReferral] Account too new: ${accountAgeDays} days < ${config.require_min_account_age_days} days`);
        return;
      }

      // Check cooldown for inviter
      if (config.cooldown_hours > 0) {
        const { data: stats } = await this.supabase
          .from('discord_referral_stats')
          .select('last_reward_at')
          .eq('guild_id', guildId)
          .eq('inviter_user_id', usedInvite.inviter)
          .single();

        if (stats?.last_reward_at) {
          const hoursSinceLastReward = (Date.now() - new Date(stats.last_reward_at).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastReward < config.cooldown_hours) {
            console.log(`[DiscordReferral] Cooldown active for inviter ${usedInvite.inviter}`);
            return;
          }
        }
      }

      // Check minimum invites requirement
      const { data: inviterStats } = await this.supabase
        .from('discord_referral_stats')
        .select('total_invites')
        .eq('guild_id', guildId)
        .eq('inviter_user_id', usedInvite.inviter)
        .single();

      const totalInvites = (inviterStats?.total_invites || 0) + 1;
      if (totalInvites < (config.require_min_members_invited || 1)) {
        // Track but don't give rewards yet
        await this.trackReferral(guildId, usedInvite.inviter, member.user.id, usedInvite.code, accountAgeDays, false);
        return;
      }

      // Track referral and give rewards
      await this.trackReferral(guildId, usedInvite.inviter, member.user.id, usedInvite.code, accountAgeDays, true);
      await this.giveRewards(member.guild, usedInvite.inviter, member, config);
      
      // Check and give tiered rewards
      await this.checkAndGiveTieredRewards(member.guild, usedInvite.inviter, guildId);

    } catch (error) {
      console.error('[DiscordReferral] Error handling member join:', error);
    }
  }

  /**
   * Track referral in database
   */
  async trackReferral(guildId, inviterUserId, newMemberUserId, inviteCode, accountAgeDays, giveRewards) {
    try {
      // Create referral record
      const { data: referral, error: referralError } = await this.supabase
        .from('discord_referrals')
        .insert({
          guild_id: guildId,
          inviter_user_id: inviterUserId,
          new_member_user_id: newMemberUserId,
          invite_code: inviteCode,
          new_member_account_age_days: accountAgeDays
        })
        .select()
        .single();

      if (referralError) {
        console.error('[DiscordReferral] Error tracking referral:', referralError);
        return;
      }

      // Update or create inviter stats
      const { data: stats } = await this.supabase
        .from('discord_referral_stats')
        .select('*')
        .eq('guild_id', guildId)
        .eq('inviter_user_id', inviterUserId)
        .single();

      if (stats) {
        await this.supabase
          .from('discord_referral_stats')
          .update({
            total_invites: stats.total_invites + 1,
            total_rewards_given: giveRewards ? stats.total_rewards_given + 1 : stats.total_rewards_given,
            last_reward_at: giveRewards ? new Date().toISOString() : stats.last_reward_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', stats.id);
      } else {
        await this.supabase
          .from('discord_referral_stats')
          .insert({
            guild_id: guildId,
            inviter_user_id: inviterUserId,
            total_invites: 1,
            total_rewards_given: giveRewards ? 1 : 0,
            last_reward_at: giveRewards ? new Date().toISOString() : null
          });
      }

      return referral;
    } catch (error) {
      console.error('[DiscordReferral] Error in trackReferral:', error);
      return null;
    }
  }

  /**
   * Give rewards to inviter and new member
   */
  async giveRewards(guild, inviterUserId, newMember, config) {
    try {
      const inviter = await guild.members.fetch(inviterUserId).catch(() => null);
      if (!inviter) {
        console.warn(`[DiscordReferral] Inviter ${inviterUserId} not found in guild`);
      }

      // Give inviter rewards
      if (inviter && config.inviter_reward_type !== 'none') {
        await this.giveUserRewards(guild, inviter, config.inviter_reward_type, {
          roleId: config.inviter_reward_role_id,
          coins: config.inviter_reward_coins,
          xp: config.inviter_reward_xp
        }, 'inviter');

        // Update referral record
        await this.supabase
          .from('discord_referrals')
          .update({
            inviter_reward_given: true,
            inviter_reward_given_at: new Date().toISOString()
          })
          .eq('guild_id', guild.id)
          .eq('new_member_user_id', newMember.user.id);
      }

      // Give new member rewards
      if (config.new_member_reward_type !== 'none') {
        await this.giveUserRewards(guild, newMember, config.new_member_reward_type, {
          roleId: config.new_member_reward_role_id,
          coins: config.new_member_reward_coins,
          xp: config.new_member_reward_xp
        }, 'new_member');

        // Update referral record
        await this.supabase
          .from('discord_referrals')
          .update({
            new_member_reward_given: true,
            new_member_reward_given_at: new Date().toISOString()
          })
          .eq('guild_id', guild.id)
          .eq('new_member_user_id', newMember.user.id);
      }

      // Log to channel if configured
      if (config.log_channel_id) {
        await this.logReferral(guild, inviter, newMember, config);
      }

    } catch (error) {
      console.error('[DiscordReferral] Error giving rewards:', error);
    }
  }

  /**
   * Give rewards to a specific user
   */
  async giveUserRewards(guild, member, rewardType, rewards, userType) {
    try {
      const rewardsGiven = [];

      // Give role
      if ((rewardType === 'role' || rewardType === 'both') && rewards.roleId) {
        const role = guild.roles.cache.get(rewards.roleId);
        if (role && role.editable && role.position < guild.members.me.roles.highest.position) {
          await member.roles.add(role, `Referral reward - ${userType}`);
          rewardsGiven.push(`Role: ${role.name}`);
        }
      }

      // Give coins
      if ((rewardType === 'coins' || rewardType === 'both') && rewards.coins > 0 && global.economyManager) {
        const result = await global.economyManager.addCoins(
          guild.id,
          member.user.id,
          rewards.coins,
          'referral_reward',
          `Referral reward - ${userType}`
        );
        if (result.success) {
          rewardsGiven.push(`${rewards.coins} coins`);
        }
      }

      // Give XP
      if ((rewardType === 'xp' || rewardType === 'both') && rewards.xp > 0 && global.xpManager) {
        // Add XP directly (bypass cooldown for referral rewards)
        const guildConfig = await configManager.getGuildConfig(guild.id);
        if (guildConfig && guildConfig.leveling_enabled) {
          // We'll need to add XP directly to the user_levels table
          const { data: userLevel } = await this.supabase
            .from('user_levels')
            .select('*')
            .eq('guild_id', guild.id)
            .eq('user_id', member.user.id)
            .single();

          if (userLevel) {
            const newXP = (userLevel.xp || 0) + rewards.xp;
            const newLevel = Math.floor(Math.sqrt(newXP / 100));
            
            await this.supabase
              .from('user_levels')
              .update({
                xp: newXP,
                level: newLevel,
                last_xp_gain: new Date().toISOString()
              })
              .eq('guild_id', guild.id)
              .eq('user_id', member.user.id);
          } else {
            // Create new record
            await this.supabase
              .from('user_levels')
              .insert({
                guild_id: guild.id,
                user_id: member.user.id,
                username: member.user.username,
                xp: rewards.xp,
                level: 0,
                total_messages: 0,
                last_xp_gain: new Date().toISOString()
              });
          }
          rewardsGiven.push(`${rewards.xp} XP`);
        }
      }

      if (rewardsGiven.length > 0) {
        console.log(`✅ [DiscordReferral] Gave rewards to ${member.user.username} (${userType}): ${rewardsGiven.join(', ')}`);
      }

    } catch (error) {
      console.error(`[DiscordReferral] Error giving rewards to ${member.user.id}:`, error);
    }
  }

  /**
   * Log referral to channel
   */
  async logReferral(guild, inviter, newMember, config) {
    try {
      const channel = guild.channels.cache.get(config.log_channel_id);
      if (!channel || !channel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎉 New Referral!')
        .setDescription(
          `${newMember.toString()} joined via invite from ${inviter ? inviter.toString() : 'Unknown'}!`
        )
        .addFields(
          { name: 'Inviter', value: inviter ? `${inviter.user.tag} (${inviter.user.id})` : 'Unknown', inline: true },
          { name: 'New Member', value: `${newMember.user.tag} (${newMember.user.id})`, inline: true }
        )
        .setTimestamp();

      if (config.inviter_reward_type !== 'none') {
        const inviterRewards = [];
        if (config.inviter_reward_role_id) inviterRewards.push('Role');
        if (config.inviter_reward_coins > 0) inviterRewards.push(`${config.inviter_reward_coins} coins`);
        if (config.inviter_reward_xp > 0) inviterRewards.push(`${config.inviter_reward_xp} XP`);
        if (inviterRewards.length > 0) {
          embed.addFields({ name: 'Inviter Rewards', value: inviterRewards.join(', '), inline: false });
        }
      }

      if (config.new_member_reward_type !== 'none') {
        const newMemberRewards = [];
        if (config.new_member_reward_role_id) newMemberRewards.push('Role');
        if (config.new_member_reward_coins > 0) newMemberRewards.push(`${config.new_member_reward_coins} coins`);
        if (config.new_member_reward_xp > 0) newMemberRewards.push(`${config.new_member_reward_xp} XP`);
        if (newMemberRewards.length > 0) {
          embed.addFields({ name: 'New Member Rewards', value: newMemberRewards.join(', '), inline: false });
        }
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[DiscordReferral] Error logging referral:', error);
    }
  }

  /**
   * Check and give tiered rewards based on invite count
   */
  async checkAndGiveTieredRewards(guild, inviterUserId, guildId) {
    try {
      // Get current invite stats
      const { data: stats } = await this.supabase
        .from('discord_referral_stats')
        .select('total_invites')
        .eq('guild_id', guildId)
        .eq('inviter_user_id', inviterUserId)
        .single();

      if (!stats) return;

      const totalInvites = stats.total_invites;

      // Get all enabled tiers for this guild, ordered by min_invites descending
      const { data: tiers, error: tiersError } = await this.supabase
        .from('discord_referral_tiers')
        .select('*')
        .eq('guild_id', guildId)
        .eq('enabled', true)
        .order('min_invites', { ascending: false });

      if (tiersError || !tiers || tiers.length === 0) {
        return; // No tiers configured
      }

      // Find the highest tier the user qualifies for
      let highestTier = null;
      for (const tier of tiers) {
        if (totalInvites >= tier.min_invites) {
          highestTier = tier;
          break;
        }
      }

      if (!highestTier) return; // User doesn't qualify for any tier

      // Get inviter member
      const inviter = await guild.members.fetch(inviterUserId).catch(() => null);
      if (!inviter) return;

      // Remove all tier roles that the user shouldn't have anymore
      // (remove roles from lower tiers)
      for (const tier of tiers) {
        if (tier.role_id && tier.min_invites < highestTier.min_invites) {
          const role = guild.roles.cache.get(tier.role_id);
          if (role && inviter.roles.cache.has(tier.role_id)) {
            try {
              await inviter.roles.remove(role, `Referral tier update - reached ${highestTier.tier_name}`);
              console.log(`[DiscordReferral] Removed tier role ${role.name} from ${inviter.user.username}`);
            } catch (error) {
              console.error(`[DiscordReferral] Error removing tier role:`, error);
            }
          }
        }
      }

      // Give the highest tier role if not already have it
      if (highestTier.role_id) {
        const tierRole = guild.roles.cache.get(highestTier.role_id);
        if (tierRole && tierRole.editable && tierRole.position < guild.members.me.roles.highest.position) {
          if (!inviter.roles.cache.has(highestTier.role_id)) {
            await inviter.roles.add(tierRole, `Referral tier reward - ${highestTier.tier_name} (${totalInvites} invites)`);
            console.log(`✅ [DiscordReferral] Gave tier role ${tierRole.name} to ${inviter.user.username} (${totalInvites} invites)`);
          }
        }
      }

      // Give tier coins if configured
      if (highestTier.coins > 0 && global.economyManager) {
        const result = await global.economyManager.addCoins(
          guildId,
          inviterUserId,
          highestTier.coins,
          'referral_tier_reward',
          `Referral tier reward - ${highestTier.tier_name}`
        );
        if (result.success) {
          console.log(`✅ [DiscordReferral] Gave ${highestTier.coins} coins to ${inviter.user.username} for tier ${highestTier.tier_name}`);
        }
      }

      // Give tier XP if configured
      if (highestTier.xp > 0 && global.xpManager) {
        const guildConfig = await configManager.getGuildConfig(guildId);
        if (guildConfig && guildConfig.leveling_enabled) {
          const { data: userLevel } = await this.supabase
            .from('user_levels')
            .select('*')
            .eq('guild_id', guildId)
            .eq('user_id', inviterUserId)
            .single();

          if (userLevel) {
            await this.supabase
              .from('user_levels')
              .update({
                xp: userLevel.xp + highestTier.xp,
                last_xp_gain: new Date().toISOString()
              })
              .eq('id', userLevel.id);
          } else {
            await this.supabase
              .from('user_levels')
              .insert({
                guild_id: guildId,
                user_id: inviterUserId,
                xp: highestTier.xp,
                level: 0,
                total_messages: 0,
                last_xp_gain: new Date().toISOString()
              });
          }
          console.log(`✅ [DiscordReferral] Gave ${highestTier.xp} XP to ${inviter.user.username} for tier ${highestTier.tier_name}`);
        }
      }

    } catch (error) {
      console.error('[DiscordReferral] Error checking tiered rewards:', error);
    }
  }

  /**
   * Clear invite cache for a guild (call when invites change)
   */
  clearInviteCache(guildId) {
    this.inviteCache.delete(guildId);
  }
}

module.exports = DiscordReferralManager;

