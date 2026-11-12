import { jpmStopJob } from '../../lib/group/sosial.js'

let handler = async (m, { reply }) => {
    if (!jpmStopJob('autoSwgc')) return reply('❌ Auto SWGC tidak sedang berjalan.')
    return reply('*▢ AUTO SWGC*\n• Status : Dihentikan')
}

handler.command = ['stopautoswgc']
handler.tags = ['jpm']
handler.owner = true

export default handler
