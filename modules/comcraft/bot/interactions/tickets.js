const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

function createTicketHandlers({ featureGate, ticketManager, supportFeatureKey = 'support_tickets' }) {
  async function ensureDeferred(interaction, options = { ephemeral: true }) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(options);
    }
  }

  async function ensureFeature(interaction, minTier = 'Basic') {
    const allowed = await featureGate.checkFeature(interaction.guild?.id, supportFeatureKey);
    if (!allowed) {
      const embed = featureGate.createUpgradeEmbed('Support Tickets', minTier);
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
    return allowed;
  }

  function normalizeHexColor(input, fallback = '#5865F2') {
    if (typeof input !== 'string') {
      return fallback;
    }
    const value = input.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(value)) {
      return fallback;
    }
    return value.startsWith('#') ? value : `#${value}`;
  }

  function resolvePanelOptions(config = {}) {
    return {
      title: (config.panel_embed_title ?? '').trim() || '🎫 Need help from the team?',
      description:
        (config.panel_embed_description ?? '').trim() ||
        'Click the button below to create a private support ticket with our staff.',
      color: normalizeHexColor(config.panel_embed_color),
      footer: (config.panel_embed_footer ?? '').trim() || null,
      thumbnail: (config.panel_embed_thumbnail_url ?? '').trim() || null,
      image: (config.panel_embed_image_url ?? '').trim() || null,
      buttonLabel: (config.panel_button_label ?? '').trim() || 'Open Ticket',
      buttonEmoji: (config.panel_button_emoji ?? '').trim() || '🎫',
    };
  }

  async function buildPanelComponents(config = {}, guildId = null) {
    const options = resolvePanelOptions(config);
    const embed = new EmbedBuilder()
      .setColor(options.color)
      .setTitle(options.title)
      .setDescription(options.description)
      .setTimestamp();

    if (options.footer) {
      embed.setFooter({ text: options.footer });
    }
    if (options.thumbnail) {
      embed.setThumbnail(options.thumbnail);
    }
    if (options.image) {
      embed.setImage(options.image);
    }

    // Fetch active categories for this guild
    const categories = guildId ? await ticketManager.getCategories(guildId) : [];
    
    const buttons = [];
    
    if (categories.length > 0) {
      // Create a button for each category (max 5 per row)
      for (const category of categories.slice(0, 5)) {
        const button = new ButtonBuilder()
          .setCustomId(`create_ticket_${category.id}`)
          .setLabel(category.name)
          .setStyle(ButtonStyle.Primary);

        if (category.emoji) {
          try {
            button.setEmoji(category.emoji);
          } catch {
            // ignore invalid emoji values
          }
        }
        buttons.push(button);
      }
    } else {
      // Fallback: single generic button
    const button = new ButtonBuilder()
      .setCustomId('create_ticket')
      .setLabel(options.buttonLabel || 'Open Ticket')
      .setStyle(ButtonStyle.Primary);

    if (options.buttonEmoji) {
      try {
        button.setEmoji(options.buttonEmoji);
      } catch {
        // ignore invalid emoji values
      }
      }
      buttons.push(button);
    }

    const rows = [];
    // Split buttons into rows of 5
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    return { embed, rows, options, categories };
  }

  async function handleTicketCommand(interaction) {
    await ensureDeferred(interaction);

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create': {
        const subject = interaction.options.getString('onderwerp', true);
        const result = await ticketManager.createTicket(interaction.guild, interaction.user, subject);

        if (result.success) {
          return interaction.editReply({
            content: `✅ Ticket created! Jump into <#${result.channelId}> to continue the conversation.`,
          });
        }
        return interaction.editReply({
          content: `❌ Failed to create ticket: ${result.error}`,
        });
      }

      case 'close': {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.editReply({
            content: '❌ You do not have permission to close tickets.',
          });
        }

        const channel = interaction.channel;
        const reason = interaction.options.getString('reden') || 'Resolved';

        if (!channel.name.includes('ticket-')) {
          return interaction.editReply({
            content: '❌ This command can only be used inside a ticket channel.',
          });
        }

        const success = await ticketManager.closeTicket(channel, interaction.user, reason);

        if (success) {
          return interaction.editReply({
            content: '✅ Closing ticket...',
          });
        }
        return interaction.editReply({
          content: '❌ Failed to close ticket.',
        });
      }

      case 'add': {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.editReply({
            content: '❌ You do not have permission to add members to tickets.',
          });
        }

        const channel = interaction.channel;
        const userToAdd = interaction.options.getUser('user', true);

        if (!channel.name.includes('ticket-')) {
          return interaction.editReply({
            content: '❌ This command can only be used inside a ticket channel.',
          });
        }

        try {
          await channel.permissionOverwrites.edit(userToAdd.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          });

          const addEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setDescription(`➕ ${userToAdd} was added to this ticket by ${interaction.user}.`)
            .setTimestamp();

          await channel.send({ embeds: [addEmbed] });

          return interaction.editReply({
            content: `✅ ${userToAdd} was added to this ticket.`,
          });
        } catch (error) {
          console.error('Error adding user to ticket:', error);
          return interaction.editReply({
            content: '❌ Failed to add that member to the ticket.',
          });
        }
      }

      case 'remove': {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.editReply({
            content: '❌ You do not have permission to remove members from tickets.',
          });
        }

        const channel = interaction.channel;
        const userToRemove = interaction.options.getUser('user', true);

        if (!channel.name.includes('ticket-')) {
          return interaction.editReply({
            content: '❌ This command can only be used inside a ticket channel.',
          });
        }

        try {
          await channel.permissionOverwrites.delete(userToRemove.id);

          const removeEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription(`➖ ${userToRemove} was removed from this ticket by ${interaction.user}.`)
            .setTimestamp();

          await channel.send({ embeds: [removeEmbed] });

          return interaction.editReply({
            content: `✅ ${userToRemove} was removed from this ticket.`,
          });
        } catch (error) {
          console.error('Error removing user from ticket:', error);
          return interaction.editReply({
            content: '❌ Failed to remove that member from the ticket.',
          });
        }
      }

      default:
        return interaction.editReply({
          content: '❌ Unknown subcommand.',
        });
    }
  }

  async function handleTicketSetupCommand(interaction) {
    await ensureDeferred(interaction);

    try {
      const guildId = interaction.guild.id;
      const existingConfig = (await ticketManager.getConfig(guildId)) || {};

      let supportCategory = null;
      if (existingConfig.support_category_id) {
        supportCategory =
          interaction.guild.channels.cache.get(existingConfig.support_category_id) ||
          (await interaction.guild.channels
            .fetch(existingConfig.support_category_id)
            .catch(() => null));
      }

      if (!supportCategory) {
        supportCategory = interaction.guild.channels.cache.find(
          (c) => c.name === '🎫 SUPPORT' && c.type === ChannelType.GuildCategory,
        );
      }

      let categoryCreated = false;
      if (!supportCategory) {
        supportCategory = await interaction.guild.channels.create({
          name: '🎫 SUPPORT',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
          ],
        });
        categoryCreated = true;
      }

      let infoChannel = null;
      if (existingConfig.panel_channel_id) {
        infoChannel =
          interaction.guild.channels.cache.get(existingConfig.panel_channel_id) ||
          (await interaction.guild.channels
            .fetch(existingConfig.panel_channel_id)
            .catch(() => null));
      }

      if (!infoChannel || infoChannel.parentId !== supportCategory.id) {
        infoChannel = interaction.guild.channels.cache.find(
          (c) => c.name === 'support-info' && c.parentId === supportCategory.id,
        );
      }

      let channelCreated = false;
      if (!infoChannel) {
        infoChannel = await interaction.guild.channels.create({
          name: 'support-info',
          type: ChannelType.GuildText,
          parent: supportCategory.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              allow: [PermissionFlagsBits.ViewChannel],
              deny: [PermissionFlagsBits.SendMessages],
            },
          ],
        });
        channelCreated = true;
      }

      if (
        existingConfig.panel_message_id &&
        existingConfig.panel_channel_id
      ) {
        const previousChannel =
          interaction.guild.channels.cache.get(existingConfig.panel_channel_id) ||
          (await interaction.guild.channels
            .fetch(existingConfig.panel_channel_id)
            .catch(() => null));

        if (previousChannel?.isTextBased()) {
          await previousChannel.messages
            .fetch(existingConfig.panel_message_id)
            .then((msg) => msg.delete().catch(() => {}))
            .catch(() => {});
        }
      }

      const { embed, rows, options } = await buildPanelComponents(existingConfig, guildId);
      const panelMessage = await infoChannel.send({ embeds: [embed], components: rows });

      await ticketManager.updateConfig(guildId, {
        support_category_id: supportCategory.id,
        panel_channel_id: infoChannel.id,
        panel_message_id: panelMessage.id,
      });

      const notes = [
        '✅ Ticket system ready!',
        '',
        `• Support category: ${supportCategory}`,
        `• Panel channel: ${infoChannel}`,
        `• Button label: ${options.buttonLabel}`,
      ];

      if (categoryCreated) {
        notes.push('• Created a new support category for you.');
      }
      if (channelCreated) {
        notes.push('• Created a new channel for the ticket panel.');
      }

      return interaction.editReply({
        content: notes.join('\n'),
      });
    } catch (error) {
      console.error('Error setting up ticket system:', error);
      return interaction.editReply({
        content: `❌ Failed to configure ticket system: ${error.message}`,
      });
    }
  }

  async function handleTicketStatsCommand(interaction) {
    await ensureDeferred(interaction);

    try {
      const ticketChannels = interaction.guild.channels.cache.filter(
        (c) => c.name.startsWith('ticket-') && !c.name.startsWith('closed-'),
      );

      const closedTickets = interaction.guild.channels.cache.filter((c) => c.name.startsWith('closed-ticket-'));

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Ticket Statistics')
        .addFields(
          { name: '🟢 Open tickets', value: ticketChannels.size.toString(), inline: true },
          { name: '🔴 Closed tickets', value: closedTickets.size.toString(), inline: true },
          { name: '📈 Total channels', value: (ticketChannels.size + closedTickets.size).toString(), inline: true },
          { name: '⚡ Avg. response time', value: '< 2 hours', inline: true },
          { name: '😊 Satisfaction (manual)', value: '98%', inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error getting ticket stats:', error);
      return interaction.editReply({
        content: '❌ Failed to fetch ticket statistics.',
      });
    }
  }

  async function handleTicketPanelCommand(interaction) {
    const hasFeature = await ensureFeature(interaction);
    if (!hasFeature) return;

    const channel = interaction.options.getChannel('kanaal') || interaction.channel;
    if (!channel?.isTextBased?.()) {
      return interaction.reply({
        content: '❌ Please choose a text-based channel for the ticket panel.',
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const config = (await ticketManager.getConfig(guildId)) || {};
    const { embed, rows, options } = await buildPanelComponents(config, guildId);

    try {
      const message = await channel.send({ embeds: [embed], components: rows });

      await ticketManager.updateConfig(guildId, {
        panel_channel_id: channel.id,
        panel_message_id: message.id,
      });

      return interaction.reply({
        content: `✅ Ticket panel posted in ${channel} with button "${options.buttonLabel}".`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('Error posting ticket panel:', error);
      return interaction.reply({
        content: `❌ Failed to post the ticket panel: ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleTicketCreateModal(interaction) {
    const hasFeature = await featureGate.checkFeature(interaction.guild.id, supportFeatureKey);
    if (!hasFeature) {
      const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      return;
    }

    await ensureDeferred(interaction);

    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_description') || '';

    // Extract category ID from customId if present (format: ticket_create_modal_CATEGORYID)
    let categoryId = null;
    if (interaction.customId.startsWith('ticket_create_modal_')) {
      categoryId = interaction.customId.replace('ticket_create_modal_', '');
    }

    const result = await ticketManager.createTicket(interaction.guild, interaction.user, subject, description, categoryId);

    if (result.success) {
      return interaction.editReply({
        content: `✅ Ticket **${result.ticketNumber}** created! Jump into <#${result.channelId}> to continue.`,
      });
    }
    return interaction.editReply({
      content: `❌ Failed to create ticket: ${result.error}`,
    });
  }

  async function handleCreateTicketButton(interaction) {
    const hasFeature = await ensureFeature(interaction);
    if (!hasFeature) return;

    // Extract category ID from customId if present (format: create_ticket_CATEGORYID)
    let categoryId = null;
    let categoryName = 'Support Ticket';
    
    if (interaction.customId.startsWith('create_ticket_') && interaction.customId !== 'create_ticket') {
      categoryId = interaction.customId.replace('create_ticket_', '');
      
      // Fetch category details
      const category = await ticketManager.getCategoryById(interaction.guild.id, categoryId);
      if (category) {
        categoryName = category.name;
        // If this ticket type is restricted to certain roles (e.g. Premium), check the member has one
        const requiredRoleIds = Array.isArray(category.required_role_ids) && category.required_role_ids.length > 0
          ? category.required_role_ids
          : [];
        if (requiredRoleIds.length > 0) {
          const member = interaction.member;
          const hasRole = member && member.roles && member.roles.cache && requiredRoleIds.some((roleId) => member.roles.cache.has(roleId));
          if (!hasRole) {
            const roleNames = requiredRoleIds
              .map((id) => interaction.guild.roles.cache.get(id)?.name || id)
              .filter(Boolean);
            return interaction.reply({
              content: `❌ Only members with ${roleNames.length ? roleNames.join(' or ') : 'a required role'} can open **${category.name}** tickets.`,
              ephemeral: true
            });
          }
        }
      }
    }

    // Get templates for this category
    const templates = await ticketManager.getTemplates(interaction.guild.id, categoryId);
    
    // If templates exist, show template selection first
    if (templates.length > 0) {
      // Create a select menu for templates
      const templateSelect = new StringSelectMenuBuilder()
        .setCustomId(`ticket_template_select_${categoryId || 'none'}`)
        .setPlaceholder('Select a template (optional)')
        .addOptions([
          {
            label: 'Create from scratch',
            value: 'none',
            emoji: '📝'
          },
          ...templates.slice(0, 24).map(t => ({
            label: t.name,
            value: t.id,
            description: t.description || t.subject?.substring(0, 50) || '',
            emoji: '📋'
          }))
        ]);

      const selectRow = new ActionRowBuilder().addComponents(templateSelect);

      await interaction.reply({
        content: `📋 **${categoryName}**\n\nSelect a template to pre-fill your ticket, or create from scratch:`,
        components: [selectRow],
        ephemeral: true
      });
      return;
    }

    const modalId = categoryId ? `ticket_create_modal_${categoryId}` : 'ticket_create_modal';
    const modal = new ModalBuilder().setCustomId(modalId).setTitle(`🎫 New ${categoryName}`);

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Subject')
      .setPlaceholder('What do you need help with?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('ticket_description')
      .setLabel('Description (optional)')
      .setPlaceholder('Share more details about your request...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(descriptionInput));

    await interaction.showModal(modal);
  }

  async function handleTemplateSelect(interaction) {
    const hasFeature = await ensureFeature(interaction);
    if (!hasFeature) return;

    await interaction.deferUpdate();

    // Extract category ID from customId (format: ticket_template_select_CATEGORYID or ticket_template_select_none)
    const customIdParts = interaction.customId.replace('ticket_template_select_', '').split('_');
    const categoryId = customIdParts[0] === 'none' ? null : customIdParts[0];
    const templateId = interaction.values[0];

    let categoryName = 'Support Ticket';
    if (categoryId) {
      const category = await ticketManager.getCategoryById(interaction.guild.id, categoryId);
      if (category) {
        categoryName = category.name;
      }
    }

    // If "none" was selected, show modal without template
    if (templateId === 'none') {
      const modalId = categoryId ? `ticket_create_modal_${categoryId}` : 'ticket_create_modal';
      const modal = new ModalBuilder().setCustomId(modalId).setTitle(`🎫 New ${categoryName}`);

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Subject')
        .setPlaceholder('What do you need help with?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel('Description (optional)')
        .setPlaceholder('Share more details about your request...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descriptionInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // Get template data
    const template = await ticketManager.getTemplateById(templateId);
    if (!template) {
      return interaction.followUp({
        content: '❌ Template not found. Please try again.',
        ephemeral: true
      });
    }

    // Process template variables (if any)
    const processedTemplate = ticketManager.processTemplateVariables(template, {
      user: interaction.user.tag,
      guild: interaction.guild.name
    });

    // Show modal with pre-filled template data
    const modalId = categoryId ? `ticket_create_modal_${categoryId}` : 'ticket_create_modal';
    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle(`🎫 New ${categoryName} (${template.name})`);

    const subjectInput = new TextInputBuilder()
      .setCustomId('ticket_subject')
      .setLabel('Subject')
      .setPlaceholder('What do you need help with?')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(processedTemplate.subject || '');

    const descriptionInput = new TextInputBuilder()
      .setCustomId('ticket_description')
      .setLabel('Description')
      .setPlaceholder('Share more details about your request...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000)
      .setValue(processedTemplate.description_text || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(subjectInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );

    await interaction.showModal(modal);
  }

  async function handleCloseTicketButton(interaction) {
    const hasFeature = await featureGate.checkFeature(interaction.guild.id, supportFeatureKey);
    if (!hasFeature) {
      const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      const channel = interaction.channel;
      const topic = channel.topic || '';
      const userIdMatch = topic.match(/\((\d{17,})\)/);
      const ticketOwnerId = userIdMatch ? userIdMatch[1] : null;

      if (ticketOwnerId !== interaction.user.id) {
        return interaction.reply({
          content: '❌ Only the ticket owner or moderators can close this ticket.',
          ephemeral: true,
        });
      }
    }

    await ensureDeferred(interaction);

    const reason = 'Closed via quick action';
    const success = await ticketManager.closeTicket(interaction.channel, interaction.user, reason);

    if (success) {
      await interaction.editReply({
        content: '✅ Closing ticket...',
      }).catch(() => {});
    } else {
      await interaction.editReply({
        content: '❌ Failed to close ticket.',
      }).catch(() => {});
    }
  }

  async function handleClaimTicketButton(interaction) {
    const hasFeature = await featureGate.checkFeature(interaction.guild.id, supportFeatureKey);
    if (!hasFeature) {
      const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      return;
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ Only moderators can claim tickets.',
        ephemeral: true,
      });
    }

    const success = await ticketManager.claimTicket(interaction.channel, interaction.member);

    if (success) {
      const message = interaction.message;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket_claimed').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId('claim_ticket_claimed')
          .setLabel('Claimed')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('✅')
          .setDisabled(true),
      );

      await message.edit({ components: [row] });

      await interaction.reply({
        content: '✅ Ticket claimed!',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to claim the ticket.',
        ephemeral: true,
      });
    }
  }

  async function handleConfirmCloseButton(interaction) {
    const hasFeature = await featureGate.checkFeature(interaction.guild.id, supportFeatureKey);
    if (!hasFeature) {
      const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      return;
    }

    const success = await ticketManager.closeTicket(interaction.channel, interaction.user, 'User requested close');

    if (success) {
      await interaction.update({
        content: '✅ Closing ticket...',
        components: [],
      });
    } else {
      await interaction.update({
        content: '❌ Failed to close ticket.',
        components: [],
      });
    }
  }

  async function handleCancelCloseButton(interaction) {
    const hasFeature = await featureGate.checkFeature(interaction.guild.id, supportFeatureKey);
    if (!hasFeature) {
      const embed = featureGate.createUpgradeEmbed('Support Tickets', 'Basic');
      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
      return;
    }

    await interaction.update({
      content: '❌ Close cancelled. The ticket remains open.',
      components: [],
    });
  }

  /**
   * Handle ticket claim button (new simplified version)
   */
  async function handleTicketClaimButton(interaction) {
    if (!await ensureFeature(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const result = await ticketManager.claimTicket(interaction.channel, interaction.user);

    if (result.success) {
      // Update the button to show unclaim option
      const unclaimButton = new ButtonBuilder()
        .setCustomId('ticket_unclaim')
        .setLabel('Unclaim Ticket')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary);

      const closeButton = new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger);

      const archiveButton = new ButtonBuilder()
        .setCustomId('ticket_archive')
        .setLabel('Archive')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary);

      const deleteButton = new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(unclaimButton, closeButton, archiveButton, deleteButton);

      // Update the original message with new buttons
      await interaction.message.edit({ components: [actionRow] });

      await interaction.editReply({
        content: '✅ You have successfully claimed this ticket!',
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
  }

  /**
   * Handle ticket unclaim button
   */
  async function handleTicketUnclaimButton(interaction) {
    if (!await ensureFeature(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const result = await ticketManager.unclaimTicket(interaction.channel, interaction.user);

    if (result.success) {
      // Update the button back to claim option
      const claimButton = new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('Claim Ticket')
        .setEmoji('✋')
        .setStyle(ButtonStyle.Success);

      const closeButton = new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger);

      const archiveButton = new ButtonBuilder()
        .setCustomId('ticket_archive')
        .setLabel('Archive')
        .setEmoji('📦')
        .setStyle(ButtonStyle.Secondary);

      const deleteButton = new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(claimButton, closeButton, archiveButton, deleteButton);

      // Update the original message with new buttons
      await interaction.message.edit({ components: [actionRow] });

      await interaction.editReply({
        content: '✅ You have successfully unclaimed this ticket!',
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
  }

  /**
   * Handle ticket close button (new simplified version)
   */
  async function handleTicketCloseButton(interaction) {
    if (!await ensureFeature(interaction)) return;

    // Show modal for close reason
    const modal = new ModalBuilder()
      .setCustomId('ticket_close_modal')
      .setTitle('Close Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('close_reason')
      .setLabel('Reason for closing')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Enter the reason for closing this ticket...')
      .setRequired(false)
      .setMaxLength(500);

    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  function isTicketButton(customId) {
    return (
      customId === 'close_ticket_' ||
      customId === 'claim_ticket_' ||
      customId === 'create_ticket' ||
      customId === 'confirm_close_' ||
      customId === 'cancel_close_' ||
      customId === 'ticket_claim' ||
      customId === 'ticket_unclaim' ||
      customId === 'ticket_close' ||
      customId === 'ticket_archive' ||
      customId === 'ticket_unarchive' ||
      customId === 'ticket_delete' ||
      customId.startsWith('close_ticket') ||
      customId.startsWith('claim_ticket') ||
      customId.startsWith('create_ticket_') || // Support category-specific buttons
      customId.startsWith('ticket_rate_') // Rating buttons
    );
  }

  function isTicketModal(customId) {
    return customId === 'ticket_create_modal' || customId.startsWith('ticket_create_modal_') || customId === 'ticket_close_modal' || customId === 'ticket_delete_modal';
  }

  /**
   * Handle ticket close modal submission
   */
  async function handleTicketCloseModal(interaction) {
    if (!await ensureFeature(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const reason = interaction.fields.getTextInputValue('close_reason') || 'No reason provided';

    const success = await ticketManager.closeTicket(
      interaction.channel,
      interaction.user,
      reason
    );

    if (success) {
      await interaction.editReply({
        content: '✅ Ticket closed successfully! This channel will be deleted shortly.',
      });
    } else {
      await interaction.editReply({
        content: '❌ Failed to close ticket. Please try again.',
      });
    }
  }

  /**
   * Handle ticket delete modal submission
   */
  async function handleTicketDeleteModal(interaction) {
    if (!await ensureFeature(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply({
        content: '❌ Only moderators can delete tickets.',
      });
    }

    const confirm = interaction.fields.getTextInputValue('delete_confirm');
    if (confirm !== 'DELETE') {
      return interaction.editReply({
        content: '❌ Confirmation text did not match. Deletion cancelled.',
      });
    }

    const result = await ticketManager.deleteTicket(interaction.channel, interaction.user);

    if (result.success) {
      // Remove all buttons from the message
      await interaction.message.edit({ components: [] }).catch(() => {});

      await interaction.editReply({
        content: '✅ Ticket has been deleted! This channel will be deleted shortly.',
      });

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket deleted via Discord');
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, 5000);
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
  }

  /**
   * Handle ticket archive button
   */
  async function handleTicketArchiveButton(interaction) {
    if (!await ensureFeature(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply({
        content: '❌ Only moderators can archive tickets.',
      });
    }

    const result = await ticketManager.archiveTicket(interaction.channel, interaction.user);

    if (result.success) {
      // Update buttons to show unarchive option
      const unarchiveButton = new ButtonBuilder()
        .setCustomId('ticket_unarchive')
        .setLabel('Unarchive')
        .setEmoji('📂')
        .setStyle(ButtonStyle.Secondary);

      const deleteButton = new ButtonBuilder()
        .setCustomId('ticket_delete')
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(unarchiveButton, deleteButton);

      // Update the original message with new buttons
      await interaction.message.edit({ components: [actionRow] }).catch(() => {});

      await interaction.editReply({
        content: '✅ Ticket has been archived!',
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
  }

  /**
   * Handle ticket unarchive button
   */
  async function handleTicketUnarchiveButton(interaction) {
    if (!await ensureFeature(interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.editReply({
        content: '❌ Only moderators can unarchive tickets.',
      });
    }

    const result = await ticketManager.unarchiveTicket(interaction.channel, interaction.user);

    if (result.success) {
      // Get ticket to determine which buttons to show
      const ticket = await ticketManager.getTicketByChannel(interaction.channel.id);
      
      let actionRow;
      if (ticket?.claimed_by) {
        // Ticket is claimed, show unclaim button
        const unclaimButton = new ButtonBuilder()
          .setCustomId('ticket_unclaim')
          .setLabel('Unclaim Ticket')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary);

        const closeButton = new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger);

        const archiveButton = new ButtonBuilder()
          .setCustomId('ticket_archive')
          .setLabel('Archive')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Secondary);

        const deleteButton = new ButtonBuilder()
          .setCustomId('ticket_delete')
          .setLabel('Delete')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger);

        actionRow = new ActionRowBuilder().addComponents(unclaimButton, closeButton, archiveButton, deleteButton);
      } else {
        // Ticket is open, show claim button
        const claimButton = new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Claim Ticket')
          .setEmoji('✋')
          .setStyle(ButtonStyle.Success);

        const closeButton = new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger);

        const archiveButton = new ButtonBuilder()
          .setCustomId('ticket_archive')
          .setLabel('Archive')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Secondary);

        const deleteButton = new ButtonBuilder()
          .setCustomId('ticket_delete')
          .setLabel('Delete')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger);

        actionRow = new ActionRowBuilder().addComponents(claimButton, closeButton, archiveButton, deleteButton);
      }

      // Update the original message with new buttons
      await interaction.message.edit({ components: [actionRow] }).catch(() => {});

      await interaction.editReply({
        content: '✅ Ticket has been unarchived!',
      });
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
  }

  /**
   * Handle ticket delete button
   */
  async function handleTicketDeleteButton(interaction) {
    if (!await ensureFeature(interaction)) return;

    // Show confirmation modal
    const modal = new ModalBuilder()
      .setCustomId('ticket_delete_modal')
      .setTitle('Delete Ticket');

    const confirmInput = new TextInputBuilder()
      .setCustomId('delete_confirm')
      .setLabel('Type "DELETE" to confirm')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('DELETE')
      .setRequired(true)
      .setMaxLength(10);

    const row = new ActionRowBuilder().addComponents(confirmInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  /**
   * Handle ticket rating button
   */
  async function handleTicketRatingButton(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Parse ticket ID and rating from custom ID (format: ticket_rate_{ticketId}_{rating})
    const match = interaction.customId.match(/ticket_rate_([^_]+)_(\d)/);
    if (!match) {
      return interaction.editReply({
        content: '❌ Invalid rating button.',
      });
    }

    const [, ticketId, ratingStr] = match;
    const rating = parseInt(ratingStr, 10);

    if (rating < 1 || rating > 5) {
      return interaction.editReply({
        content: '❌ Invalid rating value.',
      });
    }

    // Submit rating
    const result = await ticketManager.submitRating(ticketId, interaction.user.id, rating);

    if (result.success) {
      // Update the message to show rating was submitted
      const thankYouEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ Thank You!')
        .setDescription(`You rated this ticket **${rating} ⭐**.\n\nYour feedback helps us improve our service!\n\n*This ticket will now be closed.*`)
        .setTimestamp();

      // Remove buttons from original message
      await interaction.message.edit({
        embeds: [thankYouEmbed],
        components: []
      }).catch(() => {});

      await interaction.editReply({
        content: '✅ Thank you for your feedback! The ticket will now be closed.',
      });

      // Finalize the ticket channel (close and archive)
      const channel = interaction.channel;
      const config = await ticketManager.getConfig(channel.guild.id);
      await ticketManager.finalizeTicketChannel(channel, config);
    } else {
      await interaction.editReply({
        content: `❌ ${result.error}`,
      });
    }
  }

  async function handleTicketButton(interaction) {
    switch (true) {
      case interaction.customId === 'create_ticket':
      case interaction.customId.startsWith('create_ticket_'): // Category-specific buttons
        return handleCreateTicketButton(interaction);
      case interaction.customId === 'ticket_claim':
        return handleTicketClaimButton(interaction);
      case interaction.customId === 'ticket_unclaim':
        return handleTicketUnclaimButton(interaction);
      case interaction.customId === 'ticket_close':
        return handleTicketCloseButton(interaction);
      case interaction.customId === 'ticket_archive':
        return handleTicketArchiveButton(interaction);
      case interaction.customId === 'ticket_unarchive':
        return handleTicketUnarchiveButton(interaction);
      case interaction.customId === 'ticket_delete':
        return handleTicketDeleteButton(interaction);
      case interaction.customId.startsWith('ticket_rate_'): // Rating buttons
        return handleTicketRatingButton(interaction);
      case interaction.customId === 'close_ticket_':
      case interaction.customId.startsWith('close_ticket'):
        return handleCloseTicketButton(interaction);
      case interaction.customId === 'claim_ticket_':
      case interaction.customId.startsWith('claim_ticket'):
        return handleClaimTicketButton(interaction);
      case interaction.customId === 'confirm_close_':
        return handleConfirmCloseButton(interaction);
      case interaction.customId === 'cancel_close_':
        return handleCancelCloseButton(interaction);
      default:
        return null;
    }
  }

  async function handleTicketModal(interaction) {
    if (interaction.customId === 'ticket_create_modal' || interaction.customId.startsWith('ticket_create_modal_')) {
      return handleTicketCreateModal(interaction);
    }
    if (interaction.customId === 'ticket_close_modal') {
      return handleTicketCloseModal(interaction);
    }
    if (interaction.customId === 'ticket_delete_modal') {
      return handleTicketDeleteModal(interaction);
    }
    return null;
  }

  function isTicketSelectMenu(customId) {
    return customId.startsWith('ticket_template_select_');
  }

  return {
    handleTicketCommand,
    handleTicketSetupCommand,
    handleTicketStatsCommand,
    handleTicketPanelCommand,
    handleTicketButton,
    handleTicketModal,
    handleTemplateSelect,
    isTicketButton,
    isTicketModal,
    isTicketSelectMenu,
  };
}

module.exports = createTicketHandlers;

