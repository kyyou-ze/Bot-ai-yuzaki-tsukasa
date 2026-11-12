/**
 * Kaguya Multi Device — Store
 * .store — store — menu utama
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { storeReply, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { menuView } from '../../lib/store/toko.js'

// ===== .store — menu utama =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    return send(menuView(p, isOwner))
}

handler.command = ['store']
handler.tags = ['store']
handler.help = ['store']

export default handler
