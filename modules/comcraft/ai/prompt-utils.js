const DEFAULT_SYSTEM_PROMPT = `You are ComCraft AI, a helpful Discord assistant for content creators.
Answer concisely, stay friendly, and when unsure, say you will check with a moderator.`;

function buildMessages({ system, context = '', conversation = [], userPrompt }) {
  const messages = [];

  if (system || DEFAULT_SYSTEM_PROMPT) {
    messages.push({
      role: 'system',
      content: system || DEFAULT_SYSTEM_PROMPT,
    });
  }

  if (context) {
    messages.push({
      role: 'user',
      content: `Relevant server knowledge:\n${context}\n\nUse this information when answering.`,
    });
  }

  conversation.forEach((turn) => {
    if (!turn || !turn.role || !turn.content) return;
    messages.push({
      role: turn.role,
      content: turn.content,
    });
  });

  if (userPrompt) {
    messages.push({
      role: 'user',
      content: userPrompt,
    });
  }

  return messages;
}

function buildModerationPrompt(content) {
  return `You are an automated moderation classifier. Analyse the following message and respond ONLY with JSON.
Return the fields:
{
  "flagged": boolean,
  "categories": string[] // list of rule categories violated or empty
}

Message:
${content}
`;
}

function buildKnowledgeContext(entries = [], limit = 10) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '';
  }

  return entries.slice(0, limit).map((entry) => {
    const title = entry.title || 'Knowledge';
    const content = entry.content || '';
    const tags = Array.isArray(entry.tags) && entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : '';
    return `### ${title}
${content}
${tags}`.trim();
  }).join('\n\n');
}

module.exports = {
  buildMessages,
  buildModerationPrompt,
  buildKnowledgeContext,
};

