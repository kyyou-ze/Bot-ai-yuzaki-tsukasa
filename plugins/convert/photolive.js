// plugins/convert/photolive.js
// Live Photo: kirim/reply 1 video, foto diambil otomatis dari frame awal video

import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import {
    prepareWAMessageMedia,
    generateWAMessageFromContent
} from '@whiskeysockets/baileys'
import { ffmpegBin } from '../../lib/engine/plugins.js'

const b = '```'

async function react(conn, m, emoji) {
    try {
        await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch (e) {}
}

// ambil video dari pesan itu sendiri atau pesan yang di-reply
function pickVideo(m) {
    if (m.mtype === 'videoMessage' && m.download) return { download: m.download }
    if (m.quoted?.mtype === 'videoMessage' && m.quoted.download) return { download: m.quoted.download }
    return null
}

// ambil frame pertama video jadi JPEG (ffmpeg otomatis memutar sesuai orientasi video)
function firstFrame(videoBuffer) {
    return new Promise((resolve, reject) => {
        const tmpDir = path.join(process.cwd(), 'database', 'tmp')
        fs.mkdirSync(tmpDir, { recursive: true })
        const id = `${Date.now()}_${Math.floor(Math.random() * 100000)}`
        const input = path.join(tmpDir, `photolive_${id}.mp4`)
        const output = path.join(tmpDir, `photolive_${id}.jpg`)
        const cleanup = () => {
            for (const f of [input, output]) { try { fs.unlinkSync(f) } catch {} }
        }

        fs.writeFileSync(input, videoBuffer)
        execFile(ffmpegBin, ['-y', '-i', input, '-frames:v', '1', '-q:v', '2', output], { timeout: 60000 }, (err) => {
            try {
                if (err || !fs.existsSync(output)) throw err || new Error('Gagal mengambil frame awal video.')
                const img = fs.readFileSync(output)
                cleanup()
                resolve(img)
            } catch (e) {
                cleanup()
                reject(e)
            }
        })
    })
}

let handler = async (m, { sock: conn, prefix, command }) => {
    const p = (prefix || '.') + command
    const target = pickVideo(m)

    if (!target) {
        return m.reply(
            `     ꥟   *ᴇxᴀᴍᴘʟᴇ  •  ᴜsᴇ*\n\n` +
            `${b}sᴇɴᴅ ᴏʀ ʀᴇᴘʟʏ ᴠɪᴅᴇᴏ${b}\n` +
            `     ▸   *ᴜsᴀɢᴇ: ${p}*\n` +
            `     ▸   *sᴇɴᴅ/ʀᴇᴘʟʏ ᴠɪᴅᴇᴏ ᴡɪᴛʜ ${p}*\n` +
            `     ▸   *ғᴜɴᴄᴛɪᴏɴ: ᴠɪᴅᴇᴏ ᴅɪᴊᴀᴅɪᴋᴀɴ ʟɪᴠᴇ ᴘʜᴏᴛᴏ, ғᴏᴛᴏ ᴅᴀʀɪ ғʀᴀᴍᴇ ᴀᴡᴀʟ*\n` +
            `     ▸   *ᴜsᴇᴅ ʙʏ: ᴀʟʟ ᴜsᴇʀ*`
        )
    }

    await react(conn, m, '⏳')
    try {
        const videoBuffer = await target.download()
        if (!videoBuffer?.length) throw new Error('Gagal mengunduh video.')

        const image = await firstFrame(videoBuffer)

        const [imageMedia, videoMedia] = await Promise.all([
            prepareWAMessageMedia({ image }, { upload: conn.waUploadToServer }),
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
        console.error('[PHOTOLIVE]', e)
        await react(conn, m, '❌')
        return m.reply(`❌ Gagal membuat Live Photo: ${e.message}`)
    }
}

handler.command = ['photolive']
handler.tags = ['convert']
handler.limit = true

export default handler
