import { jpmCfg, jpmStartJob, getMedia, sendGroupStatus } from '../../lib/group/sosial.js'

// Status grup otomatis di grup ini, berulang tiap `setdelayswgc` ms.
// .autoswgc <teks>   atau reply foto / video / audio
let handler = async (m, { sock, jid, text, reply, example }) => {
    const media = await getMedia(m, ['image', 'video', 'audio'])
    const caption = text || media?.caption || m.quoted?.text || ''
    if (!caption && !media) return example('teks  (atau reply foto/video/audio)')

    const delay = jpmCfg().delayAutoSwgc
    await reply(`*▢ AUTO SWGC AKTIF*\n• Grup : ${jid}\n• Interval : setiap ${delay / 1000} detik\n\nHentikan dengan *stopswgc*`)

    jpmStartJob('autoSwgc', delay, async () => {
        await sendGroupStatus(sock, jid, { text: caption, media })
    })
}

handler.command = ['autoswgc']
handler.tags = ['jpm']
handler.owner = true
handler.group = true

export default handler
