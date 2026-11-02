'use strict';

const http = require('http');
const { destJid, onlyDigits } = require('./util');
const wa = require('./wa');

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
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.destroy();
        resolve('');
        return;
      }
      data += chunk.toString('utf8');
    });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

class HttpApi {
  constructor(cfg, isReady) {
    this.cfg = cfg;
    this.isReady = isReady;
    this.rateCap = Math.max(1, Number(cfg.sendRatePerMin) || 10);
    this.buckets = new Map();
    this.server = null;
  }

  allow(key) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b) {
      this.buckets.set(key, { tokens: this.rateCap, lastRefill: now });
      return true;
    }
    const elapsedMin = (now - b.lastRefill) / 60000;
    if (elapsedMin > 0) {
      b.tokens = Math.min(this.rateCap, b.tokens + elapsedMin * this.rateCap);
      b.lastRefill = now;
    }
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  send(res, status, body, type) {
    res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
    res.end(body);
  }

  async handleRequest(req, res) {
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

    if (url.pathname === '/help') {
      this.send(
        res,
        200,
        'Endpoints:\n' +
          'GET /healthz -> ok\n' +
          'GET /help -> bantuan ini\n' +
          'POST/GET /send?to=62xxxx&text=... (Header: X-API-Key)\n'
      );
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
        console.error('[HTTP] error:', err.message);
        try {
          this.send(res, 500, 'internal error');
        } catch {
          /* ignore */
        }
      });
    });
    this.server.on('error', (err) => console.error('[HTTP] server error:', err.message));
    const port = Number(this.cfg.port) || 7860;
    const host = this.cfg.host || '0.0.0.0';
    this.server.listen(port, host, () => {
      console.log(`[HTTP] listening on ${host}:${port}`);
      console.log(`[READY] Tsukasa HTTP API aktif di port ${port}`);
    });
    return this.server;
  }
}

module.exports = { HttpApi, clientIP, toJid };
