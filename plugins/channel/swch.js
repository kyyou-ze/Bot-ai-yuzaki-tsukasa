/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — posting pembaruan ke saluran (teks / gambar / video / audio)
 *
 * Contoh:  .swch halo semua          → posting teks ke saluran bawaan (.setch)
 *          kirim/reply gambar + .swch caption
 *          reply audio + .swch
 *          .swch <link saluran> teks → ke saluran lain
 */

import { pickMedia } from '../../lib/core/file.js'
import { pickTarget, assertCanPost, getCurrent, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    const p = prefix || '.'
    try {
        const t = await pickTarget(sock, text, p)

        let media = null
        const pm = pickMedia(m)
        if (pm && ['imageMessage', 'videoMessage', 'audioMessage'].includes(pm.mtype)) {
            try {
                const buffer = await pm.download()
                if (!Buffer.isBuffer(buffer)) throw new Error('buffer kosong')
                media = { ...pm, buffer }
            } catch (err) {
                console.log('[CH] swch unduh media:', err.message)
                return reply('Gagal mengunduh media. Coba kirim ulang gambar/videonya.')
            }
        }

        let content, kind
        if (media) {
            if (media.mtype === 'imageMessage') [content, kind] = [{ image: media.buffer, caption: t.rest }, 'gambar']
            else if (media.mtype === 'videoMessage') [content, kind] = [{ video: media.buffer, caption: t.rest }, 'video']
            else [content, kind] = [{ audio: media.buffer, mimetype: media.mime || 'audio/mpeg', ptt: !!media.node?.ptt }, 'audio']
        } else {
            const body = t.rest || m.quoted?.text || m.quoted?.caption || ''
            if (!body) {
                return reply(
                    `📣 *POSTING SALURAN*\n\n` +
                    `${p}swch <teks> → posting teks\n` +
                    `Kirim/reply gambar atau video + ${p}swch <caption>\n` +
                    `Reply audio + ${p}swch → posting audio\n` +
                    `${p}swch <link saluran> <teks> → ke saluran lain\n\n` +
                    (getCurrent() ? `💡 Tujuan saat ini: ${getCurrent().name}` : `💡 Atur tujuan dulu: ${p}setch <link saluran>`)
                )
            }
            if (body.length > 2000) return reply('Teks terlalu panjang (maks 2000 karakter).')
            ;[content, kind] = [{ text: body }, 'teks']
        }

        assertCanPost(t)
        await sock.sendMessage(t.id, content)
        return reply(`✅ Pembaruan (${kind}) terkirim ke saluran *${t.name}*.`)
    } catch (err) {
        console.log('[CH] swch:', err.message)
        return reply(`❌ ${explain(err)}`)
    }
}

handler.command = ['swch']
handler.help = ['swch <teks> / reply media']
handler.tags = ['channel']
handler.owner = true

export default handler
