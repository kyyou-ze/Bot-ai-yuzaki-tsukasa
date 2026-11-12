// Balas tanpa perintah: reply pesan menfess dari bot di chat pribadi, tulis balasanmu, selesai.
import { adapt } from '../../lib/engine/plugins.js'
import { cfg, store, menfessBalas } from '../../lib/engine/features.js'

let handler = async () => false

handler.before = async (m, { conn }) => {
    if (m.isGroup || m.fromMe) return false
    const qid = m.quoted?.id
    if (!qid) return false
    const k = store()
    const tid = k.menfessMsg[qid]
    const d = tid && k.menfess[tid]
    if (!d) return false
    if (!cfg('menfess').on) return false
    const pesan = String(m.text || '').trim()
    if (!pesan || /^[!#./$]\w/.test(pesan)) return false   // command biasa dilewati
    const user = global.db.data.users[m.sender]
    const r = await menfessBalas(conn, { jid: m.sender, user, id: tid, d, pesan })
    await m.reply(r.msg)
    return true
}

handler.help = []
handler.tags = ['menfess']
handler.command = ['menfess_auto']
handler.exp = 0

export default adapt(handler, { category: 'menfess', customPrefix: /^[\s\S]+$/ })
