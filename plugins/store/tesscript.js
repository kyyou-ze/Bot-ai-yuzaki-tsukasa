/**
 * Kaguya Multi Device — Store
 * .tesscript — tesscript (owner) — tes ambil script dari URL produk lalu kirim ZIP-nya ke chat ini
 * Satu file = satu command. Helper bersama: lib/store/merchant.js, lib/store/urlfile.js
 */

import { storeReply, storeDB, resolveScript, sendScriptFile, hasScript, scriptSource } from '../../lib/store/merchant.js'
import { autoSeed } from '../../lib/store/catalog.js'
import { clearScriptCache } from '../../lib/store/urlfile.js'

// ===== .tesscript <kode> [fresh]  |  .tesscript clear =====
let handler = async (m, { sock, text, prefix, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const [codeRaw, flag] = (text || '').trim().split(/\s+/)
    autoSeed()
    const d = storeDB()

    if (codeRaw === 'clear') return reply(`🧹 Cache script dihapus (${clearScriptCache()} file).`)
    const code = String(codeRaw || '').toLowerCase()
    const pr = d.products[code]
    if (!pr) return reply(`Format: ${p}tesscript <kode> [fresh]\nContoh: ${p}tesscript sc-kaguya\nHapus cache: ${p}tesscript clear`)
    if (!hasScript(pr)) return reply(`Produk ${code} tidak punya file/url script.`)

    if (flag === 'fresh' && pr.url) clearScriptCache(pr.url)
    await reply(`⏳ Mengambil script ${code} dari ${scriptSource(pr)} ...`)
    const t = Date.now()
    const f = await resolveScript(pr)
    if (!f.ok) return reply(`❌ Gagal: ${f.reason}`)
    const ok = await sendScriptFile(sock, m.chat, pr, m)
    return reply(ok
        ? `✅ ${f.name} (${(f.size / 1048576).toFixed(2)} MB) terkirim dalam ${((Date.now() - t) / 1000).toFixed(1)} detik${f.cached ? ' (dari cache)' : ''}.`
        : '❌ File siap tapi gagal dikirim ke chat.')
}

handler.command = ['tesscript']
handler.tags = ['store']
handler.help = ['tesscript']
handler.owner = true

export default handler
