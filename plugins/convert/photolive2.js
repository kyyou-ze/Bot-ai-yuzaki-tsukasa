// plugins/convert/photolive.js
// Live Photo: gabungkan 1 gambar + 1 video jadi Live Photo (2 langkah: gambar dulu, lalu video)

import {
    prepareWAMessageMedia,
    generateWAMessageFromContent
} from '@whiskeysockets/baileys'

const sessions = new Map()
const SESSION_TTL = 5 * 60 * 1000
const b = '```'

function cleanupSessions() {
    const now = Date.now()
    for (const [key, val] of sessions) {
        if (now - val.timestamp > SESSION_TTL) sessions.delete(key)
    }
}

async function react(conn, m, emoji) {
    try {
        await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch (e) {}
}

// ambil media image/video dari pesan itu sendiri atau pesan yang di-reply
function pickMedia(m) {
    const ok = ['imageMessage', 'videoMessage']
    if (ok.includes(m.mtype) && m.download) return { type: m.mtype, download: m.download }
    if (m.quoted && ok.includes(m.quoted.mtype)) return { type: m.quoted.mtype, download: m.quoted.download }
    return null
}

let handler = async (m, { sock: conn, prefix, command }) => {
    cleanupSessions()

    const p = (prefix || '.') + command
    const sender = m.sender
    const session = sessions.get(sender)
    const target = pickMedia(m)

    if (!target) {
        if (session) {
            const sisa = Math.ceil((SESSION_TTL - (Date.now() - session.timestamp)) / 60000)
            return m.reply(
                `✅ *Step 1 selesai* — Gambar sudah disimpan.\n\n` +
                `Sekarang kirim/reply *video* dengan caption *${p}*\n` +
                `_(sesi kadaluarsa dalam ${sisa} menit)_`
            )
        }
        return m.reply(
            `     ꥟   *ᴇxᴀᴍᴘʟᴇ  •  ᴜsᴇ*\n\n` +
            `${b}sᴇɴᴅ ᴏʀ ʀᴇᴘʟʏ ɪᴍᴀɢᴇ ᴛʜᴇɴ ᴠɪᴅᴇᴏ${b}\n` +
            `     ▸   *ᴜsᴀɢᴇ: ${p}*\n` +
            `     ▸   *sᴛᴇᴘ 1: sᴇɴᴅ/ʀᴇᴘʟʏ ɪᴍᴀɢᴇ ᴡɪᴛʜ ${p}*\n` +
            `     ▸   *sᴛᴇᴘ 2: sᴇɴᴅ/ʀᴇᴘʟʏ ᴠɪᴅᴇᴏ ᴡɪᴛʜ ${p}*\n` +
            `     ▸   *ғᴜɴᴄᴛɪᴏɴ: ᴄᴏᴍʙɪɴᴇ ɪᴍᴀɢᴇ ᴀɴᴅ ᴠɪᴅᴇᴏ ɪɴᴛᴏ ᴀ ʟɪᴠᴇ ᴘʜᴏᴛᴏ*\n` +
            `     ▸   *ᴜsᴇᴅ ʙʏ: ᴀʟʟ ᴜsᴇʀ*`
        )
    }

    // ===== STEP 1: gambar =====
    if (target.type === 'imageMessage') {
        await react(conn, m, '⏳')
        try {
            const image = await target.download()
            sessions.set(sender, { image, timestamp: Date.now() })
            await react(conn, m, '✅')
            return m.reply(
                `✅ *Gambar disimpan!*\n\n` +
                `Sekarang kirim atau reply *video* dengan caption *${p}*\n` +
                `_(sesi otomatis hapus dalam 5 menit)_`
            )
        } catch (e) {
            console.error('[PHOTOLIVE2]', e)
            await react(conn, m, '❌')
            return m.reply(`❌ Gagal mengunduh gambar: ${e.message}`)
        }
    }

    // ===== STEP 2: video =====
    if (target.type === 'videoMessage') {
        if (!session) {
            return m.reply(
                `⚠️ Belum ada gambar tersimpan.\n` +
                `Kirim dulu gambar dengan *${p}*, baru video.`
            )
        }

        await react(conn, m, '⏳')
        sessions.delete(sender)

        try {
            const videoBuffer = await target.download()

            const [imageMedia, videoMedia] = await Promise.all([
                prepareWAMessageMedia({ image: session.image }, { upload: conn.waUploadToServer }),
                prepareWAMessageMedia({ video: videoBuffer }, { upload: conn.waUploadToServer })
            ])

            const imgMsg = generateWAMessageFromContent(
                m.chat,
                {
                    imageMessage: {
                        ...imageMedia.imageMessage,
                        contextInfo: {
                            pairedMediaType: 5,
                            statusSourceType: 0
                        }
                    }
                },
                { userJid: conn.user.id }
            )

            await conn.relayMessage(m.chat, imgMsg.message, { messageId: imgMsg.key.id })

            await conn.relayMessage(
                m.chat,
                {
                    videoMessage: {
                        ...videoMedia.videoMessage,
                        contextInfo: {
                            pairedMediaType: 6,
                            statusSourceType: 0
                        }
                    },
                    messageContextInfo: {
                        messageAssociation: {
                            associationType: 12,
                            parentMessageKey: imgMsg.key
                        }
                    }
                },
                {}
            )

            return react(conn, m, '✅')
        } catch (e) {
            console.error('[PHOTOLIVE2]', e)
            await react(conn, m, '❌')
            return m.reply(`❌ Gagal membuat Live Photo2: ${e.message}`)
        }
    }
}

handler.command = ['photolive2']
handler.tags = ['convert']
handler.limit = true

export default handler
