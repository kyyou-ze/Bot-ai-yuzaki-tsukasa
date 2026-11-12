/**
 * Kaguya Multi Device — Sewa Bot
 * .buktisewa — buktisewa
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendThumb } from '../../lib/store/merchant.js'
import { sewaData } from '../../lib/core/data.js'
import { toPN } from '../../lib/engine/plugins.js'
import { waError } from '../../lib/platform/wa.js'
import { LATE_PROOF_HOURS, rp, tagOf, ACTIVE, ownerJids, isImage, expireOrders } from '../../lib/store/sewa.js'

// ===== .buktisewa =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const buyer = await toPN(sock, m.sender)
        const mine = Object.values(d.orders).filter(o => o.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt)
        const order = mine.find(o => ACTIVE.has(o.status)) ||
            mine.find(o => o.status === 'expired' && Date.now() - o.createdAt < LATE_PROOF_HOURS * 3_600_000)
        if (!order) return reply(`Kamu belum punya order sewa aktif. Pesan dulu dengan ${p}sewa <paket>.`)
        if (order.gw && order.status === 'pending') return reply(`Order *${order.id}* dibayar lewat QRIS otomatis, tidak perlu kirim bukti.\nSetelah kamu membayar, sewa aktif sendiri. Cek status: ${p}cekbayarsewa`)

        const source = isImage(m) ? m : (isImage(m.quoted) ? m.quoted : null)
        if (!source) return reply(`Kirim *foto* bukti bayar dengan caption ${p}buktisewa, atau balas foto bukti dengan ${p}buktisewa.`)
        const buf = await source.download().catch(() => null)
        if (!buf?.length) return reply('Gagal mengunduh fotonya. Coba kirim ulang.')

        const caption =
            `📥 *BUKTI BAYAR SEWA*${order.status === 'expired' ? ' _(order sempat kedaluwarsa, cek mutasi!)_' : ''}\n\n` +
            `🧾 ${order.id}\n🤖 ${order.planName}\n👥 ${order.groupName || order.group}\n💳 Total: ${rp(order.total)}\n👤 @${tagOf(buyer)}\n\n` +
            `Setujui : ${p}accsewa ${order.id}\nTolak   : ${p}tolaksewa ${order.id} <alasan>`
        const sent = await Promise.allSettled(ownerJids().map(j => sendThumb(sock, j, { image: buf, caption, mentions: [buyer] })))
        if (!sent.some(r => r.status === 'fulfilled')) return reply('Gagal meneruskan bukti ke owner. Hubungi owner langsung ya.')

        order.status = 'waiting'
        order.proofAt = Date.now()
        saveDB(global.db)
        return reply(`✅ Bukti untuk *${order.id}* sudah diteruskan ke owner.\nTunggu konfirmasi ya, sewa akan aktif otomatis setelah disetujui. 🙏`)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['buktisewa']
handler.tags = ['sewa-bot']
handler.help = ['buktisewa']

export default handler
