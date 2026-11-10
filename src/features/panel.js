'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const log = require('../logger');
const wa = require('../wa');
const { formatDateTime } = require('../util');

const COMMANDS = new Set(['panel', 'server']);
const DEFAULT_APP_DIR = path.resolve(__dirname, '..', '..');
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const CHECK_TIMEOUT_MS = 2 * 60 * 1000;
const SCRIPT_TIMEOUT_MS = 5 * 60 * 1000;

function boolEnv(value, def = false) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'aktif', 'nyala'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'mati', 'nonaktif'].includes(v)) return false;
  return def;
}

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function tail(text, max = 3000) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return '…' + s.slice(-max);
}

function shortText(value, max = 400) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [];
  if (days) parts.push(`${days}h`);
  if (hours) parts.push(`${hours}j`);
  if (mins) parts.push(`${mins}m`);
  if (!parts.length || secs) parts.push(`${secs}d`);
  return parts.join(' ');
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Kontrol panel/server langsung dari WhatsApp.
 *
 * Sengaja hanya berisi aksi whitelist (bukan shell bebas) dan hanya untuk
 * owner di chat pribadi. Output command dibatasi agar tidak membanjiri chat.
 */
class PanelFeature {
  constructor(cfg, options = {}) {
    this.cfg = cfg || {};
    this.updater = options.updater || null;
    this.appDir = options.appDir || DEFAULT_APP_DIR;
    this.busy = null;
    this.lastAction = '';
    this.lastActionAt = 0;
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  async reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  async say(chat, text) {
    return wa.sendText(chat, text).catch((err) => {
      log.warn('[PANEL] gagal kirim hasil:', err.message);
    });
  }

  _run(cmd, args, timeout) {
    return new Promise((resolve) => {
      execFile(
        cmd,
        args,
        {
          cwd: this.appDir,
          timeout,
          maxBuffer: 8 * 1024 * 1024,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        },
        (err, stdout, stderr) => {
          resolve({
            ok: !err,
            code: err && typeof err.code === 'number' ? err.code : err ? 1 : 0,
            stdout: String(stdout || ''),
            stderr: String(stderr || ''),
            error: err ? err.message : '',
            timedOut: Boolean(err && err.killed),
          });
        }
      );
    });
  }

  _npm(args, timeout) {
    return this._run(npmBin(), args, timeout);
  }

  packageInfo() {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.appDir, 'package.json'), 'utf8'));
      return {
        name: raw.name || '-',
        version: raw.version || '-',
        scripts: raw.scripts && typeof raw.scripts === 'object' ? raw.scripts : {},
      };
    } catch {
      return { name: '-', version: '-', scripts: {} };
    }
  }

  async npmVersion() {
    const res = await this._run(npmBin(), ['--version'], 10000);
    return res.ok ? res.stdout.trim() : '-';
  }

  _setBusy(label) {
    this.busy = label;
    this.lastAction = label;
    this.lastActionAt = Date.now();
  }

  _clearBusy() {
    this.busy = null;
  }

  helpText() {
    return [
      '🛠️ *Kontrol Panel (khusus owner)*',
      '',
      '• .panel status — status bot, server, dan repo',
      '• .panel logs [jumlah] — log terakhir (default 20, maks 40)',
      '• .panel install — jalankan npm install (production)',
      '• .panel check — cek sintaks semua file (npm run check)',
      '• .panel run <script> — jalankan script package.json',
      '• .panel npm <argumen> — mis. .panel npm run check',
      '• .panel restart — restart lewat Pterodactyl API',
      '• .panel start — alias restart',
      '• .panel restart force — keluar paksa (panel harus auto-restart)',
      '',
      'Hanya bisa dipakai owner di chat pribadi.',
      'Aksi yang berjalan bersamaan akan ditolak.',
    ].join('\n');
  }

  async handleStatus(m) {
    const pkg = this.packageInfo();
    const mem = process.memoryUsage();
    const line = ['🖥️ *Status Panel*'];
    line.push(`• Bot      : ${pkg.name} v${pkg.version}`);
    line.push(`• PID      : ${process.pid}`);
    line.push(`• Uptime   : ${formatUptime(process.uptime())}`);
    line.push(`• Node     : ${process.version}`);
    line.push(`• NPM      : ${await this.npmVersion()}`);
    line.push(`• Platform : ${os.platform()} ${os.arch()}`);
    line.push(`• RAM      : RSS ${formatBytes(mem.rss)} | Heap ${formatBytes(mem.heapUsed)}`);
    try {
      const load = os.loadavg().map((n) => n.toFixed(2)).join(' / ');
      line.push(`• Load     : ${load}`);
    } catch {
      /* loadavg tidak tersedia di semua platform */
    }
    line.push(`• Folder   : ${this.appDir}`);
    try {
      const disk = await fs.promises.statfs(this.appDir);
      const total = Number(disk.blocks) * Number(disk.bsize);
      const free = Number(disk.bavail) * Number(disk.bsize);
      line.push(`• Disk     : ${formatBytes(free)} bebas / ${formatBytes(total)}`);
    } catch {
      /* statfs tidak tersedia di semua platform */
    }
    line.push(
      `• NPM deps : ${fs.existsSync(path.join(this.appDir, 'node_modules')) ? 'terpasang' : 'belum ada'}`
    );
    if (this.updater) {
      line.push(
        `• Restart  : ${this.updater.restartMode}${
          this.updater.restartMode === 'api'
            ? this.updater.restartReady
              ? ' (siap)'
              : ' (PTERO_* belum lengkap)'
            : ''
        }`
      );
      const repo = await this.updater.repo().catch((err) => ({ ok: false, error: err.message }));
      if (repo && repo.ok) {
        line.push(`• Repo     : ${repo.localShort} (${repo.branch})`);
        line.push(`• Lokal    : ${repo.dirty ? `ada ${repo.dirtyFiles.length} file berubah` : 'bersih'}`);
      } else if (repo && repo.error) {
        line.push(`• Repo     : ${shortText(repo.error, 180)}`);
      }
    }
    line.push(`• Log DB   : ${log.dbPath}`);
    if (this.busy) {
      line.push('', `⏳ Sedang berjalan: ${this.busy}`);
    } else if (this.lastAction && this.lastActionAt) {
      line.push(
        '',
        `Terakhir: ${this.lastAction} (${formatDateTime(this.lastActionAt, this.cfg.timezone)})`
      );
    }
    await this.reply(m, line.join('\n'));
  }

  async handleLogs(m, raw) {
    const parts = String(raw || '').trim().split(/\s+/).filter(Boolean);
    const count = Math.max(1, Math.min(40, parseInt(parts[0], 10) || 20));
    const level = (parts[1] || '').toLowerCase();
    let rows = log.recent(100);
    if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
      rows = rows.filter((row) => String(row.level || '').toLowerCase() === level);
    }
    rows = rows.slice(-count);
    if (!rows.length) {
      await this.reply(
        m,
        '📝 Belum ada log tersimpan. Log database hanya menyimpan level warn/error ' +
          '(atur lewat LOG_DB_LEVEL).'
      );
      return;
    }
    const lines = [`📝 *Log terakhir (${rows.length})*`];
    for (const row of rows) {
      const tag = row.tag ? `[${row.tag}] ` : '';
      lines.push(
        `• ${row.timeLocal || row.time || '-'} [${String(row.level || '').toUpperCase()}] ${tag}${shortText(
          row.message,
          320
        )}`
      );
    }
    const text = lines.join('\n');
    await this.reply(m, text.length > 3800 ? text.slice(0, 3800) + '\n…' : text);
  }

  async handleInstall(m, chat) {
    if (this.busy) {
      await this.reply(m, `⏳ Masih ada proses berjalan: ${this.busy}`);
      return;
    }
    this._setBusy('npm install');
    await this.reply(
      m,
      '📦 Menjalankan `npm install --omit=dev`...\nProses bisa memakan beberapa menit. ' +
        'Hasil akan dikirim setelah selesai.'
    );
    log.info('[PANEL] owner memulai npm install');
    const res = await this._npm(['install', '--omit=dev', '--no-audit', '--no-fund'], INSTALL_TIMEOUT_MS);
    this._clearBusy();
    const output = tail(res.stdout || res.stderr || res.error);
    if (res.ok) {
      const lines = ['✅ *npm install selesai*'];
      if (output) lines.push('', output);
      lines.push('', 'Jalankan `.panel restart` agar dependency baru dipakai.');
      await this.say(chat, lines.join('\n'));
    } else {
      await this.say(
        chat,
        [
          `❌ *npm install gagal*${res.timedOut ? ' (timeout)' : ''}`,
          `Exit: ${res.code}`,
          output ? `\n${output}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
    log.info(`[PANEL] npm install selesai: ${res.ok ? 'ok' : 'gagal'} (${res.code})`);
  }

  async handleCheck(m, chat) {
    if (this.busy) {
      await this.reply(m, `⏳ Masih ada proses berjalan: ${this.busy}`);
      return;
    }
    this._setBusy('npm run check');
    await this.reply(m, '🔎 Menjalankan `npm run check`...');
    const res = await this._npm(['run', 'check'], CHECK_TIMEOUT_MS);
    this._clearBusy();
    const output = tail(res.stdout || res.stderr || res.error, 2500);
    if (res.ok) {
      await this.say(chat, ['✅ *Cek sintaks lolos*', output ? `\n${output}` : ''].join('\n'));
    } else {
      await this.say(
        chat,
        [`❌ *Cek sintaks gagal*${res.timedOut ? ' (timeout)' : ''}`, output || res.error]
          .filter(Boolean)
          .join('\n')
      );
    }
  }

  async handleRunScript(m, chat, raw) {
    const name = String(raw || '').trim().split(/\s+/)[0];
    if (!name) {
      await this.reply(m, 'Gunakan: `.panel run <script>` atau `.panel npm run <script>`.');
      return;
    }
    const pkg = this.packageInfo();
    const wanted = String(name).toLowerCase();
    const script = Object.keys(pkg.scripts).find((key) => key.toLowerCase() === wanted);
    if (!script) {
      await this.reply(
        m,
        `Script \`${name}\` tidak ada. Tersedia: ${
          Object.keys(pkg.scripts).join(', ') || '-'
        }`
      );
      return;
    }
    if (/^(pre|post)?start$/.test(script)) {
      await this.reply(
        m,
        '⚠️ Script `start` tidak dijalankan dari sini karena akan membuat instance bot kedua. ' +
          'Gunakan `.panel restart`.'
      );
      return;
    }
    if (this.busy) {
      await this.reply(m, `⏳ Masih ada proses berjalan: ${this.busy}`);
      return;
    }
    this._setBusy(`npm run ${script}`);
    await this.reply(m, `▶️ Menjalankan \`npm run ${script}\`...`);
    const res = await this._npm(['run', script], SCRIPT_TIMEOUT_MS);
    this._clearBusy();
    const output = tail(res.stdout || res.stderr || res.error, 2800);
    await this.say(
      chat,
      [
        `${res.ok ? '✅' : '❌'} *npm run ${script}*${res.ok ? '' : ` (exit ${res.code})`}`,
        output ? `\n${output}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  async handleNpm(m, chat, raw) {
    const parts = String(raw || '').trim().split(/\s+/).filter(Boolean);
    const sub = (parts[0] || '').toLowerCase();
    if (!sub) {
      await this.reply(m, 'Gunakan: `.panel npm run check` atau `.panel npm install`.');
      return;
    }
    if (sub === 'install' || sub === 'i') {
      await this.handleInstall(m, chat);
      return;
    }
    if (sub === 'run' || sub === 'run-script') {
      await this.handleRunScript(m, chat, parts.slice(1).join(' '));
      return;
    }
    await this.reply(m, 'Hanya `panel npm install` dan `panel npm run <script>` yang diizinkan.');
  }

  async handleRestart(m, chat, force) {
    if (this.busy) {
      await this.reply(m, `⏳ Masih ada proses berjalan: ${this.busy}`);
      return;
    }
    if (!force && !this.updater) {
      await this.reply(m, '⚠️ Modul updater/panel belum siap.');
      return;
    }

    if (force) {
      await this.reply(
        m,
        '♻️ Bot akan keluar paksa dalam 2 detik.\n' +
          'Panel harus dikonfigurasi auto-restart, jika tidak bot tetap mati dan harus dinyalakan manual.'
      );
      log.warn('[PANEL] owner meminta restart paksa (exit)');
      const timer = setTimeout(() => process.exit(1), 2000);
      if (timer.unref) timer.unref();
      return;
    }

    await this.reply(m, '♻️ Meminta panel me-restart bot...');
    log.info('[PANEL] owner meminta restart panel');
    const res = await this.updater.restart();
    if (res.ok && res.action === 'api') {
      await this.say(chat, '✅ Permintaan restart dikirim ke panel. Bot akan tersambung lagi sebentar.');
      return;
    }
    if (res.ok && res.action === 'exit') {
      await this.say(
        chat,
        '✅ Bot akan keluar agar panel me-restart otomatis. Jika tidak kembali, nyalakan manual dari panel.'
      );
      return;
    }
    if (res.ok && res.action === 'none') {
      await this.reply(
        m,
        '⚠️ Restart otomatis belum aktif (`AUTO_UPDATE_RESTART_MODE=none`).\n' +
          'Isi PTERO_URL/PTERO_CLIENT_KEY/PTERO_SERVER_ID lalu `.panel restart`, ' +
          'atau gunakan `.panel restart force` bila panel auto-restart saat crash.'
      );
      return;
    }
    await this.reply(
      m,
      `❌ Restart gagal: ${shortText(res.error || 'tidak diketahui', 500)}\n\n` +
        'Isi PTERO_* lewat `.config set`, atau gunakan `.panel restart force` ' +
        'bila panel auto-restart saat crash.'
    );
  }

  async handle(sock, m, rest, isOwner) {
    if (!isOwner) {
      await this.reply(m, '🔒 Kontrol panel hanya untuk owner bot.');
      return true;
    }
    const chat = m.key.remoteJid;
    if (!chat || String(chat).endsWith('@g.us')) {
      await this.reply(m, '🔒 Kontrol panel hanya bisa dipakai lewat chat pribadi owner.');
      return true;
    }

    if (boolEnv('PANEL_DISABLED', false)) {
      await this.reply(m, '⚠️ Kontrol panel dinonaktifkan lewat PANEL_DISABLED=true.');
      return true;
    }

    const raw = String(rest || '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || 'status').toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (sub) {
      case 'help':
      case 'bantuan':
      case 'cara':
        await this.reply(m, this.helpText());
        return true;
      case 'status':
      case 'info':
        await this.handleStatus(m);
        return true;
      case 'logs':
      case 'log':
        await this.handleLogs(m, args);
        return true;
      case 'install':
      case 'npm-install':
        await this.handleInstall(m, chat);
        return true;
      case 'check':
      case 'syntax':
        await this.handleCheck(m, chat);
        return true;
      case 'run':
      case 'script':
        await this.handleRunScript(m, chat, args);
        return true;
      case 'npm':
        await this.handleNpm(m, chat, args);
        return true;
      case 'restart':
      case 'start':
      case 'up':
      case 'nyalakan':
      case 'hidupkan':
        await this.handleRestart(m, chat, /^(force|paksa)$/i.test(args));
        return true;
      default:
        await this.reply(
          m,
          `Subperintah \`${sub}\` tidak dikenal.\n\n${this.helpText()}`
        );
        return true;
    }
  }
}

module.exports = { PanelFeature };
