import { getBinaryNodeChild } from '@whiskeysockets/baileys'
import { jpmCfg, jpmLoop, getMedia, mediaContent } from '../../lib/group/sosial.js'

// daftar channel (newsletter) yang diikuti akun bot
async function fetchSubscribedChannels(sock) {
    const data = {}
    try {
        const result = await sock.query({
            tag: 'iq',
            attrs: { id: sock.generateMessageTag(), type: 'get', xmlns: 'w:mex', to: '@s.whatsapp.net' },
            content: [{
                tag: 'query',
                attrs: { query_id: '6388546374527196' },
                content: new TextEncoder().encode(JSON.stringify({ variables: {} }))
            }]
        })
        const child = getBinaryNodeChild(result, 'result')
        if (!child?.content) return data
        const parsed = JSON.parse(child.content.toString())
        const list = parsed?.data?.xwa2_newsletter_subscribed || parsed?.data?.newsletter_subscribed || parsed?.data?.subscribed || []
        for (const ch of list) {
            if (ch.id) data[ch.id] = { id: ch.id, name: ch.thread_metadata?.name?.text || ch.name || 'Unknown' }
        }
    } catch (e) { console.error('[JPMCH]', e?.message || e) }
    return data
}

let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m)
    if (!text && !media) return example('pesan ke semua channel  (atau reply foto/video + caption)')
    if (global.__jpmRunning) return reply('❌ JPM sedang berjalan. Ketik *stopjpm* untuk menghentikan.')

    const channels = Object.values(await fetchSubscribedChannels(sock))
    if (!channels.length) return reply('❌ Tidak ada channel yang ditemukan / bot belum mengikuti channel apa pun.')

    const delay = jpmCfg().delayJpm
    await reply(`*▢ JPM CHANNEL*\n• Target : ${channels.length} channel\n• Tipe : ${media ? 'Media + Teks' : 'Teks'}\n• Delay : ${delay}ms\n\nHentikan dengan *stopjpm*`)

    const { ok, fail } = await jpmLoop(channels, delay, ch =>
        sock.sendMessage(ch.id, media ? mediaContent(media, text) : { text }))
    return reply(`*▢ JPM CHANNEL SELESAI*\n• Berhasil : ${ok} channel\n• Gagal : ${fail} channel`)
}

handler.command = ['jpmch', 'jpmchannel']
handler.tags = ['jpm']
handler.owner = true

export default handler
