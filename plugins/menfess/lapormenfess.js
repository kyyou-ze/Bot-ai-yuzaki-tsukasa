// .lapormenfess [ID] alasan   laporkan menfess yang melecehkan / spam ke owner
import { adapt } from '../../lib/engine/plugins.js'
import { store, menfessCari, menfessLapor } from '../../lib/engine/features.js'

let handler = async (m, { conn, text, usedPrefix }) => {
    const k = store()
    let alasan = String(text || '').trim()
    let id = ''
    const mt = alasan.match(/^([A-Za-z0-9]{5})(?:\s+([\s\S]*))?$/)
    if (mt && k.menfess[mt[1].toUpperCase()]) { id = mt[1].toUpperCase(); alasan = (mt[2] || '').trim() }
    const t = menfessCari(k, m.sender, { id, quotedId: m.quoted?.id })
    if (!t || t.d.to !== m.sender) return m.reply(`Pakai: *reply* pesan menfess lalu ketik *${usedPrefix}lapormenfess alasan*, atau *${usedPrefix}lapormenfess ID alasan*.`)
    const r = await menfessLapor(conn, { jid: m.sender, id: t.id, d: t.d, alasan: alasan.slice(0, 200) })
    return m.reply((r.ok ? '🚨 ' : '') + r.msg)
}

handler.help = ['lapormenfess [ID] alasan']
handler.tags = ['menfess']
handler.command = ['lapormenfess', 'reportmenfess']
handler.exp = 0

export default adapt(handler, { category: 'menfess' })
