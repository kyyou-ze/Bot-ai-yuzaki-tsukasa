// .ungkapmenfess ID ya   pengirim membuka identitasnya ke penerima (pilihan sendiri)
import { adapt } from '../../lib/engine/plugins.js'
import { store, menfessCari } from '../../lib/engine/features.js'

let handler = async (m, { conn, text, usedPrefix }) => {
    if (m.isGroup) return m.reply('Pakai di chat pribadi bot ya.')
    const k = store()
    const [a, b] = String(text || '').trim().split(/\s+/)
    const id = /^[A-Za-z0-9]{5}$/.test(a || '') ? a.toUpperCase() : ''
    const t = menfessCari(k, m.sender, { id, quotedId: m.quoted?.id })
    if (!t || t.d.from !== m.sender) return m.reply(`Format: *${usedPrefix}ungkapmenfess ID ya*`)
    if (t.d.tutup) return m.reply('Menfess itu sudah ditarik.')
    if (t.d.terungkap) return m.reply('Identitasmu sudah pernah kamu ungkap di menfess itu.')
    if (!/^(ya|y|yes|ok)$/i.test(id ? (b || '') : (a || ''))) {
        return m.reply(`⚠️ Identitasmu (nomor WhatsApp) akan dikirim ke penerima menfess #${t.id} dan tidak bisa dibatalkan.\n\nLanjut: *${usedPrefix}ungkapmenfess ${t.id} ya*`)
    }
    await conn.sendMessage(t.d.to, { text: `🔓 *PENGUNGKAPAN* · #${t.id}\n\nPengirim menfess ini membuka identitasnya:\nwa.me/${m.sender.split('@')[0]}` })
        .catch(() => { throw 'Gagal mengirim, penerima tidak bisa dihubungi.' })
    t.d.terungkap = true
    global.db.kaguya = k
    return m.reply('✅ Identitasmu sudah diberikan ke penerima.')
}

handler.help = ['ungkapmenfess ID ya']
handler.tags = ['menfess']
handler.command = ['ungkapmenfess', 'reveal']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
