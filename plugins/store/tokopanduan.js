/**
 * Kaguya Multi Device — Store
 * .tokopanduan — tokopanduan (owner)
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { storeReply, quick, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { homeBtn, GUIDE } from '../../lib/store/toko.js'

// ===== .tokopanduan (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    return send({ text: GUIDE(p), buttons: [quick('📊 Omset', `${p}omset`), homeBtn(p)] })
}

handler.command = ['tokopanduan']
handler.tags = ['store']
handler.help = ['tokopanduan']
handler.owner = true

export default handler
