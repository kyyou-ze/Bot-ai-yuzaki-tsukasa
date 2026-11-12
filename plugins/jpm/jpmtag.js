import { jpmGroups, jpmCfg, jpmLoop, getMedia, mediaContent, tagList } from '../../lib/group/sosial.js'

let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m)
    if (!text && !media) return example('pesan broadcast  (atau reply foto/video + caption)')

    const groups = await jpmGroups(sock)
    const delay = jpmCfg().delayJpmTag
    await reply(`*▢ PROSES JPM TAG*\n• Total grup : ${groups.length}\n• Delay : ${delay}ms`)

    const { ok, fail } = await jpmLoop(groups, delay, g => {
        const tag = tagList(g)
        const caption = `${text}\n${tag.text}`
        return sock.sendMessage(g.id, media ? mediaContent(media, caption, tag.mentions) : { text: caption, mentions: tag.mentions })
    })

    return reply(`*▢ JPM TAG SELESAI*\n• Berhasil : ${ok} grup\n• Gagal : ${fail} grup`)
}

handler.command = ['jpmtag']
handler.tags = ['jpm']
handler.owner = true

export default handler
