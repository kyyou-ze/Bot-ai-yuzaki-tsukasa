'use strict';

const log = require('../logger');
const wa = require('../wa');
const { isGroupJid, jidUser, onlyDigits } = require('../util');

const TICK_MS = 30 * 1000;
const META_CACHE_MS = 5 * 60 * 1000;
const SPAM_WINDOW_MS = 10 * 1000;
const SPAM_LIMIT = 8;
const SPAM_NOTIFY_MS = 30 * 1000;

const COMMANDS = new Set(['jadwal', 'jadwalgrup', 'antilink', 'antispam', 'moderasi']);

const LINK_ALLOW_HOSTS = [
  'whatsapp.com',
  'whatsapp.net',
  'wa.me',
  'chat.whatsapp.com',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function normalizeTime(value) {
  const m = String(value || '')
    .trim()
    .match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!m) return '';
  return `${pad2(Number(m[1]))}:${m[2]}`;
}

function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

function localClock(tzOffset) {
  const offset = Number.isFinite(Number(tzOffset)) ? Number(tzOffset) : 7;
  const d = new Date(Date.now() + offset * 60 * 60 * 1000);
  return {
    date: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function bare(jid) {
  return String(jid || '').replace(/:\d+@/, '@').trim();
}

function sameUser(a, b) {
  if (!a || !b) return false;
  if (bare(a) === bare(b)) return true;
  const da = onlyDigits(jidUser(a));
  const db = onlyDigits(jidUser(b));
  return Boolean(da && db && da === db);
}

function hostAllowed(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return LINK_ALLOW_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
  } catch {
    return true;
  }
}

function findUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
}

/**
 * Moderasi grup ringan: antilink, antispam, dan jadwal buka/tutup grup.
 * Semua pengaturan disimpan per grup lewat Store.
 */
class GroupGuard {
  constructor(cfg, store) {
    this.cfg = cfg || {};
    this.store = store;
    this.timer = null;
    this.ticking = false;
    this.metaCache = new Map();
    this.spam = new Map();
    this.spamNotifyAt = new Map();
    this.failureLogAt = new Map();
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(() => {}), TICK_MS);
    if (this.timer.unref) this.timer.unref();
    this.tick().catch(() => {});
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  async metadata(sock, chat) {
    const cached = this.metaCache.get(chat);
    if (cached && Date.now() - cached.at < META_CACHE_MS) return cached.meta;
    try {
      const meta = await sock.groupMetadata(chat);
      this.metaCache.set(chat, { at: Date.now(), meta });
      return meta;
    } catch {
      return null;
    }
  }

