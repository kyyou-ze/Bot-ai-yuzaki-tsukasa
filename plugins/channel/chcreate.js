/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Channel — buat saluran baru
 *
 * Contoh:  .chcreate Info Bot | Pembaruan fitur
 */

import { need, normalize, setCurrent, link, ChannelError, explain } from './setch.js'

let handler = async (m, { sock, text, prefix, reply }) => {
    const p = prefix || '.'
    const raw = String(text || '')
    try {
        need(sock, 'newsletterCreate')
        const [name, ...d] = raw.split('|')
        const desc = d.join('|').trim()
        if (!name.trim()) return reply(`Format: ${p}chcreate <nama saluran> | <deskripsi>\nContoh: ${p}chcreate Info Kaguya | Pembaruan fitur bot`)
        if (name.trim().length > 100) return reply('Nama saluran maksimal 100 karakter.')
        const md = normalize(await sock.newsletterCreate(name.trim(), desc || undefined))
        if (!md.id) throw new ChannelError('Saluran dibuat, tetapi WhatsApp tidak mengembalikan datanya. Cek di aplikasi.')
        setCurrent({ id: md.id, name: md.name || name.trim(), role: md.role || 'OWNER' })
        return reply(`✅ Saluran dibuat: *${md.name || name.trim()}*\n🆔 ${md.id}${md.invite ? `\n🔗 ${link(md.invite)}` : ''}\nSudah dijadikan saluran bawaan (${p}swch, ${p}playch).`)
    } catch (err) {
        console.log('[CH] chcreate:', err.message)
        return reply(`❌ ${explain(err)}`)
    }
}

handler.command = ['chcreate']
handler.help = ['chcreate <nama> | <deskripsi>']
handler.tags = ['channel']
handler.owner = true

export default handler
