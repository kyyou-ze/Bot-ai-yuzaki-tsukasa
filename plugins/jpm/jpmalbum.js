import crypto from 'crypto'
import { generateWAMessage, generateWAMessageFromContent, jidNormalizedUser } from '@whiskeysockets/baileys'
import { jpmGroups, jpmCfg, jpmLoop, getMedia } from '../../lib/group/sosial.js'

// Kaguya tidak menyimpan riwayat pesan, jadi media dikumpulkan manual:
//   reply foto/video dengan  .jpmalbum add   (ulangi untuk tiap media, maks 10)
//   lalu kirim dengan        .jpmalbum <caption>      |  .jpmalbum list  |  .jpmalbum reset
const MAX = 10
const buf = () => (global.__jpmAlbum ||= [])

async function sendAlbum(sock, groupId, list, caption) {
    const userJid = jidNormalizedUser(sock.user.id)
    const opener = generateWAMessageFromContent(groupId, {
        messageContextInfo: { messageSecret: crypto.randomBytes(32) },
        albumMessage: {
            expectedImageCount: list.filter(v => v.kind === 'image').length,
            expectedVideoCount: list.filter(v => v.kind === 'video').length
        }
    }, { userJid, upload: sock.waUploadToServer })
    await sock.relayMessage(opener.key.remoteJid, opener.message, { messageId: opener.key.id })

    for (const [i, media] of list.entries()) {
        const msg = await generateWAMessage(groupId, {
            [media.kind]: media.buffer,
            caption: i === 0 ? caption : '',
            mimetype: media.mime || (media.kind === 'video' ? 'video/mp4' : 'image/jpeg')
        }, { upload: sock.waUploadToServer })
        msg.message.messageContextInfo = {
            messageSecret: crypto.randomBytes(32),
            messageAssociation: { associationType: 1, parentMessageKey: opener.key }
        }
        await sock.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id })
    }
}

let handler = async (m, { sock, text, prefix, reply }) => {
    const [first = '', ...rest] = String(text || '').trim().split(/\s+/)
    const act = first.toLowerCase()

    if (act === 'add') {
        const media = await getMedia(m)
        if (!media) return reply(`❌ Reply foto/video dengan *${prefix}jpmalbum add*.`)
        if (buf().length >= MAX) return reply(`❌ Album penuh (maks ${MAX} media).`)
        buf().push(media)
        return reply(`✅ Media ditambahkan. Antrean album: ${buf().length}/${MAX}\nKirim dengan *${prefix}jpmalbum <caption>*`)
    }
    if (act === 'reset') { global.__jpmAlbum = []; return reply('✅ Antrean album dikosongkan.') }
    if (act === 'list') return reply(`*▢ ANTREAN ALBUM*\n• Media : ${buf().length}/${MAX}`)

    const list = [...buf()]
    const quoted = await getMedia(m)
    if (quoted && !list.length) list.push(quoted)
    if (!list.length) return reply(`*▢ JPM ALBUM*\n\n1. Reply foto/video lalu *${prefix}jpmalbum add* (ulangi per media)\n2. Kirim: *${prefix}jpmalbum <caption>*\n\nAtau reply satu media langsung dengan *${prefix}jpmalbum <caption>*.`)
    if (global.__jpmRunning) return reply('❌ JPM sedang berjalan. Ketik *stopjpm* untuk menghentikan.')

    const caption = [first, ...rest].join(' ').trim()
    const groups = await jpmGroups(sock)
    if (!groups.length) return reply('❌ Tidak ada grup yang bisa dituju.')
    const delay = jpmCfg().delayJpm
    await reply(`*▢ JPM ALBUM*\n• Media : ${list.length}\n• Target : ${groups.length} grup\n• Delay : ${delay}ms\n\nHentikan dengan *stopjpm*`)

    const { ok, fail } = await jpmLoop(groups, delay, g => sendAlbum(sock, g.id, list, caption))
    global.__jpmAlbum = []
    return reply(`*▢ JPM ALBUM SELESAI*\n• Berhasil : ${ok} grup\n• Gagal : ${fail} grup`)
}

handler.command = ['jpmalbum', 'jpmab', 'jaseralbum']
handler.tags = ['jpm']
handler.owner = true

export default handler
