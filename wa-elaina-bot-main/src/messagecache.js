'use strict';

/**
 * Cache pesan keluar/masuk berbasis LRU + TTL.
 *
 * Baileys memanggil `getMessage(key)` ketika perangkat penerima meminta ulang
 * sebuah pesan (retry receipt / dekripsi gagal). Kalau fungsi itu selalu
 * mengembalikan `undefined`, WhatsApp di sisi penerima menampilkan
 * "Menunggu pesan ini. Ini mungkin membutuhkan waktu beberapa saat."
 * Cache ini menyimpan pesan yang kita kirim supaya bisa disajikan ulang.
 */

const DEFAULT_MAX = 1500;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

class MessageCache {
  constructor(options = {}) {
    const max = Number(options.max);
    const ttl = Number(options.ttlMs);
    this.max = Number.isFinite(max) && max > 0 ? Math.floor(max) : DEFAULT_MAX;
    this.ttlMs = Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_TTL_MS;
    this.map = new Map();
    this.puts = 0;
  }

  _id(key) {
    if (!key) return '';
    if (typeof key === 'string') return key;
    return String(key.id || key.messageId || '');
  }

  put(key, message) {
    const id = this._id(key);
    if (!id || !message) return false;

    // Hapus dulu supaya urutan Map tetap LRU saat id yang sama diperbarui.
    if (this.map.has(id)) this.map.delete(id);
    this.map.set(id, { message, at: Date.now() });

    this.puts += 1;
    if (this.map.size > this.max) this._evict();
    if (this.puts % 100 === 0) this._sweep();
    return true;
  }

  get(key) {
    const id = this._id(key);
    if (!id) return undefined;
    const entry = this.map.get(id);
    if (!entry) return undefined;
    if (Date.now() - entry.at > this.ttlMs) {
      this.map.delete(id);
      return undefined;
    }
    return entry.message;
  }

  has(key) {
    return Boolean(this.get(key));
  }

  _evict() {
    while (this.map.size > this.max) {
      const first = this.map.keys().next();
      if (first.done) return;
      this.map.delete(first.value);
    }
  }

  _sweep() {
    const now = Date.now();
    for (const [id, entry] of this.map) {
      if (now - entry.at > this.ttlMs) this.map.delete(id);
    }
  }

  clear() {
    this.map.clear();
  }

  size() {
    return this.map.size;
  }
}

function ttlFromEnv() {
  const minutes = Number(process.env.MESSAGE_CACHE_TTL_MIN);
  if (Number.isFinite(minutes) && minutes > 0) return minutes * 60 * 1000;
  return DEFAULT_TTL_MS;
}

const messageCache = new MessageCache({
  max: Number(process.env.MESSAGE_CACHE_MAX) || DEFAULT_MAX,
  ttlMs: ttlFromEnv(),
});

module.exports = { MessageCache, messageCache, DEFAULT_MAX, DEFAULT_TTL_MS };
