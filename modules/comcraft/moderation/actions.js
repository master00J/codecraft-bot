/**
 * Comcraft Moderation Actions
 * Warn, mute, kick, ban functionality
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const configManager = require('../config-manager');

class ModerationActions {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Get next case ID for guild
   */
  async getNextCaseId(guildId) {
    const { data } = await this.supabase
      .from('moderation_logs')
      .select('case_id')
      .eq('guild_id', guildId)
      .order('case_id', { ascending: false })
      .limit(1)
      .single();

    return (data?.case_id || 0) + 1;
  }

  /**
   * Warn a user
   */
  async warn(guild, user, moderator, reason) {
    try {
      const caseId = await this.getNextCaseId(guild.id);

      // Log to database
      const { error } = await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guild.id,
          case_id: caseId,
          user_id: user.id,
          username: user.tag,
          moderator_id: moderator.id,
          moderator_name: moderator.tag,
          action: 'warn',
          reason: reason || 'No reason provided',
          active: true
        });

      if (error) throw error;

      // Add to warnings count
      await this.supabase
        .from('user_warnings')
        .insert({
          guild_id: guild.id,
          user_id: user.id,
          moderator_id: moderator.id,
          reason: reason || 'Geen reden opgegeven'
        });

      // Send DM to user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('⚠️ Je hebt een waarschuwing ontvangen')
          .setDescription(`Je hebt een waarschuwing ontvangen in **${guild.name}**`)
          .addFields(
            { name: 'Reason', value: reason || 'No reason provided' },
            { name: 'Moderator', value: moderator.tag }
          )
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (e) {
        // User has DMs disabled
      }

      // Log to mod channel
      await this.logAction(guild, {
        caseId,
        action: 'warn',
        user,
        moderator,
        reason,
        color: '#FFA500'
      });

      // Check for auto-ban threshold
      const config = await configManager.getModerationConfig(guild.id);
      if (config?.auto_ban_enabled && config?.auto_ban_threshold) {
        const warningCount = await this.getWarningCount(guild.id, user.id);
        
        if (warningCount >= config.auto_ban_threshold) {
          // Auto-ban user
          const member = guild.members.cache.get(user.id);
          if (member) {
            await this.ban(
              guild,
              user,
              guild.members.me.user,
              `Auto-ban: ${config.auto_ban_threshold} warnings reached`,
              config.auto_ban_duration || null
            );
            
            return { success: true, caseId, autoBanned: true, warningCount };
          }
        }
      }

      return { success: true, caseId };
    } catch (error) {
      console.error('Error warning user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mute a user
   */
  async mute(guild, member, moderator, duration, reason) {
    try {
      const config = await configManager.getModerationConfig(guild.id);
      const mutedRoleId = config?.muted_role_id;

      if (!mutedRoleId) {
        return { success: false, error: 'No muted role configured' };
      }

      const mutedRole = guild.roles.cache.get(mutedRoleId);
      if (!mutedRole) {
        return { success: false, error: 'Muted role not found' };
      }

      // Add role
      await member.roles.add(mutedRole);

      const caseId = await this.getNextCaseId(guild.id);
      const expiresAt = duration ? new Date(Date.now() + duration * 60000) : null;

      // Log to database
      await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guild.id,
          case_id: caseId,
          user_id: member.user.id,
          username: member.user.tag,
          moderator_id: moderator.id,
          moderator_name: moderator.tag,
          action: 'mute',
          reason: reason || 'No reason provided',
          duration,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          active: true
        });

      // Send DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔇 Je bent gemute')
          .setDescription(`Je bent gemute in **${guild.name}**`)
          .addFields(
            { name: 'Reason', value: reason || 'No reason provided' },
            { name: 'Duration', value: duration ? `${duration} minutes` : 'Permanent' },
            { name: 'Moderator', value: moderator.tag }
          )
          .setTimestamp();

        await member.user.send({ embeds: [dmEmbed] });
      } catch (e) {}

      // Log action
      await this.logAction(guild, {
        caseId,
        action: 'mute',
        user: member.user,
        moderator,
        reason,
        duration,
        color: '#FF0000'
      });

      // Schedule unmute
      if (duration) {
        this.scheduleUnmute(guild, member, duration);
      }

      return { success: true, caseId };
    } catch (error) {
      console.error('Error muting user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unmute a user
   */
  async unmute(guild, member, moderator, reason) {
    try {
      const config = await configManager.getModerationConfig(guild.id);
      const mutedRoleId = config?.muted_role_id;

      if (!mutedRoleId) {
        return { success: false, error: 'No muted role configured' };
      }

      const mutedRole = guild.roles.cache.get(mutedRoleId);
      if (mutedRole) {
        await member.roles.remove(mutedRole);
      }

      const caseId = await this.getNextCaseId(guild.id);

      await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guild.id,
          case_id: caseId,
          user_id: member.user.id,
          username: member.user.tag,
          moderator_id: moderator.id,
          moderator_name: moderator.tag,
          action: 'unmute',
          reason: reason || 'No reason provided',
          active: true
        });

      // Deactivate active mute
      await this.supabase
        .from('moderation_logs')
        .update({ active: false })
        .eq('guild_id', guild.id)
        .eq('user_id', member.user.id)
        .eq('action', 'mute')
        .eq('active', true);

      await this.logAction(guild, {
        caseId,
        action: 'unmute',
        user: member.user,
        moderator,
        reason,
        color: '#00FF00'
      });

      return { success: true, caseId };
    } catch (error) {
      console.error('Error unmuting user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Kick a user
   */
  async kick(guild, member, moderator, reason) {
    try {
      const caseId = await this.getNextCaseId(guild.id);

      // Send DM before kick
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('👢 Je bent gekickt')
          .setDescription(`Je bent gekickt uit **${guild.name}**`)
          .addFields(
            { name: 'Reason', value: reason || 'No reason provided' },
            { name: 'Moderator', value: moderator.tag }
          )
          .setTimestamp();

        await member.user.send({ embeds: [dmEmbed] });
      } catch (e) {}

      // Kick
      await member.kick(reason);

      // Log to database
      await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guild.id,
          case_id: caseId,
          user_id: member.user.id,
          username: member.user.tag,
          moderator_id: moderator.id,
          moderator_name: moderator.tag,
          action: 'kick',
          reason: reason || 'No reason provided',
          active: true
        });

      await this.logAction(guild, {
        caseId,
        action: 'kick',
        user: member.user,
        moderator,
        reason,
        color: '#FF6600'
      });

      return { success: true, caseId };
    } catch (error) {
      console.error('Error kicking user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ban a user
   */
  async ban(guild, user, moderator, reason, duration = null) {
    try {
      const caseId = await this.getNextCaseId(guild.id);
      const expiresAt = duration ? new Date(Date.now() + duration * 60000) : null;

      // Send DM before ban
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔨 Je bent verbannen')
          .setDescription(`Je bent verbannen uit **${guild.name}**`)
          .addFields(
            { name: 'Reason', value: reason || 'No reason provided' },
            { name: 'Duration', value: duration ? `${duration} minutes` : 'Permanent' },
            { name: 'Moderator', value: moderator.tag }
          )
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] });
      } catch (e) {}

      // Ban
      await guild.members.ban(user, { reason });

      // Log to database
      await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guild.id,
          case_id: caseId,
          user_id: user.id,
          username: user.tag,
          moderator_id: moderator.id,
          moderator_name: moderator.tag,
          action: 'ban',
          reason: reason || 'No reason provided',
          duration,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          active: true
        });

      await this.logAction(guild, {
        caseId,
        action: 'ban',
        user,
        moderator,
        reason,
        duration,
        color: '#CC0000'
      });

      // Schedule unban
      if (duration) {
        this.scheduleUnban(guild, user, duration);
      }

      return { success: true, caseId };
    } catch (error) {
      console.error('Error banning user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unban a user
   */
  async unban(guild, user, moderator, reason) {
    try {
      await guild.members.unban(user, reason);

      const caseId = await this.getNextCaseId(guild.id);

      await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guild.id,
          case_id: caseId,
          user_id: user.id,
          username: user.tag,
          moderator_id: moderator.id,
          moderator_name: moderator.tag,
          action: 'unban',
          reason: reason || 'No reason provided',
          active: true
        });

      // Deactivate active ban
      await this.supabase
        .from('moderation_logs')
        .update({ active: false })
        .eq('guild_id', guild.id)
        .eq('user_id', user.id)
        .eq('action', 'ban')
        .eq('active', true);

      await this.logAction(guild, {
        caseId,
        action: 'unban',
        user,
        moderator,
        reason,
        color: '#00FF00'
      });

      return { success: true, caseId };
    } catch (error) {
      console.error('Error unbanning user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log action to mod log channel
   */
  async logAction(guild, data) {
    try {
      const config = await configManager.getModerationConfig(guild.id);
      if (!config || !config.mod_log_channel_id) return;

      const logChannel = guild.channels.cache.get(config.mod_log_channel_id);
      if (!logChannel) return;

      const actionEmojis = {
        warn: '⚠️',
        mute: '🔇',
        unmute: '🔊',
        kick: '👢',
        ban: '🔨',
        unban: '✅'
      };

      const embed = new EmbedBuilder()
        .setColor(data.color)
        .setTitle(`${actionEmojis[data.action]} Case #${data.caseId} | ${data.action.toUpperCase()}`)
        .addFields(
          { name: 'User', value: `${data.user.tag} (${data.user.id})`, inline: true },
          { name: 'Moderator', value: data.moderator.tag, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
        )
        .setTimestamp();

      if (data.duration) {
        embed.addFields({ name: 'Duration', value: `${data.duration} minutes`, inline: true });
      }

      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error logging moderation action:', error);
    }
  }

  /**
   * Schedule unmute
   */
  scheduleUnmute(guild, member, durationMinutes) {
    setTimeout(async () => {
      try {
        const config = await configManager.getModerationConfig(guild.id);
        const mutedRole = guild.roles.cache.get(config?.muted_role_id);
        
        if (mutedRole && member.roles.cache.has(mutedRole.id)) {
          await member.roles.remove(mutedRole);
          
          // Mark as inactive in database
          await this.supabase
            .from('moderation_logs')
            .update({ active: false })
            .eq('guild_id', guild.id)
            .eq('user_id', member.user.id)
            .eq('action', 'mute')
            .eq('active', true);
        }
      } catch (error) {
        console.error('Error auto-unmuting user:', error);
      }
    }, durationMinutes * 60000);
  }

  /**
   * Schedule unban
   */
  scheduleUnban(guild, user, durationMinutes) {
    setTimeout(async () => {
      try {
        await guild.members.unban(user, 'Tijdelijke ban verlopen');
        
        // Mark as inactive in database
        await this.supabase
          .from('moderation_logs')
          .update({ active: false })
          .eq('guild_id', guild.id)
          .eq('user_id', user.id)
          .eq('action', 'ban')
          .eq('active', true);
      } catch (error) {
        console.error('Error auto-unbanning user:', error);
      }
    }, durationMinutes * 60000);
  }

  /**
   * Get user's warning count
   */
  async getWarningCount(guildId, userId) {
    const { data } = await this.supabase
      .from('user_warnings')
      .select('id')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('active', true);

    return data?.length || 0;
  }

  /**
   * Get moderation case
   */
  async getCase(guildId, caseId) {
    const { data } = await this.supabase
      .from('moderation_logs')
      .select('*')
      .eq('guild_id', guildId)
      .eq('case_id', caseId)
      .single();

    return data;
  }

  /**
   * Get warning count for user
   */
  async getWarningCount(guildId, userId) {
    const { data } = await this.supabase
      .from('moderation_logs')
      .select('id')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .eq('action', 'warn')
      .eq('active', true);

    return data?.length || 0;
  }

  /**
   * Get user moderation history
   */
  async getUserHistory(guildId, userId, limit = 10) {
    const { data } = await this.supabase
      .from('moderation_logs')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Clear user warnings
   */
  async clearWarnings(guildId, userId, moderatorId, moderatorName) {
    try {
      const { error } = await this.supabase
        .from('moderation_logs')
        .update({ active: false })
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .eq('action', 'warn')
        .eq('active', true);

      if (error) throw error;

      // Log action
      const caseId = await this.getNextCaseId(guildId);
      await this.supabase
        .from('moderation_logs')
        .insert({
          guild_id: guildId,
          case_id: caseId,
          user_id: userId,
          username: 'Unknown',
          moderator_id: moderatorId,
          moderator_name: moderatorName,
          action: 'clear_warnings',
          reason: 'Warnings cleared by moderator',
          active: true
        });

      return { success: true, caseId };
    } catch (error) {
      console.error('Error clearing warnings:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ModerationActions();

