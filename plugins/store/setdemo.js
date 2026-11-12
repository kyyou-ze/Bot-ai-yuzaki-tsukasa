/**
 * Kaguya Multi Device — Store
 * .setdemo — setdemo kode|url (owner)
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'

// ===== .setdemo kode|url (owner) =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    const [codeRaw, url] = body.split('|').map(s => s.trim())
    const pr = d.products[String(codeRaw || '').toLowerCase()]
    if (!pr || !url) return reply(`Format: ${p}setdemo kode|https://link-demo\nHapus dengan ${p}setdemo kode|-`)
    if (url === '-') {
        delete pr.demo
        saveDB(global.db)
        return reply(`🗑️ Link demo ${pr.code} dihapus.`)
    }
    if (!/^https?:\/\/\S+$/i.test(url)) return reply('Link demo harus diawali http:// atau https://')
    pr.demo = url
    saveDB(global.db)
    return reply(`✅ Link demo ${pr.code} diatur. Tombol "Lihat Demo" muncul di detail produk.`)
}

handler.command = ['setdemo']
handler.tags = ['store']
handler.help = ['setdemo']
handler.owner = true

export default handler
