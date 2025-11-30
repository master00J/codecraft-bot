const BaseProvider = require('./base');
const config = require('../config');
const { buildMessages, buildModerationPrompt } = require('../prompt-utils.js');

let Anthropic;
try {
  // eslint-disable-next-line global-require
  ({ Anthropic } = require('@anthropic-ai/sdk'));
} catch (error) {
  Anthropic = null;
}

function toClaudeMessages(messages) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: [
        {
          type: 'text',
          text: message.content,
        },
      ],
    }));
}

function mapUsage(usage) {
  if (!usage) {
    return null;
  }
  const input =
    usage.input_tokens ??
    usage.prompt_tokens ??
    0;
  const output =
    usage.output_tokens ??
    usage.completion_tokens ??
    0;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: usage.total_tokens ?? input + output,
  };
}

function collectTextFragments(node, fragments) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectTextFragments(item, fragments));
    return;
  }

  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed) fragments.push(trimmed);
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  if (node.type === 'text' && typeof node.text === 'string') {
    const trimmed = node.text.trim();
    if (trimmed) fragments.push(trimmed);
  }

  if (Array.isArray(node.content)) {
    collectTextFragments(node.content, fragments);
  }
}

function extractTextFromContent(content) {
  const fragments = [];
  collectTextFragments(content, fragments);
  return fragments.join('\n\n').trim();
}

class ClaudeProvider extends BaseProvider {
  constructor() {
    super('claude');
    this.client = null;
  }

  isConfigured() {
    const { apiKey } = config.getClaudeConfig();
    return Boolean(apiKey) && Anthropic;
  }

  ensureClient() {
    if (this.client) return;
    if (!Anthropic) {
      throw new Error('Anthropic SDK not available in this environment');
    }
    const { apiKey } = config.getClaudeConfig();
    if (!apiKey) {
      throw new Error('Anthropic API key missing');
    }
    this.client = new Anthropic({ apiKey });
  }

  getModelName() {
    return config.getClaudeConfig().model;
  }

  async generate(payload, guildModel = null) {
    this.ensureClient();
    const {
      system,
      context,
      conversation,
      prompt,
      temperature = 0.7,
      maxOutputTokens = 1024,
      tools = null,
    } = payload;

    const messages = buildMessages({
      system,
      context,
      conversation,
      userPrompt: prompt,
    });

    // Claude expects system prompt separately; remove initial system entry
    const systemPrompt = messages.find((msg) => msg.role === 'system')?.content;
    const filteredMessages = toClaudeMessages(messages);

    const modelName = guildModel || this.getModelName();
    const requestPayload = {
      model: modelName,
      max_tokens: maxOutputTokens,
      temperature,
      system: systemPrompt,
      messages: filteredMessages,
    };

    if (Array.isArray(tools) && tools.length > 0) {
      requestPayload.tools = tools;
    }

    try {
      const result = await this.client.messages.create(requestPayload);

      const text = extractTextFromContent(result?.content) || result?.content?.[0]?.text || '';
      const modelName = guildModel || this.getModelName();
      return {
        provider: this.name,
        model: modelName,
        text: text.trim(),
        usage: mapUsage(result?.usage),
        raw: result,
      };
    } catch (error) {
      error.message = `Claude generate failed: ${error.message}`;
      throw error;
    }
  }

  async generateStream(payload, { onStream } = {}, guildModel = null) {
    if (Array.isArray(payload?.tools) && payload.tools.length > 0) {
      // Claude streaming met tools wordt nog niet ondersteund; val terug op non-streaming.
      return this.generate(payload, guildModel);
    }
    this.ensureClient();
    const {
      system,
      context,
      conversation,
      prompt,
      temperature = 0.7,
      maxOutputTokens = 1024,
    } = payload;

    const messages = buildMessages({
      system,
      context,
      conversation,
      userPrompt: prompt,
    });

    const systemPrompt = messages.find((msg) => msg.role === 'system')?.content;
    const filteredMessages = toClaudeMessages(messages);
    const modelName = guildModel || this.getModelName();

    const safeOnStream = (chunk, meta) => {
      if (typeof onStream !== 'function') return;
      try {
        onStream(chunk, meta);
      } catch (err) {
        console.warn('[AI Claude] onStream handler failed:', err.message);
      }
    };

    try {
      const stream = await this.client.messages.stream({
        model: modelName,
        max_tokens: maxOutputTokens,
        temperature,
        system: systemPrompt,
        messages: filteredMessages,
      });

      let collected = '';

      return await new Promise((resolve, reject) => {
        const handleError = (error) => {
          stream.controller?.abort?.();
          reject(new Error(`Claude generate failed: ${error.message}`));
        };

        stream.on('text', (chunk) => {
          if (!chunk) return;
          collected += chunk;
          safeOnStream(chunk, { done: false });
        });

        stream.on('error', handleError);

        stream
          .finalMessage()
          .then((finalMessage) => {
            const text = finalMessage?.content?.[0]?.text || collected;
            const usage =
              mapUsage(stream?.response?.usage) ||
              mapUsage(finalMessage?.usage);

            safeOnStream('', { done: true });

            resolve({
              provider: this.name,
              model: modelName,
              text: text.trim(),
              usage,
              raw: finalMessage,
            });
          })
          .catch(handleError);
      });
    } catch (error) {
      error.message = `Claude generate failed: ${error.message}`;
      throw error;
    }
  }

  async moderate(payload) {
    this.ensureClient();
    const prompt = buildModerationPrompt(payload.content);

    try {
      const result = await this.client.messages.create({
        model: config.getClaudeConfig().model,
        max_tokens: 256,
        temperature: 0,
        system: 'Return only JSON.',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      });

      const text = result?.content?.[0]?.text || '{}';
      let parsed;
      try {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd >= jsonStart) {
          parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
        }
      } catch {
        parsed = null;
      }

      return {
        provider: this.name,
        flagged: Boolean(parsed?.flagged),
        categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
        raw: result,
      };
    } catch (error) {
      error.message = `Claude moderation failed: ${error.message}`;
      throw error;
    }
  }
}

module.exports = new ClaudeProvider();

