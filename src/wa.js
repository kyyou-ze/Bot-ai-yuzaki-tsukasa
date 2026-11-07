'use strict';

const { Writable } = require('stream');
const pino = require('pino');
const log = require('./logger');
const { destJid, isGroupJid } = require('./util');
const { messageCache } = require('./messagecache');

// Pino menulis JSON per baris. Alihkan semuanya ke logger aplikasi supaya
// output panel tetap satu format: [waktu] [LEVEL] [TAG] pesan.
function forwardBaileysLine(raw) {
  const text = String(raw || '').trim();
  if (!text) return;
  try {
    const entry = JSON.parse(text);
    const levelNum = Number(entry.level);
    const level =
      levelNum >= 50 ? 'error' : levelNum >= 40 ? 'warn' : levelNum >= 30 ? 'info' : 'debug';
    let message = String(entry.msg || entry.message || 'baileys');
    const detail = entry.err || entry.error;
    if (detail && detail.message) message += ` | ${detail.message}`;
    const tag = entry.name ? `WA:${entry.name}` : 'WA';

    if (detail && detail.stack) {
      const err = new Error(message);
      err.stack = String(detail.stack);
      log[level](tag, err);
    } else {
      log[level](tag, message);
    }
  } catch {
    log.debug('WA', text);
  }
}

const baileysStream = new Writable({
  write(chunk, _encoding, done) {
    String(chunk)
      .split('\n')
      .forEach(forwardBaileysLine);
    done();
  },
});
baileysStream.on('error', () => {});

const logger = pino(
  { level: process.env.BAILEYS_LOG || 'error', base: null },
  baileysStream
);

let sock = null;
let baileys = null;

function setBaileys(mod) {
  baileys = mod || null;
}

function getBaileys() {
  return baileys;
}

function getBaileysFn(name) {
  if (!baileys) throw new Error('Baileys module belum dimuat');
  return baileys[name];
}

function setSock(s) {
  sock = s;
}

function getSock() {
  return sock;
}

function contentOf(messageOrMessageLike) {
  if (!messageOrMessageLike) return null;
  const normalizeMessageContent = getBaileysFn('normalizeMessageContent');
  if (messageOrMessageLike.message !== undefined) {
    return normalizeMessageContent(messageOrMessageLike.message);
  }
  return normalizeMessageContent(messageOrMessageLike);
}

function contentTypeOf(content) {
  if (!content) return null;
  try {
    const getContentType = getBaileysFn('getContentType');
    if (typeof getContentType === 'function') return getContentType(content);
  } catch {
    /* fallback di bawah */
  }
  const keys = Object.keys(content).filter((k) => k !== 'messageContextInfo');
  return keys[0] || null;
}

/** ContextInfo dari content apa pun (teks/gambar/video/dokumen). */
function contextInfoOf(content) {
  if (!content) return null;
  const type = contentTypeOf(content);
  if (!type) return null;
  const node = content[type];
  return (node && node.contextInfo) || null;
}

function getContextInfo(msg) {
  return contextInfoOf(contentOf(msg));
}

function quotedContent(ctxInfo) {
  if (!ctxInfo) return null;
  const normalizeMessageContent = getBaileysFn('normalizeMessageContent');
  return normalizeMessageContent(ctxInfo.quotedMessage);
}

function extractText(messageOrContent) {
  const normalizeMessageContent = getBaileysFn('normalizeMessageContent');
  const c =
    messageOrContent && messageOrContent.message !== undefined
      ? contentOf(messageOrContent)
      : normalizeMessageContent(messageOrContent);
  if (!c) return '';
  if (c.conversation) return c.conversation;
  if (c.extendedTextMessage && c.extendedTextMessage.text) return c.extendedTextMessage.text;
  if (c.imageMessage && c.imageMessage.caption) return c.imageMessage.caption;
  if (c.videoMessage && c.videoMessage.caption) return c.videoMessage.caption;
  if (c.documentMessage && c.documentMessage.caption) return c.documentMessage.caption;
  return '';
}

function hasImage(content) {
  return Boolean(content && content.imageMessage);
}
function hasVideo(content) {
  return Boolean(content && content.videoMessage);
}
function hasAudio(content) {
  return Boolean(content && content.audioMessage);
}

