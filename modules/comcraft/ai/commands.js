/**
 * AI Model Management Commands
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function getAiModelCommands() {
  return [
    new SlashCommandBuilder()
      .setName('aimodel')
      .setDescription('🤖 Change the AI model used by this server')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set')
          .setDescription('Set the AI provider and model')
          .addStringOption((option) =>
            option
              .setName('provider')
              .setDescription('AI provider to use')
              .setRequired(true)
              .addChoices(
                { name: 'Gemini', value: 'gemini' },
                { name: 'Claude', value: 'claude' },
                { name: 'DeepSeek Chat', value: 'deepseek' }
              )
          )
          .addStringOption((option) =>
            option
              .setName('model')
              .setDescription('Specific model to use (optional, uses provider default if not specified)')
              .setRequired(false)
              .addChoices(
                // Gemini models
                { name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
                // Claude models
                { name: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-latest' },
                // DeepSeek models
                { name: 'DeepSeek Chat (V3.2)', value: 'deepseek-chat' },
                { name: 'DeepSeek Reasoner (V3.2)', value: 'deepseek-reasoner' }
              )
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('view')
          .setDescription('View the current AI model settings')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('reset')
          .setDescription('Reset to default AI model (uses provider default)')
      ),
  ];
}

async function handleAiModelCommand(interaction, aiStore) {
  if (!interaction.guild) {
    return interaction.reply({
      content: '❌ This command can only be used in a server.',
      ephemeral: true,
    });
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({
      content: '❌ You need the "Manage Server" permission to use this command.',
      ephemeral: true,
    });
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  try {
    if (subcommand === 'set') {
      const provider = interaction.options.getString('provider');
      const model = interaction.options.getString('model');

      // Update AI settings
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { error } = await supabase
        .from('ai_settings')
        .upsert(
          {
            guild_id: guildId,
            default_provider: provider,
            ai_model: model || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'guild_id' }
        );

      if (error) {
        console.error('[AI Model] Error updating settings:', error);
        return interaction.reply({
          content: '❌ Failed to update AI model settings. Please try again later.',
          ephemeral: true,
        });
      }

      // Clear cache
      if (aiStore && typeof aiStore.clearCache === 'function') {
        aiStore.clearCache(guildId);
      }

      const modelText = model ? ` (${model})` : '';
      return interaction.reply({
        content: `✅ AI model updated to **${provider}**${modelText}`,
        ephemeral: true,
      });
    }

    if (subcommand === 'view') {
      const settings = await aiStore.getSettings(guildId);
      const provider = settings?.default_provider || 'claude';
      const model = settings?.ai_model || 'default';

      const embed = {
        title: '🤖 Current AI Model Settings',
        fields: [
          {
            name: 'Provider',
            value: provider.charAt(0).toUpperCase() + provider.slice(1),
            inline: true,
          },
          {
            name: 'Model',
            value: model === 'default' ? 'Provider default' : model,
            inline: true,
          },
        ],
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
      };

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (subcommand === 'reset') {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { error } = await supabase
        .from('ai_settings')
        .upsert(
          {
            guild_id: guildId,
            ai_model: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'guild_id' }
        );

      if (error) {
        console.error('[AI Model] Error resetting model:', error);
        return interaction.reply({
          content: '❌ Failed to reset AI model. Please try again later.',
          ephemeral: true,
        });
      }

      // Clear cache
      if (aiStore && typeof aiStore.clearCache === 'function') {
        aiStore.clearCache(guildId);
      }

      return interaction.reply({
        content: '✅ AI model reset to provider default.',
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('[AI Model] Error handling command:', error);
    return interaction.reply({
      content: '❌ An error occurred while processing your request.',
      ephemeral: true,
    });
  }
}

module.exports = {
  getAiModelCommands,
  handleAiModelCommand,
};

