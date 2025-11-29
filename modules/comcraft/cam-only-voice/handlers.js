/**
 * ComCraft Cam-Only Voice Command Handlers
 * Handles slash command interactions for cam-only voice
 */

const { EmbedBuilder, ChannelType } = require('discord.js');

class CamOnlyVoiceHandlers {
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Handle enable subcommand
   */
  async handleEnable(interaction) {
    try {
      const channel = interaction.options.getChannel('channel');
      const gracePeriod = interaction.options.getInteger('grace-period');
      const warnings = interaction.options.getBoolean('warnings');
      const maxWarnings = interaction.options.getInteger('max-warnings');
      const logChannel = interaction.options.getChannel('log-channel');

      // Validate channel type if provided
      if (channel && channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({
          content: '❌ The specified channel must be a voice channel.',
          ephemeral: true
        });
      }

      // Validate log channel if provided (can be text or voice channel)
      if (logChannel && logChannel.type !== ChannelType.GuildText && logChannel.type !== ChannelType.GuildVoice) {
        return interaction.reply({
          content: '❌ The log channel must be a text or voice channel.',
          ephemeral: true
        });
      }

      // Get current config
      const currentConfig = await this.manager.getConfig(interaction.guild.id);
      
      // Build channel IDs array
      let channelIds = currentConfig.channel_ids || [];
      if (channel) {
        if (!channelIds.includes(channel.id)) {
          channelIds.push(channel.id);
        }
      }

      // Update config
      const updatedConfig = {
        guild_id: interaction.guild.id,
        enabled: true,
        channel_ids: channelIds,
        grace_period_seconds: gracePeriod || currentConfig.grace_period_seconds || 10,
        warning_enabled: warnings !== null ? warnings : (currentConfig.warning_enabled !== false),
        max_warnings: maxWarnings !== null ? maxWarnings : (currentConfig.max_warnings || 2),
        exempt_roles: currentConfig.exempt_roles || [],
        exempt_users: currentConfig.exempt_users || [],
        log_channel_id: logChannel ? logChannel.id : (currentConfig.log_channel_id || null)
      };

      const savedConfig = await this.manager.saveConfig(updatedConfig);

      if (!savedConfig) {
        return interaction.reply({
          content: '❌ Failed to save configuration. Please try again.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Cam-Only Voice Enabled')
        .setDescription(
          `Camera requirement has been enabled for ${channel ? `<#${channel.id}>` : 'all voice channels'}.\n\n` +
          `**Settings:**\n` +
          `• Grace Period: ${savedConfig.grace_period_seconds}s\n` +
          `• Warnings: ${savedConfig.warning_enabled ? `Enabled (${savedConfig.max_warnings} max)` : 'Disabled'}\n` +
          `${savedConfig.log_channel_id ? `• Log Channel: <#${savedConfig.log_channel_id}>\n` : ''}` +
          `• Monitored Channels: ${savedConfig.channel_ids.length}`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error in handleEnable:', error);
      await interaction.reply({
        content: '❌ An error occurred while enabling cam-only voice.',
        ephemeral: true
      }).catch(() => {});
    }
  }

  /**
   * Handle disable subcommand
   */
  async handleDisable(interaction) {
    try {
      const channel = interaction.options.getChannel('channel');

      const currentConfig = await this.manager.getConfig(interaction.guild.id);

      if (!currentConfig.enabled) {
        return interaction.reply({
          content: '❌ Cam-only voice is already disabled.',
          ephemeral: true
        });
      }

      let channelIds = currentConfig.channel_ids || [];
      
      if (channel) {
        // Remove specific channel
        channelIds = channelIds.filter(id => id !== channel.id);
        
        if (channelIds.length === 0) {
          // No channels left, disable entirely
          const updatedConfig = {
            ...currentConfig,
            enabled: false,
            channel_ids: []
          };
          await this.manager.saveConfig(updatedConfig);
        } else {
          // Update with remaining channels
          const updatedConfig = {
            ...currentConfig,
            channel_ids: channelIds
          };
          await this.manager.saveConfig(updatedConfig);
        }

        await interaction.reply({
          content: `✅ Cam-only requirement disabled for <#${channel.id}>.`,
          ephemeral: true
        });
      } else {
        // Disable for all channels
        const updatedConfig = {
          ...currentConfig,
          enabled: false,
          channel_ids: []
        };
        await this.manager.saveConfig(updatedConfig);

        await interaction.reply({
          content: '✅ Cam-only voice has been disabled for all channels.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error in handleDisable:', error);
      await interaction.reply({
        content: '❌ An error occurred while disabling cam-only voice.',
        ephemeral: true
      }).catch(() => {});
    }
  }

  /**
   * Handle status subcommand
   */
  async handleStatus(interaction) {
    try {
      const config = await this.manager.getConfig(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor(config.enabled ? 0x00FF00 : 0xFF0000)
        .setTitle('📊 Cam-Only Voice Status')
        .setDescription(
          `**Status:** ${config.enabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
          `**Settings:**\n` +
          `• Grace Period: ${config.grace_period_seconds}s\n` +
          `• Warnings: ${config.warning_enabled ? `Enabled (${config.max_warnings} max)` : 'Disabled'}\n` +
          `• Monitored Channels: ${config.channel_ids.length}\n` +
          `• Exempt Roles: ${config.exempt_roles.length}\n` +
          `• Exempt Users: ${config.exempt_users.length}\n` +
          `${config.log_channel_id ? `• Log Channel: <#${config.log_channel_id}>` : '• Log Channel: None'}`
        );

      if (config.channel_ids.length > 0) {
        embed.addFields({
          name: 'Monitored Channels',
          value: config.channel_ids.map(id => `<#${id}>`).join('\n') || 'None',
          inline: false
        });
      }

      if (config.exempt_roles.length > 0 || config.exempt_users.length > 0) {
        const exemptList = [];
        if (config.exempt_roles.length > 0) {
          exemptList.push(`**Roles:** ${config.exempt_roles.map(id => `<@&${id}>`).join(', ')}`);
        }
        if (config.exempt_users.length > 0) {
          exemptList.push(`**Users:** ${config.exempt_users.map(id => `<@${id}>`).join(', ')}`);
        }
        embed.addFields({
          name: 'Exemptions',
          value: exemptList.join('\n') || 'None',
          inline: false
        });
      }

      embed.setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error in handleStatus:', error);
      await interaction.reply({
        content: '❌ An error occurred while fetching status.',
        ephemeral: true
      }).catch(() => {});
    }
  }

  /**
   * Handle exempt subcommands
   */
  async handleExempt(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();
      const config = await this.manager.getConfig(interaction.guild.id);

      if (subcommand === 'add-role') {
        const role = interaction.options.getRole('role');
        const exemptRoles = config.exempt_roles || [];
        
        if (exemptRoles.includes(role.id)) {
          return interaction.reply({
            content: `❌ <@&${role.id}> is already exempt.`,
            ephemeral: true
          });
        }

        exemptRoles.push(role.id);
        const updatedConfig = {
          ...config,
          exempt_roles: exemptRoles
        };
        await this.manager.saveConfig(updatedConfig);

        await interaction.reply({
          content: `✅ <@&${role.id}> is now exempt from cam requirement.`,
          ephemeral: true
        });
      } else if (subcommand === 'remove-role') {
        const role = interaction.options.getRole('role');
        const exemptRoles = (config.exempt_roles || []).filter(id => id !== role.id);
        
        const updatedConfig = {
          ...config,
          exempt_roles: exemptRoles
        };
        await this.manager.saveConfig(updatedConfig);

        await interaction.reply({
          content: `✅ <@&${role.id}> is no longer exempt.`,
          ephemeral: true
        });
      } else if (subcommand === 'add-user') {
        const user = interaction.options.getUser('user');
        const exemptUsers = config.exempt_users || [];
        
        if (exemptUsers.includes(user.id)) {
          return interaction.reply({
            content: `❌ <@${user.id}> is already exempt.`,
            ephemeral: true
          });
        }

        exemptUsers.push(user.id);
        const updatedConfig = {
          ...config,
          exempt_users: exemptUsers
        };
        await this.manager.saveConfig(updatedConfig);

        await interaction.reply({
          content: `✅ <@${user.id}> is now exempt from cam requirement.`,
          ephemeral: true
        });
      } else if (subcommand === 'remove-user') {
        const user = interaction.options.getUser('user');
        const exemptUsers = (config.exempt_users || []).filter(id => id !== user.id);
        
        const updatedConfig = {
          ...config,
          exempt_users: exemptUsers
        };
        await this.manager.saveConfig(updatedConfig);

        await interaction.reply({
          content: `✅ <@${user.id}> is no longer exempt.`,
          ephemeral: true
        });
      } else if (subcommand === 'list') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📋 Exempt List')
          .setTimestamp();

        if (config.exempt_roles.length > 0) {
          embed.addFields({
            name: 'Exempt Roles',
            value: config.exempt_roles.map(id => `<@&${id}>`).join('\n') || 'None',
            inline: false
          });
        }

        if (config.exempt_users.length > 0) {
          embed.addFields({
            name: 'Exempt Users',
            value: config.exempt_users.map(id => `<@${id}>`).join('\n') || 'None',
            inline: false
          });
        }

        if (config.exempt_roles.length === 0 && config.exempt_users.length === 0) {
          embed.setDescription('No exemptions configured.');
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      console.error('❌ [Cam-Only Voice] Error in handleExempt:', error);
      await interaction.reply({
        content: '❌ An error occurred while managing exemptions.',
        ephemeral: true
      }).catch(() => {});
    }
  }
}

module.exports = CamOnlyVoiceHandlers;

