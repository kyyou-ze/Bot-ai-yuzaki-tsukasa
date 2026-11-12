import { jpmGroups, jpmCfg, jpmLoop, getMedia, mediaContent } from '../../lib/group/sosial.js'

// JPM polos: tanpa externalAdReply / forward, hanya teks atau media + caption. Hentikan dengan stopjpmbasic.
let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m)
    const pesan = text || m.quoted?.text || ''
    if (!pesan && !media) return example('pesan broadcast  (atau reply foto/video + caption)')
    if (global.__jpmBasicRunning) return reply('❌ JPM Basic sedang berjalan. Ketik *stopjpmbasic* untuk menghentikan.')

    const groups = await jpmGroups(sock)
    if (!groups.length) return reply('❌ Tidak ada grup yang bisa dituju.')
    const delay = jpmCfg().delayJpm
    await reply(`*▢ JPM BASIC*\n• Target : ${groups.length} grup\n• Tipe : ${media ? 'Media + Teks' : 'Teks'}\n• Delay : ${delay}ms\n\nHentikan dengan *stopjpmbasic*`)

    global.__jpmBasicRunning = true
    global.__jpmBasicStop = false
    let res
    try {
        res = await jpmLoop(groups, delay, g =>
            sock.sendMessage(g.id, media ? mediaContent(media, pesan) : { text: pesan }), () => global.__jpmBasicStop)
    } finally {
        global.__jpmBasicRunning = false
        global.__jpmBasicStop = false
    }
    return reply(`*▢ JPM BASIC SELESAI*\n• Berhasil : ${res.ok} grup\n• Gagal : ${res.fail} grup`)
}

handler.command = ['jpmbasic', 'jpmb', 'jaser2']
handler.tags = ['jpm']
handler.owner = true

export default handler
