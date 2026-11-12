// .tarikmenfess ID   pengirim menarik (menghapus) menfess yang sudah terkirim
import { adapt } from '../../lib/engine/plugins.js'
import { store, menfessCari, menfessAktif } from '../../lib/engine/features.js'

let handler = async (m, { conn, text, usedPrefix, isOwner }) => {
    const k = store()
    const id = String(text || '').trim().toUpperCase().slice(0, 5)
    if (!/^[A-Z0-9]{5}$/.test(id)) return m.reply(`Format: *${usedPrefix}tarikmenfess ID*\nID ada di pesan konfirmasi / *${usedPrefix}outboxmenfess*.`)
    const d = k.menfess[id]
    const t = isOwner ? (d ? { id, d } : null) : menfessCari(k, m.sender, { id })
    if (!t || (!isOwner && t.d.from !== m.sender)) return m.reply('🍅 Menfess itu tidak ditemukan atau bukan kirimanmu.')
    if (t.d.tutup) return m.reply('Menfess itu sudah ditarik.')
    let terhapus = 0
    for (const msgId of t.d.kirim || []) {
        const ok = await conn.sendMessage(t.d.to, { delete: { remoteJid: t.d.to, fromMe: true, id: msgId } }).then(() => true).catch(() => false)
        if (ok) terhapus++
    }
    t.d.tutup = true
    global.db.kaguya = k
    return m.reply(`✅ Menfess #${t.id} ditarik. ${terhapus} pesan dihapus dari chat penerima (kalau sudah terlalu lama, WhatsApp mungkin menolak hapus, tapi menfess tidak bisa dibalas lagi).`)
}

handler.help = ['tarikmenfess ID']
handler.tags = ['menfess']
handler.command = ['tarikmenfess', 'hapusmenfess']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
