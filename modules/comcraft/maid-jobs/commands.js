const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

function createMaidJobCommands() {
  return [
    new SlashCommandBuilder()
      .setName('maid')
      .setDescription('🧹 Maid job system - clean channels and earn rewards')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('clock-in')
          .setDescription('Clock in to start your maid shift')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('clock-out')
          .setDescription('Clock out to end your maid shift')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('clean')
          .setDescription('Clean the current channel')
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('Channel to clean (default: current channel)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('status')
          .setDescription('View your current maid job status')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('stats')
          .setDescription('View your maid job statistics')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to view stats for (default: you)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('leaderboard')
          .setDescription('View the maid job leaderboard')
      )
  ];
}

async function handleMaidCommand(interaction, maidJobManager) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'clock-in':
        await handleClockIn(interaction, maidJobManager);
        break;
      case 'clock-out':
        await handleClockOut(interaction, maidJobManager);
        break;
      case 'clean':
        await handleClean(interaction, maidJobManager);
        break;
      case 'status':
        await handleStatus(interaction, maidJobManager);
        break;
      case 'stats':
        await handleStats(interaction, maidJobManager);
        break;
      case 'leaderboard':
        await handleLeaderboard(interaction, maidJobManager);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  } catch (error) {
    console.error('Error handling maid command:', error);
    await interaction.reply({
      content: `Error: ${error.message}`,
      ephemeral: true
    }).catch(() => {});
  }
}

async function handleClockIn(interaction, maidJobManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await maidJobManager.getConfig(interaction.guildId);
    if (!config || !config.enabled) {
      await interaction.editReply({
        content: '❌ Maid jobs are not enabled for this server. Contact an administrator.'
      });
      return;
    }

    // Check if user is in maid quarters channel
    const maidQuartersChannel = interaction.guild.channels.cache.get(config.maid_quarters_channel_id);
    if (interaction.channel.id !== config.maid_quarters_channel_id) {
      await interaction.editReply({
        content: `❌ You must be in the maid quarters to clock in!\nPlease go to ${maidQuartersChannel ? maidQuartersChannel.toString() : 'the maid quarters channel'} and try again.`
      });
      return;
    }

    const session = await maidJobManager.clockIn(interaction.guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('🧹 Clocked In!')
      .setDescription('You have successfully clocked in. Start cleaning channels to earn rewards!')
      .addFields(
        { name: 'Status', value: '✅ Active', inline: true },
        { name: 'Channels Cleaned', value: '0', inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleClockOut(interaction, maidJobManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const session = await maidJobManager.clockOut(interaction.guildId, interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Clocked Out!')
      .setDescription('Your shift has ended. Great work!')
      .addFields(
        { name: 'Channels Cleaned', value: session.channels_cleaned.toString(), inline: true },
        { name: 'Duration', value: formatDuration(new Date(session.clocked_in_at), new Date()), inline: true }
      )
      .setColor(0x5865F2)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleClean(interaction, maidJobManager) {
  await interaction.deferReply({ ephemeral: false }); // Public so others can see

  try {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    // Only text channels can be cleaned
    if (!targetChannel.isTextBased()) {
      await interaction.editReply({
        content: '❌ You can only clean text channels!'
      });
      return;
    }

    const result = await maidJobManager.cleanChannel(
      interaction.guildId,
      interaction.user.id,
      targetChannel.id,
      targetChannel.name
    );

    const embed = new EmbedBuilder()
      .setTitle('🧹 Channel Cleaned!')
      .setDescription(`**${result.roleplayMessage}**`)
      .addFields(
        { name: 'Channel', value: targetChannel.toString(), inline: true },
        { name: 'Total Cleaned This Shift', value: result.channelsCleaned.toString(), inline: true },
        { name: 'Rewards', value: `💰 ${result.coinsEarned} coins\n⭐ ${result.xpEarned} XP`, inline: false }
      )
      .setFooter({ text: `Keep it up! Clean more channels to earn role rewards.` })
      .setColor(0x00FF00)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleStatus(interaction, maidJobManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const session = await maidJobManager.getActiveSession(interaction.guildId, interaction.user.id);

    if (!session) {
      const config = await maidJobManager.getConfig(interaction.guildId);
      const maidQuartersChannel = config 
        ? interaction.guild.channels.cache.get(config.maid_quarters_channel_id)?.toString() || 'maid quarters'
        : 'maid quarters';

      await interaction.editReply({
        content: `❌ You are not currently clocked in.\n\nGo to ${maidQuartersChannel} and use \`/maid clock-in\` to start your shift!`
      });
      return;
    }

    const duration = formatDuration(new Date(session.clocked_in_at), new Date());

    const embed = new EmbedBuilder()
      .setTitle('🧹 Maid Job Status')
      .setDescription('Your current shift information')
      .addFields(
        { name: 'Status', value: '✅ Active', inline: true },
        { name: 'Channels Cleaned', value: session.channels_cleaned.toString(), inline: true },
        { name: 'Shift Duration', value: duration, inline: true }
      )
      .setFooter({ text: 'Use /maid clean to clean channels!' })
      .setColor(0x5865F2)
      .setTimestamp(new Date(session.clocked_in_at));

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleStats(interaction, maidJobManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const stats = await maidJobManager.getUserStats(interaction.guildId, targetUser.id);

    if (!stats || stats.total_cleanings === 0) {
      await interaction.editReply({
        content: targetUser.id === interaction.user.id
          ? '❌ You haven\'t completed any maid jobs yet. Clock in and start cleaning!'
          : `❌ ${targetUser.username} hasn't completed any maid jobs yet.`
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🧹 Maid Job Statistics - ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Total Sessions', value: stats.total_sessions.toString(), inline: true },
        { name: 'Total Cleanings', value: stats.total_cleanings.toString(), inline: true },
        { name: 'Channels Cleaned', value: stats.total_channels_cleaned.toString(), inline: true },
        { name: '💰 Coins Earned', value: stats.total_coins_earned.toString(), inline: true },
        { name: '⭐ XP Earned', value: stats.total_xp_earned.toString(), inline: true },
        { name: 'Role Level', value: stats.current_role_level > 0 ? `Level ${stats.current_role_level}` : 'None', inline: true }
      )
      .setColor(0x5865F2)
      .setTimestamp();

    if (stats.last_cleaning_at) {
      embed.setFooter({ text: `Last cleaning: ${new Date(stats.last_cleaning_at).toLocaleDateString()}` });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleLeaderboard(interaction, maidJobManager) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const leaderboard = await maidJobManager.getLeaderboard(interaction.guildId, 10);

    if (!leaderboard || leaderboard.length === 0) {
      await interaction.editReply({
        content: '❌ No maid job statistics found yet. Be the first to start cleaning!'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🧹 Maid Job Leaderboard')
      .setDescription('Top cleaners in this server')
      .setColor(0x5865F2)
      .setTimestamp();

    const leaderboardText = await Promise.all(
      leaderboard.map(async (entry, index) => {
        let user;
        try {
          user = await interaction.client.users.fetch(entry.user_id);
        } catch {
          user = { username: 'Unknown User', discriminator: '0000' };
        }

        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

        return `${medal} **${user.username}** - ${entry.total_cleanings} cleanings (💰 ${entry.total_coins_earned} coins)`;
      })
    );

    embed.setDescription(leaderboardText.join('\n'));

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

function formatDuration(start, end) {
  const ms = end - start;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  createMaidJobCommands,
  handleMaidCommand
};

