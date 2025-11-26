function registerAiRoutes({ app, aiService, featureGate, aiStore, buildKnowledgeContext }) {
  app.post('/api/ai/generate', async (req, res) => {
    if (!aiService.config.isAiEnabled()) {
      return res.status(403).json({ success: false, error: 'AI features are disabled.' });
    }
    const {
      guildId,
      prompt,
      system,
      context,
      conversation,
      provider,
      temperature,
      maxOutputTokens,
    } = req.body || {};

    if (!guildId || typeof guildId !== 'string') {
      return res.status(400).json({ success: false, error: 'guildId is required' });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    const licenseActive = await featureGate.checkLicense(guildId);
    if (!licenseActive) {
      return res.status(403).json({ success: false, error: 'License inactive for this guild.' });
    }

    const hasFeature = await featureGate.checkFeature(guildId, 'ai_assistant');
    if (!hasFeature) {
      return res.status(403).json({ success: false, error: 'AI assistant is not enabled for this tier.' });
    }

    const conversationSafe = Array.isArray(conversation)
      ? conversation
          .filter((turn) => turn && typeof turn.role === 'string' && typeof turn.content === 'string')
          .map((turn) => ({
            role: turn.role === 'assistant' ? 'assistant' : 'user',
            content: String(turn.content),
          }))
      : [];

    try {
      const [settings, persona, documents] = await Promise.all([
        aiStore.getSettings(guildId),
        aiStore.getPersona(guildId),
        aiStore.getDocuments(guildId, 10),
      ]);

      if (settings && settings.allow_question_command === false) {
        return res.status(403).json({ success: false, error: 'AI assistant is disabled for this guild.' });
      }

      const contextParts = [];
      if (persona?.style_guidelines) {
        contextParts.push(persona.style_guidelines);
      }
      if (context && typeof context === 'string') {
        contextParts.push(context);
      }
      if (documents && documents.length > 0) {
        contextParts.push(buildKnowledgeContext(documents, 10));
      }

      const result = await aiService.runTask(
        'generate',
        {
          prompt: prompt.trim(),
          system: system || persona?.system_prompt || undefined,
          context: contextParts.filter(Boolean).join('\n\n').trim(),
          conversation: conversationSafe,
          temperature,
          maxOutputTokens,
        },
        {
          provider: provider || settings?.default_provider || undefined,
          meta: { guildId },
        }
      );

      res.json({ success: true, result });
    } catch (error) {
      console.error('AI generate endpoint error:', error);
      res.status(500).json({ success: false, error: error.message || 'AI request failed' });
    }
  });

  app.post('/api/ai/moderate', async (req, res) => {
    if (!aiService.config.isAiEnabled()) {
      return res.status(403).json({ success: false, error: 'AI features are disabled.' });
    }
    const { guildId, content, provider } = req.body || {};

    if (!guildId || typeof guildId !== 'string') {
      return res.status(400).json({ success: false, error: 'guildId is required' });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, error: 'content is required' });
    }

    const licenseActive = await featureGate.checkLicense(guildId);
    if (!licenseActive) {
      return res.status(403).json({ success: false, error: 'License inactive for this guild.' });
    }

    const hasFeature = await featureGate.checkFeature(guildId, 'ai_assistant');
    if (!hasFeature) {
      return res.status(403).json({ success: false, error: 'AI assistant is not enabled for this tier.' });
    }

    try {
      const [settings] = await Promise.all([aiStore.getSettings(guildId)]);

      if (settings && settings.allow_moderation === false) {
        return res.status(403).json({ success: false, error: 'AI moderation is disabled for this guild.' });
      }

      const result = await aiService.runTask(
        'moderate',
        { content },
        {
          provider: provider || settings?.default_provider || undefined,
          meta: { guildId },
        }
      );
      res.json({ success: true, result });
    } catch (error) {
      console.error('AI moderation endpoint error:', error);
      res.status(500).json({ success: false, error: error.message || 'AI request failed' });
    }
  });
}

module.exports = registerAiRoutes;

