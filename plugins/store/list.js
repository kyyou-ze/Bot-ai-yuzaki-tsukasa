/**
 * Fitur List (ala bot store)
 *   .addlist <nama> | <isi>   tambah SATU list per perintah (isi boleh juga dari reply pesan / baris di bawah nama)
 *   .setlist <nama> | <isi>   ubah isi list
 *   .dellist <nama>           hapus list
 *   .list                     tampilkan daftar nama list + tombol "Pilih List"
 *   .list <nama>              tampilkan isi list tertentu
 * Data per chat/grup di global.db.listChat[chatJid] = { <key>: { name, text, by, at } }
 */

import { saveDB } from '../../lib/core/system.js'

const PER_PAGE = 10
const MAX_NAME = 40

const keyOf = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
const store = (chat) => {
    if (!global.db.listChat) global.db.listChat = {}
    if (!global.db.listChat[chat]) global.db.listChat[chat] = {}
    return global.db.listChat[chat]
}
const persist = () => { try { saveDB(global.db) } catch {} }

// "nama | isi"  atau  "nama\nisi"  atau  "nama" (isi dari reply)
function parseInput(raw) {
    const t = String(raw || '').trim()
    if (!t) return { name: '', body: '' }
    const bar = t.indexOf('|')
    const nl = t.indexOf('\n')
    let cut = -1
    if (bar !== -1 && (nl === -1 || bar < nl)) cut = bar
    else if (nl !== -1) cut = nl
    if (cut === -1) return { name: t, body: '' }
    return { name: t.slice(0, cut).trim(), body: t.slice(cut + 1).trim() }
}

let handler = async (m, { sock, text, command, prefix, isOwner, isAdmin, reply }) => {
    const p = prefix || '.'
    const chat = m.chat
    const data = store(chat)
    const names = () => Object.values(data).sort((a, b) => a.name.localeCompare(b.name, 'id'))
    const canEdit = m.isGroup ? (isAdmin || isOwner) : isOwner

    // ───── .list / .list <nama> ─────
    if (command === 'list') {
        const q = keyOf(text)
        if (q) {
            const it = data[q]
            if (!it) return reply(`List *${text.trim()}* tidak ditemukan.\nKetik *${p}list* untuk melihat semua list.`)
            return reply(it.text ? it.text : `_List *${it.name}* belum ada isinya._${canEdit ? `\nIsi dengan: ${p}setlist ${it.name} | isi` : ''}`)
        }

        const all = names()
        if (!all.length) {
            return reply(`Belum ada list.${canEdit ? `\nTambah dengan: *${p}addlist nama | isi*` : ''}`)
        }

        const body =
            `haiii @${m.sender.split('@')[0]} ♡\n` +
            `▸ list\n\n` +
            `┌──────── ⌗ ────────\n` +
            all.map(i => `│ ⌘ ${i.name.toUpperCase()}`).join('\n') +
            `\n└──────── ⌗ ────────\n\n` +
            `note: ketik *${p}list <nama>* atau tekan tombol di bawah untuk melihat isinya.`

        await sock.sendMessage(chat, { text: body, mentions: [m.sender] }, { quoted: m })

        const sections = []
        for (let i = 0; i < all.length; i += PER_PAGE) {
            const part = all.slice(i, i + PER_PAGE)
            sections.push({
                title: `List ${i + 1} - ${i + part.length}`,
                rows: part.map(it => ({
                    title: it.name,
                    description: `Lihat isi list ${it.name}`,
                    id: `${p}list ${it.name}`
                }))
            })
        }
        try {
            return await sock.sendButtons(chat, {
                text: 'Ketuk tombol di bawah untuk memilih list',
                footer: global.namebot || 'Bot',
                buttons: [{ type: 'list', text: 'Pilih List', sections }]
            }, { quoted: m })
        } catch {
            return // daftar teks sudah terkirim di atas
        }
    }

    // ───── perintah kelola (admin grup / owner) ─────
    if (!canEdit) return reply(m.isGroup ? 'Hanya admin grup yang bisa mengelola list.' : 'Di chat pribadi hanya owner yang bisa mengelola list.')

    const quotedText = m.quoted?.text || m.quoted?.body || ''
    const { name, body } = parseInput(text)
    const key = keyOf(name)

    if (command === 'addlist') {
        if (!key) return reply(`Format:\n*${p}addlist nama | isi*\n\nContoh:\n${p}addlist amprem | isi list amprem\n${p}addlist Jualan Panel | isi\n\nBisa juga reply pesan: ${p}addlist nama\nTanpa isi pun boleh, isinya diatur nanti lewat *${p}setlist*.`)
        if (name.length > MAX_NAME) return reply(`Nama list maksimal ${MAX_NAME} karakter.`)
        if (data[key]) return reply(`List *${name}* sudah ada. Pakai *${p}setlist ${name} | isi* untuk mengubah isinya.`)
        data[key] = { name, text: body || quotedText || '', by: m.sender, at: Date.now() }
        persist()
        const all = names()
        return reply(`✅ List *${name}* ditambahkan.\n\n*list:*\n${all.map(i => i.name).join('\n')}`)
    }

    if (command === 'setlist') {
        if (!key) return reply(`Format: *${p}setlist nama | isi* (atau reply pesan)`)
        if (!data[key]) return reply(`List *${name}* belum ada. Buat dulu dengan *${p}addlist ${name}*.`)
        const isi = body || quotedText
        if (!isi) return reply(`Isinya kosong. Tulis setelah tanda | atau reply pesan.`)
        data[key].text = isi
        data[key].at = Date.now()
        persist()
        return reply(`✅ Isi list *${data[key].name}* diperbarui.`)
    }

    if (command === 'dellist') {
        const k = keyOf(text)
        if (!k) return reply(`Format: *${p}dellist nama*`)
        if (!data[k]) return reply(`List *${text.trim()}* tidak ditemukan.`)
        const nm = data[k].name
        delete data[k]
        persist()
        const all = names()
        return reply(`🗑 List *${nm}* dihapus.\n\n*list:*\n${all.length ? all.map(i => i.name).join('\n') : '(kosong)'}`)
    }
}

handler.command = ['list', 'addlist', 'setlist', 'dellist']
handler.tags = ['store']
handler.help = ['list', 'addlist', 'setlist', 'dellist']

export default handler
