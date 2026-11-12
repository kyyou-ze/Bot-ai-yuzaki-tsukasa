/**
 * Kaguya Multi Device — Store
 * .setkat — setkat kode|kategori (owner)
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { CATS, autoSeed } from '../../lib/store/catalog.js'

// ===== .setkat kode|kategori (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    const [codeRaw, keyRaw] = body.split('|').map(s => s.trim())
    const pr = d.products[String(codeRaw || '').toLowerCase()]
    const key = String(keyRaw || '').toLowerCase()
    if (!pr || !CATS[key]) {
        return reply(`Format: ${p}setkat kode|kategori\nKategori: ${Object.entries(CATS).map(([k, c]) => `${c.emoji} ${k}`).join('  ')}\nContoh: ${p}setkat kode|web`)
    }
    pr.cat = key
    saveDB(global.db)
    return reply(`✅ ${pr.code} dipindah ke kategori ${CATS[key].emoji} ${CATS[key].name}.`)
}

handler.command = ['setkat']
handler.tags = ['store']
handler.help = ['setkat']
handler.owner = true

export default handler
