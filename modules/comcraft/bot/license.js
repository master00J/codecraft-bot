function createLicenseHelpers(configManager, featureGate) {
  async function isGuildLicensed(guildId) {
    if (!guildId) return true;
    if (typeof configManager.isSubscriptionActive !== 'function') {
      return true;
    }

    try {
      const active = await configManager.isSubscriptionActive(guildId);
      if (!active) {
        console.warn(`[License] Guild ${guildId} is not licensed.`);
      }
      return active;
    } catch (error) {
      console.error(`Error checking license for guild ${guildId}:`, error);
      return true;
    }
  }

  async function respondLicenseDisabled(interaction) {
    try {
      const embed = featureGate.createLicenseDisabledEmbed();
      if ('deferred' in interaction && (interaction.deferred || interaction.replied)) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else if (typeof interaction.reply === 'function') {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (error) {
      console.error('Failed to send license disabled response:', error);
    }
  }

  async function ensureInteractionLicense(interaction, options = {}) {
    if (!interaction.guildId) return true;

    if (interaction.isAutocomplete()) {
      return await isGuildLicensed(interaction.guildId);
    }

    const allowedCommands = options.allowedCommands || [];

    if (interaction.isChatInputCommand() && allowedCommands.includes(interaction.commandName)) {
      console.log(
        `[License] Allowing whitelisted command "${interaction.commandName}" for guild ${interaction.guildId}.`,
      );
      return true;
    }

    const licensed = await isGuildLicensed(interaction.guildId);
    if (licensed) {
      console.log(`[License] Interaction allowed for guild ${interaction.guildId}.`);
      return true;
    }

    console.warn(`[License] Interaction blocked for guild ${interaction.guildId}. Type: ${interaction.type}`);
    await respondLicenseDisabled(interaction);
    return false;
  }

  async function ensureMessageLicense(message) {
    if (!message.guildId) return true;
    const licensed = await isGuildLicensed(message.guildId);
    if (!licensed) {
      console.warn(`[License] Message blocked in guild ${message.guildId} from ${message.author.tag}.`);
    }
    return licensed;
  }

  async function ensureGuildLicense(guildId) {
    const licensed = await isGuildLicensed(guildId);
    if (!licensed) {
      console.warn(`[License] Guild-level event blocked for guild ${guildId}.`);
    }
    return licensed;
  }

  return {
    isGuildLicensed,
    respondLicenseDisabled,
    ensureInteractionLicense,
    ensureMessageLicense,
    ensureGuildLicense,
  };
}

module.exports = createLicenseHelpers;

