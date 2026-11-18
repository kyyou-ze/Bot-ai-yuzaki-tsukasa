'use strict';

const { Writable } = require('stream');
const pino = require('pino');
const log = require('./logger');
const { destJid, isGroupJid, splitTextByBytes } = require('./util');
const { messageCache } = require('./messagecache');
const { downloadQueue } = require('./downloadqueue');
const { lidMap, lidOf, pnOf } = require('./lidmap');

// ---------- presence ----------
// Tujuan: nomor tidak tampil "online" terus-menerus. Presence hanya dikirim
// saat bot benar-benar mengetik/mengirim pesan, lalu dikembalikan ke offline.
let offlineTimer = null;

function presenceMode() {
  return String(process.env.PRESENCE_MODE || 'auto').toLowerCase();
}

function cancelPresenceOffline() {
  if (offlineTimer) {
    clearTimeout(offlineTimer);
    offlineTimer = null;
  }
}

function goOfflineNow() {
  cancelPresenceOffline();
  try {
    if (sock && typeof sock.sendPresenceUpdate === 'function') {
      sock.sendPresenceUpdate('unavailable').catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

function schedulePresenceOffline() {
  if (presenceMode() === 'online') return;
  if (presenceMode() === 'offline') {
    goOfflineNow();
    return;
  }
  const sec = Math.max(3, Number(process.env.PRESENCE_IDLE_OFFLINE_SEC) || 8);
  cancelPresenceOffline();
  offlineTimer = setTimeout(() => {
    offlineTimer = null;
    goOfflineNow();
  }, sec * 1000);
  if (typeof offlineTimer.unref === 'function') offlineTimer.unref();
}

/** JID yang dipakai untuk presence: nomor asli bila LID sudah dipetakan. */
function presenceJid(jid) {
  const base = destJid(jid);
  return lidMap.getPn(base) || base;
}

async function setPresence(state, jid) {
  if (presenceMode() === 'offline') return false;
  try {
    if (sock && typeof sock.sendPresenceUpdate === 'function') {
      await sock.sendPresenceUpdate(state, presenceJid(jid));
      return true;
    }
  } catch {
    /* presence bersifat best-effort */
  }
  return false;
}

/**
 * Perkiraan durasi "mengetik" berdasarkan panjang teks/caption. Pesan media
 * tanpa caption tetap menampilkan animasi singkat supaya semua balasan punya
 * indikator mengetik.
 */
function typingDelayFor(content) {
  if (!content || content.react || content.delete) return 0;
  const maxDelay = Math.max(0, Number(process.env.TYPING_MAX_MS) || 1500);
  if (maxDelay <= 0) return 0;
  const text = String(content.text || content.caption || '');
  if (!text) return Math.min(maxDelay, 500);
  const minDelay = Math.min(500, maxDelay);
  return Math.min(maxDelay, Math.max(minDelay, Math.ceil(text.length / 120) * 200));
}

async function markRead(keys) {
  if (!sock || typeof sock.readMessages !== 'function') return false;
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
  if (!list.length) return false;
  try {
    await sock.readMessages(list);
    return true;
  } catch {
    return false;
  }
}

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

/**
 * Nomor WhatsApp bot dalam bentuk digit (mis. "6283..."). Sumber utama adalah
 * identitas socket yang sedang login, jadi landing page bisa mendeteksi nomor
 * secara otomatis tanpa konfigurasi manual.
 */
function botNumber() {
  try {
    const user = sock && sock.user;
    const raw = user && (user.id || user.jid || user.lid);
    const digits = String(raw || '')
      .split('@')[0]
      .split(':')[0]
      .replace(/\D+/g, '');
    if (digits) return digits;
  } catch {
    /* socket belum siap */
  }
  return '';
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
  cancelPresenceOffline();
  const to = await resolveSendJid(jid);
  const opts = quoted ? { quoted: retargetQuoted(quoted, to) } : {};
  // Semua pesan keluar (teks, media, poll, sticker) diberi animasi mengetik
  // sebelum dikirim. Reaksi dan hapus pesan tidak perlu indikator mengetik.
  const typing = Boolean(content && !content.react && !content.delete);
  let composing = false;
  try {
    if (typing) {
      composing = await setPresence('composing', to);
      const delay = presenceMode() === 'offline' ? 0 : typingDelayFor(content);
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
    const res = await sock.sendMessage(to, content, opts);
    // Simpan pesan keluar supaya Baileys bisa menyajikannya ulang saat
    // penerima meminta retry (mencegah "Menunggu pesan ini...").
    try {
      if (res && res.key && res.message) messageCache.put(res.key, res.message);
    } catch {
      /* cache bersifat best-effort */
    }
    return res;
  } finally {
    if (composing) await setPresence('paused', to);
    schedulePresenceOffline();
  }
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
  const str = String(text);
  const content = { text: str };
  if (mentions && mentions.length) content.mentions = mentions;
  if (linkPreview) {
    if (linkPreview.thumbnailUrl || linkPreview.thumbnail) {
      // Kartu banner: gambar besar + judul/deskripsi ditempel lewat
      // externalAdReply, jadi URL tidak perlu (dan tidak boleh) tampil di teks.
      // PENTING: field `thumbnail` pada proto ExternalAdReplyInfo bertipe string
      // (base64), bukan bytes. Mengirim Buffer membuat kartu gagal dirender dan
      // WhatsApp menyembunyikan seluruh bubble teks (yang tampil hanya audio).
      const ad = { ...linkPreview };
      if (Buffer.isBuffer(ad.thumbnail)) ad.thumbnail = ad.thumbnail.toString('base64');
      content.contextInfo = { externalAdReply: ad };
      // Cegah Baileys membuat preview link otomatis dari URL di teks.
      content.linkPreview = null;
    } else {
      // Kompatibilitas dengan format lama (WAUrlInfo / linkPreview).
      content.linkPreview = linkPreview;
    }
  }
  return sendMessage(jid, content, quoted);
}

/**
 * Kirim teks panjang dengan aman.
 *
 * WhatsApp menolak satu pesan yang melebihi batas byte UTF-8. Teks dipecah
 * lebih dulu (lihat util.splitTextByBytes), lalu tiap potongan dikirim
 * berurutan. Potongan pertama tetap membalas pesan user; potongan berikutnya
 * diberi penanda "(2/3)" agar jelas masih lanjutan.
 *
 * `options.linkPreview` ditempelkan ke potongan PERTAMA, jadi banner menyatu
 * dengan teks menu. Kalau kartu ditolak, potongan yang sama dikirim ulang
 * tanpa kartu — isi menu tetap sampai.
 */
async function sendLongText(jid, text, quoted, options = {}) {
  const wantsCard = Boolean(options.linkPreview);
  const requested = Math.max(256, Number(options.maxBytes) || 3000);
  // Potongan pertama memikul thumbnail, jadi dibuat lebih pendek.
  const maxBytes = wantsCard ? Math.min(requested, 3600) : requested;
  const chunks = splitTextByBytes(text, maxBytes, { marker: options.marker ?? '↳ ' });
  if (!chunks.length) return [];

  const results = [];
  const failures = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const part = `${i + 1}/${chunks.length}`;
    const replyTo = i === 0 ? quoted : undefined;
    const card = i === 0 ? options.linkPreview : undefined;
    let result = null;
    let lastError = null;

    // 1. Upaya utama: teks + kartu (potongan pertama) + reply.
    try {
      result = await sendText(jid, chunk, replyTo, options.mentions, card);
    } catch (err) {
      lastError = err;
      if (card) {
        log.warn('WA', `kartu pada potongan ${part} ditolak, coba tanpa kartu: ${err && err.message}`);
        try {
          result = await sendText(jid, chunk, replyTo, options.mentions);
          lastError = null;
        } catch (err2) {
          lastError = err2;
        }
      }
    }

    // 2. Tanpa reply (mengatasi quote lintas-chat/LID).
    if (!result) {
      try {
        result = await sendText(jid, chunk, undefined, options.mentions);
        lastError = null;
      } catch (err2) {
        lastError = err2;
      }
    }

    // 3. Upaya terakhir: pecah lebih kecil bila masalahnya ukuran pesan.
    if (!result) {
      const smaller = splitTextByBytes(chunk, Math.floor(maxBytes / 2), {
        marker: '',
        numbered: false,
      });
      for (const piece of smaller) {
        try {
          results.push(await sendText(jid, piece, undefined, options.mentions));
          lastError = null;
        } catch (err3) {
          lastError = err3;
          log.error('WA', `potongan kecil ${part} gagal: ${err3 && err3.message}`);
        }
      }
    } else {
      results.push(result);
    }

    if (lastError) failures.push({ part, error: lastError });
    if (i < chunks.length - 1) {
      // Jeda kecil menjaga urutan bubble di WhatsApp.
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  if (failures.length) {
    const err = new Error(
      `${failures.length}/${chunks.length} potongan teks gagal dikirim: ${failures[0].error && failures[0].error.message}`
    );
    err.failures = failures;
    throw err;
  }
  return results;
}

/**
 * Unggah gambar ke server WhatsApp sebagai thumbnail link preview berkualitas
 * tinggi. Di Android, `jpegThumbnail` saja sering tidak dirender — WhatsApp
 * butuh `highQualityThumbnail` (media yang sudah di-upload) agar kartu gambar
 * muncul.
 */
async function buildLinkThumbnail(buffer, mimetype) {
  if (!sock || typeof sock.waUploadToServer !== 'function') {
    throw new Error('socket WhatsApp belum siap');
  }
  const prepareWAMessageMedia = getBaileysFn('prepareWAMessageMedia');
  const media = await prepareWAMessageMedia(
    { image: buffer, ...(mimetype ? { mimetype } : {}) },
    {
      upload: sock.waUploadToServer,
      mediaTypeOverride: 'thumbnail-link',
      logger,
    }
  );
  return media && media.imageMessage ? media.imageMessage : null;
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
  botNumber,
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
  sendLongText,
  buildLinkThumbnail,
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
  goOfflineNow,
  schedulePresenceOffline,
  setPresence,
  markRead,
};

function isJidGroupSafe(jid) {
  try {
    return getBaileysFn('isJidGroup')(jid);
  } catch {
    return isGroupJid(jid);
  }
}
