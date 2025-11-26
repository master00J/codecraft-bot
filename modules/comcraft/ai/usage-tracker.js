const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

class UsageTracker {
  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && serviceKey) {
      this.client = createClient(url, serviceKey);
    } else {
      this.client = null;
      console.warn('[AI Usage] Supabase credentials missing; usage logging disabled.');
    }
  }

  calculateCost(provider, inputTokens = 0, outputTokens = 0) {
    const rates = config.getCostRates(provider);

    const inputCost = (inputTokens / 1000) * (rates.input || 0);
    const outputCost = (outputTokens / 1000) * (rates.output || 0);

    const total = Number((inputCost + outputCost).toFixed(6));
    return total;
  }

  async logUsage({
    guildId,
    provider,
    model,
    taskType,
    tokens = {},
    metadata = {},
  }) {
    if (!this.client || !guildId || !provider || !taskType) {
      return;
    }

    const inputTokens = Number(tokens.inputTokens || tokens.input || 0);
    const outputTokens = Number(tokens.outputTokens || tokens.output || 0);
    const totalTokens =
      Number(tokens.totalTokens || tokens.total || inputTokens + outputTokens);

    const costUsd = this.calculateCost(provider, inputTokens, outputTokens);

    try {
      await this.client.from('ai_usage_logs').insert({
        guild_id: guildId,
        provider,
        model,
        task_type: taskType,
        tokens_input: inputTokens,
        tokens_output: outputTokens,
        tokens_total: totalTokens,
        cost_usd: costUsd,
        metadata,
      });
    } catch (error) {
      console.error('[AI Usage] Failed to log usage:', error.message);
    }
  }
}

module.exports = new UsageTracker();

