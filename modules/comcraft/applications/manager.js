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
   * Setup application system for a guild
   */
  async setupConfig(guildId, channelId, questions, options = {}) {
    try {
      const { data, error } = await this.supabase
        .from('application_configs')
        .upsert({
          guild_id: guildId,
          channel_id: channelId,
          questions: questions,
          enabled: options.enabled ?? true,
          min_age: options.minAge ?? 0,
          cooldown_days: options.cooldownDays ?? 7,
          require_account_age_days: options.requireAccountAgeDays ?? 0,
          auto_thread: options.autoThread ?? false,
          ping_role_id: options.pingRoleId ?? null,
          updated_at: new Date().toISOString()
        })
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
   * Get configuration for a guild
   */
  async getConfig(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('application_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, config: null };
        }
        throw error;
      }

      return { success: true, config: data };
    } catch (error) {
      console.error('Error getting application config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user can submit application
   */
  async canApply(guildId, userId, member) {
    try {
      const configResult = await this.getConfig(guildId);
      if (!configResult.success || !configResult.config) {
        return { canApply: false, reason: 'Application system not configured' };
      }

      const config = configResult.config;

      if (!config.enabled) {
        return { canApply: false, reason: 'Applications are currently disabled' };
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

      // Check cooldown
      const { data: recentApps } = await this.supabase
        .from('applications')
        .select('created_at')
        .eq('guild_id', guildId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentApps && recentApps.length > 0) {
        const lastApp = new Date(recentApps[0].created_at);
        const cooldownMs = config.cooldown_days * 24 * 60 * 60 * 1000;
        const timeSince = Date.now() - lastApp.getTime();

        if (timeSince < cooldownMs) {
          const daysLeft = Math.ceil((cooldownMs - timeSince) / (24 * 60 * 60 * 1000));
          return { 
            canApply: false, 
            reason: `You must wait ${daysLeft} more day(s) before applying again` 
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
   * Create modal for application
   */
  createApplicationModal(questions) {
    const modal = new ModalBuilder()
      .setCustomId('application_submit')
      .setTitle('Staff Application');

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
      // Create application in database
      const { data: application, error } = await this.supabase
        .from('applications')
        .insert({
          guild_id: guildId,
          user_id: userId,
          username: username,
          answers: answers,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Send to channel
      const channel = await this.client.channels.fetch(config.channel_id);
      if (!channel) {
        return { success: false, error: 'Application channel not found' };
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📝 New Staff Application')
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
            name: `${username}'s Application`,
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

      const configResult = await this.getConfig(application.guild_id);
      if (!configResult.success || !configResult.config) {
        return { success: false, error: 'Config not found' };
      }

      const channel = await this.client.channels.fetch(configResult.config.channel_id);
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
