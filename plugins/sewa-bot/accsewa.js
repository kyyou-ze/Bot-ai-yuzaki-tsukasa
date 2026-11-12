/**
 * Kaguya Multi Device — Sewa Bot
 * .accsewa — accsewa <id> (owner)
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply } from '../../lib/store/merchant.js'
import { sewaData } from '../../lib/core/data.js'
import { waError } from '../../lib/platform/wa.js'
import { STATUS, normId, expireOrders, finalizeSewa } from '../../lib/store/sewa.js'

// ===== .accsewa <id> (owner) =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const id = normId(body.split(/\s+/)[0])
        const order = id && d.orders[id]
        if (!order) return reply(`Format: ${p}accsewa <id>   contoh: ${p}accsewa SWA-0001\nLihat daftar: ${p}pesanansewa`)
        if (order.status === 'done') return reply(`${id} sudah selesai sebelumnya.`)
        if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa di-ACC.`)

        const fin = await finalizeSewa(order, sock, p)
        if (!fin.ok) return reply(fin.error)
        return reply(`✅ ${id} selesai. Sewa ${order.groupName || order.group} ${fin.extended ? 'diperpanjang' : 'aktif'} (${fin.until}).${fin.joinNote}`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['accsewa']
handler.tags = ['sewa-bot']
handler.help = ['accsewa']
handler.owner = true

export default handler
