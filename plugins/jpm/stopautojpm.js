import { jpmStopJob } from '../../lib/group/sosial.js'

let handler = async (m, { reply }) => {
    if (!jpmStopJob('autoJpm')) return reply('❌ Auto JPM tidak sedang berjalan.')
    return reply('*▢ AUTO JPM*\n• Status : Dihentikan')
}

handler.command = ['stopautojpm']
handler.tags = ['jpm']
handler.owner = true

export default handler
