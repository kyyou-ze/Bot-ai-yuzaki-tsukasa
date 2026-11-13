'use strict';

const { Writable } = require('stream');
const pino = require('pino');
const log = require('./logger');
const { destJid, isGroupJid } = require('./util');
const { messageCache } = require('./messagecache');
const { downloadQueue } = require('./downloadqueue');
const { lidMap, lidOf, pnOf } = require('./lidmap');

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
    if (detail) {
      const cause = detail.cause || (Array.isArray(detail.errors) ? detail.errors[0] : null);
      const parts = [detail.message, cause && cause.message].filter(Boolean);
      if (parts.length) message += ` | ${parts.join(' | ')}`;
      if (detail.code) message += ` | code=${detail.code}`;
    }
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
  {
    level: process.env.BAILEYS_LOG || 'error',
    base: null,
    // Pino hanya menyerialkan key `err` secara khusus. Baileys kadang memakai
    // `{ error }`, sehingga tanpa serializer ini penyebab asli error hilang
    // dan yang terlihat hanya "transaction failed, rolling back".
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  },
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
  return downloadQueue.run('wa:media', () =>
    downloadMediaMessage(messageLike, 'buffer', {}, {
      logger,
      reuploadRequest: sock.updateMediaMessage,
    })
  );
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
  const to = await resolveSendJid(jid);
  const opts = quoted ? { quoted: retargetQuoted(quoted, to) } : {};
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

/**
 * Simpan pasangan LID -> nomor telepon dari pesan masuk. Dipanggil dari
 * handler `messages.upsert` sebelum pesan diproses.
 */
function rememberJids(key) {
  try {
    return lidMap.rememberFromKey(key);
  } catch {
    return false;
  }
}

/** Simpan pasangan LID -> nomor telepon dari event Baileys v7. */
function rememberLidPn(lidJid, pnJid) {
  try {
    return lidMap.remember(lidJid, pnJid);
  } catch {
    return false;
  }
}

/**
 * Tentukan tujuan kirim yang benar. JID `@lid` pada Baileys 6.7.x tidak
 * pernah terkirim walaupun server menerimanya, jadi ubah ke nomor telepon
 * asli bila pemetaannya diketahui.
 */
async function resolveSendJid(jid) {
  const bare = destJid(jid);
  if (!lidOf(bare)) return bare;

  const selfPn = pnOf(sock && sock.user && sock.user.id);
  const known = lidMap.getPn(bare);
  if (known) {
    // Abaikan pemetaan rusak yang menunjuk ke nomor bot sendiri (mis. sisa
    // versi lama yang membaca senderPn dari pesan fromMe).
    if (!selfPn || known !== selfPn) return known;
    lidMap.forget(bare);
  }

  // Cadangan 1: mapping internal Baileys (bila versi ini menyimpannya).
  const mapping = sock && sock.signalRepository && sock.signalRepository.lidMapping;
  if (mapping) {
    for (const fn of ['getPNForLID', 'getPnForLid', 'getPhoneNumber']) {
      if (typeof mapping[fn] !== 'function') continue;
      try {
        const pn = pnOf(await mapping[fn](bare));
        if (pn && (!selfPn || pn !== selfPn)) {
          lidMap.remember(bare, pn);
          return pn;
        }
      } catch {
        /* coba cara lain */
      }
    }
  }

  // Cadangan 2: tanya WhatsApp langsung.
  try {
    const res = await sock.onWhatsApp(bare);
    if (Array.isArray(res)) {
      const hit = res.find((x) => x && x.jid && pnOf(x.jid));
      const pn = hit ? pnOf(hit.jid) : '';
      if (pn && (!selfPn || pn !== selfPn)) {
        lidMap.remember(bare, pn);
        return pn;
      }
    }
  } catch {
    /* tetap pakai LID sebagai upaya terakhir */
  }

  log.debug('WA', `LID belum dipetakan: ${bare}`);
  return bare;
}

/**
 * Saat tujuan diubah dari LID ke nomor telepon, samakan remoteJid pesan yang
 * dikutip agar WhatsApp tidak menganggapnya quote lintas-chat.
 */
function retargetQuoted(quoted, target) {
  if (!quoted || !quoted.key) return quoted;
  const qChat = String(quoted.key.remoteJid || '');
  if (!qChat || qChat === target) return quoted;
  if (!lidOf(qChat) || isGroupJid(target)) return quoted;
  return { ...quoted, key: { ...quoted.key, remoteJid: target } };
}

async function sendText(jid, text, quoted, mentions, linkPreview) {
  const base = destJid(jid);
  // Presence ke JID LID sering diabaikan; pakai nomor asli bila sudah diketahui.
  const to = lidMap.getPn(base) || base;
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
  // Preview link eksplisit (kartu banner) supaya WhatsApp tidak perlu
  // menebak metadata dari URL di dalam teks.
  if (linkPreview) content.linkPreview = linkPreview;
  const res = await sendMessage(jid, content, quoted);
  try {
    await sock.sendPresenceUpdate('paused', to);
  } catch {
    /* ignore */
  }
  return res;
}

async function sendImage(jid, buffer, caption, quoted, mimetype, mentions) {
  const content = { image: buffer, caption: caption || '' };
  if (mimetype) content.mimetype = mimetype;
  if (mentions && mentions.length) content.mentions = mentions;
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

/**
 * Beri reaksi emoji ke sebuah pesan. `messageKey` biasanya `m.key`.
 */
async function react(jid, messageKey, emoji) {
  const text = String(emoji || '').trim();
  if (!text || !messageKey) return null;
  return sendMessage(jid, { react: { text, key: messageKey } });
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
  rememberJids,
  rememberLidPn,
  resolveSendJid,
  sendMessage,
  sendText,
  sendImage,
  sendVideo,
  sendAudio,
  sendDocument,
  sendSticker,
  react,
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
