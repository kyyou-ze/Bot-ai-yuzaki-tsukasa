'use strict';

const log = require('../logger');
const wa = require('../wa');
const { isGroupJid, jidUser, onlyDigits } = require('../util');

const TICK_MS = 30 * 1000;
const META_CACHE_MS = 5 * 60 * 1000;
const SPAM_WINDOW_MS = 10 * 1000;
const SPAM_LIMIT = 8;
const SPAM_NOTIFY_MS = 30 * 1000;

const COMMANDS = new Set([
  'jadwal',
  'jadwalgrup',
  'antilink',
  'antispam',
  'moderasi',
  'resetwarn',
  'mute',
  'unmute',
]);

const LINK_ALLOW_HOSTS = [
  'whatsapp.com',
  'whatsapp.net',
  'wa.me',
  'chat.whatsapp.com',
];

function normalizeHost(value) {
  let raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  raw = raw.replace(/^https?:\/\//, '').split('/')[0].split('?')[0];
  raw = raw.replace(/^www\./, '').replace(/:\d+$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(raw)) return '';
  return raw;
}

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
  const date = d.toISOString().slice(0, 10);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return {
    date,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    weekday,
    weekend: weekday === 0 || weekday === 6,
  };
}

function bare(jid) {
  return String(jid || '').replace(/:\d+@/, '@').trim();
}

function normalizeTarget(value) {
  const s = bare(value);
  if (/^\d{6,}$/.test(s)) return `${s}@s.whatsapp.net`;
  return s;
}

function targetFromParts(parts) {
  for (const part of Array.isArray(parts) ? parts : []) {
    const digits = onlyDigits(part);
    if (digits.length >= 6) return normalizeTarget(digits);
  }
  return '';
}

function sameUser(a, b) {
  if (!a || !b) return false;
  if (bare(a) === bare(b)) return true;
  const da = onlyDigits(jidUser(a));
  const db = onlyDigits(jidUser(b));
  return Boolean(da && db && da === db);
}