  async participantInfo(sock, chat, user) {
    const meta = await this.metadata(sock, chat);
    if (!meta) return { admin: false, botAdmin: false };
    const participants = Array.isArray(meta.participants) ? meta.participants : [];
    const me = sock.user || {};
    const botIds = [me.id, me.lid, me.jid].filter(Boolean);

    let admin = false;
    let botAdmin = false;
    for (const p of participants) {
      const pid = p.id || p.jid;
      const role = String(p.admin || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'superadmin';
      if (!admin && sameUser(pid, user)) admin = isAdmin;
      if (!botAdmin && botIds.some((b) => sameUser(pid, b))) botAdmin = isAdmin;
    }
    return { admin, botAdmin, meta };
  }

  async handleCommand(sock, m, cmd, rest, isOwner) {
    const name = String(cmd || '').toLowerCase();
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;

    if (!isGroupJid(chat)) {
      await this.reply(m, 'Perintah moderasi hanya bisa dipakai di dalam grup.');
      return true;
    }

    const who = await this.participantInfo(sock, chat, sender);
    if (!isOwner && !who.admin) {
      await this.reply(m, 'Perintah ini khusus admin grup.');
      return true;
    }

    const parts = String(rest || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const sub = (parts[0] || 'status').toLowerCase();
    const value = parts.slice(1).join(' ').trim();
    const state = this.store.getGroupGuard(chat);

    if (name === 'jadwal' || name === 'jadwalgrup') {
      if (['status', 'cek', 'info'].includes(sub)) {
        await this.reply(m, this.formatSchedule(chat, state));
        return true;
      }
      if (['off', 'mati', 'stop', 'nonaktif', 'hapus', 'reset'].includes(sub)) {
        await this.store.setGroupGuard(chat, {
          schedule: { ...(state.schedule || {}), enabled: false },
        });
        await this.reply(m, '⏹️ Jadwal buka/tutup grup dinonaktifkan.');
        return true;
      }
      if (['on', 'aktif', 'aktifkan', 'nyala'].includes(sub)) {
        const schedule = state.schedule || {};
        if (!schedule.open || !schedule.close) {
          await this.reply(
            m,
            'Atur dulu jam buka dan tutup.\nContoh: !jadwal buka 06:00 lalu !jadwal tutup 22:00'
          );
          return true;
        }
        await this.store.setGroupGuard(chat, {
          schedule: { ...schedule, enabled: true },
        });
        await this.reply(m, '✅ Jadwal buka/tutup grup diaktifkan.');
        return true;
      }
      if (['buka', 'open'].includes(sub)) {
        const time = normalizeTime(value);
        if (!time) {
          await this.reply(m, 'Format jam salah. Contoh: !jadwal buka 06:00');
          return true;
        }
        const schedule = { ...(state.schedule || {}), open: time, enabled: true };
        await this.store.setGroupGuard(chat, { schedule });
        await this.reply(m, `🔓 Jam buka grup disetel ke *${time}* (${this.cfg.timezone || 'Asia/Jakarta'}).`);
        return true;
      }
      if (['tutup', 'close'].includes(sub)) {
        const time = normalizeTime(value);
        if (!time) {
          await this.reply(m, 'Format jam salah. Contoh: !jadwal tutup 22:00');
          return true;
        }
        const schedule = { ...(state.schedule || {}), close: time, enabled: true };
        await this.store.setGroupGuard(chat, { schedule });
        await this.reply(m, `🔒 Jam tutup grup disetel ke *${time}* (${this.cfg.timezone || 'Asia/Jakarta'}).`);
        return true;
      }
      await this.reply(
        m,
        [
          '*Jadwal Buka/Tutup Grup*',
          '!jadwal status',
          '!jadwal buka 06:00',
          '!jadwal tutup 22:00',
          '!jadwal on | off',
          '',
          'Bot harus admin grup agar bisa mengubah pengaturan grup.',
        ].join('\n')
      );
      return true;
    }

    if (name === 'antilink') {
      const on = ['on', 'aktif', 'aktifkan', 'nyala', '1'].includes(sub);
      const off = ['off', 'mati', 'nonaktif', 'nonaktifkan', '0'].includes(sub);
      if (on || off) {
        await this.store.setGroupGuard(chat, { antilink: on });
        await this.reply(m, on ? '✅ Antilink diaktifkan.' : '⏹️ Antilink dinonaktifkan.');
        return true;
      }
      await this.reply(m, `Antilink saat ini: *${state.antilink ? 'aktif' : 'nonaktif'}*`);
      return true;
    }

    if (name === 'antispam') {
      const on = ['on', 'aktif', 'aktifkan', 'nyala', '1'].includes(sub);
      const off = ['off', 'mati', 'nonaktif', 'nonaktifkan', '0'].includes(sub);
      if (on || off) {
        await this.store.setGroupGuard(chat, { antispam: on });
        await this.reply(m, on ? '✅ Antispam diaktifkan.' : '⏹️ Antispam dinonaktifkan.');
        return true;
      }
      await this.reply(m, `Antispam saat ini: *${state.antispam ? 'aktif' : 'nonaktif'}*`);
      return true;
    }

    if (name === 'moderasi') {
      await this.reply(
        m,
        [
          '*Moderasi Grup*',
          `Antilink : ${state.antilink ? 'aktif' : 'nonaktif'}`,
          `Antispam : ${state.antispam ? 'aktif' : 'nonaktif'}`,
          `Jadwal   : ${state.schedule && state.schedule.enabled ? 'aktif' : 'nonaktif'}`,
          '',
          '!antilink on|off',
          '!antispam on|off',
          '!jadwal buka 06:00',
          '!jadwal tutup 22:00',
        ].join('\n')
      );
      return true;
    }

    return false;
  }

  formatSchedule(chat, state) {
    const s = (state && state.schedule) || {};
    const open = s.open || '-';
    const close = s.close || '-';
    return [
      '🗓️ *Jadwal Grup*',
      `Status : ${s.enabled ? 'aktif' : 'nonaktif'}`,
      `Buka   : ${open}`,
      `Tutup  : ${close}`,
      `Zona   : ${this.cfg.timezone || 'Asia/Jakarta'}`,
      `Antilink: ${state.antilink ? 'aktif' : 'nonaktif'} | Antispam: ${state.antispam ? 'aktif' : 'nonaktif'}`,
    ].join('\n');
  }

  async handleMessage(sock, m, content, text) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) return false;
    const sender = m.key.participant || chat;
    const state = this.store.getGroupGuard(chat);
    if (!state.antilink && !state.antispam) return false;

    const who = await this.participantInfo(sock, chat, sender);
    if (who.admin) return false;

    if (state.antilink) {
      const blocked = findUrls(text).filter((url) => !hostAllowed(url));
      if (blocked.length) {
        await this.punish(sock, chat, m, sender, 'mengirim link');
        return true;
      }
    }

    if (state.antispam) {
      const key = `${chat}|${sender}`;
      const now = Date.now();
      const list = (this.spam.get(key) || []).filter((t) => now - t < SPAM_WINDOW_MS);
      list.push(now);
      this.spam.set(key, list);
      if (list.length > SPAM_LIMIT) {
        this.spam.set(key, []);
        await this.punish(sock, chat, m, sender, 'spam pesan');
        return true;
      }
    }

    return false;
  }

