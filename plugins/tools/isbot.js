import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "detectbot": async ({ rbLib }) => {
      function isBotMessage(msg, client) {
        const id = msg?.key?.id || ''
        const isBaileys = id.startsWith('BAE5') || id.length === 16 || id.length === 12
        const isBot = Boolean(isBaileys || msg?.isBot)
        return {
          isBot,
          score: isBot ? 95 : 5,
          indicators: isBot ? ['Baileys ID pattern detected'] : ['Official client signature']
        }
      }

      const __default = { isBotMessage }
      return { isBotMessage, default: __default }
    },
    "thumb": async () => {
      const axios = (await import('axios')).default
      const sharp = (await import('sharp')).default
      let cache = { url: '', buf: null }
      // thumbnail diambil dari global.thumb.utama (config.js)
      async function getActiveThumbBuffer(size = 300) {
        try {
          const url = global.thumb?.utama
          if (!url) return Buffer.alloc(0)
          if (cache.url !== url || !cache.buf) {
            const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })
            cache = { url, buf: Buffer.from(data) }
          }
          return await sharp(cache.buf).resize(size, size, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer()
        } catch (err) {
          console.error('[THUMB ERROR]:', err?.message || err)
        }
        return Buffer.alloc(0)
      }
      return { getActiveThumbBuffer, default: { getActiveThumbBuffer } }
    }
}

const feature = async ({ rbG, rbLib }) => {
  const { getDevice } = (await import('@whiskeysockets/baileys'))
  const { isBotMessage } = (await rbLib('detectbot'))
  const { getActiveThumbBuffer } = (await rbLib('thumb'))

  const parseDeviceDetailed = (msgId, isBot) => {
      const raw = getDevice(msgId) || 'unknown';
      if (isBot) return 'WhatsApp Bot (Baileys / Multi-Device)';
      switch (raw.toLowerCase()) {
          case 'android':
              return 'Android (Official WhatsApp)';
          case 'ios':
              return 'iOS / iPhone (Official WhatsApp)';
          case 'web':
              return 'WhatsApp Web (Browser)';
          case 'desktop':
              return 'WhatsApp Desktop (Windows / Mac)';
          default:
              return raw.charAt(0).toUpperCase() + raw.slice(1);
      }
  };

  const handler = async (m, { sock, conn, reply }) => {
      const client = sock || conn || rbG.mainSock;
      const targetMsg = m.quoted ? m.quoted : m;
      const targetSender = targetMsg.sender || targetMsg.key?.participant || (targetMsg.key?.fromMe ? (client.decodeJid ? client.decodeJid(client.user?.id || '') : client.user?.id) : m.sender);
      const targetNumber = (targetSender || '').replace(/[^0-9]/g, '');

      const analysis = isBotMessage(targetMsg, client);
      const detailedDevice = parseDeviceDetailed(analysis.msgId, analysis.isBot);

      const status = analysis.isBot
          ? `🤖 *ʙᴏᴛ* (${analysis.confidence}%)`
          : `👤 *ʜᴜᴍᴀɴ* (${100 - analysis.confidence}%)`;

      const captionText = `🤖 *ᴅᴇᴛᴇᴋsɪ ʙᴏᴛ & ᴅᴇᴠɪᴄᴇ*\n\n` +
          `• 👤 *ᴛᴀʀɢᴇᴛ:* @${targetNumber}\n` +
          `• 📊 *sᴛᴀᴛᴜs:* ${status}\n` +
          `• 📱 *ᴅᴇᴠɪᴄᴇ:* ${detailedDevice}\n` +
          `• 🆔 *ᴍᴇssᴀɢᴇ ɪᴅ:* \`${analysis.msgId}\`\n` +
          `• 📑 *ᴛɪᴘᴇ ᴘᴇsᴀɴ:* \`${analysis.msgType}\``;

      const thumbBuffer = await getActiveThumbBuffer().catch(() => null);

      try {
          if (client && false) {
              await client.sendButtons(m.chat, {
                  location: {
                      degreesLatitude: 0,
                      degreesLongitude: 0,
                      name: '🤖 Deteksi Bot & Device',
                      address: `Target: @${targetNumber} • Status: ${analysis.isBot ? 'BOT' : 'HUMAN'}`,
                      jpegThumbnail: thumbBuffer
                  },
                  text: '',
                  footer: captionText,
                  contextInfo: {
                      mentionedJid: [targetSender]
                  }
              }, {
                  quoted: m,
                  mentions: [targetSender]
              });
          } else {
              await client.sendMessage(m.chat, {
                  location: {
                      degreesLatitude: 0,
                      degreesLongitude: 0,
                      name: '🤖 Deteksi Bot & Device',
                      address: `Target: @${targetNumber} • Status: ${analysis.isBot ? 'BOT' : 'HUMAN'}`,
                      jpegThumbnail: thumbBuffer
                  },
                  caption: captionText,
                  mentions: [targetSender],
                  contextInfo: {
                      mentionedJid: [targetSender]
                  }
              }, { quoted: m });
          }
      } catch (e) {
          console.error('[ISBOT ERROR]', e);
          return await reply(captionText, { mentions: [targetSender] });
      }
  };

  handler.help = ['isbot', 'cekdevice'];
  handler.tags = ['tools']
  handler.command = ['isbot']
  handler.category = 'tools';
  handler.description = 'Cek apakah suatu akun/pesan adalah Bot atau Human beserta detail device pengirim';
  handler.register = true;

  handler.limit = true;
  return handler
}

rbRegister("tools/isbot", feature, libs)

let handler = (m, ctx) => rbRun("tools/isbot", m, ctx)

handler.command = ['isbot']
handler.help = ["isbot", "cekdevice"]
handler.tags = ['tools']

export default handler
