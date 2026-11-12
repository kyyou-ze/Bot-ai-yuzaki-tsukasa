/**
 * Kaguya Multi Device — Store
 * .cekorder — cekorder [id] — cek pembayaran sekarang (toko, sewa, atau donasi)
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { storeReply, cfg, STATUS, rp, quick, sendBtn, pollNow, storeDB } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn, KINDS, entriesOf, findEntry, parseOrderId } from '../../lib/store/order.js'

// ===== .cekorder [id] — cek pembayaran sekarang (toko, sewa, atau donasi) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    const buyer = await toPN(sock, m.sender)
    const id = parseOrderId(body)
    const entry = id
        ? findEntry(id)
        : entriesOf(buyer).sort((a, b) => b.o.createdAt - a.o.createdAt)[0]
    if (!entry || (!isOwner && entry.o.buyer !== buyer)) {
        return send({ text: 'Kamu belum punya order.', buttons: [quick('Katalog Produk', `${p}order`), homeBtn(p)] })
    }
    const { kind, o } = entry
    if (o.status === 'done') {
        return send({ text: `✅ ${entry.emoji} *${o.id}* sudah lunas dan selesai.`, buttons: [quick('📜 Riwayat', `${p}riwayatorder`), homeBtn(p)] })
    }
    if (!o.gw || !['pending', 'waiting', 'expired'].includes(o.status)) {
        return send({ text: `${entry.emoji} *${o.id}* berstatus: ${STATUS[o.status] || o.status}.`, buttons: [quick('🍰 Katalog Produk', `${p}order`), homeBtn(p)] })
    }
    await pollNow()
    if (KINDS[kind].get()[o.id]?.status === 'done') return // pesan sukses sudah dikirim otomatis
    return send({
        text: `⏳ Pembayaran ${entry.emoji} *${o.id}* (${rp(o.total)}) belum terdeteksi.\nSistem mengecek otomatis tiap ${c.pollSec} detik, tunggu sebentar setelah membayar.`,
        buttons: [quick('🔄 Cek Lagi', `${p}cekorder ${o.id}`), quick('🚫 Batalkan Order', `${p}batalbayar`), homeBtn(p)]
    })
}

handler.command = ['cekorder']
handler.tags = ['store']
handler.help = ['cekorder']

export default handler
