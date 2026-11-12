import { jpmSetCfg } from '../../lib/group/sosial.js'

let handler = async (m, { text, reply, example }) => {
    const ms = parseInt(text)
    if (isNaN(ms) || ms < 1000) return example('<ms>  (minimal 1000, contoh: 60000)')
    jpmSetCfg('delayAutoSwgc', ms)
    return reply(`*▢ DELAY SWGC*\n• Delay : ${ms}ms\n• Status : Berhasil diubah\n• Info : berlaku untuk autoswgc berikutnya`)
}

handler.command = ['setdelayswgc']
handler.tags = ['jpm']
handler.owner = true

export default handler
