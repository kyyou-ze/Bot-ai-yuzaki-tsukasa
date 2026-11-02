'use strict';

const { onlyDigits, jidUser, isGroupJid, destJid, firstNonEmpty } = require('../util');
const wa = require('../wa');

function bareJid(jid) {
  return String(jid || '').replace(/:\d+@/, '@').trim();
}

function digitsOf(jid) {
  return onlyDigits(jidUser(jid));
}

class OwnerDetector {
  constructor() {
    this.jid = '';
    this.lid = '';
    this.extras = [];
    this.tag = 'owner tercinta/sayang';
    this.match = '';
    this.debug = false;

    const ownerJid = String(process.env.OWNER_JID || '').trim();
    const ownerNumber = String(process.env.OWNER_NUMBER || '').trim();
    const ownerLid = String(process.env.OWNER_LID || '').trim();
    const ownerIds = String(process.env.OWNER_IDS || '').trim();

    if (ownerJid) this.jid = bareJid(ownerJid);
    else if (ownerNumber) {
      const n = onlyDigits(ownerNumber);
      if (n) this.jid = `${n}@s.whatsapp.net`;
    }
    if (ownerLid) this.lid = bareJid(ownerLid);
    if (ownerIds) {
      this.extras = ownerIds
        .split(',')
        .map((s) => bareJid(s.trim()))
        .filter(Boolean);
    }

    this.tag = String(process.env.OWNER_TAG || '').trim() || this.tag;
    this.debug = String(process.env.OWNER_DEBUG || '').toLowerCase() === 'true';
    this.match = onlyDigits(process.env.OWNER_MATCH || '');
    if (!this.match && this.jid) this.match = jidUser(this.jid);
  }

  isOwner(sender, chat) {
    const s = bareJid(sender);
    const c = bareJid(chat);
    if (this.jid && (s === this.jid || c === this.jid)) return true;
    if (this.match) {
      if (digitsOf(s) === this.match || digitsOf(c) === this.match) return true;
    }
    if (this.lid && (s === this.lid || c === this.lid)) return true;
    for (const j of this.extras) {
      if (s === j || c === j) return true;
    }
    return false;
  }

  debugLog(sender, chat, got) {
    if (!this.debug) return;
    console.log(
      `[OWNER-DBG] sender=${sender} chat=${chat} digits(sender)=${digitsOf(sender)} digits(chat)=${digitsOf(
        chat
      )} => isOwner=${got}`
    );
  }

  currentMention() {
    return this.jid || this.lid || this.extras[0] || '';
  }

  decorate(isOwner, base) {
    if (!isOwner) return { text: base, mentions: [] };
    const j = this.currentMention();
    if (!j) return { text: base, mentions: [] };
    return {
      text: `@${jidUser(j)} (${this.tag})\n${base}`,
      mentions: [j],
    };
  }
}

// ---------------- Welcome ----------------
class WelcomeHandler {
  constructor() {
    let enabled = true;
    const v = String(process.env.WELCOME_ENABLED || '').trim().toLowerCase();
    if (v) enabled = v === '1' || v === 'true' || v === 'yes';
    this.enabled = enabled;
    this.template =
      String(process.env.WELCOME_TEXT || '').trim() ||
      'Halo {mentions}! Selamat datang di {group}. 🙂\nBaca deskripsi & patuhi aturan ya.';
  }

  async handle(sock, ev) {
    if (!this.enabled || !ev || ev.action !== 'add') return false;
    const participants = Array.isArray(ev.participants) ? ev.participants : [];
    if (participants.length === 0) return false;

    let groupName = ev.id;
    try {
      const meta = await sock.groupMetadata(ev.id);
      if (meta && meta.subject) groupName = meta.subject;
    } catch {
      /* ignore */
    }

    const mentions = participants.map((j) => bareJid(j));
    const mentionText = participants.map((j) => `@${jidUser(j)}`).join(' ');
    const text = this.template
      .replace(/\{mentions\}/g, mentionText)
      .replace(/\{group\}/g, groupName);

    try {
      await sock.sendMessage(ev.id, { text, mentions });
    } catch (err) {
      console.error('[WELCOME] gagal kirim sambutan:', err.message);
    }
    return true;
  }
}

// ---------------- Tag all ----------------
class TagAllHandler {
  constructor(trigger) {
    this.trigger = trigger;
    this.re = /\btagall\b/i;
  }

  async handle(sock, m, content) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) return false;

    const text = wa.extractText(content).trim();
    if (!text) return false;
    const isBangTagAll = /^!\s*tagall\b/i.test(text);
    if (!isBangTagAll && !this.re.test(text)) return false;

    let meta;
    try {
      meta = await sock.groupMetadata(chat);
    } catch {
      return false;
    }
    const all = (meta.participants || []).map((p) => p.id).filter(Boolean);
    if (all.length === 0) return false;

    const batch = 500;
    for (let i = 0; i < all.length; i += batch) {
      const sub = all.slice(i, i + batch);
      await wa.sendText(chat, '👋 Halo semuanya, hadir ya!', m, sub).catch(() => {});
    }
    return true;
  }
}

// ---------------- Reveal view-once (rvo) ----------------
class RvoHandler {
  constructor() {
    this.re = /\brvo\b/i;
  }

  async handle(sock, m, content) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;
    const text = wa.extractText(content);
    if (!this.re.test(text)) return false;

    const ci = wa.contextInfoOf(content);
    const quoted = wa.quotedContent(ci);
    if (!quoted) {
      await wa.sendText(chat, 'Reply foto/video *view-once* lalu ketik *tsukasa rvo* ya ✨', m).catch(() => {});
      return true;
    }

    const kind = quoted.imageMessage ? 'image' : quoted.videoMessage ? 'video' : '';
    if (!kind) {
      await wa.sendText(chat, 'Pesan yang di-reply bukan media *view-once* (foto/video).', m).catch(() => {});
      return true;
    }

    const node = kind === 'image' ? quoted.imageMessage : quoted.videoMessage;
    const mime = node.mimetype || (kind === 'image' ? 'image/jpeg' : 'video/mp4');
    const caption = node.caption || '';

    try {
      const blob = await wa.downloadQuoted(quoted, chat, sender);
      if (kind === 'image') {
        await wa.sendImage(chat, blob, caption, m, mime);
      } else {
        await wa.sendVideo(chat, blob, caption, m, mime);
      }
    } catch (err) {
      console.error('[RVO] gagal:', err.message);
      await wa.sendText(chat, 'Gagal mengunduh/mengirim ulang media view-once 😔', m).catch(() => {});
    }
    return true;
  }
}

module.exports = {
  OwnerDetector,
  WelcomeHandler,
  TagAllHandler,
  RvoHandler,
  bareJid,
  firstNonEmpty,
  destJid,
};
