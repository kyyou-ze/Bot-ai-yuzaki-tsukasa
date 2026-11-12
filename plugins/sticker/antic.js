import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const crypto = (__m => __m.default ?? __m)((await import('crypto')))
  const https = (__m => __m.default ?? __m)((await import('https')))
  const JSZip = (__m => __m.default ?? __m)((await import('jszip')))

  function buildStickerExif(metadata) {
    const json = Buffer.from(JSON.stringify(metadata), "utf-8");
    const exif = Buffer.concat([
      Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00,
      ]),
      Buffer.alloc(4),
      Buffer.from([0x16, 0x00, 0x00, 0x00]),
      json,
    ]);
    exif.writeUInt32LE(json.length, 14);
    return exif;
  }

  function makeChunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const sizeBuffer = Buffer.alloc(4);
    sizeBuffer.writeUInt32LE(data.length, 0);
    const padding = data.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    return Buffer.concat([typeBuffer, sizeBuffer, data, padding]);
  }

  async function setWebpExif(webpBuffer, metadata) {
    if (
      webpBuffer.slice(0, 4).toString() !== "RIFF" ||
      webpBuffer.slice(8, 12).toString() !== "WEBP"
    ) {
      throw new Error("File bukan WEBP valid.");
    }
    const chunks = [];
    let firstType = null;
    let offset = 12;
    while (offset + 8 <= webpBuffer.length) {
      const type = webpBuffer.slice(offset, offset + 4).toString();
      const size = webpBuffer.readUInt32LE(offset + 4);
      const chunkStart = offset;
      const chunkEnd = offset + 8 + size + (size % 2);
      if (chunkEnd > webpBuffer.length) break;
      if (firstType === null) firstType = type;
      if (type !== "EXIF") {
        chunks.push(webpBuffer.slice(chunkStart, chunkEnd));
      }
      offset = chunkEnd;
    }

    if (firstType !== "VP8X") {
      const sharp = await loadSharp();
      const meta = await sharp(webpBuffer).metadata();
      const width = meta.width || 512;
      const height = meta.height || 512;
      const hasAlpha = !!meta.hasAlpha;

      const vp8xData = Buffer.alloc(10);
      let flags = 0x08;
      if (hasAlpha) flags |= 0x10;
      vp8xData.writeUInt8(flags, 0);
      vp8xData.writeUIntLE(Math.max(0, width - 1), 4, 3);
      vp8xData.writeUIntLE(Math.max(0, height - 1), 7, 3);

      chunks.unshift(makeChunk("VP8X", vp8xData));
    } else {
      const original = Buffer.from(chunks[0]);
      original[8] = original[8] | 0x08;
      chunks[0] = original;
    }

    const exifPayload = buildStickerExif(metadata);
    const exifChunk = makeChunk("EXIF", exifPayload);
    const body = Buffer.concat([...chunks, exifChunk]);
    const header = Buffer.alloc(12);
    header.write("RIFF", 0);
    header.writeUInt32LE(body.length + 4, 4);
    header.write("WEBP", 8);
    return Buffer.concat([header, body]);
  }

  function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
  }

  async function loadSharp() {
    const sharpMod = await import('sharp').catch(() => null);
    if (!sharpMod?.default) throw new Error('Install sharp dulu:\nnpm i sharp');
    return sharpMod.default;
  }

  async function makeThumbnailJpeg(buffer) {
    const sharp = await loadSharp();
    return await sharp(buffer)
      .resize(252, 252, { fit: 'cover' })
      .jpeg()
      .toBuffer();
  }

  async function makeBlankTrayWebp() {
    const sharp = await loadSharp();
    return await sharp({
      create: {
        width: 252,
        height: 252,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .webp()
      .toBuffer();
  }

  function downloadPackFromServer(directPath, mediaKey) {
    return new Promise((resolve, reject) => {
      const path = directPath.startsWith('/') ? directPath : '/' + directPath;
      const url = `https://mmg.whatsapp.net${path}`;

      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Server CDN merespon dengan status: ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const encBuffer = Buffer.concat(chunks);
            const expanded = Buffer.from(
              crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from('WhatsApp Sticker Pack Keys'), 112)
            );
            const iv = expanded.subarray(0, 16);
            const cipherKey = expanded.subarray(16, 48);

            const encrypted = encBuffer.subarray(0, encBuffer.length - 10);
            const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            resolve(decrypted);
          } catch (e) {
            reject(new Error("Gagal melakukan dekripsi file pack: " + e.message));
          }
        });
      }).on('error', reject);
    });
  }

  async function uploadToServer(sock, buffer, { hkdf, mediaPath, mediaKey = crypto.randomBytes(32) }) {
    const expanded = Buffer.from(
      crypto.hkdfSync('sha256', mediaKey, Buffer.alloc(32), Buffer.from(hkdf), 112),
    );
    const iv = expanded.subarray(0, 16);
    const cipherKey = expanded.subarray(16, 48);
    const macKey = expanded.subarray(48, 80);
    const cipher = crypto.createCipheriv('aes-256-cbc', cipherKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const mac = crypto
      .createHmac('sha256', macKey)
      .update(iv)
      .update(encrypted)
      .digest()
      .subarray(0, 10);
    const encBuffer = Buffer.concat([encrypted, mac]);
    const fileSha256 = sha256(buffer);
    const fileEncSha256 = sha256(encBuffer);
    const iq = await sock.query({
      tag: 'iq',
      attrs: {
        id: sock.generateMessageTag?.() ?? Date.now().toString(),
        to: 's.whatsapp.net',
        type: 'set',
        xmlns: 'w:m',
      },
      content: [{ tag: 'media_conn', attrs: {} }],
    });
    const mediaConn = iq.content?.find(v => v.tag === 'media_conn');
    if (!mediaConn) throw new Error('media_conn tidak ditemukan');
    const auth = mediaConn.attrs?.auth;
    if (!auth) throw new Error('auth media_conn tidak ditemukan');
    const hosts = (mediaConn.content || [])
      .filter(v => v.tag === 'host')
      .map(v => v.attrs?.hostname)
      .filter(Boolean);
    if (!hosts.length) throw new Error('host upload tidak ditemukan');
    const token = encodeURIComponent(
      fileEncSha256.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
    );
    let lastError;
    for (const host of hosts) {
      try {
        const json = await new Promise((resolve, reject) => {
          const url = new URL(
            `https://${host}${mediaPath}/${token}?auth=${encodeURIComponent(auth)}&token=${token}`,
          );
          const req = https.request(
            {
              hostname: url.hostname,
              port: 443,
              path: url.pathname + url.search,
              method: 'POST',
              headers: {
                Origin: 'https://web.whatsapp.com',
                Referer: 'https://web.whatsapp.com/',
                'Content-Type': 'application/octet-stream',
                'Content-Length': encBuffer.length,
              },
            },
            (res) => {
              let body = '';
              res.on('data', c => body += c);
              res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                  return reject(new Error(`Upload gagal ${res.statusCode}: ${body}`));
                }
                try {
                  resolve(JSON.parse(body));
                } catch {
                  reject(new Error(`Response bukan JSON: ${body}`));
                }
              });
            },
          );
          req.on('error', reject);
          req.write(encBuffer);
          req.end();
        });
        const directPath = json.direct_path ?? json.directPath ?? json.url ?? json.path;
        if (!directPath) throw new Error('directPath tidak ditemukan');
        return {
          mediaKey,
          fileLength: buffer.length,
          fileSha256,
          fileEncSha256,
          directPath,
          ...json,
        };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError ?? new Error('Semua host upload gagal');
  }

  async function handler(m, { conn, usedPrefix, command }) {
    try {
      const targetMessage = m.quoted?.fakeObj?.message?.stickerPackMessage || m.quoted?.message?.stickerPackMessage;
      if (!targetMessage) {
        return m.reply('❌ Silahkan reply ke pesan *Sticker Pack* yang ingin dibuat anti-colong.');
      }
      await m.react('🕜');

      let packBuffer;
      if (targetMessage.directPath && targetMessage.mediaKey) {
        packBuffer = await downloadPackFromServer(targetMessage.directPath, targetMessage.mediaKey);
      } else {
        packBuffer = await m.quoted.download();
      }

      if (!packBuffer) {
        throw new Error("Gagal memperoleh data biner archive sticker pack dari server.");
      }

      const botName = rbG.botName || 'ytta';
      const dynamicPackName = `𝐋𝐘𝐍𝐍𝐀 𝐀𝐈`;
      const dynamicPublisher = `RennZSync`;

      const zip = await JSZip.loadAsync(packBuffer);
      const newZip = new JSZip();
      const stickersMetadata = [];
      const originalStickers = targetMessage.stickers || [];

      const antiColongMetadata = {
        "sticker-pack-id": crypto.randomBytes(16).toString('hex'),
        "sticker-pack-name": dynamicPackName,
        "sticker-pack-publisher": dynamicPublisher,
        "accessibility-text": "Protected Sticker",
        "android-app-store-link": "https://whatsapp.com",
        "ios-app-store-link": "https://whatsapp.com/ios",
        emojis: ["🦸"],
        "is-from-sticker-maker": 0,
        "is-avatar-sticker": 1,
        "avatar-sticker-template-id": "whatsapp",
        "is-ai-sticker": 1,
        "is-avatar-country-sticker": 1,
        "is-avatar-instant-sticker": 1,
        "sticker-maker-source-type": 4,
        "is-avatar-social-sticker": 1,
        "avatar-sticker-style": "whatsapp",
        "avatar-sticker-revision-id": "2026",
        "is-from-user-created-pack": 1,
        "origin-pack-id": "whatsapp",
        "is-text-sticker": 1,
      };

      for (const sticker of originalStickers) {
        const file = zip.file(sticker.fileName);
        if (!file) continue;
        let buffer = await file.async("nodebuffer");
        if (sticker.mimetype === "image/webp" || sticker.fileName.endsWith(".webp")) {
          try {
            buffer = await setWebpExif(buffer, antiColongMetadata);
          } catch (_) {}
        }
        newZip.file(sticker.fileName, buffer);
        stickersMetadata.push({
          fileName: sticker.fileName,
          isAnimated: sticker.isAnimated || false,
          emojis: sticker.emojis || [''],
          accessibilityLabel: sticker.accessibilityLabel || '',
          isLottie: sticker.isLottie || false,
          mimetype: sticker.mimetype || 'image/webp',
        });
      }

      const trayIconFileName = targetMessage.trayIconFileName || 'tray_icon.webp';
      const trayFile = zip.file(trayIconFileName);

      const trayBuffer = trayFile
        ? await trayFile.async("nodebuffer")
        : await makeBlankTrayWebp();

      newZip.file(trayIconFileName, trayBuffer);

      const archive = await newZip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
      const packUpload = await uploadToServer(conn, archive, {
        hkdf: 'WhatsApp Sticker Pack Keys',
        mediaPath: '/mms/sticker-pack',
      });

      const thumbnailBuffer = await makeThumbnailJpeg(trayBuffer);

      const thumbUpload = await uploadToServer(conn, thumbnailBuffer, {
        hkdf: 'WhatsApp Sticker Pack Thumbnail Keys',
        mediaPath: '/mms/thumbnail-sticker-pack',
        mediaKey: packUpload.mediaKey,
      });

      await conn.relayMessage(
        m.chat,
        {
          messageContextInfo: {
            messageSecret: crypto.randomBytes(32),
            limitSharingV2: {
              sharingLimited: true,
              trigger: "CHAT_SETTING",
              limitSharingSettingTimestamp: Date.now().toString(),
              initiatedByMe: true,
            },
          },
          stickerPackMessage: {
            stickerPackId: 'Pack_' + crypto.randomBytes(8).toString('hex'),
            name: dynamicPackName,
            publisher: dynamicPublisher,
            packDescription: targetMessage.packDescription || 'Protected Anti-Colong Pack',
            stickers: stickersMetadata,
            fileLength: packUpload.fileLength,
            fileSha256: packUpload.fileSha256,
            fileEncSha256: packUpload.fileEncSha256,
            mediaKey: packUpload.mediaKey,
            directPath: packUpload.directPath,
            mediaKeyTimestamp: Math.floor(Date.now() / 1000),
            stickerPackSize: packUpload.fileLength,
            stickerPackOrigin: 2,
            trayIconFileName,
            thumbnailDirectPath: thumbUpload.directPath,
            thumbnailSha256: thumbUpload.fileSha256,
            thumbnailEncSha256: thumbUpload.fileEncSha256,
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: thumbUpload.fileSha256.toString('base64'),
          },
        },
        { quoted: m }
      );
      await m.react('✅');
    } catch (error) {
      console.error('[AntiColongPack] Error:', error);
      await m.react('❌');
      await m.reply('❌ *GAGAL PROSES PACK*\n\n> ' + error.message);
    }
  }

  handler.help = ['antic']
  handler.tags = ['sticker']
  handler.command = /^(anticolongpack|acpack)$/i;
  handler.limit = true;
  handler.register = true;
  return handler
}

rbRegister("sticker/antic", feature)

let handler = (m, ctx) => rbRun("sticker/antic", m, ctx)

handler.command = ['antic']
handler.help = ["anticolongpack"]
handler.tags = ['sticker']

export default handler
