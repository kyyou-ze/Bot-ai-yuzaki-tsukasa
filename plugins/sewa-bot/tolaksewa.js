/**
 * Kaguya Multi Device — Sewa Bot
 * .tolaksewa — tolaksewa <id> [alasan] (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendThumb } from '../../lib/store/merchant.js'
import { sewaData } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { STATUS, normId, expireOrders } from '../../lib/store/sewa.js'

// ===== .tolaksewa <id> [alasan] (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const [idRaw, ...why] = body.split(/\s+/)
        const id = normId(idRaw)
        const order = id && d.orders[id]
        if (!order) return reply(`Format: ${p}tolaksewa <id> [alasan]   contoh: ${p}tolaksewa SWA-0001 nominal tidak sesuai`)
        if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa ditolak.`)
        order.status = 'rejected'
        order.reason = why.join(' ').trim()
        saveDB(global.db)
        await sendThumb(sock, order.buyer, {
            text: `❌ *ORDER SEWA DITOLAK*\n\n🧾 ${order.id}\n🤖 ${order.planName}\n${order.reason ? `📝 Alasan: ${order.reason}\n` : ''}\nKalau merasa sudah membayar, hubungi owner dengan menyertakan bukti bayar.`
        }).catch(() => null)
        return reply(`❌ ${id} ditolak dan pembeli diberi tahu.`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['tolaksewa']
handler.tags = ['sewa-bot']
handler.help = ['tolaksewa']
handler.owner = true

export default handler
