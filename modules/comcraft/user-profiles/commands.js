const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

function createProfileCommands() {
  return [
    new SlashCommandBuilder()
      .setName('profile')
      .setDescription('📋 User Profile Builder - Create and manage profile forms')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('list')
          .setDescription('List all profile forms in this server')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('delete')
          .setDescription('Delete a profile form')
          .addStringOption((option) =>
            option
              .setName('form_id')
              .setDescription('Form ID to delete')
              .setRequired(true)
          )
      )
  ];
}

async function handleProfileCommand(interaction, profileManager) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'list':
        await handleProfileList(interaction, profileManager);
        break;
      case 'delete':
        await handleProfileDelete(interaction, profileManager);
        break;
      default:
        await interaction.reply({ content: 'Unknown subcommand', ephemeral: true });
    }
  } catch (error) {
    console.error('Error handling profile command:', error);
    await interaction.reply({
      content: `Error: ${error.message}`,
      ephemeral: true
    }).catch(() => {});
  }
}

async function handleProfileList(interaction, profileManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const forms = await profileManager.getForms(interaction.guildId);

    if (forms.length === 0) {
      await interaction.editReply({ 
        content: '❌ No profile forms found in this server!\n\n💡 Create forms via the dashboard: https://codecraft-solutions.com/comcraft/dashboard'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Profile Forms')
      .setDescription(
        forms.map(form => {
          const status = form.enabled ? '✅ Enabled' : '❌ Disabled';
          const questionsCount = Array.isArray(form.questions) ? form.questions.length : 0;
          return `**${form.form_name}**\n` +
                 `ID: \`${form.id}\`\n` +
                 `${status} • ${questionsCount} question(s)\n` +
                 (form.description ? `*${form.description}*\n` : '');
        }).join('\n\n')
      )
      .setColor(0x5865F2)
      .setFooter({ text: `Showing ${forms.length} form(s)` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleProfileDelete(interaction, profileManager) {
  await interaction.deferReply({ ephemeral: true });

  // Check permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({ 
      content: '❌ You need "Manage Server" permission to delete profile forms!' 
    });
    return;
  }

  const formId = interaction.options.getString('form_id');

  try {
    const form = await profileManager.getForm(formId);
    if (!form) {
      await interaction.editReply({ content: '❌ Form not found!' });
      return;
    }

    if (form.guild_id !== interaction.guildId) {
      await interaction.editReply({ content: '❌ That form belongs to a different server!' });
      return;
    }

    await profileManager.deleteForm(formId);

    await interaction.editReply({
      content: `✅ Profile form "${form.form_name}" deleted successfully!`
    });
  } catch (error) {
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

module.exports = {
  createProfileCommands,
  handleProfileCommand
};

