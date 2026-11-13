'use strict';

const log = require('./logger');
const http = require('http');
const { destJid, onlyDigits } = require('./util');
const wa = require('./wa');
const metrics = require('./metrics');
const { downloadQueue } = require('./downloadqueue');
const kaguya = require('./kaguya');
const { featureList } = require('./featurescatalog');
const { version: VERSION } = require('../package.json');

function clientIP(req) {
  const xff = String(req.headers['x-forwarded-for'] || '');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return 'ip:' + first;
  }
  const addr = String(req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : '');
  const host = addr.includes(':') ? addr.replace(/:\d+$/, '') : addr;
  return 'ip:' + (host || addr);
}

function toJid(to) {
  const raw = String(to || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return destJid(raw);
  const digits = onlyDigits(raw);
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    let done = false;
    let overflow = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    req.on('data', (chunk) => {
      if (overflow) return;
      size += chunk.length;
      if (size > limit) {
        overflow = true;
        data = '';
        return;
      }
      data += chunk.toString('utf8');
    });
    req.on('end', () => finish(overflow ? '' : data));
    req.on('error', () => finish(''));
  });
}

class HttpApi {
  constructor(cfg, isReady) {
    this.cfg = cfg;
    this.isReady = isReady;
    this.rateCap = Math.max(1, Number(cfg.sendRatePerMin) || 10);
    this.buckets = new Map();
    this.server = null;
    // Origin yang diizinkan untuk landing page. `*` aman untuk endpoint
    // status publik; batasi bila ingin hanya domain tertentu.
    this.corsOrigin = String(cfg.corsOrigin || '*').trim() || '*';
    this.catalogCounts = null;
  }

  corsHeaders() {
    return {
      'Access-Control-Allow-Origin': this.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }

  catalogStats() {
    if (this.catalogCounts) return this.catalogCounts;
    let categories = 0;
    let commands = 0;
    try {
      const catalog = kaguya.getCatalog();
      categories = catalog && Array.isArray(catalog.categories) ? catalog.categories.length : 0;
      commands = catalog && catalog.byCommand ? catalog.byCommand.size : 0;
    } catch {
      /* katalog belum siap; biarkan 0 */
    }
    let features = 0;
    try {
      features = featureList().length;
    } catch {
      /* abaikan */
    }
    this.catalogCounts = { categories, commands, features };
    return this.catalogCounts;
  }

  publicStatus() {
    const snap = metrics.snapshot();
    const counts = this.catalogStats();
    return {
      ok: true,
      bot: (this.cfg && this.cfg.botName) || 'Tsukasa',
      version: VERSION,
      uptimeSec: Math.floor(process.uptime()),
      waReady: Boolean(this.isReady()),
      categories: counts.categories,
      commands: counts.commands,
      features: counts.features,
      counters: {
        messages: snap.counters.messages,
        commands: snap.counters.commands,
      },
      time: new Date().toISOString(),
    };
  }

  allow(key) {
    const now = Date.now();
    // Buang bucket lama agar Map tidak tumbuh tanpa batas saat banyak IP.
    if (this.buckets.size > 1000) {
      for (const [k, v] of this.buckets) {
        if (now - v.lastRefill > 10 * 60000 && v.tokens >= this.rateCap) {
          this.buckets.delete(k);
        }
      }
    }
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.rateCap, lastRefill: now };
      this.buckets.set(key, b);
    } else {
      const elapsedMin = (now - b.lastRefill) / 60000;
      if (elapsedMin > 0) {
        b.tokens = Math.min(this.rateCap, b.tokens + elapsedMin * this.rateCap);
        b.lastRefill = now;
      }
    }
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  send(res, status, body, type) {
    res.writeHead(status, {
      'Content-Type': type || 'text/plain; charset=utf-8',
      ...this.corsHeaders(),
    });
    res.end(body);
  }

  async handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, this.corsHeaders());
      res.end();
      return;
    }

    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      this.send(res, 400, 'bad request');
      return;
    }

    if (url.pathname === '/' || url.pathname === '/healthz') {
      this.send(res, 200, 'ok');
      return;
    }

    if (url.pathname === '/status') {
      // Endpoint publik untuk landing page. Tidak memuat data sensitif dan
      // tidak memerlukan API key; CORS diatur lewat HTTP_CORS_ORIGIN.
      this.send(
        res,
        200,
        JSON.stringify(this.publicStatus()),
        'application/json; charset=utf-8'
      );
      return;
    }

    if (url.pathname === '/help') {
      this.send(
        res,
        200,
        'Endpoints:\n' +
          'GET /healthz -> ok\n' +
          'GET /status -> status publik bot (JSON)\n' +
          'GET /metrics -> metrik runtime (JSON)\n' +
          'GET /help -> bantuan ini\n' +
          'POST/GET /send?to=62xxxx&text=... (Header: X-API-Key)\n'
      );
      return;
    }

    if (url.pathname === '/metrics') {
      // Metrik memuat pesan error terakhir; lindungi dengan API key yang sama
      // bila SEND_API_KEY dikonfigurasi.
      if (this.cfg.sendApiKey && req.headers['x-api-key'] !== this.cfg.sendApiKey) {
        this.send(res, 401, 'unauthorized');
        return;
      }
      const snap = metrics.snapshot();
      const body = JSON.stringify({
        ...snap,
        waReady: Boolean(this.isReady()),
        downloadQueue: downloadQueue.status(),
      });
      this.send(res, 200, body, 'application/json; charset=utf-8');
      return;
    }

    if (url.pathname !== '/send') {
      this.send(res, 404, 'not found');
      return;
    }

    if (this.cfg.sendApiKey && req.headers['x-api-key'] !== this.cfg.sendApiKey) {
      this.send(res, 401, 'unauthorized');
      return;
    }

    if (!this.allow(clientIP(req))) {
      this.send(res, 429, 'rate limit');
      return;
    }

    let to = url.searchParams.get('to') || '';
    let text = url.searchParams.get('text') || '';

    if (req.method === 'POST' && (!to || !text)) {
      const raw = await readBody(req);
      if (raw) {
        try {
          const body = JSON.parse(raw);
          if (!to && body.to) to = String(body.to);
          if (!text && body.text) text = String(body.text);
        } catch {
          /* body bukan JSON; abaikan */
        }
      }
    }

    if (!to || !text) {
      this.send(res, 400, "need 'to' & 'text'");
      return;
    }

    if (!this.isReady()) {
      this.send(res, 503, 'WA not ready');
      return;
    }

    const jid = toJid(to);
    if (!jid) {
      this.send(res, 400, 'invalid destination');
      return;
    }

    try {
      await wa.sendText(jid, text);
      this.send(res, 200, 'sent');
    } catch (err) {
      this.send(res, 500, err.message || 'send failed');
    }
  }

  start() {
    if (this.server) return this.server;
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        log.error('[HTTP] error:', err.message);
        try {
          this.send(res, 500, 'internal error');
        } catch {
          /* ignore */
        }
      });
    });
    this.server.on('error', (err) => log.error('[HTTP] server error:', err.message));
    const port = Number(this.cfg.port) || 7860;
    const host = this.cfg.host || '0.0.0.0';
    this.server.listen(port, host, () => {
      log.info(`[HTTP] listening on ${host}:${port}`);
      log.info(`[READY] Tsukasa HTTP API aktif di port ${port}`);
    });
    return this.server;
  }
}

module.exports = { HttpApi, clientIP, toJid };
