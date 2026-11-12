/**
 * Kaguya Multi Device — Store
 * .acc — acc <id>
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendThumb, resolveScript, hasScript, scriptSource, sendScriptFile, sendBtn, quick, copyBtn, makeReceipt } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { STORE_NAME, getDB, tagOf, STATUS, normId, expireOrders } from '../../lib/store/shop.js'

// ===== .acc <id> =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    // id tombol = command lengkap (tiap command punya file sendiri)
    const S = (sub, args = '') => `${p}${sub}${args ? ` ${args}` : ''}`
    const btn = (text, buttons, o = {}) => sendBtn(sock, m.chat, { text, buttons, ...o }, m)
    const katalogBtn = quick('🛍 Katalog', S('produk'))
    const riwayatBtn = quick('🧾 Riwayat', S('riwayat'))
    const cut = (str, n) => (String(str).length > n ? `${String(str).slice(0, n - 1)}…` : String(str))
    autoSeed() // isi katalog contoh + terapkan global.storeProducts (config.js)
    const d = getDB()
    expireOrders()
    const id = normId(body.split(/\s+/)[0])
    const order = id && d.orders[id]
    if (!order) return reply(`Format: ${p}acc <id>   contoh: ${p}acc INV-0001\nLihat daftar: ${p}pesanan`)
    if (order.status === 'done') return reply(`${id} sudah selesai sebelumnya.`)
    if (!['pending', 'waiting', 'expired'].includes(order.status)) return reply(`${id} berstatus ${STATUS[order.status]}, tidak bisa di-ACC.`)

    const pr = d.products[order.code]
    if (hasScript(pr)) {
        const f = await resolveScript(pr)
        if (!f.ok) return reply(`File script ${pr.code} bermasalah: ${scriptSource(pr)} (${f.reason}).\nPerbaiki filenya dulu, lalu ketik ${p}acc ${id} lagi.`)
    }
    let item = null
    if (pr && Array.isArray(pr.stock)) {
        if (!pr.stock.length) return reply(`Stok ${pr.code} habis, ${id} belum di-ACC.\nTambah stok dengan ${p}addstok, atau tolak dengan ${p}tolak ${id}.`)
        item = pr.stock.shift()
    } else if (pr?.deliver) {
        item = pr.deliver
    }
    order.status = 'done'
    order.doneAt = Date.now()
    if (item) order.item = item
    saveDB(global.db)

    const image = await makeReceipt('store', order, { via: order.paidVia || 'qris-manual' })
    const msg = (item || hasScript(pr))
        ? `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n🛍️ ${order.name}\n\n📦 *Pesanan kamu:*\n${item || ''}${hasScript(pr) ? '\n\n📎 File script dikirim di pesan berikutnya 👇' : ''}\n\nTerima kasih sudah belanja di ${STORE_NAME}! 🙏`
        : `✅ *PEMBAYARAN DITERIMA*\n\n🧾 ${order.id}\n🛍️ ${order.name}\n\nPesananmu dikonfirmasi, owner akan segera memprosesnya. Terima kasih! 🙏`
    const ok = await sendBtn(sock, order.buyer, {
        image,
        text: msg,
        buttons: [
            ...(item && String(item).length <= 200 ? [copyBtn('📋 Salin Pesanan', item)] : []),
            katalogBtn,
            riwayatBtn
        ]
    })
    const fileOk = hasScript(pr) ? (ok && await sendScriptFile(sock, order.buyer, pr)) : true
    if (ok && fileOk) {
        const done = `✅ ${id} selesai.${(item || hasScript(pr)) ? ' Produk sudah dikirim ke DM pembeli.' : ' Pembeli sudah diberi tahu.'}`
        // owner juga menerima struknya; kalau struk gagal dibuat, balas teks biasa (tanpa foto toko)
        if (image) return sock.sendMessage(m.chat, { image, caption: done }, { quoted: m }).catch(() => baseReply(done))
        return baseReply(done)
    }
    return sendThumb(sock, m.chat, {
        text: `✅ ${id} ditandai selesai, tapi *gagal mengirim DM* ke @${tagOf(order.buyer)}.\n${hasScript(pr) ? `Kirim manual file ${scriptSource(pr)}` : item ? `Kirim manual item ini:\n${item}` : 'Hubungi pembeli secara manual.'}`,
        mentions: [order.buyer]
    }, { quoted: m })
}

handler.command = ['acc']
handler.tags = ['store']
handler.help = ['acc']
handler.owner = true

export default handler
