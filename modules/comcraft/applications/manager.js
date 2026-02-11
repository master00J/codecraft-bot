/**
 * Comcraft Staff Applications Manager
 * Handle staff applications with voting system
 */

const { createClient } = require('@supabase/supabase-js');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

class ApplicationsManager {
  constructor(client) {
    this.client = client;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /**
   * Setup application config for a guild (one per "name" / role type)
   * @param {string} guildId
   * @param {string} channelId
   * @param {string[]} questions
   * @param {Object} options - name (e.g. 'Moderator', 'Helper'), enabled, review_channel_id, etc.
   */
  async setupConfig(guildId, channelId, questions, options = {}) {
    try {
      const name = (options.name || 'Staff').trim() || 'Staff';
      const payload = {
        guild_id: guildId,
        name,
        channel_id: channelId,
        review_channel_id: options.reviewChannelId ?? null,
        questions,
        enabled: options.enabled ?? true,
        min_age: options.minAge ?? 0,
        cooldown_days: options.cooldownDays ?? 7,
        require_account_age_days: options.requireAccountAgeDays ?? 0,
        auto_thread: options.autoThread ?? false,
        ping_role_id: options.pingRoleId ?? null,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await this.supabase
        .from('application_configs')
        .upsert(payload, { onConflict: 'guild_id,name', ignoreDuplicates: false })
        .select()
        .single();

      if (error) throw error;

      return { success: true, config: data };
    } catch (error) {
      console.error('Error setting up application config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all application configs (role types) for a guild
   */
  async getConfigs(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('application_configs')
        .select('*')
        .eq('guild_id', guildId)
        .order('name', { ascending: true });

      if (error) throw error;

      return { success: true, configs: data || [] };
    } catch (error) {
      console.error('Error getting application configs:', error);
      return { success: false, error: error.message, configs: [] };
    }
  }

  /**
   * Get one config by id (for a guild)
   */
  async getConfigById(guildId, configId) {
    try {
      const { data, error } = await this.supabase
        .from('application_configs')
        .select('*')
        .eq('id', configId)
        .eq('guild_id', guildId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return { success: true, config: null };
        throw error;
      }

      return { success: true, config: data };
    } catch (error) {
      console.error('Error getting application config by id:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get configuration for a guild (single – first config, for backward compat)
   */
  async getConfig(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('application_configs')
        .select('*')
        .eq('guild_id', guildId)
        .order('name', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { success: true, config: data };
    } catch (error) {
      console.error('Error getting application config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user can submit application for a given config (type)
   * @param {string} guildId
   * @param {string} userId
   * @param {Object} member - Discord GuildMember
   * @param {Object} config - application config (type) to apply for
   */
  async canApply(guildId, userId, member, config) {
    try {
      if (!config) {
        return { canApply: false, reason: 'Application type not found' };
      }

      if (!config.enabled) {
        return { canApply: false, reason: 'Applications are currently disabled for this role' };
      }

      // Check account age
      if (config.require_account_age_days > 0) {
        const accountAge = Date.now() - member.user.createdTimestamp;
        const requiredAge = config.require_account_age_days * 24 * 60 * 60 * 1000;
        if (accountAge < requiredAge) {
          return {
            canApply: false,
            reason: `Your Discord account must be at least ${config.require_account_age_days} days old`
          };
        }
      }

      // Cooldown: per application type (same user can apply for different types)
      let query = this.supabase
        .from('applications')
        .select('created_at')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (config.id) {
        query = query.eq('config_id', config.id);
      }
      const { data: recentApps } = await query;

      if (recentApps && recentApps.length > 0) {
        const lastApp = new Date(recentApps[0].created_at);
        const cooldownMs = (config.cooldown_days || 7) * 24 * 60 * 60 * 1000;
        const timeSince = Date.now() - lastApp.getTime();

        if (timeSince < cooldownMs) {
          const daysLeft = Math.ceil((cooldownMs - timeSince) / (24 * 60 * 60 * 1000));
          return {
            canApply: false,
            reason: `You must wait ${daysLeft} more day(s) before applying again for ${config.name || 'this role'}`
          };
        }
      }

      return { canApply: true };
    } catch (error) {
      console.error('Error checking if user can apply:', error);
      return { canApply: false, reason: 'An error occurred' };
    }
  }

  /**
   * Create modal for application (one per role; title shows which role)
   * @param {string[]} questions
   * @param {Object} options - configId (UUID), title or roleName (e.g. 'Moderator') for "Apply for: X"
   */
  createApplicationModal(questions, options = {}) {
    const configId = options.configId || '';
    const roleName = options.roleName || options.title || 'Staff';
    const title = (`Apply for: ${roleName}`).substring(0, 45);
    const customId = configId ? `application_submit_${configId}` : 'application_submit';
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle(title);

    // Discord modals support max 5 inputs
    questions.slice(0, 5).forEach((question, index) => {
      const input = new TextInputBuilder()
        .setCustomId(`question_${index}`)
        .setLabel(question.length > 45 ? question.substring(0, 45) : question)
        .setStyle(question.length > 100 ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(1000);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
    });

    return modal;
  }

  /**
   * Submit application
   */
  async submitApplication(guildId, userId, username, answers, config) {
    try {
      // Create application in database (link to config/type)
      const { data: application, error } = await this.supabase
        .from('applications')
        .insert({
          guild_id: guildId,
          config_id: config.id || null,
          user_id: userId,
          username: username,
          answers: answers,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Determine which channel to send to (review channel if set, otherwise application channel)
      const targetChannelId = config.review_channel_id || config.channel_id;
      const channel = await this.client.channels.fetch(targetChannelId);
      if (!channel) {
        return { success: false, error: 'Application channel not found' };
      }

      const typeName = config.name || 'Staff';
      // Build embed
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📝 New Application: ${typeName}`)
        .setAuthor({ name: username, iconURL: `https://cdn.discordapp.com/avatars/${userId}/${answers.avatar}.png` })
        .setDescription(`**Applicant:** <@${userId}>\n**Status:** 🟡 Pending Review`)
        .setTimestamp()
        .setFooter({ text: `Application ID: ${application.id.substring(0, 8)}` });

      // Add questions and answers
      config.questions.forEach((question, index) => {
        if (answers.responses[index]) {
          embed.addFields({
            name: question,
            value: answers.responses[index].substring(0, 1024),
            inline: false
          });
        }
      });

      // Create buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`app_vote_for_${application.id}`)
            .setLabel('Vote For')
            .setStyle(ButtonStyle.Success)
            .setEmoji('👍'),
          new ButtonBuilder()
            .setCustomId(`app_vote_against_${application.id}`)
            .setLabel('Vote Against')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👎'),
          new ButtonBuilder()
            .setCustomId(`app_approve_${application.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`app_reject_${application.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );

      // Send message
      let content = config.ping_role_id ? `<@&${config.ping_role_id}> New application!` : null;
      const message = await channel.send({ 
        content, 
        embeds: [embed], 
        components: [row] 
      });

      // Create thread if enabled
      let thread = null;
      if (config.auto_thread && channel.isTextBased()) {
        try {
          thread = await message.startThread({
            name: `${username} – ${typeName}`,
            autoArchiveDuration: 1440 // 24 hours
          });
        } catch (err) {
          console.error('Failed to create thread:', err);
        }
      }

      // Update application with message ID
      await this.supabase
        .from('applications')
        .update({ 
          message_id: message.id,
          thread_id: thread?.id || null
        })
        .eq('id', application.id);

      return { success: true, application, message, thread };
    } catch (error) {
      console.error('Error submitting application:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post the application message to Discord for an existing application (e.g. submitted via web).
   * Called by the webapp after inserting the row.
   */
  async postApplicationMessage(guildId, applicationId) {
    try {
      const { data: application, error: appError } = await this.supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .eq('guild_id', guildId)
        .single();

      if (appError || !application) {
        return { success: false, error: 'Application not found' };
      }

      let config = null;
      if (application.config_id) {
        const r = await this.getConfigById(guildId, application.config_id);
        config = r.config;
      }
      if (!config) {
        const configResult = await this.getConfig(guildId);
        config = configResult.config;
      }
      if (!config) {
        return { success: false, error: 'Config not found' };
      }

      const targetChannelId = config.review_channel_id || config.channel_id;
      const channel = await this.client.channels.fetch(targetChannelId);
      if (!channel) {
        return { success: false, error: 'Application channel not found' };
      }

      const typeName = config.name || 'Staff';
      const userId = application.user_id;
      const username = application.username || 'Unknown';
      const answers = application.answers || {};
      const responses = answers.responses || [];
      const avatar = answers.avatar || null;
      const authorOpts = { name: username };
      if (avatar) {
        authorOpts.iconURL = avatar.startsWith('http') ? avatar : `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
      }

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📝 New Application: ${typeName}`)
        .setAuthor(authorOpts)
        .setDescription(`**Applicant:** <@${userId}>\n**Status:** 🟡 Pending Review`)
        .setTimestamp()
        .setFooter({ text: `Application ID: ${application.id.substring(0, 8)}` });

      config.questions.forEach((question, index) => {
        if (responses[index]) {
          embed.addFields({
            name: question,
            value: String(responses[index]).substring(0, 1024),
            inline: false
          });
        }
      });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`app_vote_for_${application.id}`)
            .setLabel('Vote For')
            .setStyle(ButtonStyle.Success)
            .setEmoji('👍'),
          new ButtonBuilder()
            .setCustomId(`app_vote_against_${application.id}`)
            .setLabel('Vote Against')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('👎'),
          new ButtonBuilder()
            .setCustomId(`app_approve_${application.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`app_reject_${application.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
        );

      const content = config.ping_role_id ? `<@&${config.ping_role_id}> New application!` : null;
      const message = await channel.send({ content, embeds: [embed], components: [row] });

      let thread = null;
      if (config.auto_thread && channel.isTextBased()) {
        try {
          thread = await message.startThread({
            name: `${username} – ${typeName}`,
            autoArchiveDuration: 1440
          });
        } catch (err) {
          console.error('Failed to create thread:', err);
        }
      }

      await this.supabase
        .from('applications')
        .update({ message_id: message.id, thread_id: thread?.id || null })
        .eq('id', applicationId);

      return { success: true, application, message, thread };
    } catch (error) {
      console.error('Error posting application message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle vote
   */
  async handleVote(applicationId, userId, voteType) {
    try {
      const { data: application, error } = await this.supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (error || !application) {
        return { success: false, error: 'Application not found' };
      }

      if (application.status !== 'pending') {
        return { success: false, error: 'Application is no longer pending' };
      }

      // Get voters list
      const voters = application.voters || [];
      const existingVote = voters.find(v => v.user_id === userId);

      // Remove old vote if exists
      if (existingVote) {
        if (existingVote.type === 'for') {
          application.votes_for = Math.max(0, application.votes_for - 1);
        } else {
          application.votes_against = Math.max(0, application.votes_against - 1);
        }
        voters.splice(voters.indexOf(existingVote), 1);
      }

      // Add new vote if different
      if (!existingVote || existingVote.type !== voteType) {
        voters.push({ user_id: userId, type: voteType, timestamp: new Date().toISOString() });
        if (voteType === 'for') {
          application.votes_for += 1;
        } else {
          application.votes_against += 1;
        }
      }

      // Update in database
      await this.supabase
        .from('applications')
        .update({
          votes_for: application.votes_for,
          votes_against: application.votes_against,
          voters: voters
        })
        .eq('id', applicationId);

      return { 
        success: true, 
        votesFor: application.votes_for, 
        votesAgainst: application.votes_against 
      };
    } catch (error) {
      console.error('Error handling vote:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Approve application
   */
  async approveApplication(applicationId, reviewerId, reason = null) {
    try {
      const { data, error } = await this.supabase
        .from('applications')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_reason: reason
        })
        .eq('id', applicationId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, application: data };
    } catch (error) {
      console.error('Error approving application:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject application
   */
  async rejectApplication(applicationId, reviewerId, reason = null) {
    try {
      const { data, error } = await this.supabase
        .from('applications')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_reason: reason
        })
        .eq('id', applicationId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, application: data };
    } catch (error) {
      console.error('Error rejecting application:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update application message
   */
  async updateApplicationMessage(application, guild) {
    try {
      if (!application.message_id) return { success: false, error: 'No message ID' };

      let config = null;
      if (application.config_id) {
        const r = await this.getConfigById(application.guild_id, application.config_id);
        config = r.config;
      }
      if (!config) {
        const configResult = await this.getConfig(application.guild_id);
        config = configResult.config;
      }
      if (!config) {
        return { success: false, error: 'Config not found' };
      }

      // Use review channel if set, otherwise use application channel
      const targetChannelId = config.review_channel_id || config.channel_id;
      const channel = await this.client.channels.fetch(targetChannelId);
      if (!channel) return { success: false, error: 'Channel not found' };

      const message = await channel.messages.fetch(application.message_id);
      if (!message) return { success: false, error: 'Message not found' };

      const embed = message.embeds[0];
      if (!embed) return { success: false, error: 'Embed not found' };

      // Update embed
      const newEmbed = EmbedBuilder.from(embed);
      
      let statusText = '🟡 Pending Review';
      let color = '#5865F2';
      
      if (application.status === 'approved') {
        statusText = '✅ Approved';
        color = '#57F287';
      } else if (application.status === 'rejected') {
        statusText = '❌ Rejected';
        color = '#ED4245';
      }

      newEmbed.setDescription(
        `**Applicant:** <@${application.user_id}>\n` +
        `**Status:** ${statusText}\n` +
        `**Votes:** 👍 ${application.votes_for} | 👎 ${application.votes_against}`
      );
      newEmbed.setColor(color);

      if (application.reviewed_by) {
        newEmbed.addFields({
          name: 'Reviewed By',
          value: `<@${application.reviewed_by}>`,
          inline: true
        });
      }

      if (application.review_reason) {
        newEmbed.addFields({
          name: 'Reason',
          value: application.review_reason.substring(0, 1024),
          inline: false
        });
      }

      // Disable buttons if no longer pending
      const components = application.status === 'pending' ? message.components : [];

      await message.edit({ embeds: [newEmbed], components });

      return { success: true };
    } catch (error) {
      console.error('Error updating application message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List applications for guild
   */
  async listApplications(guildId, status = null, limit = 10) {
    try {
      let query = this.supabase
        .from('applications')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, applications: data || [] };
    } catch (error) {
      console.error('Error listing applications:', error);
      return { success: false, error: error.message, applications: [] };
    }
  }
}

module.exports = ApplicationsManager;
