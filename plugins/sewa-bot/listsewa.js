/**
 * Kaguya Multi Device — Sewa Bot
 * .listsewa — listsewa [hal] (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply } from '../../lib/store/merchant.js'
import { sewaData, listRentals } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { PER_PAGE, expireOrders, rentalLine } from '../../lib/store/sewa.js'

// ===== .listsewa [hal] (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const all = listRentals().sort((a, b) => (a.until ?? Infinity) - (b.until ?? Infinity))
        if (!all.length) return reply('Belum ada grup yang menyewa.')
        const pages = Math.ceil(all.length / PER_PAGE)
        const page = Math.min(Math.max(parseInt(body) || 1, 1), pages)
        const start = (page - 1) * PER_PAGE
        const aktif = all.filter(r => r.until === null || r.until > Date.now()).length
        return reply(
            `*▢ GRUP PENYEWA* (${all.length}, aktif ${aktif})\nHalaman ${page}/${pages}\n\n` +
            all.slice(start, start + PER_PAGE).map((r, i) => `${start + i + 1}. ${rentalLine(r)}`).join('\n') +
            (page < pages ? `\n\nHalaman berikutnya: ${p}listsewa ${page + 1}` : '')
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['listsewa']
handler.tags = ['sewa-bot']
handler.help = ['listsewa']
handler.owner = true

export default handler
