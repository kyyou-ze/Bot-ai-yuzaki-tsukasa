'use strict';

/**
 * Cloudflare Tunnel opsional.
 *
 * Berguna saat bot berjalan di hosting Pterodactyl tanpa akses root: bot tetap
 * bisa punya URL HTTPS publik (mis. https://bot.goyomi.my.id) tanpa membuka
 * port atau memasang reverse proxy di host. cloudflared dijalankan sebagai
 * proses anak dan hanya butuh koneksi keluar.
 *
 * Aktif bila CLOUDFLARE_TUNNEL_TOKEN diisi. Binary cloudflared diunduh sekali
 * ke data/bin/ lalu dipakai ulang saat restart.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const log = require('./logger');

const BIN_DIR = path.resolve(process.cwd(), 'data', 'bin');
const ARCH_MAP = { x64: 'amd64', arm64: 'arm64', arm: 'arm' };
const ARCH = ARCH_MAP[process.arch] || '';
const DOWNLOAD_TIMEOUT_MS = 120000;
const RESTART_MAX_DELAY_MS = 60000;

let child = null;
let starting = false;
let stopping = false;
let attempts = 0;
let lastError = '';

function enabled() {
  return String(process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim() !== '';
}

function binaryFile() {
  const custom = String(process.env.CLOUDFLARE_TUNNEL_BIN || '').trim();
  if (custom) return path.resolve(custom);
  return path.join(BIN_DIR, `cloudflared-linux-${ARCH || 'amd64'}`);
}

async function ensureBinary() {
  const file = binaryFile();
  const custom = String(process.env.CLOUDFLARE_TUNNEL_BIN || '').trim();
  try {
    const stat = fs.statSync(file);
    if (custom ? stat.isFile() : stat.isFile() && stat.size > 1024 * 1024) return file;
  } catch {
    /* belum ada, unduh di bawah */
  }
  if (custom) throw new Error(`CLOUDFLARE_TUNNEL_BIN tidak ditemukan: ${file}`);
  if (!ARCH) throw new Error(`arsitektur ${process.arch} belum didukung`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.download`;
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}`;
  log.info(`[TUNNEL] mengunduh cloudflared untuk linux-${ARCH}...`);
  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxRedirects: 5,
    headers: { 'User-Agent': 'tsukasa-bot' },
  });
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    res.data.pipe(out);
    res.data.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
  });
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, file);
  log.info('[TUNNEL] cloudflared siap dipakai.');
  return file;
}

function logLine(prefix, buf) {
  for (const line of String(buf).split(/\r?\n/)) {
    const text = line.trim();
    if (text) log.info(`${prefix} ${text.slice(0, 400)}`);
  }
}

function scheduleRestart() {
  if (stopping) return;
  attempts += 1;
  if (attempts > 12) {
    lastError = lastError || 'terlalu banyak percobaan';
    log.error('[TUNNEL] menyerah setelah 12 percobaan. Cek log di atas.');
    return;
  }
  const delay = Math.min(RESTART_MAX_DELAY_MS, 2000 * 2 ** Math.min(5, attempts - 1));
  log.warn(`[TUNNEL] mencoba lagi dalam ${Math.round(delay / 1000)} detik.`);
  const timer = setTimeout(() => {
    bootstrap().catch((err) => {
      lastError = err.message;
      log.error(`[TUNNEL] gagal: ${err.message}`);
      scheduleRestart();
    });
  }, delay);
  if (timer.unref) timer.unref();
}

function launch(file) {
  const token = String(process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim();
  const startedAt = Date.now();
  // Token dikirim lewat environment (TUNNEL_TOKEN), bukan argumen, supaya
  // tidak muncul di daftar proses.
  child = spawn(file, ['tunnel', '--no-autoupdate', 'run'], {
    env: { ...process.env, TUNNEL_TOKEN: token },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (buf) => logLine('[TUNNEL]', buf));
  child.stderr.on('data', (buf) => logLine('[TUNNEL]', buf));
  child.on('error', (err) => {
    lastError = err.message;
    log.error(`[TUNNEL] proses gagal dijalankan: ${err.message}`);
    child = null;
    scheduleRestart();
  });
  child.on('exit', (code, signal) => {
    const uptime = Date.now() - startedAt;
    child = null;
    if (stopping) return;
    if (uptime > 30000) attempts = 0;
    lastError = `cloudflared berhenti (${signal || code})`;
    log.warn(`[TUNNEL] cloudflared berhenti (${signal || code}).`);
    scheduleRestart();
  });
}

async function bootstrap() {
  if (stopping) return;
  const file = await ensureBinary();
  if (stopping) return;
  launch(file);
}

function start() {
  if (!enabled()) return { enabled: false };
  if (starting || child) return { enabled: true, running: Boolean(child) };
  starting = true;
  stopping = false;
  attempts = 0;
  lastError = '';
  log.info('[TUNNEL] Cloudflare Tunnel diaktifkan.');
  bootstrap()
    .catch((err) => {
      lastError = err.message;
      log.error(`[TUNNEL] gagal menyiapkan tunnel: ${err.message}`);
      scheduleRestart();
    })
    .finally(() => {
      starting = false;
    });
  return { enabled: true, starting: true };
}

function stop() {
  stopping = true;
  if (!child) return;
  try {
    child.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  child = null;
}

function status() {
  return {
    enabled: enabled(),
    running: Boolean(child),
    pid: child ? child.pid : null,
    error: lastError,
  };
}

module.exports = { enabled, start, stop, status };
