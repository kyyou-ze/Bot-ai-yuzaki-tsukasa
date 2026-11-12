import { jpmGroups, jpmCfg, jpmLoop, getMedia, mediaContent } from '../../lib/group/sosial.js'

let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m)
    if (!text && !media) return example('pesan broadcast  (atau reply foto/video + caption)')

    const groups = await jpmGroups(sock)
    const delay = jpmCfg().delayJpm
    await reply(`*▢ PROSES JPM*\n• Total grup : ${groups.length}\n• Tipe : ${media ? 'Media + Teks' : 'Teks'}\n• Delay : ${delay}ms`)

    const { ok, fail } = await jpmLoop(groups, delay, g =>
        sock.sendMessage(g.id, media ? mediaContent(media, text) : { text }))

    return reply(`*▢ JPM SELESAI*\n• Berhasil : ${ok} grup\n• Gagal : ${fail} grup`)
}

handler.command = ['jpm']
handler.tags = ['jpm']
handler.owner = true

export default handler
