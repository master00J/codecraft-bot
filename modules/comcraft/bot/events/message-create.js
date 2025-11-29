const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const rankCardGenerator = require('../../leveling/rank-card-generator');

function createMessageCreateHandler({
  ensureMessageLicense,
  maybeHandleAiChatMessage,
  analyticsTracker,
  autoMod,
  customCommands,
  configManager,
  xpManager,
  getAutoReactionsManager = null, // Optional: auto-reactions manager getter
  ticketManager = null, // Optional: ticket manager for transcript logging
  userStatsManager = null, // Optional: user stats manager
}) {
  return async function handleMessageCreate(message) {
    if (!message.guild || message.author.bot) return;

    if (!(await ensureMessageLicense(message))) return;

    // Log ticket messages to database (before AI chat to ensure all messages are logged)
    if (ticketManager && message.channel.name && message.channel.name.includes('ticket-')) {
      try {
        await ticketManager.logMessageIfTicketChannel(message);
      } catch (error) {
        console.error('[Tickets] Error logging message:', error.message);
      }
    }

    await maybeHandleAiChatMessage(message);

    // Track message for analytics
    await analyticsTracker.trackMessage(message);

    // Track message for user stats
    if (userStatsManager && message.guild && message.author && !message.author.bot) {
      try {
        await userStatsManager.trackMessage(
          message.guild.id,
          message.author.id,
          message.channel.id,
          message.channel.name
        );
      } catch (error) {
        console.error('[MessageCreate] Error tracking user stats:', error.message);
      }
    }

    // Track message for quest progress (message_count quest type)
    if (global.questManager && message.guild && message.author && !message.author.bot) {
      try {
        if (await global.questManager.isTracking(message.guild.id, 'message_count')) {
          await global.questManager.updateProgress(message.guild.id, message.author.id, 'message_count', {
            channelId: message.channel.id,
            increment: 1
          });
        }
      } catch (error) {
        console.error('[MessageCreate] Error updating quest progress:', error.message);
      }
    }

    // Auto-moderation check
    const violations = await autoMod.checkMessage(message);
    if (violations) {
      await autoMod.handleViolation(message, violations);
      return; // Don't give XP for moderated messages
    }

    // Check for auto-reactions (before custom commands, so reactions can be added to command messages too)
    if (getAutoReactionsManager !== null && getAutoReactionsManager !== undefined) {
      try {
        const reactionsManager = getAutoReactionsManager();
        
        if (!reactionsManager) {
          console.log(`⚠️ [AutoReactions] Manager instance is null/undefined for guild ${message.guild?.id}`);
        } else if (!reactionsManager.supabase) {
          console.log(`⚠️ [AutoReactions] Manager not available for guild ${message.guild?.id} (Supabase not configured)`);
          console.log(`   Supabase URL: ${process.env.SUPABASE_URL ? 'set' : 'not set'}`);
          console.log(`   Supabase Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'not set'}`);
        } else {
          // Call checkMessage - it will handle its own logging
          await reactionsManager.checkMessage(message);
        }
      } catch (error) {
        // Auto-reactions is optional, so don't fail if it's not available
        console.error(`❌ [AutoReactions] Error checking auto-reactions for guild ${message.guild?.id}:`, error.message);
        if (error.stack) {
          console.error('Error stack:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
      }
    } else {
      // This should not happen if module loaded correctly, but log it for debugging
      console.log(`ℹ️ [AutoReactions] getAutoReactionsManager not available (module not loaded at startup)`);
    }

    // Check for custom commands (with prefix or mention)
    const guildConfig = await configManager.getGuildConfig(message.guild.id);
    const prefix = guildConfig?.prefix || '!';

    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      const command = await customCommands.getCommand(message.guild.id, commandName);
      if (command) {
        await customCommands.executeCommand(message, command);
        return;
      }
    }

    // Give XP for message
    const xpResult = await xpManager.addXP(message.guild, message.author, message);

    if (xpResult && xpResult.leveledUp) {
      const config = xpResult.config;

      if (config.levelup_message_enabled) {
        const levelupMessage = config.levelup_message_template
          .replace('{user}', message.author.toString())
          .replace('{username}', message.author.username)
          .replace('{level}', xpResult.newLevel.toString())
          .replace('{xp}', xpResult.totalXP.toString());

        const channel = config.levelup_channel_id
          ? message.guild.channels.cache.get(config.levelup_channel_id)
          : message.channel;

        if (channel) {
          try {
            // Get full rank data for rank card
            const rankData = await xpManager.getUserLevel(message.guild.id, message.author.id);
            
            // Generate rank card image
            // Use PNG format for avatar since canvas doesn't support webp
            const rankCardBuffer = await rankCardGenerator.generateRankCard({
              user: {
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL({ size: 256, extension: 'png', forceStatic: true })
              },
              rankData: {
                level: rankData.level,
                rank: rankData.rank,
                xp: rankData.xp,
                xpForNext: rankData.xpForNext,
                totalMessages: rankData.totalMessages
              },
              config: config
            });

            // Create attachment
            const attachment = new AttachmentBuilder(rankCardBuffer, { name: 'levelup-card.png' });

            // Use custom border color if available
            const embedColor = config.rank_card_border_color || '#00FF00';
            
            const embed = new EmbedBuilder()
              .setColor(embedColor)
              .setTitle('🎉 Level Up!')
              .setDescription(levelupMessage)
              .setImage('attachment://levelup-card.png')
              .setFooter({ text: `Level ${rankData.level} • Rank #${rankData.rank}` })
              .setTimestamp();

            const msg = await channel.send({ embeds: [embed], files: [attachment] });
            
            // Add level-up animation reactions
            if (config.levelup_animation && config.levelup_animation !== 'none') {
              try {
                const emojiMap = {
                  'confetti': ['🎊', '🎉', '🎈'],
                  'fireworks': ['🎆', '✨', '💥'],
                  'sparkles': ['✨', '⭐', '💫']
                };
                
                const emojis = emojiMap[config.levelup_animation] || ['🎉'];
                for (const emoji of emojis) {
                  await msg.react(emoji).catch(() => {});
                }
              } catch (error) {
                // Ignore reaction errors
              }
            }
            
            // Delete after 10 seconds
            setTimeout(() => msg.delete().catch(() => {}), 10000);
          } catch (error) {
            console.error('Error generating level-up rank card:', error);
            
            // Fallback to embed if image generation fails
            const embedColor = config.rank_card_border_color || '#00FF00';
            
            const embed = new EmbedBuilder()
              .setColor(embedColor)
              .setTitle('🎉 Level Up!')
              .setDescription(levelupMessage)
              .setThumbnail(message.author.displayAvatarURL())
              .addFields(
                { name: '⭐ New Level', value: xpResult.newLevel.toString(), inline: true },
                { name: '✨ Total XP', value: xpResult.totalXP.toString(), inline: true },
              );

            // Add XP bar visualization
            const currentLevelXP = xpResult.totalXP % xpResult.xpForNext;
            const xpProgress = Math.floor((currentLevelXP / xpResult.xpForNext) * 100);
            const xpBar = xpManager.generateXPBar(xpProgress, config);
            embed.addFields({
              name: '📊 XP Progress',
              value: `\`${xpBar}\` **${xpProgress}%**\n\`${currentLevelXP.toLocaleString()} / ${xpResult.xpForNext.toLocaleString()} XP\``,
              inline: false
            });

            const msg = await channel.send({ embeds: [embed] });
            
            // Add level-up animation reactions
            if (config.levelup_animation && config.levelup_animation !== 'none') {
              try {
                const emojiMap = {
                  'confetti': ['🎊', '🎉', '🎈'],
                  'fireworks': ['🎆', '✨', '💥'],
                  'sparkles': ['✨', '⭐', '💫']
                };
                
                const emojis = emojiMap[config.levelup_animation] || ['🎉'];
                for (const emoji of emojis) {
                  await msg.react(emoji).catch(() => {});
                }
              } catch (error) {
                // Ignore reaction errors
              }
            }
            
            // Delete after 10 seconds
            setTimeout(() => msg.delete().catch(() => {}), 10000);
          }
        }

        // Give level rewards
        const rewards = await xpManager.giveRewards(message.guild, message.member, xpResult.newLevel);

        if (rewards.length > 0) {
          const rewardText = rewards
            .map((r) => (r.type === 'role' ? `🎭 Role: ${r.value}` : `💬 ${r.value}`))
            .join('\n');

          const rewardEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎁 Level Rewards!')
            .setDescription(`Congratulations! You have received rewards:\n\n${rewardText}`);

          await message.author.send({ embeds: [rewardEmbed] }).catch(() => {});
        }

        // Send DM if enabled
        if (config.levelup_dm_enabled) {
          try {
            await message.author.send({ embeds: [embed] });
          } catch (error) {
            // User has DMs disabled
          }
        }
      }
    }
  };
}

module.exports = createMessageCreateHandler;

