/**
 * Kaguya Multi Device — Sewa Bot
 * .delsewa — delsewa [id grup] [leave] (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply, sendThumb } from '../../lib/store/merchant.js'
import { sewaData, removeRental } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { GROUP_JID, expireOrders } from '../../lib/store/sewa.js'

// ===== .delsewa [id grup] [leave] (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const tokens = body.split(/\s+/).filter(Boolean)
        const target = tokens.find(t => GROUP_JID.test(t)) || (m.isGroup ? jid : null)
        if (!target) return reply(`Pakai di dalam grup, atau sertakan id grup.\nContoh: ${p}delsewa 1203xxxx@g.us leave`)
        if (!removeRental(target)) return reply('Grup itu tidak terdaftar menyewa.')
        const leave = tokens.some(t => /^leave$/i.test(t))
        if (leave) {
            await sendThumb(sock, target, { text: '👋 Sewa dihentikan oleh owner. Bot keluar dari grup.' }).catch(() => null)
            await sock.groupLeave(target).catch(() => null)
        }
        return reply(`✅ Sewa ${target} dihapus${leave ? ' dan bot keluar dari grup' : ''}.`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['delsewa']
handler.tags = ['sewa-bot']
handler.help = ['delsewa']
handler.owner = true

export default handler
