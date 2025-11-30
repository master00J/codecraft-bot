/**
 * ComCraft Voice Move Handlers
 * Handles voice move command interactions
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class VoiceMoveHandlers {
  constructor() {
    // No initialization needed for now
  }

  /**
   * Handle voice move command
   */
  async handleVoiceMove(interaction) {
    try {
      console.log('🔍 [Voice Move] handleVoiceMove called');
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.MoveMembers)) {
        console.log('❌ [Voice Move] User lacks MoveMembers permission');
        return interaction.reply({
          content: '❌ Je hebt geen toestemming om gebruikers te verplaatsen.',
          ephemeral: true
        });
      }

      const subcommand = interaction.options.getSubcommand();
      console.log(`🔍 [Voice Move] Subcommand: ${subcommand}`);

    switch (subcommand) {
      case 'all':
        await this.handleMoveAll(interaction);
        break;
      case 'users':
        await this.handleMoveUsers(interaction);
        break;
      case 'role':
        await this.handleMoveRole(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Onbekend subcommando.',
          ephemeral: true
        });
    }
    } catch (error) {
      console.error('❌ [Voice Move] Error in handleVoiceMove:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Er is een fout opgetreden bij het uitvoeren van dit commando.',
          ephemeral: true
        }).catch(() => {});
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: '❌ Er is een fout opgetreden bij het uitvoeren van dit commando.'
        }).catch(() => {});
      }
    }
  }

  /**
   * Move all users from one channel to another
   */
  async handleMoveAll(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const fromChannel = interaction.options.getChannel('from');
    const toChannel = interaction.options.getChannel('to');
    const reason = interaction.options.getString('reason') || 'Geen reden opgegeven';

    // Determine source channel
    let sourceChannel = fromChannel;
    if (!sourceChannel && interaction.member.voice?.channel) {
      sourceChannel = interaction.member.voice.channel;
    }

    if (!sourceChannel) {
      return interaction.editReply({
        content: '❌ Je moet een bron channel opgeven of in een voice channel zijn.'
      });
    }

    if (sourceChannel.id === toChannel.id) {
      return interaction.editReply({
        content: '❌ Het bron en doel channel kunnen niet hetzelfde zijn.'
      });
    }

    // Get all members in source channel
    const membersToMove = sourceChannel.members.filter(member => {
      // Don't move bots unless they are the bot itself
      return !member.user.bot || member.id === interaction.client.user.id;
    });

    if (membersToMove.size === 0) {
      return interaction.editReply({
        content: `❌ Er zijn geen gebruikers in ${sourceChannel.name} om te verplaatsen.`
      });
    }

    // Move all members
    const results = await this.moveMembers(membersToMove, toChannel, reason);

    // Create embed response
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Gebruikers Verplaatst')
      .setDescription(`Gebruikers verplaatst van **${sourceChannel.name}** naar **${toChannel.name}**`)
      .addFields(
        {
          name: '📊 Resultaat',
          value: `✅ Succesvol: ${results.success}\n❌ Gefaald: ${results.failed}\n⏭️ Overgeslagen: ${results.skipped}`,
          inline: false
        },
        {
          name: '📝 Reden',
          value: reason,
          inline: false
        }
      )
      .setTimestamp();

    if (results.failedMembers.length > 0) {
      embed.addFields({
        name: '❌ Kon niet verplaatsen',
        value: results.failedMembers.slice(0, 10).map(m => `• ${m.tag}`).join('\n') + 
               (results.failedMembers.length > 10 ? `\n*... en ${results.failedMembers.length - 10} meer*` : ''),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Move specific users to a channel
   */
  async handleMoveUsers(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const toChannel = interaction.options.getChannel('to');
    const usersInput = interaction.options.getString('users');
    const reason = interaction.options.getString('reason') || 'Geen reden opgegeven';

    // Parse user IDs from input (can be IDs, mentions, or usernames)
    const userIds = usersInput
      .replace(/[<@!>]/g, '') // Remove mention formatting
      .split(/[,\s]+/)
      .filter(id => id.length > 0);

    const membersToMove = new Map();

    for (const userId of userIds) {
      try {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (member && member.voice?.channel) {
          membersToMove.set(member.id, member);
        }
      } catch (error) {
        console.error(`Error fetching member ${userId}:`, error);
      }
    }

    if (membersToMove.size === 0) {
      return interaction.editReply({
        content: '❌ Geen geldige gebruikers gevonden die in een voice channel zijn.'
      });
    }

    // Move members
    const results = await this.moveMembers(membersToMove, toChannel, reason);

    // Create embed response
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Gebruikers Verplaatst')
      .setDescription(`Gebruikers verplaatst naar **${toChannel.name}**`)
      .addFields(
        {
          name: '📊 Resultaat',
          value: `✅ Succesvol: ${results.success}\n❌ Gefaald: ${results.failed}\n⏭️ Overgeslagen: ${results.skipped}`,
          inline: false
        },
        {
          name: '📝 Reden',
          value: reason,
          inline: false
        }
      )
      .setTimestamp();

    if (results.failedMembers.length > 0) {
      embed.addFields({
        name: '❌ Kon niet verplaatsen',
        value: results.failedMembers.slice(0, 10).map(m => `• ${m.tag}`).join('\n') + 
               (results.failedMembers.length > 10 ? `\n*... en ${results.failedMembers.length - 10} meer*` : ''),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Move all users with a specific role
   */
  async handleMoveRole(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const role = interaction.options.getRole('role');
    const toChannel = interaction.options.getChannel('to');
    const reason = interaction.options.getString('reason') || 'Geen reden opgegeven';

    // Get all members with the role who are in a voice channel
    const membersToMove = new Map();
    
    for (const member of role.members.values()) {
      if (member.voice?.channel && !member.user.bot) {
        membersToMove.set(member.id, member);
      }
    }

    if (membersToMove.size === 0) {
      return interaction.editReply({
        content: `❌ Geen gebruikers met de role **${role.name}** gevonden die in een voice channel zijn.`
      });
    }

    // Move members
    const results = await this.moveMembers(membersToMove, toChannel, reason);

    // Create embed response
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Gebruikers Verplaatst')
      .setDescription(`Alle gebruikers met de role **${role.name}** verplaatst naar **${toChannel.name}**`)
      .addFields(
        {
          name: '📊 Resultaat',
          value: `✅ Succesvol: ${results.success}\n❌ Gefaald: ${results.failed}\n⏭️ Overgeslagen: ${results.skipped}`,
          inline: false
        },
        {
          name: '📝 Reden',
          value: reason,
          inline: false
        }
      )
      .setTimestamp();

    if (results.failedMembers.length > 0) {
      embed.addFields({
        name: '❌ Kon niet verplaatsen',
        value: results.failedMembers.slice(0, 10).map(m => `• ${m.tag}`).join('\n') + 
               (results.failedMembers.length > 10 ? `\n*... en ${results.failedMembers.length - 10} meer*` : ''),
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }

  /**
   * Move multiple members to a channel
   * @param {Map|Collection} members - Collection of members to move
   * @param {VoiceChannel} targetChannel - Target voice channel
   * @param {string} reason - Reason for moving
   * @returns {Promise<Object>} Results object with success/failed counts
   */
  async moveMembers(members, targetChannel, reason) {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      failedMembers: []
    };

    // Check if bot has permission to move members
    if (!targetChannel.permissionsFor(targetChannel.guild.members.me)?.has(PermissionFlagsBits.MoveMembers)) {
      throw new Error('Ik heb geen toestemming om gebruikers naar dit channel te verplaatsen.');
    }

    // Move members one by one (Discord rate limits apply)
    for (const member of members.values()) {
      try {
        // Skip if already in target channel
        if (member.voice?.channel?.id === targetChannel.id) {
          results.skipped++;
          continue;
        }

        // Skip if user is not in a voice channel
        if (!member.voice?.channel) {
          results.skipped++;
          continue;
        }

        // Check if bot can move this specific member
        const botMember = targetChannel.guild.members.me;
        if (member.id === targetChannel.guild.ownerId) {
          // Can't move server owner
          results.failed++;
          results.failedMembers.push(member.user);
          continue;
        }
        
        if (member.roles.highest.position >= botMember.roles.highest.position) {
          // Can't move members with equal or higher role
          results.failed++;
          results.failedMembers.push(member.user);
          continue;
        }

        // Move the member
        await member.voice.setChannel(targetChannel, reason);
        results.success++;

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error moving member ${member.user.tag}:`, error);
        results.failed++;
        results.failedMembers.push(member.user);
      }
    }

    return results;
  }
}

module.exports = VoiceMoveHandlers;

