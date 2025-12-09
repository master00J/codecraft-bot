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
      .addSubcommand((subcommand) =>
        subcommand
          .setName('view')
          .setDescription('View a user\'s profile')
          .addUserOption((option) =>
            option
              .setName('user')
              .setDescription('User to view profile for (default: yourself)')
              .setRequired(false)
          )
          .addStringOption((option) =>
            option
              .setName('form_id')
              .setDescription('Specific form ID (optional - shows latest if not specified)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('browse')
          .setDescription('Browse all submitted profiles for a form')
          .addStringOption((option) =>
            option
              .setName('form_id')
              .setDescription('Form ID (use /profile list to see form IDs)')
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
      case 'view':
        await handleProfileView(interaction, profileManager);
        break;
      case 'browse':
        await handleProfileBrowse(interaction, profileManager);
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

async function handleProfileView(interaction, profileManager) {
  await interaction.deferReply({ ephemeral: false }); // Public so others can see profiles

  try {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const formId = interaction.options.getString('form_id');

    // If form ID is specified, show that specific form
    if (formId) {
      const form = await profileManager.getForm(formId);
      if (!form) {
        await interaction.editReply({ content: '❌ Form not found!' });
        return;
      }

      if (form.guild_id !== interaction.guildId) {
        await interaction.editReply({ content: '❌ That form belongs to a different server!' });
        return;
      }

      const profile = await profileManager.getUserProfile(formId, targetUser.id);
      if (!profile) {
        await interaction.editReply({
          content: `❌ ${targetUser.id === interaction.user.id ? 'You haven\'t' : `${targetUser.displayName} hasn't`} submitted a profile for "${form.form_name}" yet!`
        });
        return;
      }

      // Get user member object for embed
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      const userObj = member || targetUser;

      const embed = await profileManager.buildProfileEmbed(form, profile, userObj);
      embed.setTitle(`📋 ${form.form_name} - ${userObj.displayName || userObj.username}'s Profile`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // No form ID specified - show latest profile from any form
    const forms = await profileManager.getForms(interaction.guildId);
    if (forms.length === 0) {
      await interaction.editReply({
        content: '❌ No profile forms found in this server!'
      });
      return;
    }

    // Find the most recent profile from any form
    let latestProfile = null;
    let latestForm = null;
    let latestDate = null;

    for (const form of forms) {
      const profile = await profileManager.getUserProfile(form.id, targetUser.id);
      if (profile && profile.completed_at) {
        const completedDate = new Date(profile.completed_at);
        if (!latestDate || completedDate > latestDate) {
          latestProfile = profile;
          latestForm = form;
          latestDate = completedDate;
        }
      }
    }

    if (!latestProfile) {
      await interaction.editReply({
        content: `❌ ${targetUser.id === interaction.user.id ? 'You haven\'t' : `${targetUser.displayName} hasn't`} submitted any profiles yet!`
      });
      return;
    }

    // Get user member object for embed
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const userObj = member || targetUser;

    const embed = await profileManager.buildProfileEmbed(latestForm, latestProfile, userObj);
    embed.setTitle(`📋 ${latestForm.form_name} - ${userObj.displayName || userObj.username}'s Profile`);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error viewing profile:', error);
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

async function handleProfileBrowse(interaction, profileManager) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const formId = interaction.options.getString('form_id');

    const form = await profileManager.getForm(formId);
    if (!form) {
      await interaction.editReply({ content: '❌ Form not found!' });
      return;
    }

    if (form.guild_id !== interaction.guildId) {
      await interaction.editReply({ content: '❌ That form belongs to a different server!' });
      return;
    }

    // Get all completed profiles for this form
    const profiles = await profileManager.getFormProfiles(formId, 25); // Max 25 for embed limits

    if (profiles.length === 0) {
      await interaction.editReply({
        content: `❌ No profiles have been submitted for "${form.form_name}" yet!`
      });
      return;
    }

    // Fetch user information for each profile
    const profileList = [];
    for (const profile of profiles.slice(0, 25)) {
      try {
        const member = await interaction.guild.members.fetch(profile.user_id).catch(() => null);
        const username = member?.displayName || member?.user?.username || `User ${profile.user_id}`;
        const threadLink = profile.thread_id && form.channel_id
          ? `[View Thread](https://discord.com/channels/${form.guild_id}/${form.channel_id}/${profile.thread_id})`
          : 'No thread';
        
        const completedDate = profile.completed_at 
          ? `<t:${Math.floor(new Date(profile.completed_at).getTime() / 1000)}:R>`
          : 'Unknown';

        profileList.push(`**${username}** • ${threadLink} • ${completedDate}`);
      } catch (error) {
        // Skip users we can't fetch
        continue;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 ${form.form_name} - All Profiles`)
      .setDescription(
        profileList.length > 0
          ? profileList.join('\n')
          : 'No profiles found'
      )
      .setColor(0x5865F2)
      .setFooter({ 
        text: `Showing ${profileList.length} of ${profiles.length} profile(s)${profiles.length > 25 ? ' (max 25 shown)' : ''}` 
      });

    if (form.channel_id && form.message_id) {
      embed.addFields({
        name: '🔗 Form Location',
        value: `[View Form](https://discord.com/channels/${form.guild_id}/${form.channel_id}/${form.message_id})`,
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error browsing profiles:', error);
    await interaction.editReply({
      content: `❌ ${error.message}`
    });
  }
}

module.exports = {
  createProfileCommands,
  handleProfileCommand
};

