// Ambil foto profil WhatsApp (bisa banyak orang sekaligus, dikirim sebagai album)
//   .getpp @user1 @user2 ...   -> foto profil semua yang di-tag
//   .getpp (reply pesan)       -> foto profil pengirim pesan itu
//   .getpp                     -> foto profil kamu sendiri
// Taruh di plugins/tools/getpp.js
import { toPN } from '../../lib/engine/plugins.js'

const MAX = 10
const num = (jid) => String(jid || '').split('@')[0]

// ambil buffer foto profil; null kalau tidak punya foto / dikunci privasi
async function fetchPP(sock, jid) {
    const tries = [jid]
    try { const pn = await toPN(sock, jid); if (pn && pn !== jid) tries.push(pn) } catch {}
    for (const j of tries) {
        try {
            const url = await sock.profilePictureUrl(j, 'image')
            if (!url) continue
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
            if (!res.ok) continue
            return Buffer.from(await res.arrayBuffer())
        } catch {}
    }
    return null
}

let handler = async (m, { sock, reply }) => {
    const chat = m.chat
    let targets = [...(m.mentionedJid || [])]
    if (!targets.length && m.quoted?.sender) targets.push(m.quoted.sender)
    if (!targets.length) targets.push(m.sender)
    targets = [...new Set(targets)]

    const over = targets.length > MAX
    if (over) targets = targets.slice(0, MAX)

    const results = await Promise.all(targets.map(async (jid) => ({ jid, buf: await fetchPP(sock, jid) })))
    const ok = results.filter(r => r.buf)
    const fail = results.filter(r => !r.buf)

    if (!ok.length) {
        return reply(`❌ Tidak ada foto profil yang bisa diambil (kosong atau disembunyikan):\n${fail.map(f => '• @' + num(f.jid)).join('\n')}`)
    }

    const cap = (r) => `Foto profil @${num(r.jid)}`
    const mentions = ok.map(r => r.jid)

    if (ok.length === 1) {
        await sock.sendMessage(chat, { image: ok[0].buf, caption: cap(ok[0]), mentions }, { quoted: m })
    } else {
        try {
            // album (beberapa foto digabung dalam satu pesan)
            await sock.sendMessage(chat, {
                album: ok.map(r => ({ image: r.buf, caption: cap(r), mentions: [r.jid] }))
            }, { quoted: m })
        } catch (e) {
            console.error('[getpp] album gagal, kirim satu-satu:', e?.message || e)
            for (const r of ok) {
                await sock.sendMessage(chat, { image: r.buf, caption: cap(r), mentions: [r.jid] }, { quoted: m }).catch(() => {})
            }
        }
    }

    const notes = []
    if (fail.length) notes.push(`⚠️ Tanpa foto / disembunyikan: ${fail.map(f => '@' + num(f.jid)).join(', ')}`)
    if (over) notes.push(`ℹ️ Maksimal ${MAX} orang sekali ambil.`)
    if (notes.length) await sock.sendMessage(chat, { text: notes.join('\n'), mentions: fail.map(f => f.jid) }, { quoted: m })
}

handler.command = ['getpp']
handler.help = ['getpp @user1 @user2 ...']
handler.tags = ['tools']

export default handler
