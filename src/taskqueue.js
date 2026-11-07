'use strict';

/**
 * Antrean tugas dengan dua jaminan:
 * 1. Tugas dari chat yang sama dijalankan berurutan (menjaga konteks percakapan).
 * 2. Total tugas yang berjalan bersamaan dibatasi, tetapi chat berbeda tidak
 *    saling memblokir. Sebelumnya `messages.upsert` memakai `await` serial
 *    sehingga satu download TikTok/LLM lambat menahan semua chat lain.
 */

class TaskQueue {
  constructor(options = {}) {
    const concurrency = Number(options.concurrency);
    this.concurrency =
      Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 4;
    this.active = 0;
    this.running = new Set();
    this.queues = new Map();
    this.onError = typeof options.onError === 'function' ? options.onError : null;
  }

  push(key, task) {
    if (typeof task !== 'function') return;
    const k = String(key || '');
    const list = this.queues.get(k) || [];
    list.push(task);
    this.queues.set(k, list);
    this._pump();
  }

  _pump() {
    while (this.active < this.concurrency) {
      const key = this._nextKey();
      if (key === null) return;

      const list = this.queues.get(key);
      const task = list.shift();
      if (!list.length) this.queues.delete(key);

      this.running.add(key);
      this.active += 1;

      Promise.resolve()
        .then(task)
        .catch((err) => {
          if (this.onError) this.onError(err);
        })
        .finally(() => {
          this.active -= 1;
          this.running.delete(key);
          this._pump();
        });
    }
  }

  _nextKey() {
    for (const [key, list] of this.queues) {
      if (!list.length) {
        this.queues.delete(key);
        continue;
      }
      if (this.running.has(key)) continue;
      return key;
    }
    return null;
  }

  get pending() {
    let total = 0;
    for (const list of this.queues.values()) total += list.length;
    return total;
  }
}

module.exports = { TaskQueue };
