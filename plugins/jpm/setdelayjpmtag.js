import { jpmSetCfg } from '../../lib/group/sosial.js'

// delay ini juga dipakai jpmht (hidetag) dan autojpmtag
let handler = async (m, { text, reply, example }) => {
    const ms = parseInt(text)
    if (isNaN(ms) || ms < 500) return example('<ms>  (minimal 500, contoh: 3000)')
    jpmSetCfg('delayJpmTag', ms)
    return reply(`*▢ DELAY JPM TAG*\n• Delay : ${ms}ms\n• Status : Berhasil diubah`)
}

handler.command = ['setdelayjpmtag']
handler.tags = ['jpm']
handler.owner = true

export default handler
