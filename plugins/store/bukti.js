/**
 * Kaguya Multi Device — Store
 * .bukti — bukti (foto bukti bayar)
 * Satu file = satu command. Helper bersama: lib/store/shop.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, quick, pick, row, notifyOwners } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { LATE_PROOF_HOURS, QRIS, getDB, rp, tagOf, ACTIVE, expireOrders, isImage } from '../../lib/store/shop.js'

// ===== .bukti (foto bukti bayar) =====
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
    const buyer = await toPN(sock, m.sender)
    const mine = Object.values(d.orders).filter(o => o.buyer === buyer).sort((a, b) => b.createdAt - a.createdAt)
    const order = mine.find(o => ACTIVE.has(o.status)) ||
        mine.find(o => o.status === 'expired' && Date.now() - o.createdAt < LATE_PROOF_HOURS * 3_600_000)
    if (!order) return reply(`Kamu belum punya order aktif. Pesan dulu dengan ${p}beli <kode>.`)
    if (order.gw && order.status === 'pending') {
        return reply(`Order *${order.id}* dibayar lewat QRIS otomatis, tidak perlu kirim bukti.\nSetelah kamu membayar, produk dikirim sendiri. Cek status: ${p}cekorder`)
    }

    const source = isImage(m) ? m : (isImage(m.quoted) ? m.quoted : null)
    if (!source) return btn(`Kirim *foto* bukti bayar dengan caption *${p}bukti*, atau balas foto bukti dengan *${p}bukti*.`, [quick('🚫 Batalkan Order', S('batalorder')), riwayatBtn])
    const buf = await source.download().catch(() => null)
    if (!buf?.length) return reply('Gagal mengunduh fotonya. Coba kirim ulang.')

    const wasExpired = order.status === 'expired'
    const caption =
        `📥 *BUKTI BAYAR*${wasExpired ? ' _(order sempat kedaluwarsa, cek mutasi!)_' : ''}\n\n` +
        `🧾 ${order.id}\n🛍️ ${order.name}\n💳 Total: ${rp(order.total)}\n👤 @${tagOf(buyer)}\n\n` +
        `Pilih tindakan lewat tombol di bawah.`
    const reasons = ['Nominal tidak sesuai', 'Bukti tidak valid', 'Pembayaran belum masuk']
    const sent = await notifyOwners({
        image: buf,
        text: caption,
        mentions: [buyer],
        buttons: [
            quick('✅ ACC', S('acc', order.id)),
            quick('❌ Tolak', S('tolak', order.id)),
            pick('📝 Tolak + Alasan', [{ title: 'Alasan penolakan', rows: reasons.map(r => row(r, S('tolak', `${order.id} ${r.toLowerCase()}`))) }])
        ]
    })
    if (!sent.some(r => r.status === 'fulfilled' && r.value)) return reply('Gagal meneruskan bukti ke owner. Hubungi owner langsung ya.')

    order.status = 'waiting'
    order.proofAt = Date.now()
    saveDB(global.db)
    return btn(`✅ Bukti untuk *${order.id}* sudah diteruskan ke owner.\nTunggu konfirmasi ya, produk akan dikirim ke chat pribadi kamu. 🙏`, [riwayatBtn, katalogBtn])
}

handler.command = ['bukti']
handler.tags = ['store']
handler.help = ['bukti']

export default handler
