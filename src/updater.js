'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const log = require('./logger');
const { fetchWithTimeout } = require('./util');

const DEFAULT_APP_DIR = path.resolve(__dirname, '..');
const GIT_TIMEOUT_MS = 2 * 60 * 1000;
const NPM_TIMEOUT_MS = 10 * 60 * 1000;

function envStr(key, def = '') {
  const v = process.env[key];
  return v === undefined ? def : String(v).trim();
}

function boolEnv(key, def = false) {
  const v = envStr(key, '').toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'aktif', 'nyala', 'aktifkan'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'mati', 'nonaktif', 'nonaktifkan'].includes(v)) return false;
  return def;
}

function intEnv(key, def, min, max) {
  const n = parseInt(envStr(key, ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function cleanBaseUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return s.replace(/\/+$/, '');
}

function serverId(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/\/server\/([A-Za-z0-9-]+)/);
  if (m) s = m[1];
  return s.replace(/[^A-Za-z0-9-]/g, '');
}

function short(sha) {
  return String(sha || '').slice(0, 7);
}

/**
 * Auto-update dari GitHub.
 *
 * Alur: cek commit baru -> git pull --ff-only -> npm install bila perlu ->
 * syntax check -> restart panel lewat Pterodactyl Client API.
 *
 * Mode restart:
 *   api  = POST /api/client/servers/{id}/power (butuh PTERO_*)
 *   exit = keluar dengan kode 1, berharap panel otomatis restart
 *   none = tarik kode saja, restart manual lewat panel
 */
class Updater {
  constructor(cfg, options = {}) {
    this.cfg = cfg || {};
    this.appDir = options.appDir || DEFAULT_APP_DIR;
    this.notify = typeof options.notify === 'function' ? options.notify : async () => {};
    this.verify = options.verify !== false;
    this.timer = null;
    this.firstTimer = null;
    this.busy = false;
    this.lastCheck = 0;
    this.lastError = '';
    this.lastResult = null;
  }

  get enabled() {
    return boolEnv('AUTO_UPDATE_ENABLED', false);
  }

  get intervalMin() {
    return intEnv('AUTO_UPDATE_CHECK_MIN', 10, 1, 1440);
  }

  get branch() {
    return envStr('UPDATE_BRANCH', 'main') || 'main';
  }

  get remote() {
    return envStr('UPDATE_REMOTE', 'origin') || 'origin';
  }

  get restartMode() {
    const v = envStr('AUTO_UPDATE_RESTART_MODE', 'api').toLowerCase();
    return ['api', 'exit', 'none'].includes(v) ? v : 'api';
  }

  get pteroUrl() {
    return cleanBaseUrl(envStr('PTERO_URL'));
  }

  get pteroKey() {
    return envStr('PTERO_CLIENT_KEY') || envStr('PTERO_API_KEY');
  }

  get pteroServer() {
    return serverId(envStr('PTERO_SERVER_ID')) || serverId(envStr('P_SERVER_UUID'));
  }

  get restartReady() {
    return this.restartMode === 'exit' || (this.restartMode === 'api' && Boolean(this.pteroUrl && this.pteroKey && this.pteroServer));
  }

  get repoSlug() {
    const user = envStr('GITHUB_USER');
    const repo = envStr('GITHUB_REPO');
    return user && repo ? `${user}/${repo}` : '';
  }

  _gitEnv() {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    // Token hanya dipakai untuk repo privat. Dikirim lewat environment,
    // bukan argumen command line, supaya tidak muncul di daftar proses.
    const token = envStr('GITHUB_TOKEN');
    if (token) {
      env.GIT_CONFIG_COUNT = '1';
      env.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader';
      env.GIT_CONFIG_VALUE_0 =
        'AUTHORIZATION: basic ' + Buffer.from(`x-access-token:${token}`).toString('base64');
    }
    return env;
  }

  _run(cmd, args, timeout) {
    return new Promise((resolve, reject) => {
      execFile(
        cmd,
        args,
        {
          cwd: this.appDir,
          timeout,
          maxBuffer: 4 * 1024 * 1024,
          env: this._gitEnv(),
        },
        (err, stdout, stderr) => {
          if (err) {
            const message = String(stderr || stdout || err.message || '').trim() || err.message;
            const wrapped = new Error(message);
            wrapped.stdout = String(stdout || '');
            wrapped.stderr = String(stderr || '');
            wrapped.code = err.code;
            reject(wrapped);
            return;
          }
          resolve({ stdout: String(stdout || ''), stderr: String(stderr || '') });
        }
      );
    });
  }

  _git(args, timeout = GIT_TIMEOUT_MS) {
    return this._run('git', args, timeout);
  }

  _npm(args, timeout = NPM_TIMEOUT_MS) {
    return this._run('npm', args, timeout);
  }

  async repo() {
    try {
      const top = (await this._git(['rev-parse', '--show-toplevel'])).stdout.trim();
      const root = path.resolve(top);
      const app = path.resolve(this.appDir);
      const rel = path.relative(root, app);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return {
          ok: false,
          error: `Folder bot (${app}) tidak berada di dalam repo git (${root}).`,
        };
      }
      const branch = (await this._git(['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
      const local = (await this._git(['rev-parse', 'HEAD'])).stdout.trim();
      const dirtyOut = (
        await this._git(['status', '--porcelain', '--untracked-files=no'])
      ).stdout.trim();
      let remoteUrl = '';
      try {
        remoteUrl = (await this._git(['remote', 'get-url', this.remote])).stdout.trim();
      } catch {
        /* remote belum ada */
      }
      return {
        ok: true,
        root,
        app,
        branch,
        local,
        localShort: short(local),
        dirty: Boolean(dirtyOut),
        dirtyFiles: dirtyOut ? dirtyOut.split('\n').slice(0, 10) : [],
        remoteUrl,
      };
    } catch (err) {
      return {
        ok: false,
        error: `Folder bot bukan clone git / git tidak tersedia: ${err.message}`,
      };
    }
  }

  async check() {
    const info = await this.repo();
    if (!info.ok) return info;
    try {
      await this._git(['fetch', '--prune', this.remote, this.branch]);
      const remote = (await this._git(['rev-parse', 'FETCH_HEAD'])).stdout.trim();
      const counts = (await this._git([
        'rev-list',
        '--left-right',
        '--count',
        'HEAD...FETCH_HEAD',
      ])).stdout
        .trim()
        .split(/\s+/)
        .map((n) => Number(n) || 0);
      const ahead = counts[0] || 0;
      const behind = counts[1] || 0;
      let commits = [];
      if (behind > 0) {
        commits = (
          await this._git(['log', '--oneline', '--max-count=10', 'HEAD..FETCH_HEAD'])
        ).stdout
          .trim()
          .split('\n')
          .filter(Boolean);
      }
      this.lastCheck = Date.now();
      this.lastError = '';
      this.lastResult = {
        ...info,
        remote,
        remoteShort: short(remote),
        ahead,
        behind,
        commits,
      };
      return { ok: true, ...this.lastResult };
    } catch (err) {
      this.lastCheck = Date.now();
      this.lastError = err.message;
      return { ...info, ok: false, error: err.message };
    }
  }

  async _dirtyTrackedFiles() {
    const out = (await this._git([
      'status',
      '--porcelain',
      '--untracked-files=no',
    ])).stdout.replace(/\r?\n$/, '');
    if (!out.trim()) return [];
    return out
      .split('\n')
      .map((line) => {
        // Format porcelain v1: "XY path". Jangan trim() seluruh output karena
        // spasi pertama adalah kolom status (mis. " M file") dan akan
        // menggeser path kalau ikut terbuang.
        let file = line.slice(3).trim();
        // Format rename: "R  lama -> baru".
        const arrow = file.indexOf(' -> ');
        if (arrow >= 0) file = file.slice(arrow + 4).trim();
        if (file.startsWith('"') && file.endsWith('"')) {
          try {
            file = JSON.parse(file);
          } catch {
            /* biarkan apa adanya */
          }
        }
        return file;
      })
      .filter(Boolean);
  }

  async pull(opts = {}) {
    const checked = opts.checked || (await this.check());
    if (!checked.ok) return checked;
    if (!checked.behind) return { ...checked, ok: true, updated: false };
    if (checked.ahead > 0) {
      return {
        ...checked,
        ok: false,
        error: `Repo lokal punya ${checked.ahead} commit yang tidak ada di GitHub. Push atau reset dulu.`,
      };
    }

    const before = checked.local;

    // Hanya stash file yang benar-benar diubah oleh update. File runtime
    // (state, database) yang tidak disentuh commit baru dibiarkan di tempat,
    // supaya data pengguna tidak ikut tertinggal di stash saat bot restart.
    const incomingOut = (await this._git([
      'diff',
      '--name-only',
      'HEAD',
      'FETCH_HEAD',
    ])).stdout.trim();
    const incoming = incomingOut ? incomingOut.split('\n').filter(Boolean) : [];
    const incomingSet = new Set(incoming);
    const dirty = await this._dirtyTrackedFiles();
    const overlap = dirty.filter((file) => incomingSet.has(file));

    let stashed = false;
    try {
      if (overlap.length) {
        await this._git([
          'stash',
          'push',
          '-m',
          `auto-update ${new Date().toISOString()}`,
          '--',
          ...overlap,
        ]);
        stashed = true;
        log.warn(
          `[UPDATE] Perubahan lokal pada ${overlap.length} file yang ikut terupdate disimpan di git stash.`
        );
      }
      await this._git(['merge', '--ff-only', 'FETCH_HEAD']);
    } catch (err) {
      if (stashed) {
        try {
          await this._git(['stash', 'pop']);
        } catch {
          /* biarkan stash tersimpan */
        }
      }
      return { ...checked, ok: false, error: `git merge gagal: ${err.message}` };
    }

    const head = (await this._git(['rev-parse', 'HEAD'])).stdout.trim();
    const changedOut = (await this._git(['diff', '--name-only', before, head])).stdout.trim();
    const changed = changedOut ? changedOut.split('\n').filter(Boolean) : [];
    const needInstall = changed.some((f) => /(^|\/)(package\.json|package-lock\.json)$/.test(f));

    if (needInstall) {
      try {
        log.info('[UPDATE] package.json berubah, menjalankan npm install...');
        await this._npm(['install', '--omit=dev', '--no-audit', '--no-fund']);
      } catch (err) {
        await this.rollback(before, stashed, changed);
        return {
          ...checked,
          ok: false,
          error: `npm install gagal, update dibatalkan: ${err.message}`,
          rolledBack: true,
        };
      }
    }

    if (this.verify) {
      try {
        await this._npm(['run', 'check']);
      } catch (err) {
        await this.rollback(before, stashed, changed);
        return {
          ...checked,
          ok: false,
          error: `Pemeriksaan sintaks gagal, update dibatalkan: ${err.message}`,
          rolledBack: true,
        };
      }
    }

    return {
      ok: true,
      updated: true,
      from: before,
      fromShort: short(before),
      to: head,
      toShort: short(head),
      behind: checked.behind,
      stashed,
      needInstall,
      changed,
      commits: checked.commits,
    };
  }

  async rollback(commit, stashed, changed = []) {
    try {
      // Kembalikan HEAD & index ke commit lama, tetapi JANGAN `reset --hard`
      // karena file runtime yang tidak terkait (state, database) bisa ikut
      // terhapus. `--mixed` hanya menyentuh HEAD + index; isi working tree
      // tetap utuh sampai kita memulihkan file yang benar-benar diubah update.
      await this._git(['reset', '--mixed', commit]);

      for (const file of changed) {
        const exists = await this._git(['cat-file', '-e', `${commit}:${file}`])
          .then(() => true)
          .catch(() => false);
        if (exists) {
          await this._git(['checkout', commit, '--', file]);
        } else {
          // File baru dari update yang gagal; hapus hanya file ini.
          try {
            fs.rmSync(path.join(this.appDir, file), { force: true });
          } catch {
            /* biarkan jika gagal */
          }
        }
      }

      if (stashed) {
        try {
          await this._git(['stash', 'pop']);
        } catch {
          /* stash tetap tersimpan */
        }
      }
      log.warn(`[UPDATE] Rollback ke ${short(commit)}.`);
    } catch (err) {
      log.error('[UPDATE] Rollback gagal:', err.message);
    }
  }

  async restart() {
    if (this.restartMode === 'none') return { ok: true, action: 'none' };
    if (this.restartMode === 'exit') {
      const timer = setTimeout(() => process.exit(1), 1500);
      if (timer.unref) timer.unref();
      return { ok: true, action: 'exit' };
    }
    if (!this.pteroUrl || !this.pteroKey || !this.pteroServer) {
      return {
        ok: false,
        action: 'api',
        error:
          'PTERO_URL / PTERO_CLIENT_KEY / PTERO_SERVER_ID belum lengkap. Restart manual lewat panel.',
      };
    }

    const url = `${this.pteroUrl}/api/client/servers/${encodeURIComponent(
      this.pteroServer
    )}/power`;
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.pteroKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ signal: 'restart' }),
        },
        20000
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ok: false,
          action: 'api',
          error: `Panel menolak restart: HTTP ${res.status} ${text.slice(0, 200)}`,
        };
      }
      return { ok: true, action: 'api' };
    } catch (err) {
      return {
        ok: false,
        action: 'api',
        error: `Gagal menghubungi panel: ${err.message}`,
      };
    }
  }

  async updateNow({ restart = false } = {}) {
    if (this.busy) return { ok: false, error: 'Proses update lain sedang berjalan.' };
    this.busy = true;
    try {
      const checked = await this.check();
      if (!checked.ok) return checked;
      if (!checked.behind) return { ok: true, updated: false, checked };
      log.info(`[UPDATE] ${checked.behind} commit baru: ${checked.localShort} -> ${checked.remoteShort}`);
      const pulled = await this.pull({ checked });
      if (!pulled.ok || !pulled.updated) return pulled;
      this.lastResult = pulled;
      if (restart) {
        const r = await this.restart();
        return { ...pulled, restart: r };
      }
      return pulled;
    } finally {
      this.busy = false;
    }
  }

  schedule() {
    this.stop();
    if (!this.enabled) return;
    const delay = this.intervalMin * 60 * 1000;
    this.timer = setInterval(() => this.tick(), delay);
    if (this.timer.unref) this.timer.unref();
    // Cek pertama 45 detik setelah tersambung, supaya update yang tertunda
    // tidak menunggu satu interval penuh.
    this.firstTimer = setTimeout(() => this.tick(), 45 * 1000);
    if (this.firstTimer.unref) this.firstTimer.unref();
    log.info(`[UPDATE] Auto-update aktif tiap ${this.intervalMin} menit.`);
  }

  start() {
    this.schedule();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.firstTimer) {
      clearTimeout(this.firstTimer);
      this.firstTimer = null;
    }
  }

  reschedule() {
    this.schedule();
  }

  _updateMessage(pulled) {
    const lines = [
      '🔄 *Auto-update selesai*',
      `${pulled.fromShort} → ${pulled.toShort} (${pulled.behind} commit)`,
    ];
    if (pulled.commits && pulled.commits.length) {
      lines.push('', ...pulled.commits.slice(0, 5));
    }
    if (pulled.needInstall) lines.push('', 'Dependency diperbarui (npm install).');
    if (pulled.stashed) lines.push('Perubahan lokal disimpan di git stash.');
    return lines.join('\n');
  }

  async tick() {
    if (!this.enabled || this.busy) return;
    this.busy = true;
    try {
      const checked = await this.check();
      if (!checked.ok) {
        log.warn('[UPDATE] Cek gagal:', checked.error);
        return;
      }
      if (!checked.behind) {
        log.debug('[UPDATE] Sudah terbaru.');
        return;
      }

      log.info(
        `[UPDATE] Ditemukan ${checked.behind} commit baru (${checked.localShort} -> ${checked.remoteShort}).`
      );
      const pulled = await this.pull({ checked });
      if (!pulled.ok) {
        log.error('[UPDATE] Gagal update:', pulled.error);
        await this.notify(`⚠️ *Auto-update gagal*\n${pulled.error}`);
        return;
      }
      if (!pulled.updated) return;
      this.lastResult = pulled;

      const message = this._updateMessage(pulled);
      if (!this.restartReady) {
        await this.notify(
          `${message}\n\n⚠️ Restart panel belum dikonfigurasi. Isi PTERO_* atau restart manual lewat panel.`
        );
        return;
      }
      if (this.restartMode === 'api') {
        await this.notify(`${message}\n\nPanel akan direstart otomatis...`);
      } else {
        await this.notify(`${message}\n\nBot akan keluar untuk restart otomatis panel...`);
      }
      const result = await this.restart();
      if (!result.ok) {
        await this.notify(`⚠️ ${result.error}`);
      }
    } catch (err) {
      this.lastError = err.message;
      log.error('[UPDATE] Error:', err.message);
      await this.notify(`⚠️ *Auto-update error*\n${err.message}`);
    } finally {
      this.busy = false;
    }
  }
}

module.exports = { Updater };
