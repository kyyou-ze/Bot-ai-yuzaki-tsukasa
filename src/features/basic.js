'use strict';

const log = require('../logger');
const memory = require('../memory');
const menuBanner = require('../menubanner');
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

  /**
   * Cek beberapa kandidat JID sekaligus. Di chat pribadi, Baileys modern bisa
   * mengirim remoteJid sebagai @lid sehingga nomor telepon owner hanya ada di
   * field alternatif (remoteJidAlt/remoteJidPn/participantPn).
   */
  isOwnerAny(candidates, chat) {
    const list = Array.isArray(candidates) ? candidates : [candidates];
    return list.filter(Boolean).some((jid) => this.isOwner(jid, chat));
  }

  debugLog(sender, chat, got) {
    if (!this.debug) return;
    log.info(
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

// ---------------- Welcome & Goodbye ----------------
const DEFAULT_WELCOME_TEXT =
  'Halo {mentions}! Selamat datang di {group}. 🙂\nBaca deskripsi & patuhi aturan ya.';
const DEFAULT_GOODBYE_TEXT = 'Selamat jalan {mentions} 👋\nSemoga sukses di luar sana!';
const MAX_GREETING_TEXT = 2000;

/**
 * Blok pembuka bergaya menu. Sengaja tanpa URL: kartu link preview tetap
 * dikirim terpisah, jadi alamat web tidak tampil sebagai baris teks.
 */
function greetingHeader(kind, { group, count, botName } = {}) {
  const name = String(botName || 'Tsukasa').trim() || 'Tsukasa';
  const label = kind === 'goodbye' ? 'Sampai jumpa' : 'Selamat datang';
  return [
    `╭─〔 ${name} 〕`,
    `│ ${label}`,
    `│ Grup: ${String(group || '-').trim() || '-'}`,
    `│ Peserta: ${Number(count) || 0}`,
    '╰──────────',
  ].join('\n');
}

function envEnabled(name, fallback = true) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'y', 'on', 'aktif', 'nyala', 'hidup'].includes(raw)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'mati', 'nonaktif'].includes(raw)) return false;
  return fallback;
}

/**
 * Template dari env biasanya ditulis satu baris (`\n` literal). Ubah escape
 * itu menjadi baris baru sungguhan supaya pesan tidak menampilkan "\n".
 */
