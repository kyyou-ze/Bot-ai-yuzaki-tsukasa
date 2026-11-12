// .blokmenfess [ID]   blok / buka blokir satu pengirim anonim (reply menfess atau pakai ID)
import { adapt } from '../../lib/engine/plugins.js'
import { store, menfessCari } from '../../lib/engine/features.js'

let handler = async (m, { text, usedPrefix }) => {
    const k = store()
    const id = String(text || '').trim().toUpperCase().slice(0, 5)
    const t = menfessCari(k, m.sender, { id: /^[A-Z0-9]{5}$/.test(id) ? id : '', quotedId: m.quoted?.id })
    if (!t || t.d.to !== m.sender) return m.reply(`Pakai: *reply* pesan menfess lalu ketik *${usedPrefix}blokmenfess*, atau *${usedPrefix}blokmenfess ID*.`)
    const key = `${t.d.to}|${t.d.from}`
    const baru = !k.menfessPair[key]
    if (baru) k.menfessPair[key] = true
    else delete k.menfessPair[key]
    global.db.kaguya = k
    return m.reply(baru
        ? `🚫 Pengirim menfess #${t.id} diblok. Dia tidak bisa mengirim menfess lagi padamu (dia tidak diberi tahu).\nKetik perintah yang sama untuk membuka blokirnya.`
        : `✅ Blokir pengirim menfess #${t.id} dibuka.`)
}

handler.help = ['blokmenfess [ID]']
handler.tags = ['menfess']
handler.command = ['blokmenfess']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
