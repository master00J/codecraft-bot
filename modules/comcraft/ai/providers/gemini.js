const BaseProvider = require('./base');
const config = require('../config');
const { buildMessages, buildModerationPrompt } = require('../prompt-utils.js');

let GoogleGenAI = null;
let googleGenAILoadPromise = null;

async function loadGoogleGenAI() {
  if (GoogleGenAI) {
    return GoogleGenAI;
  }

  if (!googleGenAILoadPromise) {
    googleGenAILoadPromise = import('@google/genai')
      .then((mod) => {
        if (!mod || !mod.GoogleGenAI) {
          throw new Error('Failed to load GoogleGenAI export from @google/genai');
        }
        GoogleGenAI = mod.GoogleGenAI;
        return GoogleGenAI;
      })
      .catch((error) => {
        googleGenAILoadPromise = null;
        console.error('[AI Gemini] Failed to load @google/genai package:', error);
        throw error;
      });
  }

  return googleGenAILoadPromise;
}

function normalizeModelName(model) {
  if (!model) {
    return 'gemini-1.5-flash';
  }
  return model.startsWith('models/') ? model.replace(/^models\//, '') : model;
}

function splitSystemAndMessages(messages) {
  const contents = [];
  const systemParts = [];

  messages.forEach((message) => {
    if (!message || typeof message.content !== 'string') {
      return;
    }

    if (message.role === 'system') {
      systemParts.push(message.content);
      return;
    }

    const role = message.role === 'assistant' ? 'model' : 'user';
    contents.push({
      role,
      parts: [{ text: message.content }],
    });
  });

  return {
    systemInstruction: systemParts.length > 0 ? systemParts.join('\n\n') : null,
    contents,
  };
}

function collectTextFromContent(content, state) {
  if (!content) return;

  if (Array.isArray(content)) {
    content.forEach((item) => collectTextFromContent(item, state));
    return;
  }

  if (typeof content !== 'object') {
    return;
  }

  if (Array.isArray(content.parts)) {
    collectTextFromContent(content.parts, state);
  }

  if (Array.isArray(content.candidates)) {
    collectTextFromContent(content.candidates, state);
  }

  if (Array.isArray(content.output)) {
    collectTextFromContent(content.output, state);
  }

  if (Array.isArray(content.outputs)) {
    collectTextFromContent(content.outputs, state);
  }

  if (Array.isArray(content.content)) {
    collectTextFromContent(content.content, state);
  }

  if (content.response) {
    collectTextFromContent(content.response, state);
  }

  if (content.inlineData?.mimeType?.startsWith?.('audio/')) {
    state.hasAudio = true;
  }

  if (typeof content.text === 'function') {
    try {
      const text = content.text();
      if (text) {
        state.texts.push(String(text).trim());
      }
    } catch {
      // ignore errors from text() helpers
    }
  } else if (typeof content.text === 'string' && content.text.trim() !== '') {
    state.texts.push(content.text.trim());
  }
}

function extractTextFromResponse(data) {
  if (!data) {
    return '';
  }

  if (typeof data.text === 'function') {
    try {
      const text = data.text();
      if (text) {
        return String(text).trim();
      }
    } catch {
      // ignore helper errors
    }
  }

  if (typeof data.text === 'string' && data.text.trim() !== '') {
    return data.text.trim();
  }

  const state = { texts: [], hasAudio: false };
  collectTextFromContent(data, state);

  if (state.texts.length > 0) {
    return state.texts.join('\n\n');
  }

  if (state.hasAudio) {
    return 'The AI generated an audio response which is not yet supported in this interface.';
  }

  return '';
}

function mapUsage(usageMetadata) {
  if (!usageMetadata) {
    return null;
  }
  const input =
    usageMetadata.promptTokenCount ??
    usageMetadata.inputTokenCount ??
    0;
  const output =
    usageMetadata.candidatesTokenCount ??
    usageMetadata.outputTokenCount ??
    0;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: usageMetadata.totalTokenCount ?? input + output,
  };
}

function parseModerationJson(text) {
  if (!text) return null;
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    return null;
  }

  try {
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    return null;
  }
}

class GeminiProvider extends BaseProvider {
  constructor() {
    super('gemini');
    this.client = null;
  }

  isConfigured() {
    const { apiKey } = config.getGeminiConfig();
    return Boolean(apiKey);
  }

