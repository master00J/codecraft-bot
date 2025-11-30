/**
 * ComCraft Voice Move Commands
 * Slash commands for moving multiple users between voice channels
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = [
  new SlashCommandBuilder()
    .setName('voicemove')
    .setDescription('Move multiple users between voice channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Move all users from one voice channel to another')
        .addChannelOption(option =>
          option
            .setName('to')
            .setDescription('Target voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('from')
            .setDescription('Source voice channel (leave empty to use your current channel)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for moving (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('users')
        .setDescription('Move specific users to a voice channel')
        .addChannelOption(option =>
          option
            .setName('to')
            .setDescription('Target voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('users')
            .setDescription('User IDs or mentions (separated by space or comma)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for moving (optional)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Move all users with a specific role to a voice channel')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Role whose members should be moved')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('to')
            .setDescription('Target voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for moving (optional)')
            .setRequired(false)
        )
    )
];

