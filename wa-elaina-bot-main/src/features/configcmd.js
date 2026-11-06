'use strict';

const wa = require('../wa');
const settings = require('../settings');

const COMMANDS = new Set(['config', 'setting', 'pengaturan', 'set', 'isi']);

const ALIASES = {
  daftar: 'list',
  lihat: 'get',
  cek: 'get',
  tampil: 'get',
  ubah: 'set',
  atur: 'set',
  tambah: 'add',
  hapus: 'del',
  buang: 'del',
  kosongkan: 'reset',
  bantuan: 'help',
};

function summarize() {
  const s = settings.stats();
  const lines = [
    '⚙️ *Pengaturan Tsukasa*',
    `Override via chat: *${s.overrides}* dari ${s.total} setting`,
    'Nilai dari .env bisa ditimpa lewat chat, langsung berlaku tanpa restart.',
    '',
  ];
  for (const g of s.groups) {
    lines.push(`• ${g.label} (${g.count})`);
  }
  lines.push(
    '',
    'Perintah:',
    '!config list [grup]',
    '!config get <KEY>',
    '!config set <KEY> <nilai>',
    '!config add <KEY> <nilai>',
    '!config del <KEY> <nilai>',
    '!config reset <KEY>',
    '!config help',
    '',
    'Contoh cepat:',
    '!set COSPLAY_POSTS https://www.instagram.com/p/xxxx/',
    '!set ANIME_CHANNEL_INVITE https://whatsapp.com/channel/xxxx'
  );
  return lines.join('\n');
}

function helpMessage() {
  return [
    '⚙️ *Cara Mengisi Setting Lewat Chat (owner)*',
    '',
    '*Cosplay*',
    '!config set COSPLAY_ENABLED on|off',
    '!config add COSPLAY_POSTS <link Instagram>',
    '!config del COSPLAY_POSTS <link Instagram>',
    '!config add COSPLAY_RSS <url RSS>',
    '!config set ANIME_CHANNEL_COSPLAY_EVERY 4',
    '',
    '*Berita*',
    '!config set NEWS_ENABLED on|off',
    '!config add NEWS_SOURCES gematsu',
    '!config del NEWS_SOURCES siliconera',
    '!config add NEWS_X_RSS <url RSS>',
    '!config set NEWS_ITEMS 2',
    '!config set NEWS_GACHA_EVERY 2',
    '!config set NEWS_CACHE_MIN 10',
    '!config set NEWS_REPOST_TTL_MIN 720',
    '',
    '*Channel anime*',
    '!config set ANIME_CHANNEL_JID 1234567890@newsletter',
    '!config set ANIME_CHANNEL_INVITE <kode/url channel>',
    '!config set ANIME_CHANNEL_INTERVAL_MIN 180',
    '!config set ANIME_CHANNEL_MAX_PER_DAY 8',
    '!config set ANIME_CHANNEL_NEWS_EVERY 2',
    '!config set ANIME_CHANNEL_INFO_EVERY 3',
    '!config add ANIME_CHANNEL_SOURCES animekita',
    '',
    '*Moderasi & rate limit*',
    '!config set MOD_WARN_LIMIT 5',
    '!config set MOD_MUTE_MINUTES 10',
    '!config set MOD_LOG_JID 628xxxxxxxxxx',
    '!config set RATE_NEWS_SEC 15',
    '!config set RATE_DOWNLOAD_SEC 30',
    '!config set RATE_CHANNEL_SEC 30',
    '',
    '*Unduhan & detector*',
    '!config set ANIME_DL_CONCURRENCY 1',
    '!config set ANIME_EP_MAX_MB 190',
    '!config set TIKTOK_MONITOR_ENABLED on|off',
    '!config set TIKTOK_CHECK_MIN 3',
    '',
    'Lihat semua: !config list',
    'Kembalikan ke nilai .env: !config reset <KEY>',
    '',
    'Catatan: !set <KEY> <nilai> sama dengan !config set.',
  ].join('\n');
}

function formatList(group) {
  const rows = settings.list(group);
  if (!rows.length) {
    return `Grup *${group}* tidak dikenal. Pilihan: ${settings
      .groups()
      .map((g) => g.key)
      .join(', ')}`;
  }
  const lines = [`⚙️ *Pengaturan — ${rows[0].groupLabel}*`, ''];
  for (const row of rows) {
    const mark = row.source === 'chat' ? '✏️' : row.source === 'env' ? '📄' : '·';
    lines.push(`${mark} *${row.key}*`);
    lines.push(`   ${row.text}`);
    lines.push(`   ${row.label}`);
  }
  lines.push('', '✏️ diubah lewat chat · 📄 dari .env · · default');
  return lines.join('\n');
}

function formatAll() {
  const s = settings.stats();
  const lines = [
    '⚙️ *Semua Pengaturan*',
    `File: ${s.file}`,
    `Override aktif: ${s.overrides}/${s.total}`,
  ];
  for (const g of s.groups) {
    lines.push('', `*${g.label}*`);
    for (const row of settings.list(g.key)) {
      const mark = row.source === 'chat' ? '✏️' : row.source === 'env' ? '📄' : '·';
      lines.push(`${mark} ${row.key} = ${row.text}`);
    }
  }
  lines.push('', '✏️ chat · 📄 .env · · default');
  return lines.join('\n');
}

