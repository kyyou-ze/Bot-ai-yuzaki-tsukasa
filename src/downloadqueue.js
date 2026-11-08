'use strict';

const log = require('./logger');
const metrics = require('./metrics');

function envInt(name, fallback, min, max) {
  const n = parseInt(String(process.env[name] || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Antrean unduhan global. Dipakai oleh download media WhatsApp dan HTTP agar
 * banyak permintaan berat tidak menghabiskan RAM/bandwidth sekaligus.
 */
class DownloadQueue {
  constructor(options = {}) {
    this._concurrency = Math.max(
      1,
      Math.min(10, Number(options.concurrency) || envInt('DOWNLOAD_QUEUE_CONCURRENCY', 2, 1, 10))
    );
    this.queue = [];
    this.running = [];
    this.lastError = '';
  }

  get concurrency() {
    return this._concurrency;
  }

  setConcurrency(value) {
    const n = Math.max(1, Math.min(10, Number(value) || this._concurrency));
    this._concurrency = n;
    this._pump();
  }

  run(label, task) {
    if (typeof task !== 'function') return Promise.reject(new Error('task harus function'));
    return new Promise((resolve, reject) => {
      this.queue.push({ label: String(label || 'download'), task, resolve, reject });
      metrics.inc('downloads');
      this._pump();
    });
  }

  _pump() {
    while (this.running.length < this._concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this.running.push(job);
      Promise.resolve()
        .then(job.task)
        .then(
          (value) => {
            metrics.inc('downloadsCompleted');
            job.resolve(value);
          },
          (err) => {
            metrics.inc('downloadsFailed');
            this.lastError = String((err && err.message) || err || 'download gagal').slice(0, 300);
            job.reject(err);
          }
        )
        .finally(() => {
          const idx = this.running.indexOf(job);
          if (idx >= 0) this.running.splice(idx, 1);
          this._pump();
        });
    }
  }

  status() {
    return {
      concurrency: this._concurrency,
      active: this.running.length,
      pending: this.queue.length,
      labels: this.running.map((job) => job.label).slice(0, 20),
      lastError: this.lastError,
    };
  }
}

const downloadQueue = new DownloadQueue();

module.exports = { DownloadQueue, downloadQueue };
