/**
 * Kaguya Multi Device — Store
 * .donatur — donatur — papan donatur
 * Satu file = satu command. Helper bersama: lib/store/donate.js
 */

import { storeReply, cfg, rp, tagOf, quick, sendBtn, merchantDB } from '../../lib/store/merchant.js'
import { homeBtn, donations } from '../../lib/store/donate.js'
import { syncLedger } from '../../lib/store/ledger.js'

// ===== .donatur — papan donatur =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const c = cfg()
    const db = merchantDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    // sumber utama: ledger.donors (permanen, tidak hilang walau data donasi asli dibersihkan)
    syncLedger(global.db)
    const donors = Object.values(global.db.ledger?.donors || {})
    const done = donations().filter(d => d.status === 'done')
    if (!done.length && !donors.length) return send({ text: 'Belum ada donasi masuk. Jadilah yang pertama! 💝', buttons: [quick('💝 Donasi', `${p}donasi`)] })
    const byUser = new Map()
    for (const d of donors) byUser.set(String(d.jid), { buyer: d.jid, name: d.name, sum: Number(d.total) || 0, n: Number(d.count) || 0 })
    // donasi yang belum sempat masuk ledger (jeda singkat) tetap dihitung
    const counted = new Set(Object.values(global.db.ledger?.transactions || {}).filter(t => t.kind === 'donate').map(t => t.ref))
    for (const d of done) {
        if (counted.has(d.id)) continue
        const cur = byUser.get(String(d.buyer)) || { buyer: d.buyer, name: d.name, sum: 0, n: 0 }
        cur.sum += d.total
        cur.n += 1
        if (d.name) cur.name = d.name
        byUser.set(String(d.buyer), cur)
    }
    const top = [...byUser.values()].sort((a, b) => b.sum - a.sum).slice(0, 10)
    const medal = ['🥇', '🥈', '🥉']
    const all = [...byUser.values()]
    const total = all.reduce((a, u) => a + u.sum, 0)
    const count = all.reduce((a, u) => a + u.n, 0)
    return send({
        text:
            `🏆 *DAFTAR DONATUR*\n\n` +
            top.map((u, i) => `${medal[i] || `${i + 1}.`} ${u.name || `@${tagOf(u.buyer)}`} — ${rp(u.sum)}${u.n > 1 ? ` (${u.n}x)` : ''}`).join('\n') +
            `\n\n💝 Total: ${rp(total)} dari ${count} donasi`,
        buttons: [quick('💝 Donasi', `${p}donasi`), homeBtn(p)]
    })
}

handler.command = ['donatur']
handler.tags = ['store']
handler.help = ['donatur']

export default handler
