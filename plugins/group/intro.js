import fs from 'fs'
import path from 'path'
import { getMeta, isGroupAdmin, updateGroupSetting, formatGroupText } from '../../lib/platform/wa.js'

// .intro      -> semua member bisa melihat intro grup (teks, atau foto + teks)
// .setintro   -> khusus admin grup & owner:
//   .setintro <teks>                  : ganti teks saja (foto lama tetap dipakai)
//   kirim/balas FOTO + .setintro <teks>: ganti foto (dan teks kalau diisi)
//   balas FOTO + .setintro (tanpa teks): ganti foto saja
//   balas PESAN TEKS + .setintro       : jadikan pesan itu teks intro
// Intro tersimpan PER GRUP di global.db.groups[jid].intro = { text, image }.
// Teks yang diset admin menggantikan seluruh teks (bawaan hanya dipakai kalau grup belum punya teks).
// Foto disimpan sebagai file di ./database/media/intro (bukan di bot.json supaya tidak membengkak).

const DIR = './database/media/intro'
const MAX_TEXT = 8000
// batas aman caption foto di WhatsApp; teks lebih panjang dikirim sebagai pesan terpisah setelah foto
const MAX_CAPTION = 1000

// Teks bawaan ada di plugins/group/data/intro-default.txt (bebas diedit, tidak perlu restart
// kalau plugin di-reload; file dibaca setiap kali .intro dipanggil).
const DEFAULT_FILE = new URL('./data/intro-default.txt', import.meta.url)
const FALLBACK_TEXT = '📌 *INTRO @group*\n\nHalo @user 👋\nBelum ada intro yang diatur di grup ini.\n\nAdmin bisa mengaturnya dengan .setintro <teks>'
const defaultText = () => {
    try { return fs.readFileSync(DEFAULT_FILE, 'utf-8').trim() || FALLBACK_TEXT } catch { return FALLBACK_TEXT }
}

const fileOf = (jid) => path.join(DIR, `${String(jid).replace(/[^a-z0-9-]/gi, '_')}.jpg`)
const getIntro = (jid) => global.db?.groups?.[jid]?.intro || {}

const hasImage = (intro) => !!intro.image && fs.existsSync(intro.image)

const removeImage = (intro) => {
    if (intro.image) fs.rm(intro.image, { force: true }, () => {})
}

async function render(sock, jid, sender, intro) {
    const meta = await getMeta(sock, jid).catch(() => null)
    const text = formatGroupText(intro.text || defaultText(), {
        user: `@${String(sender).split('@')[0]}`,
        group: meta?.subject || 'grup ini',
        count: meta?.participants?.length || '-',
        desc: meta?.desc
    })
    return text
}

async function sendIntro(sock, m, jid, sender) {
    const intro = getIntro(jid)
    const text = await render(sock, jid, sender, intro)
    const mentions = [sender]
    if (hasImage(intro)) {
        const image = fs.readFileSync(intro.image)
        if (text.length <= MAX_CAPTION) return sock.sendMessage(jid, { image, caption: text, mentions }, { quoted: m })
        await sock.sendMessage(jid, { image }, { quoted: m })
        return sock.sendMessage(jid, { text, mentions })
    }
    return sock.sendMessage(jid, { text, mentions }, { quoted: m })
}

const isImage = (msg) => !!msg?.isMedia && msg.mtype === 'imageMessage'

let handler = async (m, { sock, text, command, prefix, jid, sender, isOwner, isAdmin, reply }) => {
    const p = prefix || '.'
    const raw = (text || '').trim()
    const sub = (raw.split(/\s+/)[0] || '').toLowerCase()

    // lihat intro: semua member
    if (command === 'intro' && !raw) return sendIntro(sock, m, jid, sender)

    // selain melihat intro, semua khusus owner & admin grup
    if (!isOwner && !isAdmin) {
        isAdmin = await isGroupAdmin(sock, jid, sender, m.sender, m.key?.participant, m.key?.participantAlt, m.key?.participantPn)
    }
    if (!isOwner && !isAdmin) return reply(global.mess.admin)

    const intro = getIntro(jid)

    if (command === 'intro' && ['reset', 'hapus', 'delete'].includes(sub)) {
        removeImage(intro)
        updateGroupSetting(jid, 'intro', { text: undefined, image: undefined })
        return reply('Intro grup dikembalikan ke bawaan (teks dan foto dihapus).')
    }
    if (command === 'intro' && ['hapusfoto', 'delfoto', 'nofoto', 'delimg'].includes(sub)) {
        if (!hasImage(intro)) return reply('Intro grup ini belum memakai foto.')
        removeImage(intro)
        updateGroupSetting(jid, 'intro', { image: undefined })
        return reply('Foto intro dihapus. Intro sekarang hanya teks.')
    }
    if (command === 'intro' && ['set', 'edit'].includes(sub)) {
        text = raw.slice(sub.length).trim()
    } else if (command === 'intro') {
        // .intro <sesuatu yang bukan subperintah> -> tampilkan bantuan
        return reply(help(p, intro))
    } else {
        text = raw
    }

    // ───── .setintro ─────
    const source = isImage(m) ? m : (isImage(m.quoted) ? m.quoted : null)
    let newText = (text || '').trim()

    // balas pesan teks tanpa isi -> pakai teks pesan yang dibalas
    if (!newText && !source && m.quoted?.text) newText = m.quoted.text.trim()

    if (!newText && !source) return reply(help(p, intro))
    if (newText.length > MAX_TEXT) return reply(`Teks intro terlalu panjang (${newText.length}/${MAX_TEXT} karakter).`)

    const patch = {}
    if (newText) patch.text = newText

    if (source) {
        const buf = await source.download().catch(() => null)
        if (!buf?.length) return reply('Gagal mengunduh fotonya. Coba kirim ulang fotonya.')
        fs.mkdirSync(DIR, { recursive: true })
        const file = fileOf(jid)
        fs.writeFileSync(file, buf)
        patch.image = file
    }

    updateGroupSetting(jid, 'intro', patch)

    const parts = []
    if (patch.text) parts.push('teks')
    if (patch.image) parts.push('foto')
    await reply(`Intro grup berhasil diubah (${parts.join(' + ')}). Ini hasilnya:`)
    return sendIntro(sock, m, jid, sender)
}

function help(p, intro) {
    return `╭─▣「 *INTRO GRUP* 」▣─╮
┃ ✦ Teks : ${intro.text ? 'custom' : 'bawaan'}
┃ ✦ Foto : ${hasImage(intro) ? 'ada' : 'tidak ada'}
╰─────────────➤

${p}intro → lihat intro (semua member)

*Khusus admin grup & owner:*
${p}setintro <teks> → ganti teks saja
Kirim / balas FOTO dengan ${p}setintro <teks> → ganti foto + teks
Balas FOTO dengan ${p}setintro (tanpa teks) → ganti foto saja
Balas pesan teks dengan ${p}setintro → pakai pesan itu sebagai teks
${p}intro hapusfoto → hapus foto, jadi teks saja
${p}intro reset → kembalikan ke bawaan

Variabel teks: @user @group @count @desc`
}

handler.command = ['intro', 'setintro']
handler.tags = ['group']
handler.group = true

export default handler
