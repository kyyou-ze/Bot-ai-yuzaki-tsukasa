/**
 * Kaguya Multi Device — Store
 * .kategori — kategori <key>
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { storeReply, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { CATS, productsOf, autoSeed } from '../../lib/store/catalog.js'
import { homeBtn, categoryView } from '../../lib/store/toko.js'

// ===== .kategori <key> =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    const key = body.toLowerCase()
    if (!CATS[key]) {
        return send({
            text: `Kategori tidak dikenal.\n\n${Object.entries(CATS).map(([k, c]) => `${c.emoji} ${k} — ${c.name}`).join('\n')}`,
            buttons: [homeBtn(p)]
        })
    }
    if (!productsOf(key).length) return send({ text: `${CATS[key].emoji} Kategori *${CATS[key].name}* masih kosong.`, buttons: [homeBtn(p)] })
    return send(categoryView(p, key))
}

handler.command = ['kategori']
handler.tags = ['store']
handler.help = ['kategori']

export default handler
