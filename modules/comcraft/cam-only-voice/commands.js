/**
 * ComCraft Cam-Only Voice Commands
 * Slash commands for managing cam-only voice channels
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = [
  new SlashCommandBuilder()
    .setName('cam-only')
    .setDescription('Manage cam-only voice channel settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable cam-only requirement for voice channels')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Voice channel to enable cam-only (leave empty for all channels)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('grace-period')
            .setDescription('Grace period in seconds before disconnecting (default: 10)')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(60)
        )
        .addBooleanOption(option =>
          option
            .setName('warnings')
            .setDescription('Enable warnings before disconnecting (default: true)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('max-warnings')
            .setDescription('Maximum warnings before disconnecting (default: 2)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(5)
        )
        .addChannelOption(option =>
          option
            .setName('log-channel')
            .setDescription('Channel to log cam-only actions')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable cam-only requirement')
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Voice channel to disable (leave empty for all channels)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View current cam-only voice settings')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('exempt')
        .setDescription('Manage exempt roles and users')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add-role')
            .setDescription('Add a role that is exempt from cam requirement')
            .addRoleOption(option =>
              option
                .setName('role')
                .setDescription('Role to exempt')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove-role')
            .setDescription('Remove a role from exempt list')
            .addRoleOption(option =>
              option
                .setName('role')
                .setDescription('Role to remove')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('add-user')
            .setDescription('Add a user that is exempt from cam requirement')
            .addUserOption(option =>
              option
                .setName('user')
                .setDescription('User to exempt')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove-user')
            .setDescription('Remove a user from exempt list')
            .addUserOption(option =>
              option
                .setName('user')
                .setDescription('User to remove')
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('List all exempt roles and users')
        )
    )
    .toJSON()
];

