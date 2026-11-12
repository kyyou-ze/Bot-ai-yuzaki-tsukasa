import { jpmGroups, jpmCfg, jpmLoop, getMedia, mediaContent, tagList } from '../../lib/group/sosial.js'

// jpm hidetag: pesan terlihat biasa, semua member grup tetap dapat notifikasi.
// Mendukung teks, foto, video, dokumen, dan audio (kirim langsung atau reply).
let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m, ['image', 'video', 'document', 'audio'])
    const caption = text || media?.caption || m.quoted?.text || ''
    if (!caption && !media) return example('pesan  (atau kirim/reply foto, video, dokumen, audio)')

    const groups = await jpmGroups(sock)
    const cfg = jpmCfg()
    const delay = cfg.delayJpmTag
    const tipe = media ? media.kind.toUpperCase() + (caption ? ' + Teks' : '') : 'Teks (HideTag)'
    await reply(`*▢ PROSES JPM HIDETAG*\n• Total grup : ${groups.length}\n• Tipe : ${tipe}\n• Delay : ${delay}ms`)

    const { ok, fail } = await jpmLoop(groups, delay, g => {
        const { mentions } = tagList(g)
        return sock.sendMessage(g.id, media ? mediaContent(media, caption, mentions) : { text: caption, mentions })
    })

    return reply(`*▢ JPM HIDETAG SELESAI*\n• Berhasil : ${ok} grup\n• Gagal : ${fail} grup`)
}

handler.command = ['jpmht']
handler.tags = ['jpm']
handler.owner = true

export default handler
