/**
 * ComCraft Voice Move Commands
 * Slash commands for moving multiple users between voice channels
 */

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = [
  new SlashCommandBuilder()
    .setName('voicemove')
    .setDescription('Verplaats meerdere gebruikers tussen voice channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('all')
        .setDescription('Verplaats alle gebruikers van een voice channel naar een ander')
        .addChannelOption(option =>
          option
            .setName('from')
            .setDescription('Bron voice channel (laat leeg voor jouw huidige channel)')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('to')
            .setDescription('Doel voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reden voor verplaatsing (optioneel)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('users')
        .setDescription('Verplaats specifieke gebruikers naar een voice channel')
        .addChannelOption(option =>
          option
            .setName('to')
            .setDescription('Doel voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('users')
            .setDescription('Gebruikers IDs of mentions (gescheiden door spatie of komma)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reden voor verplaatsing (optioneel)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('role')
        .setDescription('Verplaats alle gebruikers met een bepaalde role naar een voice channel')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Role waarvan alle leden verplaatst moeten worden')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option
            .setName('to')
            .setDescription('Doel voice channel')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reden voor verplaatsing (optioneel)')
            .setRequired(false)
        )
    )
];

