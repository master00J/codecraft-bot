const EventEmitter = require('events');
const config = require('./config');

/**
 * Lightweight in-process task queue with concurrency control.
 * We use a custom implementation instead of p-queue because
 * the production bot currently runs on Node 18 (CommonJS) while
 * p-queue is ESM-only on recent versions.
 *
 * When the runtime is upgraded to Node 20+ we can switch back
 * to p-queue if desired.
 */
class AiTaskQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    const queueConfig = config.getQueueConfig();

    this.concurrency = options.concurrency || queueConfig.concurrency;
    this.timeoutMs = options.timeoutMs || queueConfig.timeoutMs;

    this.queue = [];
    this.activeCount = 0;
    this.pending = 0;

    this.isProcessing = false;
  }

  add(task, meta = {}) {
    this.emit('queued', meta);
    return new Promise((resolve, reject) => {
      const job = { task, meta, resolve, reject };
      this.queue.push(job);
      this.pending = this.queue.length;
      this._process();
    });
  }

  _process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const loop = async () => {
      while (this.activeCount < this.concurrency && this.queue.length > 0) {
        const job = this.queue.shift();
        this.pending = this.queue.length;
        this._runJob(job);
      }
      this.isProcessing = false;
    };

    setImmediate(loop);
  }

  _runJob(job) {
    const { task, meta, resolve, reject } = job;
    const start = Date.now();
    this.activeCount += 1;
    this.emit('start', { meta });

    const timeout = this.timeoutMs > 0
      ? setTimeout(() => {
          const error = new Error(`AI task timed out after ${this.timeoutMs}ms`);
          this.emit('error', { meta, error, durationMs: Date.now() - start });
          this.activeCount -= 1;
          reject(error);
          this._process();
        }, this.timeoutMs)
      : null;

    const run = async () => {
      try {
        const result = await task();
        if (timeout) clearTimeout(timeout);
        this.emit('success', { meta, durationMs: Date.now() - start });
        resolve(result);
      } catch (error) {
        if (timeout) clearTimeout(timeout);
        this.emit('error', { meta, error, durationMs: Date.now() - start });
        reject(error);
      } finally {
        this.activeCount -= 1;
        if (this.activeCount === 0 && this.queue.length === 0) {
          this.emit('idle');
        } else {
          this.emit('active', this.queue.length);
        }
        this._process();
      }
    };

    run().catch((error) => {
      console.error('[AI Queue] Unexpected failure running job', error);
    });
  }
}

module.exports = new AiTaskQueue();

