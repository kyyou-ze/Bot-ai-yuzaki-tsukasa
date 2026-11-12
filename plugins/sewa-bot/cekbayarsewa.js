/**
 * Kaguya Multi Device — Sewa Bot
 * .cekbayarsewa — cekbayarsewa [id] — cek pembayaran otomatis sekarang
 * Satu file = satu command. Helper bersama: lib/store/sewa.js
 */

import { storeReply, quick, sendBtn, pollNow, cfg as merchantCfg } from '../../lib/store/merchant.js'
import { sewaData } from '../../lib/core/data.js'
import { toPN } from '../../lib/engine/plugins.js'
import { waError } from '../../lib/platform/wa.js'
import { rp, STATUS, normId, expireOrders } from '../../lib/store/sewa.js'

// ===== .cekbayarsewa [id] — cek pembayaran otomatis sekarang =====
let handler = async (m, { sock, text, command, prefix, jid, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = String(text || '').trim()
    const d = sewaData()
    expireOrders()


    try {
        const buyer = await toPN(sock, m.sender)
        const id = normId(body.split(/\s+/)[0])
        const order = id
            ? d.orders[id]
            : Object.values(d.orders).filter(o => o.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt)[0]
        if (!order || (!isOwner && order.buyer !== buyer)) return reply(`Kamu belum punya order sewa. Pesan dengan ${p}sewa <paket>.`)
        if (order.status === 'done') return sendBtn(sock, m.chat, { text: `✅ Order *${order.id}* sudah lunas, sewa sudah aktif.`, buttons: [quick('📜 Riwayat', `${p}riwayatorder`), quick('🏠 Menu Toko', `${p}store`)] }, m)
        if (!order.gw || !['pending', 'waiting', 'expired'].includes(order.status)) return reply(`Order *${order.id}* berstatus: ${STATUS[order.status] || order.status}.`)
        await pollNow()
        if (d.orders[order.id].status === 'done') return // pesan sukses sudah dikirim otomatis
        return sendBtn(sock, m.chat, {
            text: `⏳ Pembayaran *${order.id}* (${rp(order.total)}) belum terdeteksi.\nSistem mengecek otomatis tiap ${merchantCfg().pollSec} detik, tunggu sebentar setelah membayar.`,
            buttons: [quick('🔄 Cek Lagi', `${p}cekbayarsewa ${order.id}`), quick('🚫 Batalkan Order', `${p}batalsewa`), quick('🏠 Menu Toko', `${p}store`)]
        }, m)
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['cekbayarsewa']
handler.tags = ['sewa-bot']
handler.help = ['cekbayarsewa']

export default handler
