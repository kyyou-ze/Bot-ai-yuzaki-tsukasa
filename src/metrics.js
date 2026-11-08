'use strict';

const startedAt = Date.now();

const counters = {
  messages: 0,
  commands: 0,
  ownerCommands: 0,
  errors: 0,
  reconnects: 0,
  downloads: 0,
  downloadsCompleted: 0,
  downloadsFailed: 0,
};

const gauges = {
  waReady: 0,
  reconnectAttempts: 0,
  reconnectDelayMs: 0,
  lastMessageAt: 0,
};

let lastError = null;

function inc(name, amount = 1) {
  if (!Object.prototype.hasOwnProperty.call(counters, name)) return;
  const n = Number(amount);
  if (!Number.isFinite(n)) return;
  counters[name] += n;
}

function setGauge(name, value) {
  if (!Object.prototype.hasOwnProperty.call(gauges, name)) return;
  gauges[name] = value;
}

function recordError(message, meta = {}) {
  const text = String(message || 'unknown error').replace(/\s+/g, ' ').slice(0, 500);
  lastError = {
    message: text,
    tag: String(meta.tag || ''),
    at: new Date().toISOString(),
  };
  inc('errors');
}

function snapshot() {
  const now = Date.now();
  return {
    startedAt,
    startedAtIso: new Date(startedAt).toISOString(),
    uptimeSec: Math.max(0, Math.floor((now - startedAt) / 1000)),
    counters: { ...counters },
    gauges: { ...gauges },
    lastError: lastError ? { ...lastError } : null,
  };
}

function reset() {
  for (const key of Object.keys(counters)) counters[key] = 0;
  lastError = null;
}

module.exports = { inc, setGauge, recordError, snapshot, reset, counters, gauges };
