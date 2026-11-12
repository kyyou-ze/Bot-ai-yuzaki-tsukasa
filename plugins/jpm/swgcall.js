import { jpmGroups, jpmCfg, jpmLoop, getMedia, sendGroupStatus } from '../../lib/group/sosial.js'

// SWGC ke SEMUA grup (seperti swgc, tapi massal) lalu tampilkan total grup yang kena.
// .swgcall <teks>   atau reply foto / video / audio (+ teks sebagai caption)
// Grup banchat & blacklist JPM otomatis dilewati. Hentikan dengan *stopjpm*.
let handler = async (m, { sock, text, reply, example }) => {
    if (global.__jpmRunning) return reply('❌ Masih ada proses JPM/SWGC yang berjalan. Tunggu selesai atau ketik *stopjpm*.')

    const media = await getMedia(m, ['image', 'video', 'audio'])
    const caption = text || media?.caption || m.quoted?.text || ''
    if (!caption && !media) return example('teks status  (atau reply foto/video/audio)')

    const groups = await jpmGroups(sock)
    if (!groups.length) return reply('❌ Tidak ada grup yang bisa dikirimi status.')

    const delay = jpmCfg().delayJpm
    const tipe = media ? ({ image: 'Foto', video: 'Video', audio: 'Audio' }[media.kind] || 'Media') : 'Teks'
    await reply(
        `*▢ PROSES SWGC ALL*\n` +
        `• Total grup : ${groups.length}\n` +
        `• Tipe : ${tipe}\n` +
        `• Delay : ${delay}ms\n\n` +
        `Hentikan dengan *stopjpm*`
    )

    const { ok, fail } = await jpmLoop(groups, delay, g =>
        sendGroupStatus(sock, g.id, { text: caption, media }))

    return reply(
        `*▢ SWGC ALL SELESAI*\n` +
        `• Total grup : ${groups.length}\n` +
        `• Berhasil : ${ok} grup\n` +
        `• Gagal : ${fail} grup` +
        (ok + fail < groups.length ? `\n• Dilewati (dihentikan) : ${groups.length - ok - fail} grup` : '')
    )
}

handler.command = ['swgcall']
handler.tags = ['jpm']
handler.owner = true

export default handler
