/**
 * ComCraft Vote Kick Commands
 * Slash commands for vote kick functionality
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

class VoteKickCommands {
  constructor(voteKickManager) {
    this.voteKickManager = voteKickManager;
  }

  /**
   * Register all vote kick commands
   */
  getCommands() {
    return [
      // Vote kick command
      new SlashCommandBuilder()
        .setName('votekick')
        .setDescription('Start a vote to kick a user from the voice channel')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to vote kick from the voice channel')
            .setRequired(true)
        )
    ];
  }

  /**
   * Handle vote kick command
   */
  async handleVoteKick(interaction) {
    try {
      const targetUser = interaction.options.getUser('user');
      const targetMember = await interaction.guild.members.fetch(targetUser.id);
      const initiator = interaction.member;

      // Check if vote kick is enabled
      const isEnabled = await this.voteKickManager.isEnabled(interaction.guild.id);
      if (!isEnabled) {
        return interaction.reply({
          content: '❌ Vote kick is disabled for this server. Enable it in the dashboard.',
          ephemeral: true
        });
      }

      // Get voice channel of initiator
      if (!initiator.voice.channel) {
        return interaction.reply({
          content: '❌ You must be in a voice channel to start a vote kick.',
          ephemeral: true
        });
      }

      const voiceChannel = initiator.voice.channel;

      // Check if target can be vote kicked
      const canKick = await this.voteKickManager.canBeVoteKicked(
        interaction.guild,
        targetMember,
        voiceChannel.id
      );

      if (!canKick.allowed) {
        return interaction.reply({
          content: `❌ ${canKick.reason}`,
          ephemeral: true
        });
      }

      // Start vote kick session
      const result = await this.voteKickManager.startVoteKick(
        interaction.guild,
        voiceChannel,
        targetMember,
        initiator
      );

      if (!result.success) {
        return interaction.reply({
          content: `❌ ${result.error}`,
          ephemeral: true
        });
      }

      const session = result.session;
      const config = await this.voteKickManager.getConfig(interaction.guild.id);

      // Create embed and buttons
      const embed = this.voteKickManager.createVoteEmbed(
        session,
        targetMember,
        initiator,
        config
      );
      const buttons = this.voteKickManager.createVoteButtons(session.id);

      // Send message
      const message = await interaction.reply({
        embeds: [embed],
        components: [buttons],
        fetchReply: true
      });

      // Update session with message ID
      await this.voteKickManager.supabase
        .from('vote_kick_sessions')
        .update({ message_id: message.id })
        .eq('id', session.id);

      // Set up auto-update interval
      this.setupAutoUpdate(message, session, targetMember, initiator, config);
    } catch (error) {
      console.error('Error handling vote kick command:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while starting the vote kick.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Set up auto-update for vote kick embed
   */
  setupAutoUpdate(message, session, targetMember, initiator, config) {
    const updateInterval = setInterval(async () => {
      try {
        // Get updated session
        const { data: updatedSession } = await this.voteKickManager.supabase
          .from('vote_kick_sessions')
          .select('*')
          .eq('id', session.id)
          .single();

        if (!updatedSession || updatedSession.status !== 'active') {
          clearInterval(updateInterval);
          return;
        }

        // Check if expired
        if (new Date(updatedSession.expires_at) < new Date()) {
          clearInterval(updateInterval);
          await this.voteKickManager.expireSession(session.id);
          
          const expiredEmbed = new EmbedBuilder()
            .setColor(0x808080)
            .setTitle('🗳️ Vote Kick - Expired')
            .setDescription(`The vote kick for **${targetMember.user.tag}** has expired.`)
            .addFields(
              {
                name: '✅ Votes For',
                value: `${updatedSession.votes_for || 0}/${updatedSession.required_votes}`,
                inline: true
              },
              {
                name: '❌ Votes Against',
                value: `${updatedSession.votes_against || 0}`,
                inline: true
              }
            )
            .setTimestamp();

          await message.edit({
            embeds: [expiredEmbed],
            components: []
          });
          return;
        }

        // Update embed
        const embed = this.voteKickManager.createVoteEmbed(
          updatedSession,
          targetMember,
          initiator,
          config
        );

        await message.edit({
          embeds: [embed],
          components: [this.voteKickManager.createVoteButtons(session.id)]
        });
      } catch (error) {
        console.error('Error updating vote kick embed:', error);
        clearInterval(updateInterval);
      }
    }, 5000); // Update every 5 seconds

    // Clear interval after vote duration
    setTimeout(() => {
      clearInterval(updateInterval);
    }, (config.vote_duration_seconds || 60) * 1000);
  }

  /**
   * Handle vote button interaction
   */
  async handleVoteButton(interaction) {
    try {
      const customId = interaction.customId;
      const match = customId.match(/^votekick_vote_([^_]+)_(for|against)$/);
      
      if (!match) {
        return;
      }

      const sessionId = match[1];
      const voteType = match[2];

      // Check if vote kick is enabled
      const isEnabled = await this.voteKickManager.isEnabled(interaction.guild.id);
      if (!isEnabled) {
        return interaction.reply({
          content: '❌ Vote kick is disabled for this server.',
          ephemeral: true
        });
      }

      // Record vote
      const result = await this.voteKickManager.vote(sessionId, interaction.user.id, voteType);

      if (!result.success) {
        return interaction.reply({
          content: `❌ ${result.error}`,
          ephemeral: true
        });
      }

      // Get updated session
      const { data: session } = await this.voteKickManager.supabase
        .from('vote_kick_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return interaction.reply({
          content: '❌ Vote kick session not found.',
          ephemeral: true
        });
      }

      // Get target member
      const targetMember = await interaction.guild.members.fetch(session.target_user_id);
      const initiator = await interaction.guild.members.fetch(session.initiator_user_id);
      const config = await this.voteKickManager.getConfig(interaction.guild.id);

      // Update embed
      const embed = this.voteKickManager.createVoteEmbed(session, targetMember, initiator, config);

      await interaction.message.edit({
        embeds: [embed],
        components: [this.voteKickManager.createVoteButtons(sessionId)]
      });

      // Confirm vote
      await interaction.reply({
        content: `✅ You voted ${voteType === 'for' ? 'to kick' : 'to keep'} **${targetMember.user.tag}**.`,
        ephemeral: true
      });

      // If vote passed, handle kick
      if (result.passed) {
        await this.handleVotePassed(interaction, session, targetMember, initiator);
      }
    } catch (error) {
      console.error('Error handling vote button:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your vote.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Handle when vote passes
   */
  async handleVotePassed(interaction, session, targetMember, initiator) {
    try {
      // Kick user from voice channel
      if (targetMember.voice.channel) {
        await targetMember.voice.disconnect('Vote kicked from voice channel');
      }

      // Update log with usernames
      await this.voteKickManager.supabase
        .from('vote_kick_logs')
        .update({
          target_username: targetMember.user.tag,
          initiator_username: initiator.user.tag
        })
        .eq('guild_id', session.guild_id)
        .eq('target_user_id', session.target_user_id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Create passed embed
      const passedEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🗳️ Vote Kick - Passed')
        .setDescription(`**${targetMember.user.tag}** has been kicked from the voice channel.`)
        .addFields(
          {
            name: '✅ Votes For',
            value: `${session.votes_for || 0}/${session.required_votes}`,
            inline: true
          },
          {
            name: '❌ Votes Against',
            value: `${session.votes_against || 0}`,
            inline: true
          },
          {
            name: '👥 Total Voters',
            value: `${(session.voters || []).length}`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.message.edit({
        embeds: [passedEmbed],
        components: []
      });

      // Send log message if log channel is configured
      const config = await this.voteKickManager.getConfig(interaction.guild.id);
      if (config?.log_channel_id) {
        try {
          const logChannel = await interaction.guild.channels.fetch(config.log_channel_id);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor(0xFF6B6B)
              .setTitle('🗳️ Vote Kick Executed')
              .setDescription(`**${targetMember.user.tag}** was vote kicked from <#${session.channel_id}>`)
              .addFields(
                {
                  name: '👤 Target',
                  value: `${targetMember.user.tag} (${targetMember.id})`,
                  inline: true
                },
                {
                  name: '🚀 Started by',
                  value: `${initiator.user.tag}`,
                  inline: true
                },
                {
                  name: '✅ Votes For',
                  value: `${session.votes_for || 0}`,
                  inline: true
                },
                {
                  name: '❌ Votes Against',
                  value: `${session.votes_against || 0}`,
                  inline: true
                }
              )
              .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
          }
        } catch (error) {
          console.error('Error sending log message:', error);
        }
      }
    } catch (error) {
      console.error('Error handling vote passed:', error);
    }
  }
}

module.exports = VoteKickCommands;

