/**
 * Kaguya Multi Device — Store
 * .strukpdf — strukpdf ID (owner) — struk order yang sudah lunas dalam bentuk PDF (siap cetak/kirim)
 * Satu file = satu command. Memakai gateway POST /api/maker/struk dengan "format": "pdf"
 */

import { storeReply, gwReady, gateway, scrub, receiptData, rp, quick, sendBtn } from '../../lib/store/merchant.js'
import { homeBtn, findEntry, parseOrderId } from '../../lib/store/order.js'

const RECEIPT_KIND = { INV: 'store', SWA: 'sewa', DON: 'donate' }

// ===== .strukpdf ID (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    if (!gwReady()) return reply('Gateway belum dikonfigurasi. Isi global.merchantGw (url & token) di config.js.')

    const id = parseOrderId(body)
    if (!id) return reply(`Format: ${p}strukpdf ID\nContoh: ${p}strukpdf INV-0012  (atau ${p}strukpdf 12)\nSewa: SWA-0003, donasi: DON-0004.`)
    const entry = findEntry(id)
    if (!entry) return reply(`Order *${id}* tidak ditemukan.`)
    if (entry.o.status !== 'done') return reply(`Order *${id}* belum lunas, struk hanya dibuat untuk order yang sudah selesai.`)

    try {
        const payload = receiptData(RECEIPT_KIND[entry.kind], entry.o)
        const { ok, httpStatus, data } = await gateway('/api/maker/struk', { method: 'POST', body: { ...payload, format: 'pdf' }, timeout: 25_000 })
        if (httpStatus === 401) return reply('❌ Token ditolak gateway (401). Samakan token di config.js dengan INTERNAL_TOKEN di Vercel.')
        if (!ok || !data.base64) return reply(`❌ Gagal membuat struk PDF: ${scrub(data?.error || `HTTP ${httpStatus}`)}\n\nPastikan gateway sudah di-deploy dengan versi terbaru (opsi format=pdf).`)

        await sock.sendMessage(m.chat, {
            document: Buffer.from(data.base64, 'base64'),
            mimetype: 'application/pdf',
            fileName: `struk-${entry.o.id}.pdf`,
            caption: `🧾 Struk ${entry.emoji} *${entry.o.id}* — ${rp(entry.o.total)}`
        }, { quoted: m })
        return send({ text: `✅ Struk PDF *${entry.o.id}* terkirim.`, buttons: [quick('📊 Omset', `${p}omset`), homeBtn(p)] })
    } catch (e) {
        if (e.noJson) return reply('⚠️ Gateway membalas error tanpa JSON. Pastikan gateway sudah di-deploy ulang dengan file terbaru.')
        return reply(`❌ Gagal membuat struk PDF:\n${scrub(e?.message || e)}`)
    }
}

handler.command = ['strukpdf']
handler.tags = ['store']
handler.help = ['strukpdf']

export default handler