  async punish(sock, chat, m, sender, reason) {
    try {
      await sock.sendMessage(chat, { delete: m.key });
    } catch (err) {
      log.debug('[GUARD] gagal hapus pesan:', err.message);
    }

    const rec = await this.store.addWarn(chat, sender, reason);
    const limit = 5;
    const key = `${chat}|${sender}`;
    const last = this.spamNotifyAt.get(key) || 0;
    if (Date.now() - last > SPAM_NOTIFY_MS) {
      this.spamNotifyAt.set(key, Date.now());
      await wa
        .sendText(
          chat,
          `⚠️ @${jidUser(sender)} pesan dihapus (${reason}). Peringatan ${rec.count}/${limit}.`,
          m,
          [sender]
        )
        .catch(() => {});
    }

    if (rec.count >= limit) {
      try {
        await sock.groupParticipantsUpdate(chat, [bare(sender)], 'remove');
      } catch (err) {
        log.warn('[GUARD] gagal mengeluarkan peserta:', err.message);
      }
    }
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const entries = this.store.listGroupGuards();
      if (!entries.length) return;
      const sock = wa.getSock();
      if (!sock) return;
      const { date, minutes } = localClock(this.cfg.tzOffset);

      for (const [chat, entry] of entries) {
        const s = entry.schedule || {};
        if (!s.enabled || !s.open || !s.close) continue;

        for (const action of ['open', 'close']) {
          const target = minutesOf(action === 'open' ? s.open : s.close);
          if (target < 0) continue;
          const delta = minutes - target;
          if (delta < 0 || delta > 10) continue;

          const token = `${date} ${action === 'open' ? s.open : s.close}`;
          if (entry.events && entry.events[action] === token) continue;

          const ok = await this.apply(sock, chat, action);
          if (ok) {
            await this.store.markGroupGuardEvent(chat, action, token);
          }
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  async apply(sock, chat, action) {
    const { botAdmin } = await this.participantInfo(sock, chat, '');
    if (!botAdmin) {
      const key = `${chat}|${action}`;
      const last = this.failureLogAt.get(key) || 0;
      if (Date.now() - last > 60 * 60 * 1000) {
        this.failureLogAt.set(key, Date.now());
        log.warn(`[GUARD] bot bukan admin grup ${chat}; jadwal ${action} dilewati.`);
      }
      return false;
    }

    try {
      await sock.groupSettingUpdate(
        chat,
        action === 'close' ? 'announcement' : 'not_announcement'
      );
      await wa
        .sendText(
          chat,
          action === 'close'
            ? '🔒 Grup ditutup otomatis sesuai jadwal. Sampai jumpa besok!'
            : '🔓 Grup dibuka otomatis sesuai jadwal. Selamat beraktivitas!'
        )
        .catch(() => {});
      return true;
    } catch (err) {
      log.warn(`[GUARD] gagal ${action} grup ${chat}:`, err.message);
      return false;
    }
  }
}

module.exports = { GroupGuard };
