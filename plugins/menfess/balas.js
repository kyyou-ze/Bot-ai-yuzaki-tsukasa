// .balas pesan   balas menfess tanpa ID: reply pesan menfess lalu ketik .balas pesan,
//                atau langsung .balas pesan untuk menfess terbaru. ID tetap boleh: .balas ID pesan
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, store, menfessCari, menfessBalas } from '../../lib/engine/features.js'

let handler = async (m, { conn, text, usedPrefix }) => {
    const c = cfg('menfess')
    const k = store()
    if (!c.on) return m.reply('Fitur menfess sedang dimatikan.')
    if (m.isGroup) return m.reply('Balas menfess lewat chat pribadi bot ya, supaya aman.')

    let pesan = String(text || '').trim()
    let id = ''
    // format lama "ID|pesan" atau "ID pesan" (ID 5 karakter) tetap didukung
    const mt = pesan.match(/^([A-Za-z0-9]{5})\s*[|\s]\s*([\s\S]+)$/)
    if (mt && k.menfess[mt[1].toUpperCase()]) { id = mt[1].toUpperCase(); pesan = mt[2].trim() }
    if (!pesan) return m.reply(`Format: *${usedPrefix}balas pesanmu*\n\nCara termudah: *reply* pesan menfess, lalu ketik pesan balasanmu (tanpa perintah juga bisa).\nTanpa reply, balasan dikirim ke menfess terbaru.`)

    const t = menfessCari(k, m.sender, { id, quotedId: m.quoted?.id })
    if (!t) return m.reply('🍅 Tidak ada menfess aktif untuk dibalas.')
    const user = global.db.data.users[m.sender]
    const r = await menfessBalas(conn, { jid: m.sender, user, id: t.id, d: t.d, pesan, prefix: usedPrefix })
    return m.reply(r.msg)
}

handler.help = ['balas pesan']
handler.tags = ['menfess']
handler.command = ['balas', 'balasmenfess', 'bm']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