async function downloadMedia(messageLike) {
  if (!sock) throw new Error('WhatsApp belum terhubung');
  const downloadMediaMessage = getBaileysFn('downloadMediaMessage');
  return downloadMediaMessage(messageLike, 'buffer', {}, {
    logger,
    reuploadRequest: sock.updateMediaMessage,
  });
}

/**
 * Unduh media dari pesan yang di-quote. `quoted` adalah content yang sudah
 * dinormalisasi (view-once/ephemeral sudah dibuka).
 */
async function downloadQuoted(quoted, chatJid, senderJid) {
  return downloadMedia({
    key: {
      remoteJid: chatJid,
      id: 'quoted',
      participant: senderJid,
      fromMe: false,
    },
    message: quoted,
  });
}

async function sendMessage(jid, content, quoted) {
  const to = destJid(jid);
  const opts = quoted ? { quoted } : {};
  const res = await sock.sendMessage(to, content, opts);
  // Simpan pesan keluar supaya Baileys bisa menyajikannya ulang saat
  // penerima meminta retry (mencegah "Menunggu pesan ini...").
  try {
    if (res && res.key && res.message) messageCache.put(res.key, res.message);
  } catch {
    /* cache bersifat best-effort */
  }
  return res;
}

async function sendText(jid, text, quoted, mentions) {
  const to = destJid(jid);
  const str = String(text);
  try {
    await sock.sendPresenceUpdate('composing', to);
    // Delay dipangkas: sebelumnya bisa sampai 8 detik per pesan dan membuat
    // bot terasa hang, apalagi saat banyak chat masuk bersamaan.
    const maxDelay = Math.max(0, Number(process.env.TYPING_MAX_MS) || 1500);
    const minDelay = Math.min(250, maxDelay);
    const delay = Math.min(maxDelay, Math.max(minDelay, Math.ceil(str.length / 120) * 200));
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  } catch {
    /* ignore */
  }
  const content = { text: str };
  if (mentions && mentions.length) content.mentions = mentions;
  const res = await sendMessage(jid, content, quoted);
  try {
    await sock.sendPresenceUpdate('paused', to);
  } catch {
    /* ignore */
  }
  return res;
}

async function sendImage(jid, buffer, caption, quoted, mimetype) {
  const content = { image: buffer, caption: caption || '' };
  if (mimetype) content.mimetype = mimetype;
  return sendMessage(jid, content, quoted);
}

async function sendVideo(jid, buffer, caption, quoted, mimetype) {
  const content = { video: buffer, caption: caption || '' };
  if (mimetype) content.mimetype = mimetype;
  return sendMessage(jid, content, quoted);
}

async function sendAudio(jid, buffer, mimetype, ptt, quoted) {
  return sendMessage(
    jid,
    { audio: buffer, mimetype: mimetype || 'audio/mpeg', ptt: Boolean(ptt) },
    quoted
  );
}

async function sendDocument(jid, buffer, mimetype, fileName, caption, quoted) {
  return sendMessage(
    jid,
    {
      document: buffer,
      mimetype: mimetype || 'application/octet-stream',
      fileName: fileName || 'file',
      caption: caption || '',
    },
    quoted
  );
}

async function sendSticker(jid, webpBuffer, quoted) {
  return sendMessage(jid, { sticker: webpBuffer }, quoted);
}

function userJid(jid) {
  try {
    return getBaileysFn('jidNormalizedUser')(jid);
  } catch {
    return jid;
  }
}

module.exports = {
  logger,
  setBaileys,
  getBaileys,
  setSock,
  getSock,
  contentOf,
  contentTypeOf,
  contextInfoOf,
  getContextInfo,
  quotedContent,
  extractText,
  hasImage,
  hasVideo,
  hasAudio,
  downloadMedia,
  downloadQuoted,
  sendMessage,
  sendText,
  sendImage,
  sendVideo,
  sendAudio,
  sendDocument,
  sendSticker,
  userJid,
  destJid,
  isJidGroup: isJidGroupSafe,
  isGroupJid,
};

function isJidGroupSafe(jid) {
  try {
    return getBaileysFn('isJidGroup')(jid);
  } catch {
    return isGroupJid(jid);
  }
}
