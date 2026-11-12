// Command custom per grup, dibuat admin.
//
//   .addlistgc <nama> <teks>        teks saja     (teks boleh beberapa baris)
//   .addlistgc <nama> <teks>        + kirim / reply FOTO  -> foto dengan teks sebagai caption
//   .addlistgc <nama>               + reply pesan teks    -> isi diambil dari pesan yang di-reply
//   .dellistgc <nama>               hapus command
//   .listgc                         daftar command custom grup ini (semua member bisa lihat)
//
// Contoh: .addlistgc rules Dilarang spam & promosi!   -> member ketik .rules, bot membalas teks itu
// Nama command yang sudah dipakai fitur bot tidak bisa dipakai. Membuat nama yang sama = menimpa.
import { pickImage } from '../../lib/core/file.js'
import {
    NAME_RE, MAX_ENTRIES, MAX_TEXT, MAX_IMAGE,
    normName, isBuiltinCommand, getList, setEntry, delEntry, writeImage
} from '../../lib/group/sosial.js'

let handler = async (m, { sock, jid, text = '', command, prefix, reply, example, isAdmin, isOwner }) => {
    const p = prefix || '.'
    const list = getList(jid)
    const names = Object.keys(list).sort()

    // ───── .listgc ─────
    if (command === 'listgc') {
        if (!names.length) {
            return reply(`Belum ada command custom di grup ini.\n\nAdmin bisa membuatnya:\n*${p}addlistgc rules Teks rules grup*`)
        }
        const rows = names.map((n, i) => `${i + 1}. *${p}${n}*${list[n].image ? ' 📷' : ''}`)
        return reply(`📋 *COMMAND CUSTOM GRUP* (${names.length})\n\n${rows.join('\n')}\n\n_📷 = ada foto_`)
    }

    // add / del hanya admin grup (atau owner bot)
    if (!isAdmin && !isOwner) return reply(global.mess?.admin || 'Fitur ini khusus admin grup.')

    // ───── .dellistgc ─────
    if (command === 'dellistgc') {
        const name = normName(text.split(/\s+/)[0])
        if (!name) {
            return example(`rules${names.length ? `\n\nYang ada: ${names.join(', ')}` : ''}`)
        }
        if (!delEntry(jid, name)) return reply(`Command *${p}${name}* tidak ada di grup ini. Cek daftarnya dengan *${p}listgc*.`)
        return reply(`🗑️ Command *${p}${name}* dihapus.`)
    }

    // ───── .addlistgc ─────
    const match = /^(\S+)\s*([\s\S]*)$/.exec(text.trim())
    if (!match) return example('rules Dilarang spam & promosi!   (boleh kirim / reply foto)')

    const name = normName(match[1])
    let body = (match[2] || '').trim()

    if (!NAME_RE.test(name)) {
        return reply('Nama command hanya boleh huruf, angka, _ dan - (maksimal 30 karakter). Contoh: *rules*, *info-grup*')
    }
    if (isBuiltinCommand(name)) {
        return reply(`Nama *${name}* sudah dipakai fitur bot. Pakai nama lain, mis. *${name}grup*.`)
    }

    // teks: dari perintah, kalau kosong ambil dari pesan teks yang di-reply
    if (!body && m.quoted) body = String(m.quoted.text || m.quoted.body || '').trim()

    // foto: dikirim bersama perintah (caption) atau pesan foto yang di-reply
    const img = pickImage(m)
    if (!body && !img) {
        return example('rules Dilarang spam & promosi!   (boleh kirim / reply foto)')
    }
    if (body.length > MAX_TEXT) return reply(`Teks terlalu panjang (${body.length} karakter, maksimal ${MAX_TEXT}).`)
    if (!list[name] && names.length >= MAX_ENTRIES) {
        return reply(`Batas command custom per grup ${MAX_ENTRIES}. Hapus yang tidak terpakai dengan *${p}dellistgc <nama>*.`)
    }

    let imagePath = null
    if (img) {
        let buffer
        try { buffer = await img.download() } catch (e) { console.error('[addlistgc] unduh foto gagal:', e?.message || e) }
        if (!buffer?.length) return reply('Foto gagal diunduh, coba kirim ulang.')
        if (buffer.length > MAX_IMAGE) return reply(`Foto terlalu besar (maksimal ${Math.round(MAX_IMAGE / 1024 / 1024)} MB).`)
        try { imagePath = writeImage(jid, name, buffer, img.mime) } catch (e) {
            console.error('[addlistgc] simpan foto gagal:', e?.message || e)
            return reply('Foto gagal disimpan di server.')
        }
    }

    const { created } = setEntry(jid, name, { text: body, image: imagePath, by: m.sender })
    return reply(
        `✅ Command *${p}${name}* ${created ? 'dibuat' : 'diperbarui (isi lama diganti)'}.\n` +
        `Isi: ${imagePath ? 'foto + teks' : 'teks'}\n\n` +
        `Coba ketik *${p}${name}*`
    )
}

handler.help = ['listgc', 'addlistgc <nama> <teks>', 'dellistgc <nama>']
handler.tags = ['group']
handler.command = ['listgc', 'addlistgc', 'dellistgc']
handler.group = true

export default handler