function hostAllowed(url, extraHosts = []) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const allow = [...LINK_ALLOW_HOSTS, ...(Array.isArray(extraHosts) ? extraHosts : [])];
    return allow.some((allowed) => host === allowed || host.endsWith('.' + allowed));
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

  targetOf(m) {
    const content = wa.contentOf(m);
    const ci = wa.contextInfoOf(content);
    const mentions = (ci && Array.isArray(ci.mentionedJid) && ci.mentionedJid) || [];
    if (mentions[0]) return normalizeTarget(mentions[0]);
    if (ci && ci.participant) return normalizeTarget(ci.participant);
    return '';
  }

  warnLimit(state) {
    return Math.max(1, Number(state && state.warnLimit) || Number(this.cfg.warnLimit) || 5);
  }

  muteMinutes(state) {
    return Math.max(
      1,
      Number(state && state.muteMinutes) || Number(this.cfg.muteMinutes) || 10
    );
  }

  async logAction(chat, text) {
    const target = String(
      (this.cfg && (this.cfg.modLogJid || this.cfg.ownerJid)) || ''
    ).trim();
    if (!target) return;
    const jid = target.includes('@')
      ? target
      : `${target.replace(/\D+/g, '')}@s.whatsapp.net`;
    if (!jid || jid.startsWith('@')) return;
    await wa
      .sendText(jid, `🛡️ *Moderation log*\nGrup: ${chat}\n${text}`)
      .catch(() => {});
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
      const schedule = { ...(state.schedule || {}) };
      if (['status', 'cek', 'info'].includes(sub)) {
        await this.reply(m, this.formatSchedule(chat, state));
        return true;
      }
      if (['off', 'mati', 'stop', 'nonaktif', 'hapus', 'reset'].includes(sub)) {
        await this.store.setGroupGuard(chat, {
          schedule: { ...schedule, enabled: false },
        });
        await this.reply(m, '⏹️ Jadwal buka/tutup grup dinonaktifkan.');
        return true;
      }
      if (['on', 'aktif', 'aktifkan', 'nyala'].includes(sub)) {
        if (!schedule.open || !schedule.close) {
          await this.reply(
            m,
            'Atur dulu jam buka dan tutup.\nContoh: !jadwal buka 06:00 lalu !jadwal tutup 22:00'
          );
          return true;
        }
        if (schedule.open === schedule.close) {
          await this.reply(
            m,
            'Jam buka dan tutup tidak boleh sama. Contoh: buka 06:00, tutup 22:00.'
          );
          return true;
        }
        await this.store.setGroupGuard(chat, {
          schedule: { ...schedule, enabled: true },
        });
        await this.reply(m, '✅ Jadwal buka/tutup grup diaktifkan.');
        return true;
      }
      if (['weekend', 'weekendonly', 'akhirpekan'].includes(sub)) {
        const on = ['on', 'aktif', 'aktifkan', 'nyala', '1'].includes(value.toLowerCase());
        const off = ['off', 'mati', 'nonaktif', 'nonaktifkan', '0'].includes(value.toLowerCase());
        if (!on && !off) {
          await this.reply(
            m,
            `Jadwal akhir pekan: *${schedule.weekendOnly ? 'aktif' : 'nonaktif'}*\n` +
              'Gunakan: !jadwal weekend on|off'
          );
          return true;
        }
        await this.store.setGroupGuard(chat, {
          schedule: { ...schedule, weekendOnly: on },
        });
        await this.reply(
          m,
          on
            ? '✅ Jadwal hanya berlaku Sabtu & Minggu.'
            : '⏹️ Jadwal berlaku setiap hari.'
        );
        return true;
      }
      if (['test', 'tes', 'uji'].includes(sub)) {
        const action = (parts[1] || '').toLowerCase();
        if (['open', 'buka', 'close', 'tutup'].includes(action)) {
          const act = ['open', 'buka'].includes(action) ? 'open' : 'close';
          const ok = await this.apply(sock, chat, act);
          await this.logAction(chat, `Test jadwal ${act} oleh ${bare(sender)} -> ${ok ? 'sukses' : 'gagal'}`);
          await this.reply(
            m,
            ok
              ? `✅ Test ${act === 'open' ? 'buka' : 'tutup'} grup berhasil.`
              : '❌ Test gagal. Pastikan bot admin grup dan pengaturan grup diizinkan.'
          );
          return true;
        }

        const { botAdmin } = await this.participantInfo(sock, chat, '');
        const overnight =
          minutesOf(schedule.open) >= 0 &&
          minutesOf(schedule.close) >= 0 &&
          minutesOf(schedule.close) <= minutesOf(schedule.open);
        await this.reply(
          m,
          [
            '🧪 *Test Jadwal (dry-run)*',
            `Bot admin : ${botAdmin ? 'ya' : 'tidak'}`,
            `Status    : ${schedule.enabled ? 'aktif' : 'nonaktif'}`,
            `Buka      : ${schedule.open || '-'}`,
            `Tutup     : ${schedule.close || '-'}`,
            `Weekend   : ${schedule.weekendOnly ? 'hanya Sabtu/Minggu' : 'setiap hari'}`,
            `Mode      : ${overnight ? 'lewat tengah malam' : 'hari yang sama'}`,
            '',
            'Untuk benar-benar menguji: !jadwal test open|close',
          ].join('\n')
        );
        return true;
      }
      if (['buka', 'open'].includes(sub)) {
        const time = normalizeTime(value);
        if (!time) {
          await this.reply(m, 'Format jam salah. Contoh: !jadwal buka 06:00');
          return true;
        }
        if (schedule.close && schedule.close === time) {
          await this.reply(m, 'Jam buka tidak boleh sama dengan jam tutup.');
          return true;
        }
        const next = { ...schedule, open: time, enabled: true };
        await this.store.setGroupGuard(chat, { schedule: next });
        const overnight = schedule.close && minutesOf(schedule.close) <= minutesOf(time);
        await this.reply(
          m,
          `🔓 Jam buka grup disetel ke *${time}* (${this.cfg.timezone || 'Asia/Jakarta'}).` +
            (overnight ? '\nℹ️ Jadwal ini melewati tengah malam (tutup lebih awal dari buka).' : '')
        );
        return true;
      }
      if (['tutup', 'close'].includes(sub)) {
        const time = normalizeTime(value);
        if (!time) {
          await this.reply(m, 'Format jam salah. Contoh: !jadwal tutup 22:00');
          return true;
        }
        if (schedule.open && schedule.open === time) {
          await this.reply(m, 'Jam tutup tidak boleh sama dengan jam buka.');
          return true;
        }
        const next = { ...schedule, close: time, enabled: true };
        await this.store.setGroupGuard(chat, { schedule: next });
        const overnight = schedule.open && minutesOf(time) <= minutesOf(schedule.open);
        await this.reply(
          m,
          `🔒 Jam tutup grup disetel ke *${time}* (${this.cfg.timezone || 'Asia/Jakarta'}).` +
            (overnight ? '\nℹ️ Jadwal ini melewati tengah malam (tutup lebih awal dari buka).' : '')
        );
        return true;
      }
      await this.reply(
        m,
        [
          '*Jadwal Buka/Tutup Grup*',
          '!jadwal status',
          '!jadwal buka 06:00',
          '!jadwal tutup 22:00',
          '!jadwal weekend on|off',
          '!jadwal test',
          '!jadwal test open|close',
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

      if (['allow', 'izinkan', 'add', 'tambah'].includes(sub)) {
        const host = normalizeHost(value);
        if (!host) {
          await this.reply(
            m,
            'Format domain salah. Contoh: !antilink allow youtube.com'
          );
          return true;
        }
        const allow = [...new Set([...(state.linkAllow || []), host])];
        await this.store.setGroupGuard(chat, { linkAllow: allow });
        await this.reply(m, `✅ Domain *${host}* diizinkan di grup ini.`);
        return true;
      }

      if (['unallow', 'hapus', 'remove', 'del'].includes(sub)) {
        const host = normalizeHost(value);
        if (!host) {
          await this.reply(m, 'Format: !antilink unallow youtube.com');
          return true;
        }
        const allow = (state.linkAllow || []).filter((h) => h !== host);
        await this.store.setGroupGuard(chat, { linkAllow: allow });
        await this.reply(m, `🗑️ Domain *${host}* dikeluarkan dari allowlist.`);
        return true;
      }

      if (['list', 'daftar', 'allowlist'].includes(sub)) {
        const allow = state.linkAllow || [];
        await this.reply(
          m,
          [
            `Antilink: *${state.antilink ? 'aktif' : 'nonaktif'}*`,
            'Domain allowlist:',
            ...(allow.length ? allow.map((h) => `• ${h}`) : ['• (kosong)']),
            '',
            'Tambahkan: !antilink allow domain.com',
          ].join('\n')
        );
        return true;
      }

      await this.reply(
        m,
        [
          `Antilink saat ini: *${state.antilink ? 'aktif' : 'nonaktif'}*`,
          `Allowlist: ${(state.linkAllow || []).length ? state.linkAllow.join(', ') : '(kosong)'}`,
          '',
          '!antilink on|off',
          '!antilink allow domain.com',
          '!antilink unallow domain.com',
          '!antilink list',
        ].join('\n')
      );
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

    if (name === 'resetwarn') {
      if (sub === 'all' || sub === 'semua') {
        const warns = this.store.listWarns(chat);
        for (const w of warns) await this.store.clearWarns(chat, w.user);
        await this.reply(m, `🧹 Semua peringatan di grup ini direset (${warns.length} pengguna).`);
        await this.logAction(chat, `Reset semua warn oleh ${bare(sender)} (${warns.length} pengguna)`);
        return true;
      }

      const target = this.targetOf(m) || targetFromParts(parts);
      if (!target) {
        await this.reply(m, 'Mention/reply pengguna, atau tulis: !resetwarn all');
        return true;
      }
      const rec = this.store.getWarn(chat, target);
      await this.store.clearWarns(chat, target);
      await this.reply(m, `🧹 Peringatan untuk @${jidUser(target)} direset (sebelumnya ${rec.count}).`, [
        target,
      ]);
      await this.logAction(chat, `Reset warn ${bare(target)} oleh ${bare(sender)} (${rec.count})`);
      return true;
    }

    if (name === 'mute') {
      const target = this.targetOf(m) || targetFromParts(parts);
      if (!target) {
        await this.reply(
          m,
          'Format: !mute [menit] @pengguna (atau reply pesan). Contoh: !mute 10 @user'
        );
        return true;
      }

      const targetInfo = await this.participantInfo(sock, chat, target);
      if (targetInfo.admin && !isOwner) {
        await this.reply(m, 'Tidak bisa mute admin grup lain.');
        return true;
      }

      const requested = parseInt(parts[0], 10);
      const minutes = Math.max(
        1,
        Math.min(24 * 60, Number.isFinite(requested) ? requested : this.muteMinutes(state))
      );
      const until = Date.now() + minutes * 60 * 1000;
      await this.store.muteGroupUser(chat, target, until);
      await this.reply(
        m,
        `🔇 @${jidUser(target)} dimute selama *${minutes} menit*. Semua pesannya akan dihapus.`,
        [target]
      );
      await this.logAction(chat, `Mute ${bare(target)} selama ${minutes} menit oleh ${bare(sender)}`);
      return true;
    }

    if (name === 'unmute') {
      const target = this.targetOf(m) || targetFromParts(parts);
      if (!target) {
        await this.reply(m, 'Format: !unmute @pengguna (atau reply pesan).');
        return true;
      }
      await this.store.clearGroupMute(chat, target);
      await this.reply(m, `🔊 Mute @${jidUser(target)} dicabut.`, [target]);
      await this.logAction(chat, `Unmute ${bare(target)} oleh ${bare(sender)}`);
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
          `Allowlist: ${(state.linkAllow || []).length} domain`,
          `Warn max : ${this.warnLimit(state)}`,
          `Mute     : ${this.muteMinutes(state)} menit sebelum kick`,
          '',
          '!antilink on|off',
          '!antilink allow domain.com',
          '!antispam on|off',
          '!jadwal buka 06:00',
          '!jadwal tutup 22:00',
          '!jadwal weekend on|off',
          '!mute [menit] @user',
          '!unmute @user',
          '!resetwarn @user | all',
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
      `Hari   : ${s.weekendOnly ? 'Sabtu & Minggu' : 'setiap hari'}`,
      `Antilink: ${state.antilink ? 'aktif' : 'nonaktif'} | Antispam: ${state.antispam ? 'aktif' : 'nonaktif'}`,
      `Allowlist: ${(state.linkAllow || []).length ? state.linkAllow.join(', ') : '(kosong)'}`,
    ].join('\n');
  }

  async handleMessage(sock, m, content, text) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) return false;
    const sender = m.key.participant || chat;
    const state = this.store.getGroupGuard(chat);

    // Mute tetap berlaku walau antilink/antispam dimatikan. WhatsApp tidak
    // punya mute native untuk member, jadi pesan mereka dihapus otomatis.
    const mute = this.store.getGroupMute(chat, bare(sender));
    if (mute.muted) {
      const who = await this.participantInfo(sock, chat, sender);
      if (!who.admin) {
        try {
          await sock.sendMessage(chat, { delete: m.key });
        } catch (err) {
          log.debug('[GUARD] gagal hapus pesan mute:', err.message);
        }
        const key = `mute|${chat}|${sender}`;
        const last = this.spamNotifyAt.get(key) || 0;
        if (Date.now() - last > 60 * 1000) {
          this.spamNotifyAt.set(key, Date.now());
          const until = new Date(mute.until).toLocaleTimeString('id-ID', {
            timeZone: this.cfg.timezone || 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
          });
          await wa
            .sendText(
              chat,
              `🔇 @${jidUser(sender)} sedang dimute sampai ${until}. Pesan dihapus otomatis.`,
              m,
              [sender]
            )
            .catch(() => {});
        }
        return true;
      }
    }

    if (!state.antilink && !state.antispam) return false;

    const who = await this.participantInfo(sock, chat, sender);
    if (who.admin) return false;

    if (state.antilink) {
      const blocked = findUrls(text).filter(
        (url) => !hostAllowed(url, state.linkAllow)
      );
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

    const state = this.store.getGroupGuard(chat);
    const limit = this.warnLimit(state);
    const rec = await this.store.addWarn(chat, sender, reason);
    const key = `${chat}|${sender}`;
    const last = this.spamNotifyAt.get(key) || 0;
    const minutes = this.muteMinutes(state);
    const willMute = rec.count >= limit - 1 && rec.count < limit;
    const willKick = rec.count >= limit;
    let note = `⚠️ @${jidUser(sender)} pesan dihapus (${reason}). Peringatan ${rec.count}/${limit}.`;
    if (willMute) {
      note += `\n🔇 Kamu dimute ${minutes} menit. Pelanggaran berikutnya = dikeluarkan.`;
    }

    if (Date.now() - last > SPAM_NOTIFY_MS || willMute || willKick) {
      this.spamNotifyAt.set(key, Date.now());
      await wa.sendText(chat, note, m, [sender]).catch(() => {});
    }

    if (willMute) {
      await this.store.muteGroupUser(
        chat,
        bare(sender),
        Date.now() + minutes * 60 * 1000
      );
    }

    if (willKick) {
      await this.store.clearGroupMute(chat, bare(sender));
      try {
        await sock.groupParticipantsUpdate(chat, [bare(sender)], 'remove');
        await wa
          .sendText(
            chat,
            `🚪 @${jidUser(sender)} dikeluarkan setelah ${limit} peringatan.`,
            m,
            [sender]
          )
          .catch(() => {});
      } catch (err) {
        log.warn('[GUARD] gagal mengeluarkan peserta:', err.message);
      }
    }

    await this.logAction(
      chat,
      `${willKick ? 'Kick' : willMute ? 'Mute' : 'Warn'} ${bare(sender)} ` +
        `(${reason}) ${rec.count}/${limit}`
    );
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const entries = this.store.listGroupGuards();
      if (!entries.length) return;
      const sock = wa.getSock();
      if (!sock) return;
      const { date, minutes, weekend } = localClock(this.cfg.tzOffset);

      for (const [chat, entry] of entries) {
        const s = entry.schedule || {};
        if (!s.enabled || !s.open || !s.close) continue;
        if (s.weekendOnly && !weekend) continue;

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
