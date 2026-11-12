/**
 * Kaguya Multi Device — Store
 * .donasi — donasi [nominal] [pesan]
 * Satu file = satu command. Helper bersama: lib/store/donate.js
 */

import { saveDB } from '../../lib/core/system.js'
import QRCode from 'qrcode'
import { storeReply, cfg, gwUsable, ACTIVE, rp, quick, pick, row, copyBtn, sendBtn, allocTotal, createGatewayInvoice, merchantDB } from '../../lib/store/merchant.js'
import { toPN } from '../../lib/engine/plugins.js'
import { QRIS, qrisReady, toDynamic } from '../../lib/store/shop.js'
import { MIN_NOMINAL, NOTE_MAX, QUICK_AMOUNTS, parseNominal, homeBtn, donations } from '../../lib/store/donate.js'

// ===== .donasi [nominal] [pesan] =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const db = merchantDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    // Tanpa gateway (kosong / url / token error) donasi tetap jalan lewat QRIS statis, hanya saja tidak terdeteksi otomatis.
    if (!gwUsable() && !qrisReady()) {
        return reply(isOwner ? 'Donasi belum tersedia. Isi global.merchantGw (otomatis) atau global.qrisStatic di config.js.' : 'Donasi belum tersedia saat ini.')
    }

    const [nomRaw, ...noteParts] = body.split(/\s+/)
    if (!nomRaw) {
        return send({
            text:
                `💝 *DONASI*\n\nDukung ${c.storeName} lewat QRIS GoPay. Nominal bebas.\n\n` +
                `Pilih nominal lewat tombol, atau ketik:\n` +
                `${p}donasi <nominal> [pesan]\n` +
                `Contoh:\n• ${p}donasi 10k donasi buat developer baik\n• ${p}donasi 1jt\n\n` +
                `Pesan boleh diisi atau dikosongkan (maks ${NOTE_MAX} huruf). Pesan tampil di struk dan notif donasi.`,
            buttons: [
                pick('💝 Pilih Nominal', [{ title: 'Nominal donasi', rows: QUICK_AMOUNTS.map(n => row(rp(n), `${p}donasi ${n}`)) }]),
                quick('🏆 Daftar Donatur', `${p}donatur`),
                homeBtn(p)
            ]
        })
    }

    const nominal = parseNominal(nomRaw)
    if (!nominal) return send({ text: `Nominal tidak valid.\nContoh: ${p}donasi 10000  atau  ${p}donasi 10k  atau  ${p}donasi 1jt`, buttons: [quick('💝 Pilih Nominal', `${p}donasi`)] })
    if (nominal < MIN_NOMINAL) return send({ text: `Minimal donasi ${rp(MIN_NOMINAL)}.`, buttons: [quick('💝 Pilih Nominal', `${p}donasi`)] })
    if (nominal > c.donateMax) return send({ text: `Maksimal donasi ${rp(c.donateMax)} per transaksi.`, buttons: [quick('💝 Pilih Nominal', `${p}donasi`)] })

    // mode manual: QRIS statis dengan nominal terisi, tanpa pelacakan pembayaran
    const manualDonation = async () => {
        if (!qrisReady()) return reply(isOwner ? 'Gateway error dan QRIS statis belum valid. Perbaiki global.merchantGw atau isi global.qrisStatic di config.js.' : 'Donasi belum tersedia saat ini.')
        const image = await QRCode.toBuffer(toDynamic(QRIS, nominal), { width: 600, margin: 3, errorCorrectionLevel: 'M' })
        const note = noteParts.join(' ').slice(0, NOTE_MAX)
        return send({
            image,
            text:
                `╭─▣「 *DONASI* 」▣─╮\n` +
                `┃ 💝 Nominal : ${rp(nominal)}\n` +
                `┃ 💳 *Total bayar : ${rp(nominal)}*\n` +
                `╰─────────────➤\n` +
                (note ? `\n💬 "${note}"\n` : '') +
                `\nScan QR di atas lewat e-wallet / m-banking (QRIS) dan bayar *${rp(nominal)}*.\n` +
                `Terima kasih banyak atas dukunganmu! 🙏`,
            buttons: [copyBtn('📋 Salin Nominal', nominal), homeBtn(p)]
        })
    }
    if (!gwUsable()) return manualDonation()

    const buyer = await toPN(sock, m.sender)
    const running = donations().find(d => d.buyer === buyer && ACTIVE.has(d.status))
    if (running) {
        return send({
            text: `Kamu masih punya donasi *${running.id}* (${rp(running.total)}) yang belum dibayar.\nSelesaikan atau batalkan dulu.`,
            buttons: [quick('🔄 Cek Pembayaran', `${p}cekdonasi ${running.id}`), quick('🚫 Batalkan', `${p}bataldonasi`)]
        })
    }

    const alloc = allocTotal(nominal)
    if (!alloc) return reply('Sedang ramai, coba lagi beberapa menit lagi ya.')

    let inv
    try {
        inv = await createGatewayInvoice(alloc.total)
    } catch (e) {
        console.error('[donate] create gagal, pakai mode manual:', e?.message || e)
        return manualDonation()
    }

    db.seq += 1
    const id = `DON-${String(db.seq).padStart(4, '0')}`
    db.donations[id] = {
        id, price: nominal, unique: alloc.unique, total: alloc.total,
        buyer, name: m.pushName || '', chat: m.chat, note: noteParts.join(' ').slice(0, NOTE_MAX),
        status: 'pending', createdAt: Date.now(), gw: inv.gw
    }
    saveDB(global.db)
    const don = db.donations[id]

    return send({
        image: inv.image,
        text:
            `╭─▣「 *DONASI ${id}* 」▣─╮\n` +
            `┃ 💝 Nominal : ${rp(nominal)}\n` +
            (alloc.unique ? `┃ 🔢 Kode unik : ${alloc.unique}\n` : '') +
            `┃ 💳 *Total bayar : ${rp(alloc.total)}*\n` +
            `┃ ⏳ Berlaku : ${c.ttlMin} menit\n` +
            `╰─────────────➤\n` +
            (don.note ? `\n💬 "${don.note}"\n` : '') +
            `\nScan QR di atas lewat GoPay / e-wallet / m-banking (QRIS) dan bayar *tepat ${rp(alloc.total)}*.\n` +
            `Donasi terdeteksi *otomatis*, tidak perlu kirim bukti. Terima kasih! 🙏`,
        buttons: [
            quick('🔄 Cek Pembayaran', `${p}cekdonasi ${id}`),
            copyBtn('📋 Salin Nominal', alloc.total),
            quick('🚫 Batalkan', `${p}bataldonasi`)
        ]
    })
}

handler.command = ['donasi']
handler.tags = ['store']
handler.help = ['donasi']

export default handler
