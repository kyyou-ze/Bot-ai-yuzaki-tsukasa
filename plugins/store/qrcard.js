/**
 * Kaguya Multi Device — Store
 * .qrcard — qrcard nominal [catatan] (owner) — kartu QRIS bernominal untuk menagih manual
 * Satu file = satu command. Memakai endpoint gateway GET /api/gopay/qr-image
 * QR ini TIDAK terhubung ke order mana pun. Begitu dibayar, poller bot mengirim notifikasi "UANG MASUK" ke owner.
 */

import { storeReply, cfg, gwReady, gateway, scrub, allocTotal, rp, quick, sendBtn } from '../../lib/store/merchant.js'
import { homeBtn, MIN_PRICE } from '../../lib/store/order.js'

const MAX_AMOUNT = 10_000_000

// "15000", "15.000", "15k", "15rb" -> 15000
function parseNominal(raw) {
    const s = String(raw || '').toLowerCase().replace(/rp\.?/g, '').trim()
    const mm = s.match(/^(\d+(?:[.,]\d+)*)\s*(k|rb|ribu|jt|juta)?$/)
    if (!mm) return NaN
    let num = mm[1]
    const mult = { k: 1e3, rb: 1e3, ribu: 1e3, jt: 1e6, juta: 1e6 }[mm[2]]
    if (mult) return Math.round(parseFloat(num.replace(',', '.')) * mult)
    return parseInt(num.replace(/[.,]/g, ''), 10)
}

// ===== .qrcard nominal [catatan] (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    if (!gwReady()) return reply('Gateway belum dikonfigurasi. Isi global.merchantGw (url & token) di config.js.')

    const [first, ...rest] = body.split(/\s+/)
    const price = parseNominal(first)
    const note = rest.join(' ').replace(/\s+/g, ' ').trim().slice(0, 30)
    if (!Number.isFinite(price)) return reply(`Format: ${p}qrcard nominal [catatan]\nContoh: ${p}qrcard 25000 Tagihan Budi\nNominal boleh 25000, 25.000, atau 25k.`)
    if (price < MIN_PRICE) return reply(`Nominal minimal ${rp(MIN_PRICE)}.`)
    if (price > MAX_AMOUNT) return reply(`Nominal maksimal ${rp(MAX_AMOUNT)}.`)

    // hindari nominal yang sama persis dengan order yang sedang menunggu bayar (bisa salah melunasi order itu)
    const a = allocTotal(price)
    if (!a) return reply('Semua nominal unik sedang terpakai order lain. Coba lagi sebentar.')

    try {
        const { ok, httpStatus, data } = await gateway('/api/gopay/qr-image', {
            query: { amount: a.total, title: c.storeName, ref: note || undefined, format: 'json' }
        })
        if (httpStatus === 401) return reply('❌ Token ditolak gateway (401). Samakan token di config.js dengan INTERNAL_TOKEN di Vercel.')
        if (!ok || !data.base64) return reply(`❌ Gagal membuat QR: ${scrub(data?.error || `HTTP ${httpStatus}`)}`)

        const image = Buffer.from(data.base64, 'base64')
        const caption =
            `💳 *KARTU QRIS*\n\n` +
            `Nominal: *${rp(a.total)}*\n` +
            (a.unique ? `_Ditambah ${rp(a.unique)} supaya tidak bentrok dengan order yang sedang menunggu bayar._\n` : '') +
            (note ? `Catatan: ${note}\n` : '') +
            `\nKirim gambar ini ke pembayar. QR tidak kedaluwarsa, tapi tidak terhubung ke order, jadi tidak ada konfirmasi otomatis ke pembayar. ` +
            `Begitu dibayar, kamu dapat notifikasi *UANG MASUK*.`
        const sent = await send({ image, text: caption, buttons: [quick('🧾 Transaksi', `${p}transaksi 30`), homeBtn(p)] })
        if (!sent) return reply('❌ Gambar QR gagal terkirim. Coba lagi.')
    } catch (e) {
        if (e.httpStatus === 404 || e.noJson) return reply('⚠️ Gateway belum punya endpoint /api/gopay/qr-image. Deploy ulang gateway dengan file terbaru.')
        return reply(`❌ Gateway tidak bisa dihubungi:\n${scrub(e?.message || e)}`)
    }
}

handler.command = ['qrcard']
handler.tags = ['store']
handler.help = ['qrcard']

export default handler
