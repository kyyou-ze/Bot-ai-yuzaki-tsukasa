'use strict';

const wa = require('../wa');
const log = require('../logger');
const menuBanner = require('../menubanner');
const { isGroupJid, jidUser, onlyDigits } = require('../util');
const {
  normalizeAccount,
  normalizeCn,
  normalizeHashtag,
  formatClock,
  formatDate,
} = require('../verifstore');

const COMMANDS = new Set([
  'verif',
  'veriv',
  'addakun',
  'tambahakun',
  'delakun',
  'hapusakun',
  'listakun',
  'daftarakun',
  'listverif',
  'listveriv',
  'unverif',
  'unveriv',
  'me',
  'profile',
  'siapaup',
  'whoup',
  'cekup',
  'history',
]);

function bareJid(value) {
  return String(value || '')
    .replace(/:\d+@/, '@')
    .trim();
}

function digitsOf(jid) {
  return onlyDigits(jidUser(jid));
}

/**
 * Kunci pencocokan akun. VerifStore menyimpan nama tanpa "@", sedangkan
 * TikTokAccounts menyimpannya dengan "@". Tanpa normalisasi ini akun yang
 * sama bisa tampil dua kali (di pantauan dan di daftar "belum masuk pantauan").
 */
function accountKey(value) {
  return normalizeAccount(value).toLowerCase();
}

function displayAccount(value) {
  const acc = normalizeAccount(value);
  return acc ? `@${acc}` : '-';
}

/** Nama grup yang enak dibaca; jangan tampilkan JID mentah ke user. */
function displayGroup(entry) {
  const name = String((entry && entry.gcName) || '').trim();
  if (name && !/@g\.us$/i.test(name) && !/^\d{10,}$/.test(name)) return name;
  return 'Grup WhatsApp';
}

/** Ambil JID WhatsApp peng-verif dari metadata pesan. */
function senderLink(m) {
  const sender = bareJid(m.key.participant || m.key.remoteJid || '');
  const pnCandidate =
    m.key.participantPn ||
    m.key.participantAlt ||
    m.key.senderPn ||
    m.key.remoteJidAlt ||
    (sender && !/@lid$/i.test(sender) ? sender : '');
  return {
    userJid: sender,
    userPn: bareJid(pnCandidate || ''),
    userName: String(m.pushName || '').trim().slice(0, 80),
  };
}

// ───────────────── kartu profil gaya ALYA MD ─────────────────

