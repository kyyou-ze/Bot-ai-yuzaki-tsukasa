/**
 * Kaguya Multi Device — Store
 * .merchantcek — merchantcek (owner) — diagnosa gateway
 * Satu file = satu command. Helper bersama: lib/store/order.js
 */

import { storeReply, cfg, gwReady, gateway, scrub, ACTIVE, rp, wib, quick, sendBtn, pollNow, merchantState, storeDB, merchantDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn } from '../../lib/store/order.js'

// ===== .merchantcek (owner) — diagnosa gateway =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const d = storeDB()
    autoSeed()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    if (!isOwner) return reply(global.mess?.owner || 'Khusus owner.')
    if (!gwReady()) return send({ text: 'Gateway belum dikonfigurasi, bot memakai mode manual (global.qrisStatic + bukti bayar). Isi global.merchantGw (url & token) di config.js kalau mau otomatis.', buttons: [homeBtn(p)] })
    const again = [quick('🔄 Cek Lagi', `${p}merchantcek`), quick('📅 Ringkasan', `${p}ringkasan`), homeBtn(p)]
    try {
        const { httpStatus, data } = await gateway('/api/gopay/status', {
            query: { amount: 1, created_at: new Date().toISOString(), debug: 1 }
        })
        if (httpStatus === 401) {
            return send({ text: '❌ Token ditolak gateway (401).\n\nSamakan token di bot dengan INTERNAL_TOKEN di Vercel. Setelah mengubah env di Vercel, wajib redeploy. Setelah mengubah token di bot, restart bot.', buttons: again })
        }
        if (data.status === 'ERROR') return send({ text: `❌ Gateway hidup, tapi GoBiz bermasalah:\n${scrub(data.error || '-')}\n\nCek GOPAY_EMAIL / GOPAY_PASSWORD di Vercel, atau login ulang: node scripts/login-otp.mjs`, buttons: again })

        await pollNow() // sekalian menentukan mode feed
        const st = merchantState()
        const pend = Object.values(d.orders).filter(o => o.gw && ACTIVE.has(o.status)).length +
            Object.values(global.db?.sewa?.orders || {}).filter(o => o.gw && ACTIVE.has(o.status)).length +
            Object.values(merchantDB().donations).filter(o => ACTIVE.has(o.status)).length
        const feedLine = st.feedMode === 'feed'
            ? `🔔 Notifikasi uang masuk: aktif (WhatsApp${global.tgSock ? ' + Telegram' : ''})`
            : st.feedMode === 'legacy'
                ? '⚠️ Gateway belum punya endpoint /api/gopay/transactions, jadi notifikasi uang masuk di luar order belum aktif. Deploy ulang gateway dengan file terbaru.'
                : '🔔 Notifikasi uang masuk: menunggu cek pertama'
        // sesi GoBiz dari /api/gopay/health-gobiz (gateway lama tanpa endpoint ini: baris dilewati)
        let sesiLine = ''
        try {
            const h = await gateway('/api/gopay/health-gobiz')
            const hd = h.data
            if (hd?.state) {
                const label = {
                    ready: '✅ siap',
                    refreshable: '🔄 token akan diperbarui otomatis',
                    login_required: '❌ perlu login ulang',
                    cooling_down: `⏳ login ditahan ${hd.cooldown?.seconds_left || 0} detik`,
                    misconfigured: '⚠️ konfigurasi kurang'
                }[hd.state] || hd.state
                sesiLine = `🔑 Sesi GoBiz: ${label}${hd.token?.expires_at ? ` (token s/d ${wib(hd.token.expires_at)} WIB)` : ''}\n` +
                    (hd.advice || []).map(a => `   ↳ ${scrub(a)}`).join('\n') + ((hd.advice || []).length ? '\n' : '')
            }
        } catch { /* abaikan */ }
        const recent = (data.recent || []).map(t => `• ${rp(t.amount ?? 0)} — ${t.status || '?'} — ${t.time ? wib(t.time) : '-'}`).join('\n') || '-'
        return send({
            text: `✅ *Gateway OK*\n\n🔐 Token valid, login GoBiz aktif\n${sesiLine}${feedLine}\n📨 Telegram owner: ${global.tgSock ? 'bot menyala' : 'bot Telegram tidak menyala'}\n⏳ Menunggu pembayaran: ${pend}\n⏱️ Cek tiap ${c.pollSec} detik (idle ${c.idlePollSec} detik), order berlaku ${c.ttlMin} menit\n\n*Transaksi terbaru*\n${recent}`,
            buttons: again
        })
    } catch (e) {
        return send({ text: `❌ Gateway tidak bisa dihubungi:\n${scrub(e?.message || e)}`, buttons: again })
    }
}

handler.command = ['merchantcek']
handler.tags = ['store']
handler.help = ['merchantcek']
handler.owner = true

export default handler