function unescapeTemplate(value) {
  return String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

class WelcomeHandler {
  constructor(store, cfg) {
    this.store = store || null;
    this.cfg = cfg || {};
    this.masterEnabled = envEnabled('GREETING_ENABLED', true);
    this.defaultWelcome = {
      enabled: envEnabled('WELCOME_ENABLED', true),
      text:
        unescapeTemplate(process.env.WELCOME_TEXT).trim() || DEFAULT_WELCOME_TEXT,
    };
    this.defaultGoodbye = {
      enabled: envEnabled('GOODBYE_ENABLED', true),
      text:
        unescapeTemplate(process.env.GOODBYE_TEXT).trim() || DEFAULT_GOODBYE_TEXT,
    };
  }

  /** Gabungkan konfigurasi default env dengan override per grup. */
  resolve(chat, kind) {
    const type = kind === 'goodbye' ? 'goodbye' : 'welcome';
    const def = type === 'goodbye' ? this.defaultGoodbye : this.defaultWelcome;
    let saved = { enabled: null, text: '' };
    try {
      if (this.store && typeof this.store.getGreeting === 'function') {
        saved = this.store.getGreeting(chat)[type] || saved;
      }
    } catch {
      /* pakai default */
    }
    return {
      enabled: saved.enabled === null ? def.enabled : Boolean(saved.enabled),
      text: String(saved.text || def.text || '').trim() || def.text,
      custom: Boolean(saved.text),
    };
  }

  participantsOf(list) {
    const out = [];
    const seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      let jid = '';
      if (typeof item === 'string') jid = item;
      else if (item && typeof item === 'object') {
        jid = item.id || item.jid || item.lid || item.phoneNumber || '';
      }
      jid = bareJid(String(jid || '').trim());
      if (!jid) continue;
      if (!/@(s\.whatsapp\.net|lid|g\.us)$/i.test(jid)) {
        const digits = onlyDigits(jid);
        if (!digits) continue;
        jid = `${digits}@s.whatsapp.net`;
      }
      if (seen.has(jid)) continue;
      seen.add(jid);
      out.push(jid);
    }
    return out;
  }

  render(template, ctx = {}) {
    const mentions = Array.isArray(ctx.mentions) ? ctx.mentions : [];
    const mentionText = mentions.map((j) => `@${jidUser(j)}`).join(' ');
    const names = mentions
      .map((j) => memory.getUserName(j) || jidUser(j))
      .filter(Boolean)
      .join(', ');
    return unescapeTemplate(template)
      .replace(/\{mentions\}/gi, mentionText)
      .replace(/\{user\}|\{name\}|\{nama\}/gi, names || mentionText)
      .replace(/\{group\}|\{grup\}/gi, String(ctx.group || ''))
      .replace(/\{count\}|\{jumlah\}/gi, String(mentions.length))
      .trim();
  }

  /** Header menu + isi sambutan/perpisahan. */
  decorate(kind, text, ctx = {}) {
    const header = greetingHeader(kind, {
      group: ctx.group,
      count: Array.isArray(ctx.mentions) ? ctx.mentions.length : ctx.count,
      botName: this.cfg && this.cfg.botName,
    });
    return text ? `${header}\n\n${text}` : header;
  }

  /**
   * Kartu banner untuk welcome/goodbye. URL target tidak ditulis ke teks,
   * hanya dipakai sebagai canonical-url preview.
   */
  async banner(kind, group) {
    const fallback = new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 8000);
      if (typeof timer.unref === 'function') timer.unref();
    });
    try {
      return await Promise.race([
        menuBanner.buildGreetingPreview({
          title: (this.cfg && this.cfg.botName) || 'Tsukasa',
          description:
            kind === 'goodbye'
              ? `Sampai jumpa dari ${String(group || 'grup').trim() || 'grup'}.`
              : `Selamat datang di ${String(group || 'grup').trim() || 'grup'}.`,
        }),
        fallback,
      ]);
    } catch (err) {
      log.warn('[GREETING] banner dilewati:', err && err.message ? err.message : err);
      return null;
    }
  }

  async groupName(sock, chat) {
    try {
      if (!sock || typeof sock.groupMetadata !== 'function') return chat;
      const meta = await Promise.race([
        sock.groupMetadata(chat),
        new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 5000);
          if (typeof timer.unref === 'function') timer.unref();
        }),
      ]);
      return (meta && meta.subject) || chat;
    } catch {
      return chat;
    }
  }

  async handle(sock, ev) {
    if (!this.masterEnabled || !ev) return false;
    const action = String(ev.action || '').toLowerCase();
    const kind = action === 'add' ? 'welcome' : action === 'remove' ? 'goodbye' : '';
    if (!kind) return false;

    const chat = String(ev.id || '').trim();
    if (!isGroupJid(chat)) return false;

    const conf = this.resolve(chat, kind);
    if (!conf.enabled) return false;

    const mentions = this.participantsOf(ev.participants);
    if (!mentions.length) return false;

    const group = await this.groupName(sock, chat);
    const text = this.render(conf.text, { mentions, group });
    if (!text) return false;

    const body = this.decorate(kind, text, { mentions, group });
    const preview = await this.banner(kind, group);

    try {
      const content = { text: body, mentions };
      if (preview) content.linkPreview = preview;
      await sock.sendMessage(chat, content);
      log.info(
        `[GREETING] ${kind} ${mentions.length} peserta di ${chat} (${conf.custom ? 'custom' : 'default'})`
      );
      return true;
    } catch (err) {
      log.error(`[GREETING] gagal kirim ${kind}:`, err.message);
      return false;
    }
  }

  async handleCommand(sock, m, cmd, rest, rawRest, allowed, isOwner) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await wa.sendText(chat, 'Perintah ini hanya berlaku di grup.', m);
      return true;
    }
    if (!allowed) {
      await wa.sendText(chat, 'Perintah ini khusus admin grup atau owner bot.', m);
      return true;
    }

    const kind =
      cmd === 'goodbye' || cmd === 'selamattinggal' || cmd === 'pamit' || cmd === 'bye'
        ? 'goodbye'
        : 'welcome';
    const label = kind === 'goodbye' ? 'Perpisahan' : 'Sambutan';
    const conf = this.resolve(chat, kind);

    const full = String(rest || '').trim();
    const first = (full.split(/\s+/)[0] || '').toLowerCase();
    // rawRest mempertahankan newline asli; rest sudah dinormalisasi parser.
    const rawBody = String(rawRest == null ? full : rawRest);
    const body = rawBody
      .replace(/^\s*\S+[^\S\r\n]*/, '')
      .replace(/^\r?\n/, '')
      .trim();

    const help = [
      `⚙️ *Pesan ${label} Grup*`,
      `• .${cmd} on/off — aktifkan atau matikan`,
      `• .${cmd} set <teks> — ganti template (boleh multi-baris)`,
      `• .${cmd} reset — kembali ke template default`,
      `• .${cmd} preview — kirim contoh pesan`,
      `• .${cmd} status — lihat template aktif`,
      '',
      'Placeholder: {mentions} {user} {group} {count}',
      'Tulis \\n di dalam teks (atau kirim pesan multi-baris) untuk baris baru.',
    ].join('\n');

    if (['on', 'aktif', 'nyala', 'hidup', 'enable'].includes(first)) {
      await this.store.setGreeting(chat, kind, { enabled: true });
      await wa.sendText(chat, `✅ Pesan ${label.toLowerCase()} diaktifkan.`, m);
      return true;
    }

    if (['off', 'mati', 'nonaktif', 'disable'].includes(first)) {
      await this.store.setGreeting(chat, kind, { enabled: false });
      await wa.sendText(chat, `❎ Pesan ${label.toLowerCase()} dimatikan.`, m);
      return true;
    }

    if (['reset', 'hapus', 'default', 'bawaan'].includes(first)) {
      await this.store.resetGreeting(chat, kind);
      const def = this.resolve(chat, kind);
      await wa.sendText(
        chat,
        `♻️ Template ${label.toLowerCase()} kembali ke default (${def.enabled ? 'aktif' : 'nonaktif'}).`,
        m
      );
      return true;
    }

    if (['set', 'isi', 'text', 'teks', 'ubah', 'ganti'].includes(first)) {
      if (!body) {
        await wa.sendText(chat, `Tulis teksnya setelah perintah.\nContoh: .${cmd} set Halo {mentions}, selamat datang di {group}!`, m);
        return true;
      }
      if (body.length > MAX_GREETING_TEXT) {
        await wa.sendText(chat, `❌ Teks terlalu panjang (maks ${MAX_GREETING_TEXT} karakter).`, m);
        return true;
      }
      await this.store.setGreeting(chat, kind, { text: body, enabled: true });
      const group = await this.groupName(sock, chat);
      const previewText = this.decorate(
        kind,
        this.render(body, { mentions: [m.key.participant || chat], group }),
        { mentions: [m.key.participant || chat], group }
      );
      await wa.sendText(
        chat,
        `✅ Template ${label.toLowerCase()} disimpan.\n\n*Preview:*\n${previewText}`,
        m
      );
      return true;
    }

    if (['preview', 'tes', 'test', 'contoh'].includes(first)) {
      const actor = bareJid(m.key.participant || chat);
      const group = await this.groupName(sock, chat);
      const body = this.decorate(kind, this.render(conf.text, { mentions: [actor], group }), {
        mentions: [actor],
        group,
      });
      const preview = await this.banner(kind, group);
      const content = { text: body, mentions: [actor] };
      if (preview) content.linkPreview = preview;
      await sock.sendMessage(chat, content);
      return true;
    }

    if (!first || ['status', 'info', 'lihat'].includes(first)) {
      await wa.sendText(
        chat,
        [
          `⚙️ *Pesan ${label} Grup*`,
          `• Status  : ${conf.enabled ? 'aktif' : 'nonaktif'}`,
          `• Sumber  : ${conf.custom ? 'custom grup ini' : 'default bot'}`,
          '',
          '*Template:*',
          conf.text,
          '',
          `Gunakan .${cmd} help untuk cara mengubah.`,
        ].join('\n'),
        m
      );
      return true;
    }

    await wa.sendText(chat, help, m);
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

    // Teks setelah "tagall" dipakai sebagai pesan tag. Contoh:
    // ".tagall woi asw" -> mention semua dengan pesan "woi asw".
    const match = text.match(/\btagall\b\s*([\s\S]*)$/i);
    const custom = match ? match[1].trim() : '';
    const message = custom || '👋 Halo semuanya, hadir ya!';

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
      await wa.sendText(chat, message, m, sub).catch(() => {});
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
      log.error('[RVO] gagal:', err.message);
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