// Profil dari API pihak ketiga di-cache 5 menit supaya `.me` tidak membanjiri
// layanan gratis. Kegagalan disimpan sebentar agar tidak menembak terus.
const PROFILE_CACHE_MS = 5 * 60 * 1000;
const PROFILE_FAIL_MS = 60 * 1000;
const PROFILE_TIMEOUT_MS = 12000;
const AVATAR_TIMEOUT_MS = 8000;
const AVATAR_MAX_BYTES = 900 * 1024;
const profileCache = new Map();
const numberFormatter = new Intl.NumberFormat('en-US');
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function withTimeout(promise, ms, fallback = null) {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
    Promise.resolve(promise).then(
      (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

function formatNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? numberFormatter.format(n) : '0';
}

function shorten(value, max = 280) {
  const s = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '-';
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Bingkai teks profil ALYA MD. */
function frame(title, lines, icon = '✦') {
  const body = (lines || []).map((line) => `│ ${line}`);
  return [`╭─✦ ${icon} *${title}*`, ...body, '╰─────✦'].join('\n');
}

function verifiedLabel(value) {
  if (value === true) return 'Ya ✅';
  if (value === false) return 'Tidak ❌';
  const s = String(value ?? '').trim();
  if (!s) return '-';
  if (/^(true|yes|ya|verified)$/i.test(s)) return 'Ya ✅';
  if (/^(false|no|tidak|unverified)$/i.test(s)) return 'Tidak ❌';
  return s;
}

function privacyLabel(value) {
  if (value === true) return 'Private Account 🔒';
  if (value === false) return 'Public Account 🌐';
  const s = String(value ?? '').trim();
  if (!s) return '-';
  if (/private|terkunci|pribadi/i.test(s)) return 'Private Account 🔒';
  if (/public|umum/i.test(s)) return 'Public Account 🌐';
  return s;
}

/** createTime dari API bisa berupa detik, milidetik, atau teks siap pakai. */
function createTimeLabel(value, timezone) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return value.trim() || '-';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return String(value).trim() || '-';
  const date = new Date(n > 1e12 ? n : n * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Jakarta',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).formatToParts(date);
    const pick = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    const day = pick('day');
    const month = pick('month');
    const year = pick('year');
    if (!day || !month || !year) return date.toISOString().slice(0, 10);
    return `${day} ${BULAN[month - 1] || month} ${year}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function avatarUrlOf(profile) {
  const p = (profile && profile.profile) || {};
  return (
    p.avatarLarger ||
    p.avatarMedium ||
    p.avatarThumb ||
    (profile && profile.avatar) ||
    ''
  );
}

async function fetchAvatar(url) {
  if (!url || !/^https?:\/\//i.test(String(url))) return null;
  return withTimeout(
    (async () => {
      const res = await fetch(String(url), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Referer: 'https://www.tiktok.com/',
        },
      });
      if (!res || !res.ok) return null;
      const length = Number(res.headers.get('content-length') || 0);
      if (length > AVATAR_MAX_BYTES) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length || buffer.length > AVATAR_MAX_BYTES) return null;
      return buffer;
    })(),
    AVATAR_TIMEOUT_MS,
    null
  );
}

class VerifFeature {
  constructor(cfg, store, monitor, accounts) {
    this.cfg = cfg || {};
    this.store = store;
    this.monitor = monitor || null;
    this.accounts = accounts || null;
    this.timezone = String(this.cfg.timezone || 'Asia/Jakarta');
    this.tzOffset = Number.isFinite(Number(this.cfg.tzOffset)) ? Number(this.cfg.tzOffset) : 7;
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  reply(m, text, linkPreview) {
    return wa
      .sendText(m.key.remoteJid, text, m, undefined, linkPreview)
      .catch((err) => {
        log.warn('[VERIF] gagal kirim balasan:', err && err.message);
        return null;
      });
  }

  /** Balasan panjang dipecah per byte UTF-8 supaya tidak ditolak WhatsApp. */
  replyLong(m, text) {
    return wa.sendLongText(m.key.remoteJid, text, m).catch((err) => {
      log.error('[VERIF] gagal kirim balasan panjang:', err && err.message);
      return null;
    });
  }

  /** Ambil profil TikTok dengan cache; monitor yang sudah berjalan dipakai dulu. */
  async fetchProfile(account) {
    const key = accountKey(account);
    const cached = profileCache.get(key);
    const ttl = cached && cached.profile ? PROFILE_CACHE_MS : PROFILE_FAIL_MS;
    if (cached && Date.now() - cached.at < ttl) return cached.profile;

    let profile = null;
    try {
      if (this.monitor && typeof this.monitor.getProfile === 'function') {
        profile = await withTimeout(this.monitor.getProfile(account), PROFILE_TIMEOUT_MS, null);
      } else {
        const { fetchTikTokUser } = require('../tiktokapi');
        profile = await withTimeout(fetchTikTokUser(account, this.cfg), PROFILE_TIMEOUT_MS, null);
      }
    } catch {
      profile = null;
    }

    profileCache.set(key, { at: Date.now(), profile: profile || null });
    if (profileCache.size > 200) profileCache.delete(profileCache.keys().next().value);
    return profile || null;
  }

  /** Satu blok profil: kartu ALYA MD + data monitoring Tsukasa. */
  renderProfile(entry, profile, videos, hashtag, cn) {
    const acc = normalizeAccount(entry.accName);
    const blocks = [];

    if (profile) {
      blocks.push(
        frame(
          'TIKTOK',
          [
            `👤 *Username*: ${displayAccount(profile.username || acc)}`,
            `📛 *Nickname*: ${shorten(profile.nickname, 80)}`,
            `☑️ *Verified*: ${verifiedLabel(profile.verified)}`,
            `🔐 *Account*: ${privacyLabel(profile.privateAccount)}`,
            `🪪 *Nama WA*: ${shorten(entry.userName, 80)}`,
            `📢 *Grup*: ${displayGroup(entry)}`,
            `📅 *Dibuat*: ${createTimeLabel(profile.createTime, this.timezone)}`,
          ],
          '🎵'
        )
      );
      const digg = Number(profile.diggCount);
      blocks.push(
        frame(
          'STATISTIK',
          [
            `👥 *Followers*: ${formatNumber(profile.followers)}`,
            `👤 *Following*: ${formatNumber(profile.followings ?? profile.following)}`,
            `❤️ *Likes*: ${formatNumber(profile.hearts ?? profile.heartsCount ?? profile.likes)}`,
            `🎬 *Videos*: ${formatNumber(profile.videoCount)}`,
            ...(Number.isFinite(digg) && digg > 0 ? [`👍 *Digg*: ${formatNumber(digg)}`] : []),
          ],
          '📊'
        )
      );
      blocks.push(
        frame('BIO', [shorten(profile.signature || profile.bio || '-', 280)], '💬')
      );
    } else {
      blocks.push(
        frame(
          'TIKTOK',
          [
            `👤 *Username*: ${displayAccount(acc)}`,
            `📛 *Nickname*: ${shorten(entry.userName, 80)}`,
            `📢 *Grup*: ${displayGroup(entry)}`,
            '⚠️ _Data profil TikTok belum bisa diambil, coba lagi nanti._',
          ],
          '🎵'
        )
      );
    }

    const latest = videos[0];
    const monitorLines = [`🎯 *Target*: ${hashtag} • CN ${cn}`];
    if (latest) {
      const hashtagOk = latest.hashtagStatus === 'Ada';
      const cnOk = latest.cnStatus === 'Cocok';
      monitorLines.push(
        `🕒 *UP hari*: ${formatClock(latest.timestamp, this.timezone)} WIB • ${videos.length} video`
      );
      monitorLines.push(`${hashtagOk ? '✅' : '❎'} ${hashtag} ${hashtagOk ? 'ada' : 'belum ada'}`);
      monitorLines.push(`${cnOk ? '✅' : '❎'} CN ${cn} ${cnOk ? 'cocok' : 'belum cocok'}`);

      const notes = [];
      if (!hashtagOk) notes.push(`caption belum memakai ${hashtag}`);
      if (!cnOk) notes.push(`nama/bio belum memuat ${cn}`);
      if (notes.length) monitorLines.push(`⚠️ ${notes.join(' • ')}`);

      const caption = String(latest.caption || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (caption) {
        monitorLines.push(`📝 ${caption.slice(0, 120)}${caption.length > 120 ? '…' : ''}`);
      }
      if (latest.link) monitorLines.push(`🔗 *Video*: ${latest.link}`);
    } else {
      monitorLines.push('🕒 *UP hari*: belum ada');
      monitorLines.push(`❎ ${hashtag} belum ada video untuk dicek`);
    }

    if (entry.createdAt) {
      monitorLines.push(`📅 *Verif*: ${formatDate(entry.createdAt, this.timezone)}`);
    }
    const monitorOn =
      !this.accounts ||
      typeof this.accounts.isEnabled !== 'function' ||
      this.accounts.isEnabled();
    monitorLines.push(`🔔 *Status*: ${monitorOn ? 'Aktif (real-time)' : 'Nonaktif'}`);
    blocks.push(frame('MONITORING', monitorLines, '📡'));

    blocks.push(`🔗 https://www.tiktok.com/@${acc}`);
    return blocks.join('\n\n');
  }

  usage() {
    return [
      '*Verif ACC TikTok*',
      '/verif <nama_acc>',
      '/listverif',
      '/unverif <nama_acc>',
      '/me — kartu profil TikTok + statistik',
      '',
      '*Pantauan akun*',
      '/addakun <nama_acc> — sama seperti /verif di grup, khusus owner di DM',
      '/delakun <nama_acc>',
      '/listakun',
      '',
      '*Cek siapa yang UP*',
      '/siapaup [CN]',
      '/cekup @username',
      '/history [CN]',
      '',
      'Bisa juga: Tsukasa verif <nama_acc>, .verif <nama_acc>',
    ].join('\n');
  }

  groupName(sock, chat) {
    return sock
      .groupMetadata(chat)
      .then((meta) => (meta && (meta.subject || meta.name)) || chat)
      .catch(() => chat);
  }

  statusLine() {
    if (!this.accounts) return 'pantauan tidak tersedia';
    return this.accounts.isEnabled() ? 'aktif ✅' : 'nonaktif ❌';
  }

  refreshMonitor() {
    if (this.monitor && typeof this.monitor.refresh === 'function') {
      this.monitor.refresh();
    }
  }

  /**
   * Pastikan akun hasil verif ikut dipantau detector. Idempoten: kalau akun
   * sudah ada, tidak ada penulisan ulang atau restart detector.
   */
  async ensureMonitored(accName) {
    if (!this.accounts) return { ok: false, reason: 'unavailable', account: accName };
    const res = await this.accounts.add(accName);
    if (res.ok) this.refreshMonitor();
    return res;
  }

  /**
   * Sinkronkan semua akun yang pernah diverifikasi ke daftar pantauan.
   * Dipanggil saat startup supaya akun verif lama tidak tertinggal.
   */
  async syncMonitoredAccounts() {
    if (!this.accounts) return { added: 0, total: 0 };
    let added = 0;
    for (const item of this.store.allAccounts()) {
      const res = await this.accounts.add(item.accName);
      if (res.ok) added += 1;
    }
    if (added) {
      // Saat startup detector mungkin belum berjalan; cukup perbarui daftar.
      // Refresh hanya jika monitor sudah aktif supaya tidak memulai lebih awal.
      if (this.monitor && (this.monitor.timer || this.monitor.startTimer)) {
        this.refreshMonitor();
      }
    }
    return { added, total: this.accounts.list().length };
  }

  async isGroupAdmin(sock, m, chat) {
    if (!isGroupJid(chat)) return false;

    let meta;
    try {
      meta = await sock.groupMetadata(chat);
    } catch {
      return false;
    }

    const candidates = [
      m.key.participant,
      m.key.participantPn,
      m.key.participantAlt,
      m.key.remoteJidAlt,
      m.key.senderPn,
    ]
      .filter(Boolean)
      .map(bareJid);
    if (!candidates.length) return false;

    const candDigits = new Set(candidates.map(digitsOf).filter(Boolean));
    for (const p of meta.participants || []) {
      if (!p || (p.admin !== 'admin' && p.admin !== 'superadmin')) continue;
      const ids = [p.id, p.phoneNumber, p.lid].filter(Boolean).map(bareJid);
      for (const id of ids) {
        if (candidates.includes(id)) return true;
        const d = digitsOf(id);
        if (d && candDigits.has(d)) return true;
      }
    }
    return false;
  }

  async handle(sock, m, cmd, rest, isOwner) {
    const name = String(cmd || '').toLowerCase();
    if (!COMMANDS.has(name)) return false;

    if (!rest && (name === 'verif' || name === 'addakun' || name === 'tambahakun')) {
      await this.reply(m, this.usage());
      return true;
    }

    switch (name) {
      case 'verif':
      case 'veriv':
        await this.handleVerif(sock, m, rest);
        return true;
      case 'addakun':
      case 'tambahakun':
        await this.handleAddAccount(sock, m, rest, isOwner);
        return true;
      case 'delakun':
      case 'hapusakun':
        await this.handleDelAccount(sock, m, rest, isOwner);
        return true;
      case 'listakun':
      case 'daftarakun':
        await this.handleListAccounts(m);
        return true;
      case 'listverif':
      case 'listveriv':
        await this.handleList(m);
        return true;
      case 'unverif':
      case 'unveriv':
        await this.handleUnverif(m, rest);
        return true;
      case 'me':
      case 'profile':
        await this.handleMe(m, rest);
        return true;
      case 'siapaup':
      case 'whoup':
        await this.handleSiapaUp(m, rest);
        return true;
      case 'cekup':
        await this.handleCekUp(m, rest);
        return true;
      case 'history':
        await this.handleHistory(m, rest);
        return true;
      default:
        return false;
    }
  }

  async handleVerif(sock, m, rest) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Verif ACC hanya bisa dilakukan di dalam grup.');
      return;
    }

    const accName = normalizeAccount(rest);
    if (!accName) {
      await this.reply(m, 'Gunakan: /verif <nama_acc>\nContoh: /verif ECN');
      return;
    }

    const gcName = await this.groupName(sock, chat);
    const link = senderLink(m);
    const result = await this.store.add({
      gcId: chat,
      accName,
      cnKeyword: this.cfg.tiktokCnKeyword || 'ECN',
      hashtag: this.cfg.tiktokHashtag || '#margaecn',
      gcName,
      ...link,
    });

    // Akun yang diverifikasi otomatis masuk daftar pantauan detector.
    await this.ensureMonitored(result.entry.accName).catch(() => {});

    const mention = link.userPn || link.userJid;
    const mentions = mention && !/@lid$/i.test(mention) ? [mention] : [];
    const tag = mentions.length ? `@${jidUser(mention)}` : link.userName || 'kamu';

    if (!result.added) {
      if (result.updated) {
        await wa.sendText(
          chat,
          `🔗 Akun *${result.entry.accName}* sudah terverif dan sekarang tertaut ke WhatsApp ${tag}.\n` +
            'Akun ini juga dipantau detector, jadi kamu akan di-tag saat UP.',
          m,
          mentions
        );
        return;
      }
      await this.reply(
        m,
        `ACC ${result.entry.accName} ini sudah terverif di GC ini.\n` +
          'Kalau kamu belum tertaut, kirim ulang /verif dengan nama yang sama.'
      );
      return;
    }

    await wa.sendText(
      chat,
      `✅ Berhasil verif ACC ${result.entry.accName} di GC ini.\n` +
        `🔗 Akun TikTok tertaut ke WhatsApp ${tag}.\n` +
        'Akun otomatis masuk daftar pantauan detector.\n' +
        'Saat akun ini UP, detector akan memberi tahu grup ini dan men-tag kamu.',
      m,
      mentions
    );
  }

  /**
   * `/addakun` — di grup menjadi alias `/verif` karena dasarnya sama.
   * Di chat pribadi hanya owner yang boleh menambah akun pantauan.
   */
  async handleAddAccount(sock, m, rest, isOwner) {
    const chat = m.key.remoteJid;
    if (isGroupJid(chat)) {
      await this.handleVerif(sock, m, rest);
      return;
    }

    if (!isOwner) {
      await this.reply(m, 'Menambah pantauan di chat pribadi khusus owner.\nDi grup, gunakan /verif <nama_acc>.');
      return;
    }

    const input = String(rest || '').trim();
    if (!input) {
      await this.reply(m, 'Gunakan: /addakun @username\nContoh: /addakun @rinorstr');
      return;
    }

    const res = await this.ensureMonitored(input);
    if (res.ok) {
      await this.reply(
        m,
        `✅ *${res.account}* ditambahkan ke daftar pantauan.\n` +
          `Total: ${res.total} akun • status ${this.statusLine()}.\n` +
          'Video berikutnya dicek otomatis dalam ±3 menit.'
      );
      return;
    }

    if (res.reason === 'exists') {
      await this.reply(m, `ℹ️ *${res.account}* sudah ada di daftar pantauan.`);
      return;
    }
    if (res.reason === 'unavailable') {
      await this.reply(m, '❌ Daftar pantauan tidak tersedia saat ini.');
      return;
    }
    await this.reply(
      m,
      '❌ Username tidak valid. Gunakan huruf, angka, titik, atau underscore (2-24 karakter).\n' +
        'Contoh: /addakun @rinorstr'
    );
  }

  /**
   * `/delakun` — di grup menghapus verif grup ini (dan pantauan bila tidak
   * ada verif lain). Di chat pribadi owner menghapus semua verif + pantauan.
   */
  async handleDelAccount(sock, m, rest, isOwner) {
    const chat = m.key.remoteJid;
    const input = String(rest || '').trim();
    if (!input) {
      await this.reply(m, 'Gunakan: /delakun @username\nContoh: /delakun @rinorstr');
      return;
    }

    const accName = normalizeAccount(input);
    if (!accName) {
      await this.reply(m, '❌ Username tidak valid.\nContoh: /delakun @rinorstr');
      return;
    }

    if (!isGroupJid(chat)) {
      if (!isOwner) {
        await this.reply(m, 'Menghapus pantauan di chat pribadi khusus owner.');
        return;
      }
      const removedVerif = await this.store.removeAllByAccount(accName);
      const res = this.accounts ? await this.accounts.remove(accName) : { ok: false };
      if (res.ok) this.refreshMonitor();
      if (!removedVerif && !res.ok) {
        await this.reply(m, `ℹ️ *${accName}* tidak ada di daftar verif maupun pantauan.`);
        return;
      }
      await this.reply(
        m,
        `🗑️ *${accName}* dihapus.\n` +
          `Verifikasi dihapus: ${removedVerif} entri\n` +
          `Pantauan: ${res.ok ? 'dihapus' : 'tidak ada'}\n` +
          `Status detector: ${this.statusLine()}`
      );
      return;
    }

    const allowed = isOwner || (await this.isGroupAdmin(sock, m, chat));
    if (!allowed) {
      await this.reply(m, 'Perintah ini khusus admin grup atau owner bot.');
      return;
    }

    const removedHere = await this.store.remove(chat, accName);
    const remaining = this.store.entriesByAccount(accName).length;
    let monitorRemoved = false;
    if (remaining === 0 && this.accounts) {
      const res = await this.accounts.remove(accName);
      monitorRemoved = Boolean(res.ok);
      if (monitorRemoved) this.refreshMonitor();
    }

    if (!removedHere && !monitorRemoved) {
      await this.reply(m, `ℹ️ *${accName}* tidak ada di daftar verif grup ini maupun pantauan.`);
      return;
    }

    const lines = [`🗑️ *${accName}* dihapus dari grup ini.`];
    if (remaining > 0) {
      lines.push(`Masih terverifikasi di ${remaining} grup lain, jadi tetap dipantau.`);
    } else if (monitorRemoved) {
      lines.push('Akun juga dihapus dari daftar pantauan detector.');
    }
    await this.reply(m, lines.join('\n'));
  }

  async handleListAccounts(m) {
    const list = this.accounts ? this.accounts.list() : [];
    const verified = new Map(
      this.store.allAccounts().map((item) => [accountKey(item.accName), item])
    );
    const seen = new Set(list.map((acc) => accountKey(acc)));

    const lines = [
      '📋 *Akun TikTok yang dipantau*',
      `Status: ${this.statusLine()} • ${list.length} akun`,
      '',
    ];

    if (!list.length && !verified.size) {
      lines.push('Belum ada akun. Tambahkan dengan /addakun @username atau /verif <nama_acc>.');
      await this.reply(m, lines.join('\n'));
      return;
    }

    list.forEach((account, i) => {
      const info = verified.get(accountKey(account));
      const status = info ? `terverif di ${info.groups} grup` : 'pantauan';
      lines.push(`${i + 1}. ${displayAccount(account)} — ${status}`);
    });

    // Hanya tampilkan akun yang benar-benar belum ada di daftar pantauan.
    const extra = [...verified.values()].filter((item) => !seen.has(accountKey(item.accName)));
    if (extra.length) {
      lines.push('', '⚠️ *Terverifikasi tapi belum masuk pantauan:*');
      for (const item of extra) {
        lines.push(`• ${displayAccount(item.accName)} — ${item.groups} grup`);
      }
    }

    lines.push('');
    lines.push('Tambah: /addakun @username atau /verif <nama_acc>');
    lines.push('Hapus: /delakun @username');
    await this.reply(m, lines.join('\n'));
  }

  /**
   * `.me` — tampilkan akun TikTok yang tertaut ke nomor WhatsApp user,
   * lengkap dengan status UP, hashtag, dan CN hari ini. Bisa dipakai di grup
   * maupun chat pribadi.
   */
  async handleMe(m, rest) {
    const link = senderLink(m);
    const candidates = [link.userJid, link.userPn, m.key.participantAlt, m.key.remoteJidAlt].filter(
      Boolean
    );

    // Satu akun TikTok bisa terverif di beberapa grup. Tanpa deduplikasi,
    // `.me` mengulang blok profil yang sama dan teksnya membengkak.
    const seenAccounts = new Set();
    let entries = this.store.entriesForUser(candidates).filter((entry) => {
      const key = accountKey(entry.accName);
      if (!key || seenAccounts.has(key)) return false;
      seenAccounts.add(key);
      return true;
    });
    if (!entries.length) {
      await this.reply(
        m,
        [
          '👤 *Profil TikTok kamu*',
          '',
          'Belum ada akun TikTok yang tertaut ke nomor WhatsApp ini.',
          'Verifikasi dulu di grup dengan:',
          '/verif <nama_acc TikTok>',
          '',
          'Contoh: /verif @kagenouofficial',
        ].join('\n')
      );
      return;
    }

    const filter = accountKey(rest);
    if (filter) entries = entries.filter((e) => accountKey(e.accName) === filter);
    if (!entries.length) {
      await this.reply(m, `❌ Akun *${displayAccount(rest)}* belum tertaut ke nomor kamu.`);
      return;
    }

    const defaultHashtag = normalizeHashtag(this.cfg.tiktokHashtag || '#margaecn');
    const defaultCn = normalizeCn(this.cfg.tiktokCnKeyword || 'ECN');
    const today = this.store.todayVideos();

    // Ambil profil TikTok secara paralel. Batasi 5 akun supaya `.me` tidak
    // menembak API terlalu banyak kalau satu nomor punya banyak akun.
    const profiles = await Promise.all(
      entries.map((entry, index) =>
        index < 5 ? this.fetchProfile(entry.accName) : Promise.resolve(null)
      )
    );

    const header =
      entries.length === 1
        ? '🎵 *PROFIL TIKTOK KAMU*'
        : `🎵 *PROFIL TIKTOK KAMU* (${entries.length} akun)`;
    const sections = entries.map((entry, index) => {
      const acc = normalizeAccount(entry.accName);
      const hashtag = normalizeHashtag(entry.hashtag) || defaultHashtag;
      const cn = normalizeCn(entry.cnKeyword) || defaultCn;
      const videos = today.filter((v) => accountKey(v.username) === accountKey(acc));
      return this.renderProfile(entry, profiles[index], videos, hashtag, cn);
    });

    const text = [
      header,
      '',
      sections.join('\n\n━━━━━━━━━━━━━━━\n\n'),
      '',
      `📊 *Total akun tertaut*: ${entries.length}`,
      '🗑️ Hapus tautan: /unverif <nama_acc>',
    ].join('\n');

    // Kartu gambar memakai avatar akun pertama yang profilnya berhasil diambil.
    const firstIndex = profiles.findIndex(Boolean);
    const firstProfile = firstIndex >= 0 ? profiles[firstIndex] : null;
    const cardEntry = firstIndex >= 0 ? entries[firstIndex] : entries[0];
    let card = null;
    const avatar = await fetchAvatar(avatarUrlOf(firstProfile));
    if (avatar) {
      try {
        card = await menuBanner.buildAdReply({
          thumbnail: avatar,
          title: `${this.cfg.botName || 'Tsukasa'} • Profil TikTok`,
          description:
            entries.length === 1
              ? `Profil ${displayAccount(cardEntry.accName)}`
              : `${entries.length} akun TikTok tertaut`,
          sourceUrl: `https://www.tiktok.com/@${normalizeAccount(cardEntry.accName)}`,
        });
      } catch {
        card = null;
      }
    }

    // Teks profil dikirim lebih dulu dan dipecah per byte UTF-8. Kartu avatar
    // menyusul terpisah: bila unduh/unggah gambar gagal, data `.me` tetap tampil.
    const sent = await this.replyLong(m, text);
    if (!sent) {
      await this.reply(m, `⚠️ Profil gagal dikirim. Coba ${this.cfg.botPrefix || '.'}me <nama_akun>.`);
    }

    if (card) {
      const cardCaption =
        entries.length === 1
          ? `🎵 Profil ${displayAccount(cardEntry.accName)}`
          : `🎵 ${entries.length} akun TikTok tertaut`;
      await wa
        .sendText(m.key.remoteJid, cardCaption, m, undefined, card)
        .catch((err) => log.warn('[VERIF] kartu profil gagal dikirim:', err && err.message));
    }
  }

  async handleList(m) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Daftar verif hanya bisa dilihat di dalam grup.');
      return;
    }

    const list = this.store.list(chat);
    if (!list.length) {
      await this.reply(m, 'Belum ada ACC yang terverif di GC ini.');
      return;
    }

    const lines = ['📋 *Daftar ACC terverif di GC ini*', ''];
    list.forEach((e, i) => {
      const linked = e.userPn || e.userJid;
      const by = linked && !/@lid$/i.test(linked) ? ` — @${jidUser(linked)}` : '';
      lines.push(
        `${i + 1}. *${e.accName}*${by} — ${e.hashtag || '-'} (CN ${e.cnKeyword || '-'})`
      );
    });
    lines.push('');
    lines.push('Hapus: /unverif <nama_acc>');
    await this.reply(m, lines.join('\n'));
  }

  async handleUnverif(m, rest) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Unverif hanya bisa dilakukan di dalam grup.');
      return;
    }

    const accName = normalizeAccount(rest);
    if (!accName) {
      await this.reply(m, 'Gunakan: /unverif <nama_acc>');
      return;
    }

    const removed = await this.store.remove(chat, accName);
    const remaining = this.store.entriesByAccount(accName).length;
    let monitorRemoved = false;
    if (removed && remaining === 0 && this.accounts) {
      const res = await this.accounts.remove(accName);
      monitorRemoved = Boolean(res.ok);
      if (monitorRemoved) this.refreshMonitor();
    }

    let text = removed
      ? `🗑️ ACC ${accName} dihapus dari daftar verif GC ini.`
      : `ACC ${accName} tidak ditemukan di daftar verif GC ini.`;
    if (monitorRemoved) text += '\nAkun juga dihapus dari daftar pantauan detector.';
    else if (remaining > 0) text += `\nAkun masih terverifikasi di ${remaining} grup lain.`;
    await this.reply(m, text);
  }

  async handleSiapaUp(m, rest) {
    // Tanpa argumen tampilkan semua akun, bukan hanya CN default.
    const cn = normalizeCn(rest);
    const scope = cn ? `ACC ${cn}` : 'semua akun';
    const videos = this.store.latestPerAccount(1, cn).slice(0, 30);

    if (!videos.length) {
      await this.reply(m, `Belum ada yang UP hari ini untuk ${scope}.`);
      return;
    }

    const lines = [`📋 *Siapa yang UP hari ini (${scope}):*`];
    videos.forEach((v, i) => {
      const hashtag = v.hashtagStatus === 'Ada' ? 'Ada ✅' : 'Tidak Ada ❌';
      const cnPart = v.cn ? ` • CN ${v.cn} ${v.cnStatus === 'Cocok' ? '✅' : '❎'}` : '';
      lines.push(
        `${i + 1}. ${v.username} (${v.nickname || '-'}) - ${formatClock(
          v.timestamp,
          this.timezone
        )} WIB - # ${hashtag}${cnPart}`
      );
    });
    await this.reply(m, lines.join('\n'));
  }

  async handleCekUp(m, rest) {
    const username = normalizeAccount(rest);
    if (!username) {
      await this.reply(m, 'Gunakan: /cekup @username\nContoh: /cekup @rinorstr');
      return;
    }

    const target = username.toLowerCase();
    // Tanpa filter CN: video tetap terlihat walau nickname belum memuat CN.
    const videos = this.store
      .todayVideos()
      .filter((v) => normalizeAccount(v.username).toLowerCase() === target);

    if (!videos.length) {
      await this.reply(m, `❌ @${username} belum UP hari ini.`);
      return;
    }

    const v = videos[0];
    const lines = [
      `✅ @${username} sudah UP hari ini jam ${formatClock(v.timestamp, this.timezone)} WIB`,
      '',
      `📝 Caption: ${v.caption || '-'}`,
      `📌 ${normalizeHashtag(v.hashtag) || this.cfg.tiktokHashtag} - ${v.hashtagStatus}`,
      `📌 CN ${v.cn || this.cfg.tiktokCnKeyword || 'ECN'} - ${v.cnStatus}`,
      `🔗 ${v.link}`,
    ];
    await this.reply(m, lines.join('\n'));
  }

  async handleHistory(m, rest) {
    // Tanpa argumen tampilkan semua akun, bukan hanya CN default.
    const cn = normalizeCn(rest);
    const scope = cn ? `ACC ${cn}` : 'semua akun';
    const summary = this.store.historySummary(7, cn);

    if (!summary.length) {
      await this.reply(m, `Belum ada riwayat UP 7 hari terakhir untuk ${scope}.`);
      return;
    }

    const lines = [`📅 *Rekap UP 7 hari terakhir (${scope})*`, ''];
    summary.slice(0, 30).forEach((row, i) => {
      const last = row.lastAt
        ? `${formatDate(row.lastAt, this.timezone)} ${formatClock(row.lastAt, this.timezone)}`
        : '-';
      lines.push(
        `${i + 1}. ${row.username} (${row.nickname || '-'}) — ${row.activeDays} hari, ` +
          `${row.total} video (terakhir: ${last})`
      );
    });
    if (summary.length > 30) lines.push('', `…dan ${summary.length - 30} akun lainnya.`);
    await this.reply(m, lines.join('\n'));
  }
}

module.exports = { VerifFeature, COMMANDS };
