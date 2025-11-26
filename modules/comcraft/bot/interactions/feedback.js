const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

function createFeedbackHandlers({ client, feedbackQueueManager, configManager }) {
  function hasManagerPermissions(interaction) {
    return interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
  }

  async function handleFeedbackCommand(interaction) {
    const guildId = interaction.guild.id;
    const subcommand = interaction.options.getSubcommand();

    if (!hasManagerPermissions(interaction)) {
      return interaction.reply({
        content: '❌ You do not have permission for this feedback command.',
        ephemeral: true,
      });
    }

    if (
      subcommand === 'setup' &&
      !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      return interaction.reply({
        content: '❌ Only server administrators can configure the feedback queue.',
        ephemeral: true,
      });
    }

    switch (subcommand) {
      case 'setup':
        return handleSetupSubcommand(interaction, guildId);
      case 'next':
        return handleNextSubcommand(interaction, guildId);
      case 'complete':
        return handleCompleteSubcommand(interaction, guildId);
      case 'queue':
        return handleQueueSubcommand(interaction, guildId);
      default:
        return interaction.reply({
          content: '❌ Unknown feedback subcommand.',
          ephemeral: true,
        });
    }
  }

  async function handleSetupSubcommand(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('kanaal', true);
    const role = interaction.options.getRole('rol');

    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({
        content: '❌ Please choose a text channel for the queue.',
      });
    }

    const result = await setupFeedbackQueueMessage(
      guildId,
      channel.id,
      role ? role.id : null,
      interaction.user.id,
      interaction.user.username
    );

    if (!result.success) {
      return interaction.editReply({
        content: `❌ Failed to place queue message: ${result.error}`,
      });
    }

    return interaction.editReply({
      content: `✅ Feedback queue set in ${channel}${role ? ` (role required: ${role})` : ''}.`,
    });
  }

  async function handleNextSubcommand(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const claim = await feedbackQueueManager.claimNextSubmission(guildId, interaction.user.id);
    if (!claim.success) {
      return interaction.editReply({ content: `❌ Unable to fetch submission: ${claim.error}` });
    }

    const submission = claim.data;
    if (!submission) {
      return interaction.editReply({ content: '📭 The queue is empty at the moment.' });
    }

    const embed = buildSubmissionEmbed(submission)
      .setTitle('🎧 Next submission ready for feedback')
      .addFields({ name: 'Submission ID', value: submission.id });

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`feedback_mark_complete_${submission.id}`)
        .setLabel('✅ Mark as complete')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      content: `🎶 You are now handling the submission from **${
        submission.display_name || submission.username
      }**.`,
      embeds: [embed],
      components: [actionRow],
    });

    const config = await feedbackQueueManager.getConfig(guildId);
    if (config?.channel_id) {
      await postClaimNotice(interaction, submission, config.channel_id);
    }
  }

  async function handleCompleteSubcommand(interaction, guildId) {
    const submissionId = interaction.options.getString('submission_id', true);
    const note = interaction.options.getString('notitie') || undefined;

    await interaction.deferReply({ ephemeral: true });

    const result = await feedbackQueueManager.completeSubmission(
      guildId,
      submissionId,
      interaction.user.id,
      note
    );

    if (!result.success) {
      return interaction.editReply({ content: `❌ Could not complete submission: ${result.error}` });
    }

    return interaction.editReply({ content: `✅ Submission ${submissionId} marked as complete.` });
  }

  async function handleQueueSubcommand(interaction, guildId) {
    await interaction.deferReply({ ephemeral: true });

    const pending = await feedbackQueueManager.listPending(guildId, 10);
    if (pending.length === 0) {
      return interaction.editReply({ content: '📭 The queue is empty.' });
    }

    const embed = new EmbedBuilder()
      .setColor('#22C55E')
      .setTitle('🎧 Pending feedback submissions')
      .setDescription(
        pending
          .map((entry, index) => {
            const submittedAt = new Date(entry.created_at).toLocaleString('en-US');
            const header = `**${index + 1}. ${entry.display_name || entry.username}** – ${
              entry.sample_url
            }`;
            const meta = `Status: ${entry.status} • ID: \`${entry.id}\` • ${submittedAt}`;
            const note = entry.user_notes ? `\n_Note:_ ${entry.user_notes}` : '';
            return `${header}\n${meta}${note}`;
          })
          .join('\n\n')
      );

    return interaction.editReply({ embeds: [embed] });
  }

  async function postClaimNotice(interaction, submission, channelId) {
    try {
      const queueChannel = await interaction.guild.channels.fetch(channelId);
      if (!queueChannel?.isTextBased()) return;

      const channelEmbed = buildSubmissionEmbed(submission)
        .setTitle('🎧 Submission currently being reviewed')
        .setFooter({ text: `Claimed by ${interaction.user.username}` });

      await queueChannel
        .send({
          content: `🎧 **${interaction.user.username}** is reviewing the submission from **${
            submission.display_name || submission.username
          }**.`,
          embeds: [channelEmbed],
        })
        .catch(() => {});
    } catch (err) {
      console.warn('Feedback queue: could not post claim notice', err.message);
    }
  }

  async function handleFeedbackSubmitButton(interaction) {
    const guildId = interaction.guildId;
    const config = await feedbackQueueManager.getConfig(guildId);

    if (!config) {
      return interaction.reply({
        content: '⛔ The feedback queue has not been configured yet.',
        ephemeral: true,
      });
    }

    if (config.button_role_id) {
      const hasRole = interaction.member.roles.cache.has(config.button_role_id);
      if (!hasRole) {
        return interaction.reply({
          content: '🚫 You do not have the required role to submit a sample.',
          ephemeral: true,
        });
      }
    }

    const modal = new ModalBuilder()
      .setCustomId('feedback_submit_modal')
      .setTitle((config.modal_title || 'Submit your sample for feedback').slice(0, 45));

    const linkInput = new TextInputBuilder()
      .setCustomId('sample_link')
      .setLabel((config.modal_link_label || 'Sample link').slice(0, 45))
      .setPlaceholder('https://...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const components = [new ActionRowBuilder().addComponents(linkInput)];

    if (config.modal_notes_label !== null) {
      const notesLabel = (config.modal_notes_label || 'Feedback request').slice(0, 45);
      const notesField = new TextInputBuilder()
        .setCustomId('sample_notes')
        .setLabel(notesLabel)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(!!config.modal_notes_required);

      components.push(new ActionRowBuilder().addComponents(notesField));
    }

    if (Array.isArray(config.extra_fields)) {
      for (const field of config.extra_fields.slice(0, 3)) {
        const textInput = new TextInputBuilder()
          .setCustomId(`extra_${field.id}`)
          .setLabel((field.label || 'Extra field').slice(0, 45))
          .setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(!!field.required);

        if (field.placeholder) {
          textInput.setPlaceholder(field.placeholder.slice(0, 100));
        }

        components.push(new ActionRowBuilder().addComponents(textInput));
      }
    }

    modal.addComponents(...components);
    await interaction.showModal(modal);
  }

  async function handleFeedbackSubmitModal(interaction) {
    const guildId = interaction.guildId;
    const config = await feedbackQueueManager.getConfig(guildId);

    if (!config) {
      return interaction.reply({
        content: '⛔ Feedback queue configuration not found. Please contact an admin.',
        ephemeral: true,
      });
    }

    const sampleUrl = interaction.fields.getTextInputValue('sample_link').trim();
    let notes = '';
    if (config.modal_notes_label !== null) {
      try {
        notes = interaction.fields.getTextInputValue('sample_notes')?.trim?.() || '';
      } catch (err) {
        notes = '';
      }
    }

    if (!/^https?:\/\/\S+/i.test(sampleUrl)) {
      return interaction.reply({
        content: '❌ Invalid link. Please make sure it starts with http(s)://',
        ephemeral: true,
      });
    }

    const extraData = collectExtraFields(interaction, config.extra_fields);

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const displayName = member?.displayName || interaction.user.username;

    const submission = await feedbackQueueManager.createSubmission({
      guild_id: guildId,
      user_id: interaction.user.id,
      username: interaction.user.username,
      display_name: displayName,
      sample_url: sampleUrl,
      user_notes: notes,
      metadata: extraData,
    });

    if (!submission.success) {
      return interaction.reply({
        content: `❌ Could not save your submission: ${submission.error}`,
        ephemeral: true,
      });
    }

    await postSubmissionToQueue(interaction, config, submission.data);
    await notifySubmission(interaction, config, submission.data, displayName);

    return interaction.reply({
      content: '✅ Thanks! Your sample has been added to the queue. A moderator will pick it up soon.',
      ephemeral: true,
    });
  }

  function collectExtraFields(interaction, extraFields) {
    const extraData = {};
    if (!Array.isArray(extraFields)) return extraData;

    for (const field of extraFields) {
      let value = '';
      try {
        value = interaction.fields.getTextInputValue(`extra_${field.id}`)?.trim?.() ?? '';
      } catch (err) {
        value = '';
      }
      if (value !== '') {
        extraData[field.id] = {
          label: field.label || 'Extra field',
          value,
        };
      }
    }

    return extraData;
  }

  async function postSubmissionToQueue(interaction, config, submission) {
    const queueChannel = await interaction.guild.channels.fetch(config.channel_id).catch(() => null);
    if (!queueChannel?.isTextBased()) return;

    const embed = buildSubmissionEmbed(submission)
      .setTitle('🎶 New feedback submission')
      .setFooter({ text: `Submission ID: ${submission.id}` });

    await queueChannel
      .send({
        content: `🔔 New submission from **${submission.display_name || submission.username}** waiting for feedback!`,
        embeds: [embed],
      })
      .catch((err) => console.warn('Could not post feedback message:', err.message));
  }

  async function notifySubmission(interaction, config, submission, displayName) {
    const notificationChannelId =
      config.notification_channel_id && config.notification_channel_id !== config.channel_id
        ? config.notification_channel_id
        : null;

    if (!notificationChannelId) {
      return;
    }

    const notifyChannel = await interaction.guild.channels
      .fetch(notificationChannelId)
      .catch(() => null);
    if (!notifyChannel?.isTextBased()) {
      return;
    }

    const pingRoleId = config.notification_ping_role;
    const replacements = {
      '{{user}}': displayName,
      '{{link}}': submission.sample_url || '',
      '{{channel}}': `<#${config.channel_id}>`,
      '{{role}}': pingRoleId ? `<@&${pingRoleId}>` : '',
    };

    let notificationMessage = (
      config.notification_message || '🔔 New submission from {{user}} waiting for feedback!'
    ).trim();

    if (!notificationMessage) {
      notificationMessage = '🔔 New submission from {{user}} waiting for feedback!';
    }

    Object.entries(replacements).forEach(([placeholder, value]) => {
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      notificationMessage = notificationMessage.replace(regex, value);
    });

    if (pingRoleId && !notificationMessage.includes(`<@&${pingRoleId}>`)) {
      notificationMessage = `<@&${pingRoleId}> ${notificationMessage}`.trim();
    }

    if (notificationMessage.length === 0) {
      notificationMessage = '🔔 New submission waiting for feedback!';
    }

    const notificationEmbed = buildSubmissionEmbed(submission)
      .setTitle('🎶 New feedback submission')
      .setFooter({ text: `Submission ID: ${submission.id}` });

    await notifyChannel
      .send({
        content: notificationMessage,
        embeds: [notificationEmbed],
      })
      .catch((err) => console.warn('Could not post notification message:', err.message));
  }

  async function handleFeedbackCompleteButton(interaction, submissionId) {
    if (!hasManagerPermissions(interaction)) {
      return interaction.reply({
        content: '❌ You do not have permission to perform this action.',
        ephemeral: true,
      });
    }

    const guildId = interaction.guildId;
    const result = await feedbackQueueManager.completeSubmission(
      guildId,
      submissionId,
      interaction.user.id,
      'Marked via button'
    );

    if (!result.success) {
      return interaction.reply({
        content: `❌ Could not complete submission: ${result.error}`,
        ephemeral: true,
      });
    }

    const embed = buildSubmissionEmbed(result.data)
      .setTitle('✅ Submission completed')
      .setFooter({ text: `Completed by ${interaction.user.username}` });

    await interaction.update({
      content: '✅ Submission marked as completed.',
      embeds: [embed],
      components: [],
    });

    await notifyFeedbackCompletion(guildId, result.data, interaction.user.username);
  }

  async function setupFeedbackQueueMessage(guildId, channelId, roleId, createdBy, createdByName) {
    try {
      const guild =
        client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) {
        return { success: false, error: 'Guild not found' };
      }

      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Channel is not text-based' };
      }

      const existingConfig = await feedbackQueueManager.getConfig(guildId);
      if (existingConfig?.channel_id && existingConfig?.message_id) {
        await cleanupPreviousQueueMessage(guild, existingConfig);
      }

      const embed = buildFeedbackQueueEmbed(existingConfig, roleId);

      const styleMap = {
        primary: ButtonStyle.Primary,
        secondary: ButtonStyle.Secondary,
        success: ButtonStyle.Success,
        danger: ButtonStyle.Danger,
      };

      const buttonLabelRaw = existingConfig?.queue_button_label ?? '🎵 Sample indienen';
      const buttonLabel = (typeof buttonLabelRaw === 'string' ? buttonLabelRaw : 'Submit').trim() || 'Submit';
      const styleKey =
        typeof existingConfig?.queue_button_style === 'string'
          ? existingConfig.queue_button_style.toLowerCase()
          : 'primary';

      const button = new ButtonBuilder()
        .setCustomId('feedback_submit')
        .setLabel(buttonLabel.slice(0, 80))
        .setStyle(styleMap[styleKey] || ButtonStyle.Primary);

      if (existingConfig?.queue_button_emoji && typeof existingConfig.queue_button_emoji === 'string') {
        const emoji = existingConfig.queue_button_emoji.trim();
        if (emoji) {
          button.setEmoji(emoji);
        }
      }

      const row = new ActionRowBuilder().addComponents(button);

      const message = await channel.send({
        embeds: [embed],
        components: [row],
      });

      await feedbackQueueManager.setConfig(guildId, {
        channel_id: channelId,
        message_id: message.id,
        button_role_id: roleId || null,
        created_by: createdBy || createdByName || 'unknown',
      });

      console.log(`🎧 Feedback queue message posted in ${guild.name} (${channelId})`);
      return { success: true, messageId: message.id };
    } catch (error) {
      console.error('Feedback queue: setup failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function cleanupPreviousQueueMessage(guild, existingConfig) {
    try {
      const oldChannel = await guild.channels.fetch(existingConfig.channel_id);
      if (!oldChannel?.isTextBased()) return;

      const oldMessage = await oldChannel.messages.fetch(existingConfig.message_id);
      if (oldMessage) {
        await oldMessage.delete().catch(() => {});
      }
    } catch (err) {
      console.warn('Feedback queue: could not delete previous message:', err.message);
    }
  }

  async function notifyFeedbackCompletion(guildId, submission, moderatorName) {
    try {
      const config = await feedbackQueueManager.getConfig(guildId);
      if (!config?.channel_id) return;

      const guild =
        client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
      if (!guild) return;

      const completionChannelId = config.notification_channel_id || config.channel_id;
      const channel = await guild.channels.fetch(completionChannelId);
      if (!channel || !channel.isTextBased()) return;

      const embed = buildSubmissionEmbed(submission)
        .setTitle('✅ Submission completed')
        .setFooter({ text: `Completed by ${moderatorName}` });

      await channel
        .send({
          content: `✅ **${moderatorName}** finished the submission from **${
            submission.display_name || submission.username
          }**.`,
          embeds: [embed],
        })
        .catch(() => {});
    } catch (error) {
      console.warn('Feedback queue: completion notification failed', error);
    }
  }

  function buildFeedbackQueueEmbed(config = {}, roleId) {
    const defaultDescription =
      'Click the button below to submit your sample for feedback.\n\n• Provide a Soundcloud, YouTube, Dropbox... link\n• Optionally add context (genre, type of feedback)\n• Moderators pick submissions in order during feedback sessions';
    const defaultTitle = '🎧 Sample Feedback Queue';
    const defaultFooter = 'ComCraft Feedback Queue';
    const defaultColor = '#8B5CF6';

    const rawColor = typeof config.queue_embed_color === 'string' ? config.queue_embed_color : defaultColor;
    const sanitizedColor = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;

    let colorInt = 0x8b5cf6;
    if (/^#?[0-9a-fA-F]{6}$/.test(rawColor) || /^#?[0-9a-fA-F]{6}$/.test(sanitizedColor)) {
      try {
        colorInt = parseInt(sanitizedColor.replace('#', ''), 16);
      } catch (err) {
        colorInt = 0x8b5cf6;
      }
    }

    const embed = new EmbedBuilder().setColor(colorInt).setTimestamp();

    const title = config.queue_embed_title ?? defaultTitle;
    if (typeof title === 'string' && title.trim().length > 0) {
      embed.setTitle(title.trim().slice(0, 256));
    } else {
      embed.setTitle(defaultTitle);
    }

    let description = config.queue_embed_description ?? defaultDescription;
    if (typeof description !== 'string' || description.trim().length === 0) {
      description = defaultDescription;
    }

    if (roleId) {
      if (/\{\{\s*role\s*\}\}/gi.test(description)) {
        description = description.replace(/\{\{\s*role\s*\}\}/gi, `<@&${roleId}>`);
      } else if (!description.includes(`<@&${roleId}>`)) {
        description = `${description}\n\n🔒 Only available to <@&${roleId}> members.`;
      }
    } else {
      description = description.replace(/\{\{\s*role\s*\}\}/gi, '');
    }

    embed.setDescription(description.slice(0, 2048));

    if (Object.prototype.hasOwnProperty.call(config, 'queue_embed_footer')) {
      const footer = config.queue_embed_footer;
      if (typeof footer === 'string' && footer.trim() !== '') {
        embed.setFooter({ text: footer.trim().slice(0, 2048) });
      }
    } else {
      embed.setFooter({ text: defaultFooter });
    }

    if (config.queue_embed_thumbnail) {
      embed.setThumbnail(config.queue_embed_thumbnail);
    }

    if (config.queue_embed_image) {
      embed.setImage(config.queue_embed_image);
    }

    return embed;
  }

  function buildSubmissionEmbed(submission) {
    const submittedAt = submission.created_at
      ? new Date(submission.created_at).toLocaleString('en-US')
      : 'Unknown';

    const fields = [
      {
        name: 'Producer',
        value: submission.display_name || submission.username || submission.user_id,
        inline: true,
      },
      { name: 'Status', value: submission.status || 'pending', inline: true },
      { name: 'Sample', value: submission.sample_url || '—', inline: false },
    ];

    if (submission.user_notes) {
      fields.push({ name: 'Artist request', value: submission.user_notes, inline: false });
    }

    if (submission.metadata && typeof submission.metadata === 'object') {
      for (const [key, meta] of Object.entries(submission.metadata)) {
        const label = meta?.label || `Field ${key}`;
        const value = meta?.value ? String(meta.value) : '-';
        fields.push({ name: label, value, inline: false });
      }
    }

    if (submission.moderator_notes) {
      fields.push({ name: 'Moderator note', value: submission.moderator_notes, inline: false });
    }

    fields.push({ name: 'Submitted at', value: submittedAt, inline: false });

    return new EmbedBuilder().setColor('#7C3AED').addFields(fields).setTimestamp();
  }

  return {
    handleFeedbackCommand,
    handleFeedbackSubmitButton,
    handleFeedbackSubmitModal,
    handleFeedbackCompleteButton,
    setupFeedbackQueueMessage,
    notifyFeedbackCompletion,
  };
}

module.exports = createFeedbackHandlers;

