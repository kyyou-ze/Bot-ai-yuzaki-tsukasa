'use strict';

const wa = require('../wa');
const settings = require('../settings');

const COMMANDS = new Set(['update', 'upgrade', 'autoupdate']);

function timeText(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('id-ID', { timeZone: process.env.BOT_TIMEZONE || 'Asia/Jakarta' });
  } catch {
    return new Date(ts).toISOString();
  }
}

function restartText(updater) {
  if (updater.restartMode === 'none') return 'none (manual)';
  if (updater.restartMode === 'exit') return 'exit (keluar)';
  return updater.restartReady ? 'api (siap)' : 'api (belum lengkap)';
}

function updateLines(pulled) {
  const lines = [
    `✅ *Update berhasil*`,
    `${pulled.fromShort} → ${pulled.toShort} (${pulled.behind} commit)`,
  ];
  if (pulled.commits && pulled.commits.length) lines.push('', ...pulled.commits.slice(0, 5));
  if (pulled.needInstall) lines.push('', 'Dependency diperbarui (npm install).');
  if (pulled.stashed) lines.push('Perubahan lokal disimpan di git stash.');
  return lines.join('\n');
}

class UpdateFeature {
  constructor(updater) {
    this.updater = updater || null;
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  async reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  async handle(sock, m, rest, isOwner) {
    if (!this.updater) {
      await this.reply(m, '⚠️ Modul auto-update belum siap.');
      return true;
    }
    if (!isOwner) {
      await this.reply(m, '🔒 Perintah update hanya untuk owner bot.');
      return true;
    }

    const raw = String(rest || '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || 'status').toLowerCase();

    if (sub === 'help' || sub === 'bantuan' || sub === 'cara') {
      await this.reply(
        m,
        [
          '🔄 *Auto-update GitHub → Pterodactyl*',
          '',
          '!update status      - status repo, auto-update, dan panel',
          '!update check       - cek commit baru di GitHub',
          '!update now         - tarik update + restart panel',
          '!update auto on|off - aktifkan/nonaktifkan cek otomatis',
          '!update interval 5  - cek tiap N menit',
          '!update mode api|exit|none - cara restart',
          '',
          'Setup panel (sekali saja):',
          '!config set PTERO_URL https://panel.domain.com',
          '!config set PTERO_CLIENT_KEY ptlc_xxxxxxxx',
          '!config set PTERO_SERVER_ID xxxxxxxx',
          '!config set AUTO_UPDATE_ENABLED on',
          '',
          'Catatan: folder bot harus clone git dari repo GitHub.',
          'Jika bukan, minta admin panel clone ulang repo ke folder server.',
        ].join('\n')
      );
      return true;
    }

    if (sub === 'status' || sub === 'info') {
      const info = await this.updater.repo();
      const last = this.updater.lastResult;
      const lines = [
        '🔄 *Status Auto-Update*',
        `Auto       : ${this.updater.enabled ? 'on' : 'off'}`,
        `Interval   : ${this.updater.intervalMin} menit`,
        `Branch     : ${this.updater.branch}`,
        `Restart    : ${restartText(this.updater)}`,
        `Terakhir   : ${timeText(this.updater.lastCheck)}`,
      ];
      if (!info.ok) {
        lines.push('', `❌ ${info.error}`);
        lines.push('', 'Minta admin panel menjalankan:');
        lines.push('`git clone https://github.com/kyyou-ze/Bot-ai-yuzaki-tsukasa.git .`');
      } else {
        lines.push(`Folder     : ${info.root}`);
        lines.push(`Commit     : ${info.localShort} (${info.branch})`);
        lines.push(`Remote     : ${info.remoteUrl || '-'}`);
        lines.push(`File lokal : ${info.dirty ? `ada perubahan (${info.dirtyFiles.length})` : 'bersih'}`);
        if (last && last.behind) {
          lines.push('', `🔄 Ada *${last.behind} commit* baru: ${last.localShort} → ${last.remoteShort}`);
        }
      }
      if (this.updater.lastError) lines.push('', `⚠️ ${this.updater.lastError}`);
      await this.reply(m, lines.join('\n'));
      return true;
    }

    if (sub === 'check' || sub === 'cek') {
      const res = await this.updater.check();
      if (!res.ok) {
        await this.reply(m, `❌ Gagal cek update: ${res.error}`);
        return true;
      }
      if (!res.behind) {
        await this.reply(
          m,
          `✅ *Sudah terbaru*\nCommit: ${res.localShort} (${res.branch})\nRemote: ${res.remoteShort}`
        );
        return true;
      }
      const lines = [
        `🔄 *Ada ${res.behind} commit baru*`,
        `${res.localShort} → ${res.remoteShort}`,
        '',
        ...(res.commits || []).slice(0, 10),
        '',
        'Jalankan !update now untuk menerapkan.',
      ];
      await this.reply(m, lines.join('\n'));
      return true;
    }

    if (['now', 'pull', 'tarik', 'sekarang', 'update'].includes(sub)) {
      const pulled = await this.updater.updateNow({ restart: false });
      if (!pulled.ok) {
        await this.reply(m, `❌ Gagal update: ${pulled.error}`);
        return true;
      }
      if (!pulled.updated) {
        await this.reply(
          m,
          `✅ *Sudah terbaru*\nCommit: ${pulled.checked ? pulled.checked.localShort : '-'}`
        );
        return true;
      }
      const base = updateLines(pulled);
      if (!this.updater.restartReady) {
        await this.reply(
          m,
          `${base}\n\n⚠️ Restart panel belum dikonfigurasi. Restart manual lewat panel agar kode baru dipakai.`
        );
        return true;
      }
      const note =
        this.updater.restartMode === 'api'
          ? 'Panel akan direstart otomatis...'
          : 'Bot akan keluar untuk restart otomatis panel...';
      await this.reply(m, `${base}\n\n${note}`);
      const result = await this.updater.restart();
      if (!result.ok) await this.reply(m, `⚠️ ${result.error}`);
      return true;
    }

    if (sub === 'auto' || sub === 'otomatis') {
      if (!parts[1]) {
        await this.reply(
          m,
          `Auto-update sekarang: *${this.updater.enabled ? 'on' : 'off'}*\nGunakan: !update auto on|off`
        );
        return true;
      }
      const res = settings.set('AUTO_UPDATE_ENABLED', parts[1]);
      await this.reply(m, res.ok ? `✅ Auto-update: *${settings.describe('AUTO_UPDATE_ENABLED').text}*` : `❌ ${res.error}`);
      return true;
    }

    if (sub === 'interval' || sub === 'jeda') {
      if (!parts[1]) {
        await this.reply(m, `Interval sekarang: *${this.updater.intervalMin} menit*`);
        return true;
      }
      const res = settings.set('AUTO_UPDATE_CHECK_MIN', parts[1]);
      await this.reply(
        m,
        res.ok
          ? `✅ Cek update tiap *${settings.describe('AUTO_UPDATE_CHECK_MIN').text} menit*.`
          : `❌ ${res.error}`
      );
      return true;
    }

    if (sub === 'mode') {
      if (!parts[1]) {
        await this.reply(
          m,
          `Mode restart: *${this.updater.restartMode}*\nGunakan: !update mode api|exit|none`
        );
        return true;
      }
      const res = settings.set('AUTO_UPDATE_RESTART_MODE', parts[1]);
      await this.reply(
        m,
        res.ok
          ? `✅ Mode restart: *${settings.describe('AUTO_UPDATE_RESTART_MODE').text}*`
          : `❌ ${res.error}`
      );
      return true;
    }

    await this.reply(m, `❌ Subperintah tidak dikenal.\n\nGunakan !update help`);
    return true;
  }
}

module.exports = { UpdateFeature };
