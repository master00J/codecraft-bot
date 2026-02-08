/**
 * Verify and appeal command handlers.
 * Shared by index.js (main bot) and setup-bot-handlers.js (custom bots).
 */

const {
  PermissionFlagsBits,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

async function handleAppealCommand(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ Appeals can only be submitted inside a server.',
      ephemeral: true
    });
  }

  const caseId = interaction.options.getInteger('case');

  const caseInput = new TextInputBuilder()
    .setCustomId('appeal_case_id')
    .setLabel('Case ID (optional)')
    .setPlaceholder('e.g. 123')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  if (caseId) {
    caseInput.setValue(String(caseId));
  }

  const reasonInput = new TextInputBuilder()
    .setCustomId('appeal_reason')
    .setLabel('Why should this case be reviewed?')
    .setPlaceholder('Explain what happened and why you are appealing.')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId('appeal_submit_modal')
    .setTitle('Submit an Appeal')
    .addComponents(
      new ActionRowBuilder().addComponents(caseInput),
      new ActionRowBuilder().addComponents(reasonInput)
    );

  try {
    await interaction.showModal(modal);
  } catch (error) {
    console.error('Error showing appeal modal:', error);
    if (!interaction.replied && !interaction.deferred && interaction.isRepliable()) {
      await interaction.reply({
        content: '❌ Unable to open the appeal form right now.',
        ephemeral: true
      }).catch(() => {});
    }
  }
}

async function handleVerifyCommand(interaction, configManager, gameVerificationManager) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
  }
  const config = await configManager.getGameVerificationConfig(interaction.guild.id);
  if (!config || !config.enabled) {
    return interaction.reply({
      content: '❌ In-game verification is not enabled in this server.',
      ephemeral: true
    });
  }
  const username = interaction.options.getString('username').trim().slice(0, 32);
  if (!username) {
    return interaction.reply({
      content: '❌ Please provide a valid in-game username.',
      ephemeral: true
    });
  }
  if (config.one_time_only) {
    const existing = await gameVerificationManager.getVerifiedUser(interaction.guild.id, interaction.user.id);
    if (existing) {
      return interaction.reply({
        content: `❌ You are already verified as **${existing.in_game_username}**. Only an admin can update your in-game name.`,
        ephemeral: true
      });
    }
  }
  const member = interaction.member;
  if (!member) {
    return interaction.reply({
      content: '❌ Could not find your member data.',
      ephemeral: true
    });
  }
  const me = interaction.guild.members.me;
  if (!me) {
    return interaction.reply({
      content: '❌ Bot member not found.',
      ephemeral: true
    });
  }
  const unregId = config.unregistered_role_id;
  const verifiedId = config.verified_role_id;
  if (!verifiedId) {
    return interaction.reply({
      content: '❌ Verified role is not configured. Ask an admin to set it in the dashboard.',
      ephemeral: true
    });
  }
  try {
    if (unregId && member.roles.cache.has(unregId)) {
      await member.roles.remove(unregId, `${config.game_name} verification`);
    }
    await member.roles.add(verifiedId, `${config.game_name} verification`);
    if (me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await member.setNickname(username, `${config.game_name} verification`).catch(() => {});
    }
    const record = await gameVerificationManager.recordVerification(
      interaction.guild.id,
      interaction.user.id,
      username
    );
    if (!record.success) {
      console.error('[Verify] DB record error:', record.error);
    }
    const gameName = config.game_name || 'In-Game';
    return interaction.reply({
      content: `✅ You are now verified as **${username}** for ${gameName}. Your nickname has been updated.`,
      ephemeral: true
    });
  } catch (err) {
    console.error('[Verify] Error:', err);
    return interaction.reply({
      content: `❌ Verification failed: ${err.message || 'Unknown error'}. Make sure the bot has permission to manage roles and nicknames.`,
      ephemeral: true
    });
  }
}

async function handleVerifySetCommand(interaction, configManager, gameVerificationManager) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true
    });
  }
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) &&
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ You need the "Manage Nicknames" permission to use this command.',
      ephemeral: true
    });
  }
  const config = await configManager.getGameVerificationConfig(interaction.guild.id);
  if (!config || !config.enabled) {
    return interaction.reply({
      content: '❌ In-game verification is not enabled in this server.',
      ephemeral: true
    });
  }
  const targetUser = interaction.options.getUser('user');
  const username = interaction.options.getString('username').trim().slice(0, 32);
  if (!username) {
    return interaction.reply({
      content: '❌ Please provide a valid in-game username.',
      ephemeral: true
    });
  }
  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    return interaction.reply({
      content: '❌ User not found in this server.',
      ephemeral: true
    });
  }
  const me = interaction.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    return interaction.reply({
      content: '❌ I do not have permission to change nicknames.',
      ephemeral: true
    });
  }
  try {
    await member.setNickname(username, `In-game username update by ${interaction.user.tag}`);
    const record = await gameVerificationManager.recordVerification(
      interaction.guild.id,
      targetUser.id,
      username
    );
    if (!record.success) {
      console.error('[VerifySet] DB error:', record.error);
    }
    configManager.clearGameVerificationCache(interaction.guild.id);
    return interaction.reply({
      content: `✅ Updated **${targetUser.tag}**'s in-game username to **${username}**.`,
      ephemeral: true
    });
  } catch (err) {
    console.error('[VerifySet] Error:', err);
    return interaction.reply({
      content: `❌ Update failed: ${err.message || 'Unknown error'}.`,
      ephemeral: true
    });
  }
}

module.exports = { handleAppealCommand, handleVerifyCommand, handleVerifySetCommand };
