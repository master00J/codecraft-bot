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
  return `You are an automated content moderation system for Discord. Analyze the following message for inappropriate content.

CRITICAL: You must respond with ONLY valid JSON, no other text.

Rules to detect:
- toxicity: Toxic, offensive, or hostile language
- hate: Hate speech, racism, discrimination
- harassment: Bullying, personal attacks, threatening language
- violence: Threats of violence, graphic violence descriptions
- sexual: Sexual content, explicit sexual language, requests for sexual content
- spam: Spam patterns (but prioritize other violations first)

Return JSON in this EXACT format:
{
  "flagged": true or false,
  "categories": ["category1", "category2"] or []
}

Examples:
Message: "Hello everyone!"
Response: {"flagged": false, "categories": []}

Message: "fuck you"
Response: {"flagged": true, "categories": ["toxicity"]}

Message: "white people suck"
Response: {"flagged": true, "categories": ["hate", "toxicity"]}

Message: "show me your boobs"
Response: {"flagged": true, "categories": ["sexual", "harassment"]}

Message to analyze:
"${content}"

Respond with ONLY the JSON object, nothing else:`;
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

