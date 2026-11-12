/**
 * Kaguya Multi Device — Store
 * .ringkasan — ringkasan [kemarin|YYYY-MM-DD] (owner) — pemasukan harian langsung dari GoBiz
 * Satu file = satu command. Memakai endpoint gateway GET /api/gopay/balance-summary
 * (beda dengan .omset yang dihitung dari catatan order di bot: ini termasuk uang masuk di luar order).
 */

import { storeReply, gwReady, gateway, scrub, rp, quick, sendBtn } from '../../lib/store/merchant.js'
import { homeBtn } from '../../lib/store/order.js'

const WIB = 7 * 3600 * 1000
const wibDate = (ms) => new Date(ms + WIB).toISOString().slice(0, 10)
const clock = (iso) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
const longDate = (d) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// ===== .ringkasan [kemarin|YYYY-MM-DD] (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim().toLowerCase()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    if (!gwReady()) return reply('Gateway belum dikonfigurasi. Isi global.merchantGw (url & token) di config.js.')

    const today = wibDate(Date.now())
    let date = today
    if (/^(kemarin|yesterday)$/.test(body)) date = wibDate(Date.now() - 24 * 3600 * 1000)
    else if (/^\d{4}-\d{2}-\d{2}$/.test(body)) date = body
    else if (body && !/^(hari ?ini|today)$/.test(body)) return reply(`Format: ${p}ringkasan [kemarin | YYYY-MM-DD]\nContoh: ${p}ringkasan 2026-11-05`)

    try {
        const { ok, httpStatus, data } = await gateway('/api/gopay/balance-summary', { query: { date, last: 5 } })
        if (httpStatus === 401) return reply('❌ Token ditolak gateway (401). Samakan token di config.js dengan INTERNAL_TOKEN di Vercel.')
        if (!ok || !data.ok) return reply(`❌ Gagal mengambil ringkasan: ${scrub(data?.error || `HTTP ${httpStatus}`)}`)

        const types = Object.entries(data.by_payment_type || {})
            .sort((a, b) => b[1].total - a[1].total)
            .map(([k, v]) => `┃ ${k}: ${v.count} trx • ${rp(v.total)}`)
        const peak = [...(data.by_hour || [])].sort((a, b) => b.count - a.count)[0]
        const last = (data.last_transactions || []).map(t =>
            `• ${t.time_wib.slice(0, 5)}  ${/refund/i.test(t.status) ? '↩️ -' : ''}${rp(t.amount)}${t.payment_type ? `  ${t.payment_type}` : ''}`)

        const lines = [
            `╭─▣「 *RINGKASAN GOBIZ* 」▣─╮`,
            `┃ 📅 ${longDate(data.date)}${data.date === today ? ' (hari ini)' : ''}`,
            `┃ 💰 Masuk : ${data.total_transactions} trx • ${rp(data.total_income)}`,
            data.refunds.count ? `┃ ↩️ Refund : ${data.refunds.count} trx • ${rp(data.refunds.total)}` : null,
            data.refunds.count ? `┃ ✅ Bersih : ${rp(data.net)}` : null,
            data.total_transactions ? `┃ 🧮 Rata-rata : ${rp(data.average_ticket)}` : null,
            peak ? `┃ 🔥 Tersibuk : ${String(peak.hour).padStart(2, '0')}.00 WIB (${peak.count} trx)` : null,
            types.length ? `┣ *Per jenis bayar*\n${types.join('\n')}` : null,
            `╰─────────────➤`
        ].filter(Boolean)

        let textOut = lines.join('\n')
        if (!data.total_transactions && !data.refunds.count) textOut += '\n\nBelum ada transaksi masuk di tanggal ini.'
        if (last.length) textOut += `\n\n*Terbaru*\n${last.join('\n')}`
        if (data.truncated) textOut += '\n\n⚠️ GoBiz mengembalikan batas maksimal baris, angka bisa kurang dari yang sebenarnya.'
        textOut += '\n\n_Dihitung dari transaksi GoBiz, termasuk uang masuk di luar order bot._'

        const nav = date === today
            ? quick('◀️ Kemarin', `${p}ringkasan kemarin`)
            : quick('📅 Hari Ini', `${p}ringkasan`)
        return send({ text: textOut, buttons: [nav, quick('🧾 Transaksi', `${p}transaksi`), homeBtn(p)] })
    } catch (e) {
        if (e.httpStatus === 404 || e.noJson) return reply('⚠️ Gateway belum punya endpoint /api/gopay/balance-summary. Deploy ulang gateway dengan file terbaru.')
        return reply(`❌ Gateway tidak bisa dihubungi:\n${scrub(e?.message || e)}`)
    }
}

handler.command = ['ringkasan']
handler.tags = ['store']
handler.help = ['ringkasan']

export default handler
