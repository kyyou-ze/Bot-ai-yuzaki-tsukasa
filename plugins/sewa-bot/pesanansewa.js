/**
 * Kaguya Multi Device — Sewa Bot
 * .pesanansewa — pesanansewa (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply, sendThumb } from '../../lib/store/merchant.js'
import { sewaData } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { rp, tagOf, ACTIVE, STATUS, expireOrders } from '../../lib/store/sewa.js'

// ===== .pesanansewa (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const active = Object.values(d.orders).filter(o => ACTIVE.has(o.status)).sort((a, b) => a.createdAt - b.createdAt)
        const recent = Object.values(d.orders).filter(o => o.status === 'done').sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
        if (!active.length && !recent.length) return reply('Belum ada order sewa.')
        const fmt = (o) => `🧾 *${o.id}* — ${o.planName}\n   👥 ${o.groupName || o.group}\n   ${rp(o.total)} | ${STATUS[o.status]} | @${tagOf(o.buyer)}`
        return sendThumb(sock, m.chat, {
            text: `*▢ PESANAN SEWA*\n\n*Berjalan* (${active.length})\n${active.map(fmt).join('\n\n') || '-'}\n\n*Selesai terakhir*\n${recent.map(fmt).join('\n\n') || '-'}\n\nSetujui: ${p}accsewa <id>   Tolak: ${p}tolaksewa <id> <alasan>`,
            mentions: [...active, ...recent].map(o => o.buyer)
        }, { quoted: m })
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['pesanansewa']
handler.tags = ['sewa-bot']
handler.help = ['pesanansewa']
handler.owner = true

export default handler
