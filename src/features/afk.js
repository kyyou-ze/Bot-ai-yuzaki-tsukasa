'use strict';

const wa = require('../wa');
const memory = require('../memory');
const { jidUser } = require('../util');

const COMMANDS = new Set(['afk', 'back', 'unafk', 'kembali']);
const AFK_OFF = /^(off|stop|clear|hapus|batal|kembali|balik)$/i;
const AFK_LIST = /^(list|daftar)$/i;
const MAX_REASON = 200;
const NOTICE_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Nama untuk ditampilkan di pesan AFK. Tag/mention sengaja tidak dipakai:
 * notifikasi AFK cukup menyebut nama, tanpa menandai (dan membangunkan) user.
 */
function displayName(jid, pushName) {
  const saved = String(memory.getUserName(jid) || '').trim();
  const push = String(pushName || '').trim();
  return saved || push || jidUser(jid) || 'User';
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  if (total < 60) return `${total} detik`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  if (hours < 24) return `${hours} jam${restMin ? ` ${restMin} menit` : ''}`;
  const days = Math.floor(hours / 24);
  const restHour = hours % 24;
  return `${days} hari${restHour ? ` ${restHour} jam` : ''}`;
}

class AfkFeature {
  constructor(cfg, store) {
    this.store = store;
    this.noticeAt = new Map();
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  async handleCommand(chat, m, cmd, rest, sender) {
    const user = (m && m.key && m.key.participant) || sender || chat;
    const name = String(cmd || '').toLowerCase();
    const arg = String(rest || '').trim();

    if (name === 'back' || name === 'unafk' || name === 'kembali' || AFK_OFF.test(arg)) {
      const existing = this.store.getAfk(user);
      await this.store.clearAfk(user);
      if (existing) {
        const dur = formatDuration(Date.now() - existing.since);
        await wa
          .sendText(chat, `✅ AFK dicabut. Selamat kembali setelah ${dur}!`, m)
          .catch(() => {});
      } else {
        await wa.sendText(chat, 'Kamu tidak sedang AFK.', m).catch(() => {});
      }
      return true;
    }

    if (AFK_LIST.test(arg)) {
      const rows = this.store.listAfkForChat(chat);
      if (rows.length === 0) {
        await wa.sendText(chat, 'Tidak ada member yang sedang AFK di chat ini.', m).catch(() => {});
        return true;
      }
      const body = rows
        .slice(0, 30)
        .map((a) => {
          const reason = a.reason ? ` — ${a.reason}` : '';
          return `• ${displayName(a.user)} (${formatDuration(Date.now() - a.since)})${reason}`;
        })
        .join('\n');
      await wa.sendText(chat, `😴 *Daftar AFK*\n${body}`, m).catch(() => {});
      return true;
    }

    const reason = arg.slice(0, MAX_REASON);
    const existing = this.store.getAfk(user);
    await this.store.setAfk(user, reason, chat);
    const reasonLine = reason ? `\nAlasan: ${reason}` : '';
    await wa
      .sendText(
        chat,
        existing
          ? `😴 Status AFK diperbarui.${reasonLine}\nKirim pesan, sticker, atau media apa saja untuk kembali.`
          : `😴 AFK aktif.${reasonLine}\nKirim pesan, sticker, atau media apa saja untuk kembali.`,
        m
      )
      .catch(() => {});
    return true;
  }

  /**
   * Dipanggil untuk setiap pesan masuk:
   * - mencabut AFK pengirim dan memberi salam kembali,
   * - memberi tahu jika ada user AFK yang di-mention / di-reply.
   */
  async observe(chat, m, content) {
    const sender = (m && m.key && m.key.participant) || chat;
    const self = this.store.getAfk(sender);
    if (self) {
      const dur = formatDuration(Date.now() - self.since);
      const who = displayName(sender, m && m.pushName);
      await this.store.clearAfk(sender);
      await wa
        .sendText(chat, `👋 ${who} sudah kembali setelah ${dur}.`, m)
        .catch(() => {});
    }

    const ctx = wa.contextInfoOf(content);
    if (!ctx) return;

    const targets = [];
    if (Array.isArray(ctx.mentionedJid)) targets.push(...ctx.mentionedJid);
    // Saat pesan AFK user di-reply, contextInfo.participant berisi JID user
    // yang pesannya dikutip.
    if (ctx.participant) targets.push(ctx.participant);

    const seen = new Set();
    for (const raw of targets) {
      const jid = String(raw || '').trim();
      if (!jid || jid === sender || seen.has(jid)) continue;
      seen.add(jid);

      const afk = this.store.getAfk(jid);
      if (!afk) continue;

      const key = `${chat}|${jid}`;
      const last = this.noticeAt.get(key) || 0;
      if (Date.now() - last < NOTICE_COOLDOWN_MS) continue;
      this.noticeAt.set(key, Date.now());
      if (this.noticeAt.size > 2000) {
        this.noticeAt.delete(this.noticeAt.keys().next().value);
      }

      const reason = afk.reason ? `\nAlasan: ${afk.reason}` : '';
      await wa
        .sendText(
          chat,
          `😴 ${displayName(jid)} sedang AFK sejak ${formatDuration(
            Date.now() - afk.since
          )} lalu.${reason}`,
          m
        )
        .catch(() => {});
      break;
    }
  }
}

module.exports = { AfkFeature, formatDuration };
