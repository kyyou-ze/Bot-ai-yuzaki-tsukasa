/**
 * Kaguya Multi Device — Sewa Bot
 * .ceksewa — ceksewa
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply } from '../../lib/store/merchant.js'
import { formatDate, formatRemaining, sewaData, getRental } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { STATUS, expireOrders } from '../../lib/store/sewa.js'

// ===== .ceksewa =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        if (!m.isGroup) return reply('Pakai di dalam grup yang mau dicek.')
        const r = getRental(jid)
        if (!r) return reply(`Grup ini belum pernah menyewa bot.\nKetik ${p}sewa untuk melihat paket.`)
        const active = r.until === null || r.until > Date.now()
        return reply(
            `*▢ STATUS SEWA*\n\nStatus : ${active ? '✅ Aktif' : '⌛ Habis'}\n` +
            `Masa   : ${r.until === null ? 'Permanen' : `${active ? formatRemaining(r.until) + ' lagi' : 'habis sejak ' + formatDate(r.until)}\nBerakhir: ${formatDate(r.until)}`}\n` +
            `Paket  : ${r.plan || '-'}\nSejak  : ${formatDate(r.firstAdded || r.added)}`
        )
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['ceksewa']
handler.tags = ['sewa-bot']
handler.help = ['ceksewa']

export default handler
