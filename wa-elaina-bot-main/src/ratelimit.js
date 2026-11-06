'use strict';

/**
 * Rate limiter sederhana berbasis Map untuk menahan command berat
 * (!news, !cosplay, unduh episode) agar tidak dispam.
 */
class RateLimiter {
  constructor(options = {}) {
    const max = Number(options.maxEntries);
    this.maxEntries = Number.isFinite(max) && max > 0 ? Math.floor(max) : 2000;
    this.last = new Map();
    this.checks = 0;
  }

  /**
   * @returns {{allowed: boolean, retryMs: number}}
   */
  take(key, windowMs) {
    const k = String(key || '');
    const win = Math.max(0, Number(windowMs) || 0);
    if (!k || win <= 0) return { allowed: true, retryMs: 0 };

    const now = Date.now();
    const prev = this.last.get(k) || 0;
    const elapsed = now - prev;
    if (prev && elapsed < win) {
      return { allowed: false, retryMs: win - elapsed };
    }

    this.last.set(k, now);
    this.checks += 1;
    if (this.checks % 200 === 0) this._sweep(now, win);
    return { allowed: true, retryMs: 0 };
  }

  reset(key) {
    this.last.delete(String(key || ''));
  }

  _sweep(now, windowMs) {
    for (const [key, at] of this.last) {
      if (now - at > Math.max(windowMs, 5 * 60 * 1000)) this.last.delete(key);
    }
    if (this.last.size <= this.maxEntries) return;
    const excess = this.last.size - this.maxEntries;
    let i = 0;
    for (const key of this.last.keys()) {
      this.last.delete(key);
      if (++i >= excess) break;
    }
  }

  get size() {
    return this.last.size;
  }
}

module.exports = { RateLimiter };
