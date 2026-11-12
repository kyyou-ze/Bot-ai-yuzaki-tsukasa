/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — upload teks / foto / video / audio (VN) ke saluran lewat node mentah
 *
 * Contoh:  .upch halo            → teks
 *          reply foto/video/audio + .upch caption
 * Tujuan   : global.idch (config.js) atau saluran bawaan dari .setch
 */

import { getCurrent } from './setch.js'

function buildNode(to, id, contenttype, content) {
    return {
        tag: 'message',
        attrs: { to, id, type: 'media' },
        content: [
            { tag: 'meta', attrs: { contenttype } },
            { tag: 'plaintext', attrs: { mediatype: contenttype }, content }
        ]
    }
}

let handler = async (m, { sock, text, prefix, reply }) => {
    const target = global.idch || getCurrent()?.id
    if (!target) return reply(`Tujuan belum diatur. Isi global.idch di config.js atau pakai ${prefix || '.'}setch <link saluran>.`)

    const { prepareWAMessageMedia, generateMessageIDV2, proto } = await import('@whiskeysockets/baileys')
    let node

    try {
        if (m.quoted) {
            const mime = m.quoted.mimetype || ''
            const caption = text || ''
            const isMedia = /^(image|video|audio)/.test(mime)
            const buffer = isMedia ? await m.quoted.download() : null

            if (mime.startsWith('image') || mime.startsWith('video')) {
                const type = mime.startsWith('image') ? 'image' : 'video'
                const obj = { [type]: buffer }
                if (caption) obj.caption = caption
                const msg = await prepareWAMessageMedia(obj, { upload: sock.waUploadToServer, jid: '@newsletter' })
                node = buildNode(target, generateMessageIDV2(), type, proto.Message.encode(msg).finish())
            } else if (mime.startsWith('audio')) {
                const waveform = Buffer.from(Array.from({ length: 100 }, () => Math.floor(Math.random() * 100)))
                const msg = await prepareWAMessageMedia(
                    { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true, waveform },
                    { upload: sock.waUploadToServer, jid: '@newsletter' }
                )
                node = buildNode(target, generateMessageIDV2(), 'audio', proto.Message.encode(msg).finish())
            } else {
                const txt = text || m.quoted.text || ''
                if (!txt) return reply('Kirim teks, atau reply ke foto/video/audio (bisa dengan caption)')
                node = buildNode(target, generateMessageIDV2(), 'text', proto.Message.encode({ extendedTextMessage: { text: txt } }).finish())
            }
        } else if (text) {
            node = buildNode(target, generateMessageIDV2(), 'text', proto.Message.encode({ extendedTextMessage: { text } }).finish())
        } else {
            return reply('Kirim teks, atau reply ke foto/video/audio (bisa dengan caption)')
        }

        await sock.query(node)

        let url = ''
        try {
            const meta = await sock.newsletterMetadata('jid', target)
            if (meta?.thread_metadata?.invite) url = `https://whatsapp.com/channel/${meta.thread_metadata.invite}`
        } catch {}
        return reply(`*UP CHANNEL SUKSES!*${url ? `\n\n> cek di: ${url}` : ''}`)
    } catch (e) {
        console.error('[UPCH]', e)
        return reply(`Gagal upload ke saluran: ${e.message || e}`)
    }
}

handler.command = ['upch']
handler.help = ['upch <teks> / reply media']
handler.tags = ['channel']
handler.owner = true

export default handler
