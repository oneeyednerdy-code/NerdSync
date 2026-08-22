'use strict';

class NerdSyncRequestManager {
  constructor({ maxConcurrent = 8 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.queue = [];
    this.total = 0;
    this.completed = 0;
    this.cancelled = 0;
    this.failed = 0;
    this.cacheHits = 0;
    this.rateLimit = null;
    this.rateRemaining = null;
    this.rateResetAt = 0;
  }

  async acquire(signal) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      this.total += 1;
      return;
    }
    await new Promise((resolve, reject) => {
      const item = { resolve, reject, signal };
      const abort = () => {
        this.queue = this.queue.filter(entry => entry !== item);
        this.cancelled += 1;
        reject(new DOMException('Request cancelled', 'AbortError'));
      };
      item.abort = abort;
      signal?.addEventListener('abort', abort, { once:true });
      this.queue.push(item);
    });
    this.active += 1;
    this.total += 1;
  }

  release(outcome = 'completed') {
    this.active = Math.max(0, this.active - 1);
    if (outcome === 'cancelled') this.cancelled += 1;
    else if (outcome === 'failed') this.failed += 1;
    else this.completed += 1;
    while (this.queue.length && this.active < this.maxConcurrent) {
      const next = this.queue.shift();
      next.signal?.removeEventListener('abort', next.abort);
      if (next.signal?.aborted) {
        this.cancelled += 1;
        next.reject(new DOMException('Request cancelled', 'AbortError'));
        continue;
      }
      next.resolve();
      break;
    }
  }

  updateRate(headers) {
    const limit = Number(headers?.get?.('Ratelimit-Limit'));
    const remaining = Number(headers?.get?.('Ratelimit-Remaining'));
    const resetSeconds = Number(headers?.get?.('Ratelimit-Reset'));
    if (Number.isFinite(limit)) this.rateLimit = limit;
    if (Number.isFinite(remaining)) this.rateRemaining = remaining;
    if (Number.isFinite(resetSeconds) && resetSeconds > 0) this.rateResetAt = resetSeconds * 1000;
  }

  async respectRateBudget(signal) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (!Number.isFinite(this.rateRemaining) || this.rateRemaining > 2 || this.rateResetAt <= Date.now()) return;
    const waitMs = Math.min(5000, Math.max(250, this.rateResetAt - Date.now()));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, waitMs);
      const abort = () => { clearTimeout(timer); reject(new DOMException('Request cancelled', 'AbortError')); };
      signal?.addEventListener('abort', abort, { once:true });
    });
  }

  markCacheHit() { this.cacheHits += 1; }

  snapshot() {
    return {
      active:this.active,
      queued:this.queue.length,
      maxConcurrent:this.maxConcurrent,
      total:this.total,
      completed:this.completed,
      failed:this.failed,
      cancelled:this.cancelled,
      cacheHits:this.cacheHits,
      rateLimit:this.rateLimit,
      rateRemaining:this.rateRemaining,
      rateResetAt:this.rateResetAt || null,
    };
  }
}

const nerdSyncRequestManager = new NerdSyncRequestManager({ maxConcurrent:8 });
