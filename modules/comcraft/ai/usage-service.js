const { createClient } = require('@supabase/supabase-js');
const configManager = require('../config-manager');

let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase service credentials are required for AI usage tracking.');
    }
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

function startOfCurrentMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

async function getMonthlyUsage(guildId) {
  const supabase = getSupabase();
  const periodStart = startOfCurrentMonthUTC();

  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('tokens_input, tokens_output, tokens_total, cost_usd')
    .eq('guild_id', guildId)
    .gte('created_at', periodStart.toISOString());

  if (error) {
    console.warn('[AI Usage] Failed to fetch usage logs:', error.message);
    return {
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      costUsd: 0,
      periodStart,
      periodEnd: startOfNextMonthUTC(),
    };
  }

  const totals = (data || []).reduce(
    (acc, row) => {
      acc.tokensInput += Number(row.tokens_input || 0);
      acc.tokensOutput += Number(row.tokens_output || 0);
      acc.tokensTotal += Number(row.tokens_total || 0);
      acc.costUsd += Number(row.cost_usd || 0);
      return acc;
    },
    {
      tokensInput: 0,
      tokensOutput: 0,
      tokensTotal: 0,
      costUsd: 0,
    }
  );

  return {
    ...totals,
    costUsd: Number(totals.costUsd.toFixed(6)),
    periodStart,
    periodEnd: startOfNextMonthUTC(),
  };
}

async function getUsageLimit(guildId) {
  const limits = await configManager.getSubscriptionLimits(guildId);
  if (!limits) {
    return -1;
  }

  const raw = limits.ai_tokens_monthly;
  if (raw === null || raw === undefined) {
    return -1;
  }

  const value = Number(raw);
  if (Number.isNaN(value)) {
    return -1;
  }
  return value;
}

async function ensureWithinQuota(guildId) {
  const [summary, limit] = await Promise.all([getMonthlyUsage(guildId), getUsageLimit(guildId)]);

  const response = {
    allowed: true,
    limitTokens: limit,
    summary,
  };

  if (limit >= 0 && summary.tokensTotal >= limit) {
    response.allowed = false;
  }

  return response;
}

async function getUsageHistory(guildId, { limit = 20 } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('id, created_at, provider, model, tokens_input, tokens_output, tokens_total, cost_usd, task_type, metadata')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[AI Usage] Failed to fetch usage history:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    provider: row.provider,
    model: row.model,
    task_type: row.task_type,
    tokens_input: Number(row.tokens_input || 0),
    tokens_output: Number(row.tokens_output || 0),
    tokens_total: Number(row.tokens_total || 0),
    cost_usd: Number(row.cost_usd || 0),
    metadata: row.metadata || {},
  }));
}

module.exports = {
  getMonthlyUsage,
  getUsageLimit,
  ensureWithinQuota,
  getUsageHistory,
};

