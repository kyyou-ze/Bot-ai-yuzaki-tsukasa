import { jpmGroups, jpmCfg, jpmLoop, jpmStartJob, getMedia, mediaContent, splitInterval, JPM_MIN_INTERVAL } from '../../lib/group/sosial.js'

// .autojpm <interval> <pesan>   interval: 60000 (ms) / 30s / 5m / 1h  (default 60 detik)
let handler = async (m, { sock, text, reply, example }) => {
    const media = await getMedia(m)
    const { interval, teks } = splitInterval(text)
    if (!teks && !media) return example('5m pesan auto broadcast  (interval: 30s / 5m / 1h / 60000)')
    if (interval < JPM_MIN_INTERVAL) return reply(`❌ Interval minimal ${JPM_MIN_INTERVAL / 1000} detik.`)

    const delay = jpmCfg().delayJpm
    await reply(`*▢ AUTO JPM AKTIF*\n• Interval : setiap ${interval / 1000} detik\n• Delay antar grup : ${delay}ms\n• Pesan : ${teks || '[Media]'}\n\nHentikan dengan *stopautojpm*`)

    jpmStartJob('autoJpm', interval, async isStopped => {
        const groups = await jpmGroups(sock, { auto: true })
        await jpmLoop(groups, delay, g =>
            sock.sendMessage(g.id, media ? mediaContent(media, teks) : { text: teks }), isStopped)
    })
}

handler.command = ['autojpm']
handler.tags = ['jpm']
handler.owner = true

export default handler
