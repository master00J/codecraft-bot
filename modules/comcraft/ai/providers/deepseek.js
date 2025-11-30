/**
 * DeepSeek AI Provider
 * Supports deepseek-chat and deepseek-reasoner models
 */

const BaseProvider = require('./base');
const config = require('../config');
const { buildMessages, buildModerationPrompt } = require('../prompt-utils.js');

class DeepSeekProvider extends BaseProvider {
  constructor() {
    super('deepseek');
    this.apiKey = null;
    this.baseUrl = 'https://api.deepseek.com/v1';
  }

  isConfigured() {
    const { apiKey } = config.getDeepSeekConfig();
    return Boolean(apiKey);
  }

  ensureApiKey() {
    if (this.apiKey) return;
    const { apiKey } = config.getDeepSeekConfig();
    if (!apiKey) {
      throw new Error('DeepSeek API key missing');
    }
    this.apiKey = apiKey;
  }

  getModelName(guildModel = null) {
    const { model } = config.getDeepSeekConfig();
    // If guild has a specific model, use it; otherwise use default
    return guildModel || model || 'deepseek-chat';
  }

  async makeRequest(endpoint, payload) {
    this.ensureApiKey();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  async generate(payload, guildModel = null) {
    const {
      system,
      context,
      conversation,
      prompt,
      temperature = 0.7,
      maxOutputTokens = 4096,
    } = payload;

    const messages = buildMessages({
      system,
      context,
      conversation,
      userPrompt: prompt,
    });

    // Convert to OpenAI format (DeepSeek uses OpenAI-compatible API)
    const openAIMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
      content: msg.content,
    }));

    // Extract system message if present
    const systemMessage = openAIMessages.find(msg => msg.role === 'system');
    const filteredMessages = openAIMessages.filter(msg => msg.role !== 'system');

    // If system message exists, add it as first message (some APIs prefer this)
    const finalMessages = systemMessage 
      ? [{ role: 'system', content: systemMessage.content }, ...filteredMessages]
      : filteredMessages;

    const modelName = this.getModelName(guildModel);

    try {
      const requestPayload = {
        model: modelName,
        messages: finalMessages,
        temperature,
        max_tokens: maxOutputTokens,
      };

      const result = await this.makeRequest('/chat/completions', requestPayload);

      const text = result?.choices?.[0]?.message?.content || '';
      const usage = result?.usage ? {
        inputTokens: result.usage.prompt_tokens || 0,
        outputTokens: result.usage.completion_tokens || 0,
        totalTokens: result.usage.total_tokens || 0,
      } : null;

      return {
        provider: this.name,
        model: modelName,
        text: text.trim(),
        usage,
        raw: result,
      };
    } catch (error) {
      error.message = `DeepSeek generate failed: ${error.message}`;
      throw error;
    }
  }

  async generateStream(payload, { onStream } = {}, guildModel = null) {
    const {
      system,
      context,
      conversation,
      prompt,
      temperature = 0.7,
      maxOutputTokens = 4096,
    } = payload;

    const messages = buildMessages({
      system,
      context,
      conversation,
      userPrompt: prompt,
    });

    const openAIMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
      content: msg.content,
    }));

    const systemMessage = openAIMessages.find(msg => msg.role === 'system');
    const filteredMessages = openAIMessages.filter(msg => msg.role !== 'system');
    const finalMessages = systemMessage 
      ? [{ role: 'system', content: systemMessage.content }, ...filteredMessages]
      : filteredMessages;

    const modelName = this.getModelName(guildModel);

    this.ensureApiKey();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: finalMessages,
          temperature,
          max_tokens: maxOutputTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`DeepSeek API error (${response.status}): ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let collected = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || line.startsWith(':')) continue;
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              const usage = null; // Usage info comes in final message
              if (typeof onStream === 'function') {
                onStream('', { done: true, text: collected });
              }
              return {
                provider: this.name,
                model: modelName,
                text: collected.trim(),
                usage,
                raw: null,
              };
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed?.choices?.[0]?.delta;
              if (delta?.content) {
                collected += delta.content;
                if (typeof onStream === 'function') {
                  onStream(delta.content, { done: false });
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Finalize
      if (typeof onStream === 'function') {
        onStream('', { done: true, text: collected });
      }

      return {
        provider: this.name,
        model: modelName,
        text: collected.trim(),
        usage: null,
        raw: null,
      };
    } catch (error) {
      error.message = `DeepSeek generateStream failed: ${error.message}`;
      throw error;
    }
  }

  async moderate(payload) {
    const prompt = buildModerationPrompt(payload.content);
    const modelName = this.getModelName();

    try {
      const result = await this.makeRequest('/chat/completions', {
        model: modelName,
        messages: [
          {
            role: 'system',
            content: 'Return only JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0,
        max_tokens: 256,
      });

      const text = result?.choices?.[0]?.message?.content || '{}';
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
      error.message = `DeepSeek moderation failed: ${error.message}`;
      throw error;
    }
  }
}

module.exports = new DeepSeekProvider();

