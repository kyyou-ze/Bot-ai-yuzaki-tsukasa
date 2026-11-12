import { jpmGroups, jpmCfg, jpmLoop, jpmStartJob, getMedia, mediaContent, splitInterval, tagList, JPM_MIN_INTERVAL } from '../../lib/group/sosial.js'

// .autojpmtag <interval> <pesan>   interval: 60000 (ms) / 30s / 5m / 1h  (default 60 detik)
let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m)
    const { interval, teks } = splitInterval(text)
    if (!teks && !media) return example('5m pesan auto broadcast tag  (interval: 30s / 5m / 1h / 60000)')
    if (interval < JPM_MIN_INTERVAL) return reply(`❌ Interval minimal ${JPM_MIN_INTERVAL / 1000} detik.`)

    const delay = jpmCfg().delayJpmTag
    await reply(`*▢ AUTO JPM TAG AKTIF*\n• Interval : setiap ${interval / 1000} detik\n• Delay antar grup : ${delay}ms\n\nHentikan dengan *stopautojpmtag*`)

    jpmStartJob('autoJpmTag', interval, async isStopped => {
        const groups = await jpmGroups(sock, { auto: true })
        await jpmLoop(groups, delay, g => {
            const tag = tagList(g)
            const caption = `${teks}\n${tag.text}`
            return sock.sendMessage(g.id, media ? mediaContent(media, caption, tag.mentions) : { text: caption, mentions: tag.mentions })
        }, isStopped)
    })
}

handler.command = ['autojpmtag']
handler.tags = ['jpm']
handler.owner = true

export default handler
