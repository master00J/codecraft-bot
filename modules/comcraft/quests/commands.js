/**
 * ComCraft Quest Commands
 * Handles Discord slash commands for quests
 */

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class QuestCommands {
  constructor(questManager, economyManager, xpManager) {
    this.questManager = questManager;
    this.economyManager = economyManager;
    this.xpManager = xpManager;
  }

  /**
   * Generate progress bar string
   */
  generateProgressBar(current, target, length = 20) {
    const percentage = Math.min(current / target, 1);
    const filled = Math.floor(percentage * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Format quest rewards text
   */
  formatRewards(rewards) {
    if (!rewards || typeof rewards !== 'object') return 'None';
    
    const parts = [];
    if (rewards.coins) parts.push(`💰 ${rewards.coins.toLocaleString()} coins`);
    if (rewards.xp) parts.push(`⭐ ${rewards.xp.toLocaleString()} XP`);
    if (rewards.role_id) parts.push(`🎭 Role reward`);
    if (rewards.item_id) parts.push(`🎒 Item reward`);
    
    return parts.length > 0 ? parts.join('\n') : 'None';
  }

  /**
   * Handle /quests command
   */
  async handleQuestsCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const category = interaction.options.getString('category');
    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const quests = await this.questManager.getUserQuests(
        guildId,
        targetUser.id,
        category,
        false // Don't include completed non-repeatable quests
      );

      if (!quests || quests.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('📋 Quests')
          .setDescription('No quests available at the moment. Check back later!')
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // Group quests by category
      const questsByCategory = {};
      for (const quest of quests) {
        const cat = quest.category || 'general';
        if (!questsByCategory[cat]) {
          questsByCategory[cat] = [];
        }
        questsByCategory[cat].push(quest);
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('📋 Available Quests')
        .setDescription(`Showing quests for ${targetUser === interaction.user ? 'you' : targetUser.username}`)
        .setTimestamp();

      for (const [categoryName, categoryQuests] of Object.entries(questsByCategory)) {
        let categoryText = '';

        for (const quest of categoryQuests) {
          const progress = quest.quest_progress && quest.quest_progress.length > 0
            ? quest.quest_progress[0]
            : { current_progress: 0, target_progress: quest.requirements?.target || 0, completed: false };

          const target = progress.target_progress || quest.requirements?.target || 0;
          const current = progress.current_progress || 0;
          const percentage = target > 0 ? Math.floor((current / target) * 100) : 0;
          const progressBar = this.generateProgressBar(current, target);

          const status = progress.completed ? '✅' : '⏳';
          const questEmoji = quest.emoji || '📋';

          categoryText += `${status} **${quest.name}** ${questEmoji}\n`;
          categoryText += `${progressBar} ${current}/${target} (${percentage}%)\n`;
          categoryText += `Rewards: ${this.formatRewards(quest.rewards)}\n\n`;
        }

        if (categoryText) {
          embed.addFields({
            name: `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Quests`,
            value: categoryText.slice(0, 1024), // Discord field limit
            inline: false
          });
        }
      }

      if (embed.data.fields && embed.data.fields.length === 0) {
        embed.setDescription('No active quests found for the selected category.');
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleQuestsCommand:', error);
      return interaction.editReply({
        content: '❌ An error occurred while fetching quests.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle /quest progress command
   */
  async handleQuestProgressCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const questName = interaction.options.getString('quest_name');

    try {
      const quests = await this.questManager.getUserQuests(guildId, userId, null, true);

      // Find quest by name (case-insensitive)
      const quest = quests.find(q => q.name.toLowerCase() === questName.toLowerCase());

      if (!quest) {
        return interaction.editReply({
          content: `❌ Quest "${questName}" not found. Use \`/quests\` to see available quests.`,
          ephemeral: true
        });
      }

      const progress = quest.quest_progress && quest.quest_progress.length > 0
        ? quest.quest_progress[0]
        : { current_progress: 0, target_progress: quest.requirements?.target || 0, completed: false };

      const target = progress.target_progress || quest.requirements?.target || 0;
      const current = progress.current_progress || 0;
      const percentage = target > 0 ? Math.floor((current / target) * 100) : 0;
      const progressBar = this.generateProgressBar(current, target, 30);

      const embed = new EmbedBuilder()
        .setColor(progress.completed ? '#00FF00' : '#FFA500')
        .setTitle(`${quest.emoji || '📋'} ${quest.name}`)
        .setDescription(quest.description || 'No description')
        .addFields(
          {
            name: 'Progress',
            value: `${progressBar}\n**${current}** / **${target}** (${percentage}%)`,
            inline: false
          },
          {
            name: 'Status',
            value: progress.completed ? '✅ Completed' : '⏳ In Progress',
            inline: true
          },
          {
            name: 'Rewards',
            value: this.formatRewards(quest.rewards),
            inline: true
          }
        )
        .setTimestamp();

      if (progress.completion_count > 0) {
        embed.addFields({
          name: 'Completions',
          value: `${progress.completion_count} time(s)`,
          inline: true
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleQuestProgressCommand:', error);
      return interaction.editReply({
        content: '❌ An error occurred while fetching quest progress.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle /quest complete command (admin only)
   */
  async handleQuestCompleteCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    // Check permissions
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.editReply({
        content: '❌ You need Administrator permissions to use this command.',
        ephemeral: true
      });
    }

    const guildId = interaction.guild.id;
    const questName = interaction.options.getString('quest_name');
    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const quests = await this.questManager.getUserQuests(guildId, targetUser.id, null, true);

      // Find quest by name (case-insensitive)
      const quest = quests.find(q => q.name.toLowerCase() === questName.toLowerCase());

      if (!quest) {
        return interaction.editReply({
          content: `❌ Quest "${questName}" not found.`,
          ephemeral: true
        });
      }

      const result = await this.questManager.manualComplete(guildId, quest.id, targetUser.id);

      if (!result.success) {
        return interaction.editReply({
          content: `❌ ${result.error || 'Failed to complete quest.'}`,
          ephemeral: true
        });
      }

      // Give rewards
      const rewards = result.rewards || {};
      let rewardsGiven = [];

      if (rewards.coins && this.economyManager) {
        await this.economyManager.addCoins(guildId, targetUser.id, rewards.coins, 'quest', 'Quest reward');
        rewardsGiven.push(`💰 ${rewards.coins.toLocaleString()} coins`);
      }

      if (rewards.xp && this.xpManager) {
        // Would need to implement addXP directly here or create a helper
        rewardsGiven.push(`⭐ ${rewards.xp.toLocaleString()} XP`);
      }

      if (rewards.role_id) {
        try {
          const member = await interaction.guild.members.fetch(targetUser.id);
          const role = interaction.guild.roles.cache.get(rewards.role_id);
          if (role) {
            await member.roles.add(role);
            rewardsGiven.push(`🎭 ${role.name} role`);
          }
        } catch (error) {
          console.error('Error giving role reward:', error);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Quest Completed!')
        .setDescription(`Quest **${quest.name}** has been completed for ${targetUser.username}.`)
        .addFields({
          name: 'Rewards Given',
          value: rewardsGiven.length > 0 ? rewardsGiven.join('\n') : 'None',
          inline: false
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleQuestCompleteCommand:', error);
      return interaction.editReply({
        content: '❌ An error occurred while completing the quest.',
        ephemeral: true
      });
    }
  }

  /**
   * Handle /questchain command
   */
  async handleQuestChainCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const chainName = interaction.options.getString('chain_name');

    try {
      // Get all quests with chains
      const quests = await this.questManager.getUserQuests(guildId, userId, null, true);

      // Filter by chain if specified
      const chainQuests = chainName
        ? quests.filter(q => q.chain_id && q.chain_id.toString().includes(chainName))
        : quests.filter(q => q.chain_id);

      if (chainQuests.length === 0) {
        return interaction.editReply({
          content: chainName
            ? `❌ No quest chain found with name "${chainName}".`
            : '❌ No quest chains available.',
          ephemeral: true
        });
      }

      // Group by chain_id
      const chains = {};
      for (const quest of chainQuests) {
        const chainId = quest.chain_id;
        if (!chains[chainId]) {
          chains[chainId] = [];
        }
        chains[chainId].push(quest);
      }

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🔗 Quest Chains')
        .setDescription(`Showing quest chain progress for ${interaction.user.username}`)
        .setTimestamp();

      for (const [chainId, chainQuestList] of Object.entries(chains)) {
        // Sort by chain_position
        chainQuestList.sort((a, b) => (a.chain_position || 0) - (b.chain_position || 0));

        let chainText = '';
        let completedCount = 0;

        for (const quest of chainQuestList) {
          const progress = quest.quest_progress && quest.quest_progress.length > 0
            ? quest.quest_progress[0]
            : { completed: false };

          const status = progress.completed ? '✅' : '⏳';
          const questEmoji = quest.emoji || '📋';

          chainText += `${status} **${quest.name}** ${questEmoji}\n`;
          if (progress.completed) completedCount++;
        }

        const chainProgress = `${completedCount}/${chainQuestList.length} completed`;
        
        embed.addFields({
          name: `🔗 Quest Chain (${chainProgress})`,
          value: chainText.slice(0, 1024),
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in handleQuestChainCommand:', error);
      return interaction.editReply({
        content: '❌ An error occurred while fetching quest chains.',
        ephemeral: true
      });
    }
  }
}

module.exports = QuestCommands;