  async ensureClient() {
    if (this.client) {
      return;
    }

    const { apiKey } = config.getGeminiConfig();
    if (!apiKey) {
      throw new Error('Gemini API key missing');
    }

    const GoogleGenAIConstructor = await loadGoogleGenAI();
    this.client = new GoogleGenAIConstructor({ apiKey });
  }

  getModelName() {
    const { model } = config.getGeminiConfig();
    return normalizeModelName(model);
  }

  async generate(payload, guildModel = null) {
    await this.ensureClient();

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

    const { systemInstruction, contents } = splitSystemAndMessages(messages);

    // Check if web search is enabled (tools will indicate this)
    const useGrounding = tools && typeof tools === 'object' && tools.type === 'grounding' && tools.enabled;

    try {
      const requestConfig = {
        model: guildModel || this.getModelName(),
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
        ...(systemInstruction
          ? {
              systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
              },
            }
          : {}),
      };

      // Add Google Search grounding if web search is enabled
      if (useGrounding) {
        requestConfig.tools = [
          {
            googleSearchRetrieval: {
              dynamicRetrievalConfig: {
                mode: 'MODE_DYNAMIC',
                dynamicThreshold: 0.3,
              },
            },
          },
        ];
      }

      const response = await this.client.models.generateContent(requestConfig);

      const text = extractTextFromResponse(response);
      const usage = mapUsage(response?.usageMetadata);

      const modelName = guildModel || this.getModelName();
      return {
        provider: this.name,
        model: modelName,
        text: text.trim(),
        usage,
        raw: response,
      };
    } catch (error) {
      error.message = `Gemini generate failed: ${error.message}`;
      throw error;
    }
  }

  async generateStream(payload, { onStream } = {}, guildModel = null) {
    await this.ensureClient();

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

    const { systemInstruction, contents } = splitSystemAndMessages(messages);

    const modelName = guildModel || this.getModelName();
    let collected = '';

    // Check if web search is enabled
    const useGrounding = tools && typeof tools === 'object' && tools.type === 'grounding' && tools.enabled;

    try {
      const requestConfig = {
        model: modelName,
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
        ...(systemInstruction
          ? {
              systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
              },
            }
          : {}),
      };

      // Add Google Search grounding if web search is enabled
      if (useGrounding) {
        requestConfig.tools = [
          {
            googleSearchRetrieval: {
              dynamicRetrievalConfig: {
                mode: 'MODE_DYNAMIC',
                dynamicThreshold: 0.3,
              },
            },
          },
        ];
      }

      const stream = await this.client.models.generateContentStream(requestConfig);

      if (stream?.stream && typeof stream.stream[Symbol.asyncIterator] === 'function') {
        for await (const item of stream.stream) {
          let chunk = '';
          if (typeof item?.text === 'function') {
            chunk = item.text() || '';
          } else {
            chunk = extractTextFromResponse(item);
          }

          if (chunk) {
            collected += chunk;
            if (typeof onStream === 'function') {
              try {
                onStream(chunk, { done: false });
              } catch (err) {
                console.warn('[AI Gemini] onStream handler failed:', err.message);
              }
            }
          }
        }
      }

      const finalResponse = await stream.response;
      const text = extractTextFromResponse(finalResponse) || collected;
      const usage = mapUsage(finalResponse?.usageMetadata);

      if (typeof onStream === 'function') {
        try {
          onStream('', { done: true });
        } catch (err) {
          console.warn('[AI Gemini] onStream completion handler failed:', err.message);
        }
      }

      return {
        provider: this.name,
        model: modelName,
        text: text.trim(),
        usage,
        raw: finalResponse,
      };
    } catch (error) {
      error.message = `Gemini generate failed: ${error.message}`;
      throw error;
    }
  }

  async moderate(payload) {
    await this.ensureClient();
    const moderationPrompt = buildModerationPrompt(payload.content);

    try {
      const response = await this.client.models.generateContent({
        model: this.getModelName(),
        contents: [
          {
            role: 'user',
            parts: [{ text: moderationPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
        },
      });

      const text = extractTextFromResponse(response);
      const parsed = parseModerationJson(text);

      return {
        provider: this.name,
        flagged: Boolean(parsed?.flagged),
        categories: Array.isArray(parsed?.categories) ? parsed.categories : [],
        raw: response,
      };
    } catch (error) {
      error.message = `Gemini moderation failed: ${error.message}`;
      throw error;
    }
  }
}

module.exports = new GeminiProvider();

