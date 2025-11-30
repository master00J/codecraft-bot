const config = require('./config');
const queue = require('./queue');
const registry = require('./provider-registry');
const usageTracker = require('./usage-tracker');

const geminiProvider = require('./providers/gemini');
const claudeProvider = require('./providers/claude');
const deepseekProvider = require('./providers/deepseek');

registry.register('gemini', geminiProvider);
registry.register('claude', claudeProvider);
registry.register('deepseek', deepseekProvider);

const listeners = {
  queue: [],
};

function onQueueEvent(event, handler) {
  listeners.queue.push({ event, handler });
  queue.on(event, handler);
}

function initQueueMonitoring() {
  if (listeners.queue.length > 0) {
    return;
  }
  onQueueEvent('error', ({ error, meta }) => {
    console.error('[AI Queue] task failed', meta, error?.message);
  });
}

async function runTask(type, payload, options = {}) {
  if (!config.isAiEnabled()) {
    throw new Error('AI features are disabled (AI_ENABLED=false).');
  }
  initQueueMonitoring();

  let provider;
  if (options.provider) {
    provider = registry.get(options.provider);
    if (!provider) {
      throw new Error(`Unknown AI provider "${options.provider}" requested.`);
    }
  } else {
    provider = registry.getPrimary();
  }

  if (!provider || !provider.isConfigured()) {
    throw new Error(`AI provider ${options.provider || 'primary'} is not configured.`);
  }

  const baseMeta = { type, provider: provider.name, ...(options.meta || {}) };
  const onStream = typeof options.onStream === 'function' ? options.onStream : null;

  return queue.add(async () => {
    let result;
    const runOnStream = (chunk, meta) => {
      if (!onStream) return;
      try {
        onStream(chunk, meta);
      } catch (error) {
        console.warn('[AI Service] onStream handler failed:', error.message);
      }
    };

    switch (type) {
      case 'generate':
        const guildModel = options.model || null;
        if (onStream && provider.supportsStreaming()) {
          result = await provider.generateStream(payload, { onStream: runOnStream }, guildModel);
        } else {
          result = await provider.generate(payload, guildModel);
          if (onStream && result?.text) {
            runOnStream('', { done: true, text: result.text });
          }
        }
        break;
      case 'moderate':
        result = await provider.moderate(payload);
        break;
      default:
        throw new Error(`Unknown AI task type: ${type}`);
    }

    if (baseMeta.guildId && result?.usage) {
      usageTracker
        .logUsage({
          guildId: baseMeta.guildId,
          provider: provider.name,
          model: result.model || (typeof provider.getModelName === 'function' ? provider.getModelName() : undefined),
          taskType: type,
          tokens: result.usage,
          metadata: {
            userId: baseMeta.userId,
            channelId: baseMeta.channelId,
          },
        })
        .catch((error) => {
          console.warn('[AI Usage] Logging failed:', error.message);
        });
    }

    return result;
  }, baseMeta);
}

module.exports = {
  runTask,
  registry,
  queue,
};

