/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — kirim lagu YouTube (voice note) ke saluran
 *
 * Contoh:  .playch honeystars                              → ke saluran bawaan (.setch)
 *          .playch honeystars | 12036323xxxxxxxxx@newsletter
 *          .playch honeystars | https://whatsapp.com/channel/0029VaXXXX
 *          .playch action|send|<judul>|<thumb>|<nama channel>|<id@newsletter>   (payload tombol)
 */

import axios from 'axios'
import yts from 'yt-search'
import { reactTo } from '../../lib/core/file.js'
import { ytdl, toPTT } from '../../lib/services/scraper.js'
import { parseRef, metadata, getCurrent, assertCanPost, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const p = prefix || '.'
    const input = String(text || '').trim()

    if (!input) {
        return reply(
            '*YOUTUBE PLAY KE SALURAN*\n\n' +
            `Format:\n- \`${p}${command} <judul lagu> | <id@newsletter / link saluran>\`\n- \`${p}${command} <judul lagu>\` (ke saluran bawaan .setch)\n\n` +
            `*Contoh:*\n- \`${p}${command} honeystars | 12036323xxxxxxxxx@newsletter\``
        )
    }

    // ───── parse input ─────
    let query, channelName = 'YouTube', targetRaw = ''
    if (/^action\|send\|/i.test(input)) {
        const [q, , cname, cid] = input.replace(/^action\|send\|/i, '').split('|').map((v) => v.trim())
        query = q
        channelName = cname || channelName
        targetRaw = cid
    } else {
        const [q, ...rest] = input.split('|')
        query = (q || '').trim()
        targetRaw = rest.join('|').trim()
    }
    if (!query) return reply('Judul lagu kosong.')

    // ───── tentukan saluran tujuan ─────
    let channelId, channelLabel
    try {
        if (targetRaw) {
            const ref = parseRef(targetRaw)
            if (!ref) return reply('ID/link saluran tidak valid!\nContoh: 12036323xxxxxxxxx@newsletter')
            if (ref.type === 'jid') { channelId = ref.jid; channelLabel = ref.jid }
            else { const md = await metadata(sock, ref); channelId = md.id; channelLabel = md.name; assertCanPost(md) }
        } else {
            const cur = getCurrent()
            if (!cur) return reply(`Belum ada saluran tujuan. Tulis "| <id@newsletter>" atau atur dulu: ${p}setch <link saluran>`)
            channelId = cur.id; channelLabel = cur.name
            assertCanPost(cur)
        }
    } catch (err) {
        return reply(`❌ ${explain(err)}`)
    }

    await reactTo(sock, m, '⏳')

    try {
        // 1. cari lagu
        const first = (await yts(query)).videos?.[0]
        if (!first?.url) {
            await reactTo(sock, m, '❌')
            return reply(`Lagu tidak ditemukan untuk pencarian: "${query}"`)
        }

        // 2. unduh audio
        const dl = await ytdl(first.url, 'mp3')
        if (!dl?.status || !dl.dl) throw new Error(dl?.mess || 'Gagal mendapatkan link download audio.')
        const audioRes = await axios.get(dl.dl, { responseType: 'arraybuffer', timeout: 60000 })

        // 3. ubah ke voice note opus
        const ptt = await toPTT(Buffer.from(audioRes.data), 'mp3')
        let pttBuffer
        try { pttBuffer = ptt.data } finally { try { await ptt.delete() } catch {} }

        // 4. kirim ke saluran lewat node mentah
        const { prepareWAMessageMedia, generateMessageIDV2, proto } = await import('@whiskeysockets/baileys')
        const prepared = await prepareWAMessageMedia(
            { audio: pttBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true },
            { upload: sock.waUploadToServer, jid: channelId }
        )
        const payload = {
            audioMessage: {
                ...prepared.audioMessage,
                ptt: true,
                mimetype: 'audio/ogg; codecs=opus',
                waveform: new Uint8Array([100, 80, 60, 100, 40, 80, 100, 50])
            }
        }
        await sock.query({
            tag: 'message',
            attrs: { to: channelId, id: generateMessageIDV2(sock.user?.id), type: 'media' },
            content: [{ tag: 'plaintext', attrs: { mediatype: 'audio' }, content: proto.Message.encode(payload).finish() }]
        })

        await reply(
            '*AUDIO BERHASIL DIKIRIM KE SALURAN!*\n' +
            '----------------------------------------\n' +
            `*Judul:* ${dl.title || first.title}\n` +
            `*Channel:* ${first.author?.name || channelName}\n` +
            `*Target:* ${channelLabel}\n` +
            `*Sumber:* ${first.url}\n\n` +
            `© ${global.namebot || 'Kaguya MD'}`
        )
        await reactTo(sock, m, '✨')
    } catch (err) {
        console.error('[PLAYCH ERROR]:', err)
        await reactTo(sock, m, '❌')
        return reply('Gagal memproses audio ke saluran: ' + (err.message || err))
    }
}

handler.command = ['playch']
handler.help = ['playch <lagu> | <id@newsletter>']
handler.tags = ['channel']
handler.owner = true

export default handler
