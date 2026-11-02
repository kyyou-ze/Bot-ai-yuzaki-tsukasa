'use strict';

const pino = require('pino');
const { destJid, isGroupJid } = require('./util');

const logger = pino({ level: process.env.BAILEYS_LOG || 'warn' });

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
  const getContentType = getBaileysFn('getContentType');
  return getContentType(content);
}

/** ContextInfo dari content apa pun (teks/gambar/video/dokumen). */
function contextInfoOf(content) {
  if (!content) return null;
  const type = getContentType(content);
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
  return sock.sendMessage(to, content, opts);
}

async function sendText(jid, text, quoted, mentions) {
  const content = { text: String(text) };
  if (mentions && mentions.length) content.mentions = mentions;
  return sendMessage(jid, content, quoted);
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
