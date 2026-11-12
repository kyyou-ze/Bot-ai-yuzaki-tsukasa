/**
 * Kaguya Multi Device — Store
 * .transaksi — transaksi [menit] (owner) — uang masuk terbaru langsung dari GoBiz
 * Satu file = satu command. Memakai endpoint gateway GET /api/gopay/transactions
 */

import { storeReply, gwReady, gateway, scrub, rp, quick, sendBtn } from '../../lib/store/merchant.js'
import { homeBtn } from '../../lib/store/order.js'

const SETTLED = new Set(['SETTLEMENT', 'CAPTURE'])
const stamp = (iso) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ===== .transaksi [menit] (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    if (!gwReady()) return reply('Gateway belum dikonfigurasi. Isi global.merchantGw (url & token) di config.js.')

    const minutes = Math.min(1440, Math.max(1, parseInt(body, 10) || 180))
    try {
        const { ok, httpStatus, data } = await gateway('/api/gopay/transactions', { query: { minutes, size: 50 } })
        if (httpStatus === 401) return reply('❌ Token ditolak gateway (401). Samakan token di config.js dengan INTERNAL_TOKEN di Vercel.')
        if (!ok || !Array.isArray(data.transactions)) return reply(`❌ Gagal mengambil transaksi: ${scrub(data?.error || `HTTP ${httpStatus}`)}`)

        const txs = data.transactions
            .filter(t => t.time && Number.isFinite(Number(t.amount)))
            .sort((a, b) => new Date(b.time) - new Date(a.time))
        const settled = txs.filter(t => !t.status || SETTLED.has(String(t.status).toUpperCase()))
        const label = minutes % 60 === 0 ? `${minutes / 60} jam` : `${minutes} menit`
        const shown = txs.slice(0, 15).map(t => {
            const isIn = !t.status || SETTLED.has(String(t.status).toUpperCase())
            return `${isIn ? '💰' : '↩️'} ${rp(t.amount)}  •  ${stamp(t.time)}${t.payment_type ? `  •  ${t.payment_type}` : ''}${isIn ? '' : `  (${String(t.status).toLowerCase()})`}`
        })

        const textOut = txs.length
            ? `🧾 *TRANSAKSI ${label.toUpperCase()} TERAKHIR*\n\n${shown.join('\n')}` +
              (txs.length > shown.length ? `\n… dan ${txs.length - shown.length} lainnya` : '') +
              `\n\n*Total masuk:* ${settled.length} trx • ${rp(settled.reduce((s, t) => s + Number(t.amount), 0))}`
            : `Belum ada transaksi dalam ${label} terakhir.`

        return send({
            text: textOut,
            buttons: [quick('🔄 Refresh', `${p}transaksi ${minutes}`), quick('📅 Ringkasan', `${p}ringkasan`), homeBtn(p)]
        })
    } catch (e) {
        if (e.httpStatus === 404 || e.noJson) return reply('⚠️ Gateway belum punya endpoint /api/gopay/transactions. Deploy ulang gateway dengan file terbaru.')
        return reply(`❌ Gateway tidak bisa dihubungi:\n${scrub(e?.message || e)}`)
    }
}

handler.command = ['transaksi']
handler.tags = ['store']
handler.help = ['transaksi']

export default handler
