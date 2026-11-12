import { jpmStopJob } from '../../lib/group/sosial.js'

let handler = async (m, { reply }) => {
    if (!jpmStopJob('autoJpmTag')) return reply('❌ Auto JPM Tag tidak sedang berjalan.')
    return reply('*▢ AUTO JPM TAG*\n• Status : Dihentikan')
}

handler.command = ['stopautojpmtag']
handler.tags = ['jpm']
handler.owner = true

export default handler
