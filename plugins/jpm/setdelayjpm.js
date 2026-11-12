import { jpmSetCfg } from '../../lib/group/sosial.js'

let handler = async (m, { text, reply, example }) => {
    const ms = parseInt(text)
    if (isNaN(ms) || ms < 500) return example('<ms>  (minimal 500, contoh: 3000)')
    jpmSetCfg('delayJpm', ms)
    return reply(`*▢ DELAY JPM*\n• Delay : ${ms}ms\n• Status : Berhasil diubah`)
}

handler.command = ['setdelayjpm']
handler.tags = ['jpm']
handler.owner = true

export default handler
