const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

function createPollCommands() {
  return [
    new SlashCommandBuilder()
      .setName('poll')
      .setDescription('📊 Create and manage polls')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('create')
          .setDescription('Create a new poll')
          .addStringOption((option) =>
            option
              .setName('question')
              .setDescription('The poll question/title')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('description')
              .setDescription('Optional description for the poll')
              .setRequired(false)
          )
          .addStringOption((option) =>
            option
              .setName('options')
              .setDescription('Poll options separated by commas (e.g., "Option 1, Option 2, Option 3")')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('type')
              .setDescription('Poll type')
              .setRequired(false)
              .addChoices(
                { name: 'Single Choice', value: 'single' },
                { name: 'Multiple Choice', value: 'multiple' }
              )
          )
          .addStringOption((option) =>
            option
              .setName('voting')
              .setDescription('Voting type')
              .setRequired(false)
              .addChoices(
                { name: 'Public', value: 'public' },
                { name: 'Anonymous', value: 'anonymous' }
              )
          )
          .addIntegerOption((option) =>
            option
              .setName('duration')
              .setDescription('Duration in hours (0 = no expiry)')
              .setRequired(false)
              .setMinValue(0)
          )
          .addChannelOption((option) =>
            option
              .setName('channel')
              .setDescription('Channel to post poll in (default: current channel)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('vote')
          .setDescription('Vote on a poll')
          .addStringOption((option) =>
            option
              .setName('poll_id')
              .setDescription('Poll ID (get from poll info)')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('options')
              .setDescription('Option letters (e.g., "A" or "A,B,C" for multiple)')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('results')
          .setDescription('View poll results')
          .addStringOption((option) =>
            option
              .setName('poll_id')
              .setDescription('Poll ID (get from poll info)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('end')
          .setDescription('End a poll early')
          .addStringOption((option) =>
            option
              .setName('poll_id')
              .setDescription('Poll ID to end')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('info')
          .setDescription('Get information about a poll')
          .addStringOption((option) =>
            option
              .setName('poll_id')
              .setDescription('Poll ID')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List active polls in this server')
      )
  ];
}

async function handlePollCommand(interaction, pollManager) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'create':
        await handlePollCreate(interaction, pollManager);
        break;
      case 'vote':
        await handlePollVote(interaction, pollManager);
        break;
      case 'results':
        await handlePollResults(interaction, pollManager);
        break;
      case 'end':
        await handlePollEnd(interaction, pollManager);
        break;
      case 'info':
        await handlePollInfo(interaction, pollManager);
        break;
      case 'list':
        await handlePollList(interaction, pollManager);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  } catch (error) {
    console.error('Error handling poll command:', error);
    await interaction.reply({
      content: `Error: ${error.message}`,
      ephemeral: true
    }).catch(() => {});
  }
}

async function handlePollCreate(interaction, pollManager) {
  await interaction.deferReply({ ephemeral: true });

  const question = interaction.options.getString('question');
  const description = interaction.options.getString('description');
  const optionsStr = interaction.options.getString('options');
  const pollType = interaction.options.getString('type') || 'single';
  const votingType = interaction.options.getString('voting') || 'public';
  const duration = interaction.options.getInteger('duration');
  const channel = interaction.options.getChannel('channel') || interaction.channel;

  // Validate channel
  if (!channel.isTextBased()) {
    await interaction.editReply({ content: '❌ Polls can only be created in text channels!' });
    return;
  }

  // Validate permissions
  if (!channel.permissionsFor(interaction.guild.members.me).has(['SendMessages', 'EmbedLinks'])) {
    await interaction.editReply({ content: '❌ I need permission to send messages and embeds in that channel!' });
    return;
  }

  // Parse options
  const optionsArray = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
  
  if (optionsArray.length < 2) {
    await interaction.editReply({ content: '❌ Polls need at least 2 options!' });
    return;
  }

  if (optionsArray.length > 25) {
    await interaction.editReply({ content: '❌ Polls can have a maximum of 25 options!' });
    return;
  }

  // Map options
  const options = optionsArray.map((text, index) => ({
    text,
    emoji: null, // Could add emoji parsing later
    order: index
  }));

  // Calculate expiry
  let expiresAt = null;
  if (duration && duration > 0) {
    expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
  }

  try {
    // Create poll
    const poll = await pollManager.createPoll(
      interaction.guildId,
      channel.id,
      interaction.user.id,
      {
        title: question,
        description,
        pollType,
        votingType,
        options,
        expiresAt,
        allowChangeVote: true,
        maxVotes: pollType === 'multiple' ? options.length : 1
      }
    );

    // Create message
    await pollManager.createPollMessage(poll.id);

    await interaction.editReply({
      content: `✅ Poll created successfully! Check ${channel.toString()}`
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    await interaction.editReply({
      content: `❌ Failed to create poll: ${error.message}`
    });
  }
}

async function handlePollVote(interaction, pollManager) {
  await interaction.deferReply({ ephemeral: true });

  const pollId = interaction.options.getString('poll_id');
  const optionsStr = interaction.options.getString('options').toUpperCase();

  try {
    const poll = await pollManager.getPoll(pollId);
    if (!poll) {
      await interaction.editReply({ content: '❌ Poll not found!' });
      return;
    }

    if (poll.guild_id !== interaction.guildId) {
      await interaction.editReply({ content: '❌ That poll belongs to a different server!' });
      return;
    }

    if (poll.status !== 'active') {
      await interaction.editReply({ content: '❌ This poll is not active!' });
      return;
    }

    // Parse option letters (A, B, C, etc.)
    const optionLetters = optionsStr.split(',').map(l => l.trim()).filter(l => l.length > 0);
    const optionIds = [];

    for (const letter of optionLetters) {
      const index = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
      if (index < 0 || index >= poll.poll_options.length) {
        await interaction.editReply({ content: `❌ Invalid option: ${letter}` });
        return;
      }
      optionIds.push(poll.poll_options[index].id);
    }

    // Vote
    const result = await pollManager.vote(pollId, interaction.user.id, optionIds);
    
    // Update message
    await pollManager.updatePollMessage(pollId);

    await interaction.editReply({
      content: result.changed 
        ? '✅ Vote updated successfully!'
        : '✅ Vote recorded!'
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handlePollResults(interaction, pollManager) {
  await interaction.deferReply({ ephemeral: true });

  const pollId = interaction.options.getString('poll_id');

  if (!pollId) {
    // Show list of polls to choose from
    const polls = await pollManager.getActivePolls(interaction.guildId, 10);
    
    if (polls.length === 0) {
      await interaction.editReply({ content: '❌ No active polls found!' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Active Polls')
      .setDescription(polls.map(p => `**${p.title}**\nID: \`${p.id}\``).join('\n\n'))
      .setColor(0x5865F2);

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  try {
    const poll = await pollManager.getPollWithResults(pollId);
    if (!poll) {
      await interaction.editReply({ content: '❌ Poll not found!' });
      return;
    }

    if (poll.guild_id !== interaction.guildId) {
      await interaction.editReply({ content: '❌ That poll belongs to a different server!' });
      return;
    }

    const embed = await pollManager.buildPollEmbed(poll, true);
    if (!embed) {
      await interaction.editReply({ content: '❌ Failed to build results embed!' });
      return;
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handlePollEnd(interaction, pollManager) {
  await interaction.deferReply({ ephemeral: true });

  // Check permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.editReply({ content: '❌ You need "Manage Messages" permission to end polls!' });
    return;
  }

  const pollId = interaction.options.getString('poll_id');

  try {
    const poll = await pollManager.closePoll(pollId, interaction.user.id, false);
    
    if (!poll) {
      await interaction.editReply({ content: '❌ Poll not found!' });
      return;
    }

    if (poll.guild_id !== interaction.guildId) {
      await interaction.editReply({ content: '❌ That poll belongs to a different server!' });
      return;
    }

    await interaction.editReply({
      content: '✅ Poll closed successfully!'
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handlePollInfo(interaction, pollManager) {
  await interaction.deferReply({ ephemeral: true });

  const pollId = interaction.options.getString('poll_id');

  try {
    const poll = await pollManager.getPollWithResults(pollId);
    if (!poll) {
      await interaction.editReply({ content: '❌ Poll not found!' });
      return;
    }

    if (poll.guild_id !== interaction.guildId) {
      await interaction.editReply({ content: '❌ That poll belongs to a different server!' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Poll Information')
      .addFields(
        { name: 'Title', value: poll.title, inline: false },
        { name: 'Status', value: poll.status, inline: true },
        { name: 'Type', value: poll.poll_type === 'multiple' ? 'Multiple Choice' : 'Single Choice', inline: true },
        { name: 'Voting', value: poll.voting_type === 'anonymous' ? 'Anonymous' : 'Public', inline: true },
        { name: 'Total Votes', value: poll.total_votes?.toString() || '0', inline: true },
        { name: 'Poll ID', value: `\`${poll.id}\``, inline: false }
      )
      .setColor(0x5865F2);

    if (poll.description) {
      embed.setDescription(poll.description);
    }

    if (poll.expires_at && poll.status === 'active') {
      embed.addFields({
        name: 'Expires',
        value: `<t:${Math.floor(new Date(poll.expires_at).getTime() / 1000)}:R>`,
        inline: true
      });
    }

    if (poll.message_id) {
      embed.addFields({
        name: 'Poll Message',
        value: `[Jump to Poll](https://discord.com/channels/${poll.guild_id}/${poll.channel_id}/${poll.message_id})`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handlePollList(interaction, pollManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const polls = await pollManager.getActivePolls(interaction.guildId, 10);

    if (polls.length === 0) {
      await interaction.editReply({ content: '❌ No active polls found in this server!' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Active Polls')
      .setDescription(
        polls.map(p => {
          const expires = p.expires_at 
            ? ` (expires <t:${Math.floor(new Date(p.expires_at).getTime() / 1000)}:R>)`
            : '';
          return `**${p.title}**\nID: \`${p.id}\` • ${p.total_votes || 0} votes${expires}`;
        }).join('\n\n')
      )
      .setColor(0x5865F2)
      .setFooter({ text: `Showing ${polls.length} active poll(s)` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

module.exports = {
  createPollCommands,
  handlePollCommand
};