function describeKey(key) {
  const row = settings.describe(key);
  if (!row) {
    return `Setting *${key}* tidak dikenal.\nLihat daftar: !config list`;
  }
  const source =
    row.source === 'chat' ? 'diubah lewat chat' : row.source === 'env' ? '.env' : 'default';
  return [
    `⚙️ *${row.key}*`,
    `Nilai  : ${row.text}`,
    `Sumber : ${source}`,
    `Grup   : ${row.groupLabel}`,
    `Info   : ${row.label}`,
    '',
    `Ubah: !config set ${row.key} <nilai>`,
  ].join('\n');
}

class ConfigFeature {
  constructor(cfg) {
    this.cfg = cfg || {};
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  async reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  async handle(sock, m, rest, isOwner) {
    if (!isOwner) {
      await this.reply(
        m,
        '⚙️ Perintah pengaturan ini khusus owner bot.\n' +
          'Admin grup tetap bisa memakai !antilink, !antispam, !jadwal, !mute, dan !resetwarn.'
      );
      return true;
    }

    const raw = String(rest || '').trim();
    if (!raw) {
      await this.reply(m, summarize());
      return true;
    }

    const parts = raw.split(/\s+/).filter(Boolean);
    const first = parts[0].toLowerCase();

    // Dukungan bentuk singkat: !set KEY VALUE / !config KEY VALUE.
    if (settings.isKnown(parts[0]) && parts.length >= 1) {
      await this.reply(m, this.doSet(parts[0], parts.slice(1).join(' ')));
      return true;
    }

    const sub = ALIASES[first] || first;

    if (sub === 'help' || sub === 'bantuan') {
      await this.reply(m, helpMessage());
      return true;
    }

    if (sub === 'list' || sub === 'daftar') {
      const group = parts[1] ? parts[1].toLowerCase() : '';
      await this.reply(m, group ? formatList(group) : formatAll());
      return true;
    }

    if (sub === 'groups' || sub === 'grup') {
      await this.reply(
        m,
        settings
          .groups()
          .map((g) => `• ${g.key} (${g.label}) — ${g.count} setting`)
          .join('\n')
      );
      return true;
    }

    if (sub === 'get' || sub === 'lihat') {
      if (!parts[1]) {
        await this.reply(m, 'Gunakan: !config get <KEY>');
        return true;
      }
      await this.reply(m, describeKey(parts[1]));
      return true;
    }

    if (sub === 'set' || sub === 'isi') {
      await this.reply(m, this.doSet(parts[1], parts.slice(2).join(' ')));
      return true;
    }

    if (sub === 'add' || sub === 'tambah') {
      await this.reply(m, this.doAdd(parts[1], parts.slice(2).join(' ')));
      return true;
    }

    if (sub === 'del' || sub === 'remove' || sub === 'hapus') {
      await this.reply(m, this.doRemove(parts[1], parts.slice(2).join(' ')));
      return true;
    }

    if (sub === 'reset') {
      if (!parts[1]) {
        await this.reply(m, 'Gunakan: !config reset <KEY>');
        return true;
      }
      const res = settings.unset(parts[1]);
      if (!res.ok) {
        await this.reply(m, `❌ ${res.error}`);
        return true;
      }
      await this.reply(
        m,
        `♻️ *${res.def.key}* dikembalikan ke nilai .env/default.\nNilai sekarang: ${settings.describe(
          res.def.key
        ).text}`
      );
      return true;
    }

    // Jika user menulis nama grup saja: !config news
    const knownGroup = settings.groups().some((g) => g.key === sub);
    if (knownGroup) {
      await this.reply(m, formatList(sub));
      return true;
    }

    await this.reply(m, `❌ Perintah tidak dikenal.\n\n${summarize()}`);
    return true;
  }

  doSet(key, value) {
    if (!key) return 'Gunakan: !config set <KEY> <nilai>';
    if (value === '') {
      return `Nilai kosong. Gunakan !config reset ${key} untuk mengembalikan default.`;
    }
    const res = settings.set(key, value);
    if (!res.ok) {
      return `❌ ${res.error}\nLihat daftar: !config list`;
    }
    const row = settings.describe(res.def.key);
    return `✅ *${row.key}* diset ke: ${row.text}`;
  }

  doAdd(key, value) {
    if (!key || value === '') return 'Gunakan: !config add <KEY> <nilai>';
    const res = settings.add(key, value);
    if (!res.ok) return `❌ ${res.error}`;
    if (res.unchanged) return `ℹ️ *${res.def.key}* sudah berisi nilai itu.`;
    const row = settings.describe(res.def.key);
    return `✅ Ditambahkan ke *${row.key}* (${res.value.length} item):\n${row.text}`;
  }

  doRemove(key, value) {
    if (!key || value === '') return 'Gunakan: !config del <KEY> <nilai>';
    const res = settings.remove(key, value);
    if (!res.ok) return `❌ ${res.error}`;
    if (res.unchanged) return `ℹ️ Nilai itu tidak ada di *${res.def.key}*.`;
    const row = settings.describe(res.def.key);
    return `🗑️ Dihapus dari *${row.key}* (${res.value.length} item):\n${row.text}`;
  }
}

module.exports = { ConfigFeature };
