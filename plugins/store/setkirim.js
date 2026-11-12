/**
 * Kaguya Multi Device — Store
 * .setkirim — setkirim kode|isi (owner) — pengiriman otomatis
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { saveDB } from '../../lib/core/system.js'
import { storeReply, sendBtn, storeDB } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'

// ===== .setkirim kode|isi (owner) — pengiriman otomatis =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    const at = body.indexOf('|')
    const code = (at < 0 ? body : body.slice(0, at)).trim().toLowerCase()
    const value = at < 0 ? '' : body.slice(at + 1).trim()
    const pr = d.products[code]
    if (!pr || !value) {
        return reply(`Format: ${p}setkirim kode|link atau teks\nContoh: ${p}setkirim sc-kaguya|https://drive.google.com/...\n\nIsi ini dikirim otomatis ke pembeli begitu lunas. Hapus dengan ${p}setkirim ${code || 'kode'}|-`)
    }
    if (value === '-') {
        delete pr.deliver
        saveDB(global.db)
        return reply(`🗑️ Pengiriman otomatis ${pr.code} dihapus (kembali diproses manual).`)
    }
    pr.deliver = value
    saveDB(global.db)
    return reply(`✅ Pengiriman otomatis ${pr.code} diatur.\nPembeli akan menerima isi ini begitu pembayaran lunas.${Array.isArray(pr.stock) ? '\n\n⚠️ Produk ini punya stok, jadi yang dikirim item dari stok, bukan isi ini.' : ''}`)
}

handler.command = ['setkirim']
handler.tags = ['store']
handler.help = ['setkirim']
handler.owner = true

export default handler
