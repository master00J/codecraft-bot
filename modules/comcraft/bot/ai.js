function createAiHandlers({
  aiService,
  aiStore,
  memoryStore,
  aiUsageService,
  featureGate,
  buildKnowledgeContext,
  chunkMessage,
  client,
  xpManager,
  economyManager,
}) {
  async function runGuildAiPrompt({ guild, prompt, userId, channelId = null, onStream = null }) {
    const guildId = guild.id;

    try {
      const [settings, persona, documents] = await Promise.all([
        aiStore.getSettings(guildId),
        aiStore.getPersona(guildId),
        aiStore.getDocuments(guildId, 8),
      ]);

      if (settings && settings.allow_question_command === false) {
        return { success: false, error: '🤖 The AI assistant is disabled for this guild.' };
      }

      const assistantName = persona?.assistant_name?.trim() || 'ComCraft AI';
      const guildName = guild?.name || 'this server';

      const providerToUse = typeof settings?.default_provider === 'string' && settings.default_provider ? settings.default_provider : undefined;
      const allowWebSearch =
        settings?.web_search_enabled === true &&
        (providerToUse ? providerToUse === 'claude' : false);
      const webSearchTools = allowWebSearch
        ? [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 3,
            },
          ]
        : null;

      const replaceTokens = (value) => {
        if (!value || typeof value !== 'string') {
          return '';
        }
        return value
          .replace(/\{guild\}/gi, guildName)
          .replace(/\{assistant\}/gi, assistantName)
          .replace(/\{assistant_name\}/gi, assistantName)
          .replace(/comcraft ai/gi, assistantName);
      };

      const enforcedIdentity = [
        `Your name is ${assistantName}. You are the AI guide for the ${guildName} community.`,
        `You MUST always introduce yourself as ${assistantName}. If anyone asks for your name, identity, who you are, or what you are called, immediately answer "${assistantName}" without hesitation.`,
        'Never claim you have no name, never say you are just a language model, and never defer the question. Mention your training only if explicitly asked, and even then, keep the focus on your role as the configured character.',
        'Stay consistent with the persona settings provided by the dashboard and fully embody the chosen character in every response.',
      ].join(' ');

      const styleGuidelines = replaceTokens(persona?.style_guidelines);
      const knowledgeContext =
        Array.isArray(documents) && documents.length > 0 ? buildKnowledgeContext(documents, 8) : '';

      const contextParts = [enforcedIdentity];
      if (styleGuidelines) contextParts.push(styleGuidelines);
      if (knowledgeContext) contextParts.push(knowledgeContext);

      let memorySummary = '';
      if (settings?.memory_enabled !== false) {
        const memories = await memoryStore.getRelevantMemories(guildId, {
          userId,
          limit: 8,
          query: prompt,
        });
        memorySummary = await memoryStore.summarizeMemories(memories);
        if (memorySummary) {
          contextParts.push(`Relevant memories about this guild or user:\n${memorySummary}`);
        }
      }

      const customSystemPrompt = replaceTokens(persona?.system_prompt);
      const systemPrompt = [enforcedIdentity, customSystemPrompt].filter(Boolean).join('\n\n');

      const payload = {
        prompt,
        system: systemPrompt || undefined,
        context: contextParts.filter(Boolean).join('\n\n').trim(),
        conversation: [],
        tools: webSearchTools || undefined,
      };

      const options = providerToUse ? { provider: providerToUse } : {};

      const quotaCheck = await aiUsageService.ensureWithinQuota(guildId);
      if (!quotaCheck.allowed) {
        const limitTokens = quotaCheck.limitTokens;
        const usedTokens = quotaCheck.summary.tokensTotal;
        const resetAt = quotaCheck.summary.periodEnd;
        const limitText = limitTokens >= 0 ? limitTokens.toLocaleString() : '∞';
        const usedText = usedTokens.toLocaleString();
        const resetText = resetAt ? new Date(resetAt).toLocaleDateString() : 'soon';
        return {
          success: false,
          error: `🤖 AI usage limit reached for this period (${usedText}/${limitText} tokens). The quota resets on ${resetText}. Upgrade your tier or wait for the reset to continue.`,
        };
      }

      let streamedText = '';
      const streamHandler =
        typeof onStream === 'function'
          ? (chunk, meta) => {
              if (chunk) {
                streamedText += chunk;
              }
              onStream(chunk, meta);
            }
          : null;

      const result = await aiService.runTask('generate', payload, {
        ...options,
        meta: {
          guildId,
          userId,
          channelId,
        },
        onStream: allowWebSearch ? undefined : streamHandler,
      });
      const answer = (result?.text || streamedText)?.trim();

      if (!answer) {
        return { success: false, error: '🤖 I could not find an answer. Try rephrasing your question.' };
      }

      if (settings?.memory_enabled !== false) {
        memoryStore.writeInteractionMemory({
          guildId,
          userId,
          channelId,
          prompt,
          response: answer,
        });
        memoryStore.pruneStaleMemories(guildId, {
          retentionDays: Number(settings.memory_retention_days || 90),
          maxEntries: Number(settings.memory_max_entries || 200),
        });
      }

      return {
        success: true,
        answer,
        providerName: result?.provider || options?.provider || 'gemini',
        assistantName,
        settings,
      };
    } catch (error) {
      console.error('runGuildAiPrompt error:', error);
      return { success: false, error: `❌ AI could not provide an answer: ${error.message || 'Unknown error'}` };
    }
  }

  async function handleAskAiCommand(interaction) {
    const guildId = interaction.guild.id;

    const allowed = await featureGate.checkFeatureOrReply(interaction, guildId, 'ai_assistant', 'Premium');
    if (!allowed) {
      return;
    }

    if (!aiService.config.isAiEnabled()) {
      return interaction.reply({
        content: '🤖 The AI assistant is currently disabled.',
        ephemeral: true,
      });
    }

    const prompt = interaction.options.getString('prompt', true).trim();

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({ content: '🤖 Please wait... I\'m thinking.' });

    let streamedContent = '';
    let lastEdit = Date.now();
    let hasStreamed = false;

    const throttleMs = 800;

    const updateReply = async (text) => {
      if (!text) return;
      const display = text.length <= 1900 ? text : `…${text.slice(-1900)}`;
      try {
        await interaction.editReply({ content: display });
      } catch (error) {
        console.warn('AI stream edit failed:', error.message);
      }
    };

    const streamHandler = async (chunk) => {
      if (chunk) {
        streamedContent += chunk;
        const now = Date.now();
        if (!hasStreamed || now - lastEdit > throttleMs) {
          hasStreamed = true;
          lastEdit = now;
          await updateReply(streamedContent);
        }
      }
    };

    try {
      const result = await runGuildAiPrompt({
        guild: interaction.guild,
        prompt,
        userId: interaction.user.id,
        channelId: interaction.channelId,
        onStream: streamHandler,
      });

      if (!result.success) {
        await interaction.editReply({
          content: result.error || '❌ AI could not provide an answer. Try again later.',
        });
        return;
      }

      const { answer, providerName } = result;

      const prefix = providerName ? `*(via ${providerName})*\n` : '';
      const chunks = chunkMessage(`${prefix}${answer}`);

      const [first, ...rest] = chunks;
      await interaction.editReply({ content: first });
      for (const chunk of rest) {
        // eslint-disable-next-line no-await-in-loop
        await interaction.followUp({ content: chunk, ephemeral: true });
      }
    } catch (error) {
      console.error('AI ask command failed:', error);
      const message = `❌ AI could not provide an answer: ${error.message || 'Unknown error'}`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: message });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  }

  async function maybeHandleAiChatMessage(message) {
    try {
      const botUser = client?.user || null;
      const mentionTriggered =
        !!botUser &&
        (message.mentions?.users?.has?.(botUser.id) || message.mentions?.repliedUser?.id === botUser.id);

      const settings = await aiStore.getSettings(message.guild.id);
      if (!settings && !mentionTriggered) {
        return false;
      }

      if (settings && settings.chat_enabled !== true && !mentionTriggered) {
        return false;
      }

      const baseChannelId = message.channel.isThread?.() ? message.channel.parentId : message.channel.id;

      if (!mentionTriggered && settings?.chat_channel_id && settings.chat_channel_id !== baseChannelId) {
        return false;
      }

      let prompt = message.content?.trim() || '';
      if (mentionTriggered && botUser) {
        const mentionPattern = new RegExp(`<@!?${botUser.id}>`, 'gi');
        prompt = prompt.replace(mentionPattern, '').trim();
      }

      if (!prompt) {
        if (!mentionTriggered) {
          return false;
        }
        prompt = 'Hello!';
      }

      if (!mentionTriggered && prompt.startsWith('/')) return false;

      await message.channel.sendTyping();

      const result = await runGuildAiPrompt({
        guild: message.guild,
        prompt,
        userId: message.author.id,
        channelId: message.channel.id,
      });

      if (!result.success) {
        await message.reply(result.error || '❌ AI could not provide an answer right now.');
        return true;
      }

      const { answer, providerName, assistantName, settings: resolvedSettings } = result;

      let responseChannel = message.channel;
      const shouldReplyInThread =
        !mentionTriggered && resolvedSettings?.chat_reply_in_thread !== false;

      if (shouldReplyInThread) {
        if (message.channel.isThread?.()) {
          responseChannel = message.channel;
        } else {
          try {
            const threadName = `${assistantName || 'AI'} • ${message.author.username}`.slice(0, 90);
            const thread = await message.startThread({
              name: threadName,
              autoArchiveDuration: 60,
            });
            responseChannel = thread;
          } catch (error) {
            console.warn('Failed to open AI thread:', error.message);
          }
        }
      }

      const prefix = providerName ? `*(via ${providerName})*\n` : '';
      const chunks = chunkMessage(`${prefix}${answer}`, 1800);

      const [firstChunk, ...restChunks] = chunks;
      let replyMessage;
      if (responseChannel === message.channel) {
        replyMessage = await message.reply({ content: firstChunk });
      } else {
        replyMessage = await responseChannel.send({ content: firstChunk });
      }

      for (const chunk of restChunks) {
        // eslint-disable-next-line no-await-in-loop
        await responseChannel.send({
          content: chunk,
          reply: replyMessage ? { messageReference: replyMessage.id } : undefined,
        });
      }

      // Give the bot XP for responding
      if (xpManager && client?.user) {
        try {
          const botXP = 15 + Math.floor(Math.random() * 10); // 15-25 XP per response
          await xpManager.addXP(message.guild.id, client.user.id, botXP);
          
          // Auto-convert XP to coins when bot has enough (every 100 XP)
          if (economyManager) {
            const botLevel = await xpManager.getUserLevel(message.guild.id, client.user.id);
            if (botLevel && botLevel.xp >= 100) {
              const xpToConvert = Math.floor(botLevel.xp / 100) * 100; // Convert in batches of 100
              await economyManager.convertXP(message.guild.id, client.user.id, xpToConvert, xpManager);
              console.log(`🤖 Bot auto-converted ${xpToConvert} XP to coins`);
            }
          }
        } catch (xpError) {
          console.error('Error giving bot XP:', xpError);
        }
      }

      return true;
    } catch (error) {
      console.error('maybeHandleAiChatMessage error:', error);
      return false;
    }
  }

  return {
    runGuildAiPrompt,
    handleAskAiCommand,
    maybeHandleAiChatMessage,
  };
}

module.exports = createAiHandlers;

