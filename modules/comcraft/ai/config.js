/**
 * AI configuration helper.
 * Centralises environment parsing so other modules can
 * read tokens and settings in a consistent way.
 */

const DEFAULT_PROVIDER = process.env.AI_PRIMARY_PROVIDER || 'claude';

module.exports = {
  getPrimaryProvider() {
    return DEFAULT_PROVIDER;
  },

  isAiEnabled() {
    return process.env.AI_ENABLED !== 'false';
  },

  getGeminiConfig() {
    return {
      apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    };
  },

  getClaudeConfig() {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest',
    };
  },

  getDeepSeekConfig() {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    };
  },

  getQueueConfig() {
    return {
      concurrency: Number(process.env.AI_QUEUE_CONCURRENCY || 3),
      timeoutMs: Number(process.env.AI_TASK_TIMEOUT_MS || 15000),
    };
  },

  isEmbeddingsEnabled() {
    return process.env.AI_EMBEDDINGS_ENABLED !== 'false';
  },

  getEmbeddingModel() {
    return process.env.AI_EMBED_MODEL || process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';
  },

  getCostRates(providerName) {
    const defaults = {
      gemini: {
        input: Number(process.env.AI_COST_GEMINI_INPUT_PER_1K || 0),
        output: Number(process.env.AI_COST_GEMINI_OUTPUT_PER_1K || 0),
      },
      claude: {
        input: Number(process.env.AI_COST_CLAUDE_INPUT_PER_1K || 0),
        output: Number(process.env.AI_COST_CLAUDE_OUTPUT_PER_1K || 0),
      },
      deepseek: {
        input: Number(process.env.AI_COST_DEEPSEEK_INPUT_PER_1K || 0),
        output: Number(process.env.AI_COST_DEEPSEEK_OUTPUT_PER_1K || 0),
      },
    };

    const fallback = {
      input: Number(process.env.AI_COST_INPUT_PER_1K || 0),
      output: Number(process.env.AI_COST_OUTPUT_PER_1K || 0),
    };

    const key = (providerName || '').toLowerCase();
    const rates = defaults[key] || {};

    return {
      input: rates.input ?? fallback.input,
      output: rates.output ?? fallback.output,
    };
  },
};

