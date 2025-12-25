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

    // Auto-clean channel for maid jobs (optional: if user is clocked in and sends message in new channel)
    if (global.maidJobManager && message.guild && message.author && !message.author.bot) {
      try {
        // Check if user has active maid session
        const session = await global.maidJobManager.getActiveSession(message.guild.id, message.author.id);
        if (session) {
          // Check if this channel was already cleaned in this session
          const { data: existingCleaning } = await global.maidJobManager.supabase
            .from('maid_cleanings')
            .select('id')
            .eq('session_id', session.id)
            .eq('channel_id', message.channel.id)
            .single()
            .catch(() => ({ data: null }));

          // If not cleaned yet, auto-clean (optional feature - can be disabled per guild)
          if (!existingCleaning) {
            const config = await global.maidJobManager.getConfig(message.guild.id);
            // Only auto-clean if enabled (could add auto_clean_on_message to config)
            // For now, users must use /maid clean command manually
          }
        }
      } catch (error) {
        // Silent fail - don't break message processing if maid job check fails
        // console.error('[MessageCreate] Error checking maid job:', error.message);
      }
    }

    // Auto-moderation check
    const violations = await autoMod.checkMessage(message);
    if (violations) {
      await autoMod.handleViolation(message, violations);
      return; // Don't give XP for moderated messages
    }

    // Check for reply channel feature (add reply button to media posts)
    try {
      const channelRules = await configManager.getChannelModerationRules(message.guild.id, message.channel.id);
      if (channelRules?.reply_channel_id && (message.attachments.size > 0 || message.embeds.length > 0)) {
        // Check if bot can manage messages and webhooks
        const botMember = message.guild.members.me;
        const permissions = message.channel.permissionsFor(botMember);
        
        if (botMember && permissions?.has(['ManageMessages', 'ManageWebhooks', 'SendMessages'])) {
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          
          // Create or get webhook for this channel
          let webhook = (await message.channel.fetchWebhooks()).find(w => w.owner?.id === botMember.id);
          
          if (!webhook) {
            try {
              webhook = await message.channel.createWebhook({
                name: 'Comcraft Reply',
                avatar: botMember.user.displayAvatarURL(),
                reason: 'Auto-reply button for media posts'
              });
            } catch (error) {
              console.error('[MessageCreate] Error creating webhook:', error.message);
              // Fallback to reaction if webhook creation fails
              message.react('💬').catch(() => {});
              return;
            }
          }

          // Prepare attachments
          const attachments = Array.from(message.attachments.values()).map(att => ({
            attachment: att.url,
            name: att.name
          }));

          // Prepare embeds (copy original embeds if any)
          const embeds = message.embeds.length > 0 
            ? message.embeds.map(e => e.toJSON())
            : [];

          // Repost message via webhook with button
          try {
            // Generate a unique ID for this button that we can track
            // We'll store message.id -> webhookMessage.id mapping, or use a hash
            const buttonId = `media_reply_${message.id}_${message.channel.id}`;
            console.log('[MessageCreate] Creating reply button with ID:', buttonId);
            
            const replyButton = new ButtonBuilder()
              .setCustomId(buttonId)
              .setLabel('Reply')
              .setEmoji('💬')
              .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(replyButton);

            // Send webhook message WITH button directly
            console.log('[MessageCreate] Sending webhook message with button...');
            const webhookMessage = await webhook.send({
              content: message.content || undefined,
              username: message.author.username,
              avatarURL: message.author.displayAvatarURL(),
              embeds: embeds,
              files: attachments,
              components: [row]
            });
            console.log('[MessageCreate] Webhook message sent successfully, ID:', webhookMessage.id);

            // Store the mapping: buttonId -> webhookMessage.id for the handler
            // We'll pass the webhook message ID through the button handler
            // For now, the button will work with the original message ID in the handler

            // Delete original message after successful repost
            await message.delete().catch(() => {
              // If deletion fails, that's okay - the repost still happened
              console.log('[MessageCreate] Could not delete original message after repost');
            });
          } catch (error) {
            console.error('[MessageCreate] Error reposting message via webhook:', error.message);
            console.error('[MessageCreate] Full error:', error);
            // Fallback to reaction if webhook send fails
            message.react('💬').catch(() => {});
          }
        } else {
          // Fallback: add reaction if we don't have required permissions
          message.react('💬').catch(() => {});
        }
      }
    } catch (error) {
      // Silent fail - don't break message processing
      console.error('[MessageCreate] Error adding reply button:', error.message);
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

    // Check for profile image uploads (if message has image attachment)
    if (message.attachments && message.attachments.size > 0 && global.profileManager) {
      try {
        const imageAttachment = Array.from(message.attachments.values()).find(
          att => att.contentType && att.contentType.startsWith('image/')
        );
        
        if (imageAttachment) {
          // Check if user has an active profile response with image questions
          // This is a simple check - in production you might want to track which form/question the user is working on
          const { data: activeResponses } = await global.profileManager.supabase
            .from('user_profiles_responses')
            .select('form_id, responses, status')
            .eq('guild_id', message.guild.id)
            .eq('user_id', message.author.id)
            .eq('status', 'in_progress')
            .order('updated_at', { ascending: false })
            .limit(1);
          
          if (activeResponses && activeResponses.length > 0) {
            const response = activeResponses[0];
            const form = await global.profileManager.getForm(response.form_id);
            
            if (form && form.enabled) {
              // Find first image question that doesn't have a response yet
              const imageQuestion = form.questions.find(q => 
                q.type === 'image' && !response.responses?.[q.id]
              );
              
              if (imageQuestion) {
                // Download image and upload to Supabase
                const imageResponse = await fetch(imageAttachment.url);
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                
                try {
                  const imageUrl = await global.profileManager.uploadImageResponse(
                    response.form_id,
                    imageQuestion.id,
                    imageBuffer,
                    imageAttachment.name,
                    imageAttachment.contentType,
                    message.author.id,
                    message.guild.id
                  );
                  
                  // Send confirmation message
                  const confirmationMessage = await message.reply({
                    content: `✅ **Image uploaded successfully!**\n\nThe image has been saved to your profile and will be displayed when you submit the form.`,
                    allowedMentions: { repliedUser: false }
                  });
                  
                  // Delete the original message with the image attachment (to keep channel clean)
                  try {
                    await message.delete().catch(() => {
                      // If deletion fails (e.g., no permission), just log it
                      console.log('[Profile] Could not delete original image message (may not have permission)');
                    });
                  } catch (deleteError) {
                    console.log('[Profile] Error deleting original message:', deleteError.message);
                  }
                  
                  // Auto-delete confirmation message after 5 seconds
                  setTimeout(async () => {
                    try {
                      await confirmationMessage.delete().catch(() => {});
                    } catch (error) {
                      // Ignore errors when deleting
                    }
                  }, 5000);
                } catch (error) {
                  console.error('[Profile] Error uploading image:', error);
                  const errorMessage = await message.reply({
                    content: `❌ Failed to upload image: ${error.message}`,
                    allowedMentions: { repliedUser: false }
                  });
                  
                  // Auto-delete error message after 5 seconds
                  setTimeout(async () => {
                    try {
                      await errorMessage.delete().catch(() => {});
                    } catch (error) {
                      // Ignore errors when deleting
                    }
                  }, 5000);
                }
              }
            }
          }
        }
      } catch (error) {
        // Don't break message handling if profile image check fails
        console.error('[MessageCreate] Error checking profile image upload:', error.message);
      }
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

