/**
 * Kaguya Multi Device — Store
 * .order — order [kode] [ok]
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { storeReply, cfg, ACTIVE, rp, quick, sendBtn, storeDB, available, stockLabel } from '../../lib/store/merchant.js'
import { startStoreOrder, expireOrders } from '../../lib/store/shop.js'
import { toPN } from '../../lib/engine/plugins.js'
import { catOf, deliveryLabel, autoSeed } from '../../lib/store/catalog.js'
import { MIN_PRICE, homeBtn, productPicker } from '../../lib/store/order.js'

// ===== .order [kode] [ok] =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    expireOrders() // order manual yang lewat batas waktu
    const [codeRaw, confirm] = body.split(/\s+/)

    // tanpa kode → daftar produk
    if (!codeRaw) return send(productPicker(p))

    const pr = d.products[codeRaw.toLowerCase()]
    if (!pr) return send({ text: `Produk "${codeRaw}" tidak ditemukan.`, buttons: [quick('🛍️ Katalog Produk', `${p}order`), homeBtn(p)] })
    if (pr.price < MIN_PRICE) return reply('Harga produk ini belum valid, hubungi owner.')
    if (available(pr) <= 0) return send({ text: `Maaf, *${pr.name}* sedang habis.`, buttons: [quick('🛍️ Produk Lain', `${p}order`), homeBtn(p)] })

    const buyer = await toPN(sock, m.sender)
    const running = Object.values(d.orders).find(o => o.buyer === buyer && ACTIVE.has(o.status))
    if (running) {
        return send({
            text: `Kamu masih punya order *${running.id}* (${running.name}).\n${running.status === 'pending' ? 'Selesaikan pembayarannya atau batalkan dulu.' : 'Tunggu konfirmasi owner ya.'}`,
            buttons: running.status === 'pending'
                ? (running.gw
                    ? [quick('🔄 Cek Pembayaran', `${p}cekorder ${running.id}`), quick('🚫 Batalkan Order', `${p}batalbayar`)]
                    : [quick('📸 Cara Kirim Bukti', `${p}bukti`), quick('🚫 Batalkan Order', `${p}batalorder`)])
                : [quick('🧾 Cek Order', `${p}cekorder`), homeBtn(p)]
        })
    }

    // langkah 1: detail produk + konfirmasi
    if (String(confirm || '').toLowerCase() !== 'ok') {
        return send({
            text:
                `╭─▣「 *${pr.name}* 」▣─╮\n` +
                `┃ ${catOf(pr).emoji} Kategori : ${catOf(pr).name}\n` +
                `┃ 🔖 Kode  : ${pr.code}\n` +
                `┃ 💰 Harga : ${rp(pr.price)}\n` +
                `┃ 📦 Stok  : ${stockLabel(pr)}\n` +
                `┃ 🚚 Kirim : ${deliveryLabel(pr)}\n` +
                `╰─────────────➤\n` +
                `${pr.desc ? `\n${pr.desc}\n` : ''}\nTap *Beli Sekarang* untuk membuat invoice QRIS.`,
            buttons: [
                quick('✅ Beli Sekarang', `${p}order ${pr.code} ok`),
                ...(pr.demo ? [{ type: 'url', text: '🔗 Lihat Demo', url: pr.demo }] : []),
                quick('Kategori Lain', `${p}store`),
                homeBtn(p)
            ]
        })
    }

    // langkah 2: buat invoice
    // otomatis kalau global.merchantGw siap, kalau kosong / url / token error → QRIS statis + bukti manual
    return startStoreOrder({ sock, m, pr, buyer, p, isOwner })
}

handler.command = ['order']
handler.tags = ['store']
handler.help = ['order']

export default handler
