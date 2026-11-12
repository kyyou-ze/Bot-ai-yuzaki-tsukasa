/**

* Kaguya Multi Device — WhatsApp & Tele Bot
*
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
*
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

import { getOwners, formatWib, footerText, jidNumber } from '../../lib/core/system.js'
import { pickMedia } from '../../lib/core/file.js'
import { digits } from '../../lib/core/data.js'
import { userJid as tgUserJid } from '../../lib/platform/telegram.js'

const MIN_LEN = 5
const COOLDOWN_MS = 3 * 60 * 1000 // 3 menit per pengirim, supaya tidak dipakai spam ke owner
const lastReport = new Map()

const MEDIA_FIELD = { imageMessage: 'image', videoMessage: 'video', documentMessage: 'document', audioMessage: 'audio' }

const genId = () => 'R' + Date.now().toString(36).toUpperCase()

// socket WhatsApp aktif (bukan socket Telegram) buat kirim ke nomor owner
function waSockOf(sock) {
    if (global.sock && global.sock.platform !== 'telegram') return global.sock
    if (sock.platform !== 'telegram') return sock
    return null
}

// socket Telegram aktif buat kirim ke chat owner Telegram
function tgSockOf(sock) {
    if (global.tgSock) return global.tgSock
    if (sock.platform === 'telegram') return sock
    return null
}

async function sendToOwners(sock, content) {
    let ok = 0
    let fail = 0

    const wa = waSockOf(sock)
    if (wa) {
        const numbers = [...new Set(getOwners().map(digits).filter(Boolean))]
        for (const num of numbers) {
            try {
                await wa.sendMessage(`${num}@s.whatsapp.net`, content)
                ok++
            } catch (e) {
                fail++
            }
        }
    }

    const tg = tgSockOf(sock)
    if (tg) {
        const ids = [...new Set([].concat(global.telegram?.owners || []).map(v => String(v).replace(/\D/g, '')).filter(Boolean))]
        for (const id of ids) {
            try {
                await tg.sendMessage(tgUserJid(id), content)
                ok++
            } catch (e) {
                fail++
            }
        }
    }

    return { ok, fail }
}

let handler = async (m, { sock, jid, text, command, prefix, reply, isOwner }) => {
    const p = prefix || '.'
    const note = String(text || '').trim()
    const media = pickMedia(m)

    // reply ke media tanpa keterangan: pakai caption aslinya sebagai keterangan kalau ada
    const caption = note || String(m.quoted?.caption || m.quoted?.msg?.caption || '').trim()

    if (!caption && !media) {
        return reply(
            `*▢ LAPOR BUG / ERROR*\n\n` +
            `Ceritakan masalahnya, bisa sambil reply screenshot atau video bukti.\n\n` +
            `Contoh:\n${p}${command} fitur sticker error, muncul "Terjadi error: timeout"`
        )
    }
    if (!media && caption.length < MIN_LEN) {
        return reply(`Keterangannya terlalu singkat, ceritakan sedikit lebih detail ya (minimal ${MIN_LEN} karakter).`)
    }

    if (!isOwner) {
        const key = jidNumber(m.sender)
        const last = lastReport.get(key) || 0
        const sisa = COOLDOWN_MS - (Date.now() - last)
        if (sisa > 0) return reply(`Tunggu ${Math.ceil(sisa / 1000)} detik lagi sebelum lapor lagi ya, biar owner tidak kebanjiran laporan yang sama.`)
        lastReport.set(key, Date.now())
        if (lastReport.size > 2000) lastReport.delete(lastReport.keys().next().value)
    }

    const id = genId()
    const isGroup = m.isGroup
    let roomName = isGroup ? 'Grup' : 'Private'
    if (isGroup) {
        try {
            const meta = await sock.groupMetadata(jid)
            roomName = `Grup: ${meta.subject || jid}`
        } catch {
            roomName = `Grup (${jid})`
        }
    }

    const reportText = [
        `🐞 *LAPORAN BUG/ERROR*`,
        `ID        : ${id}`,
        `Dari      : ${m.pushName || '-'} (${jidNumber(m.sender)})`,
        `Platform  : ${sock.platform === 'telegram' ? 'Telegram' : 'WhatsApp'}`,
        `Lokasi    : ${roomName}`,
        `Waktu     : ${formatWib(Date.now())}`,
        ``,
        `Keterangan:`,
        caption || '(tidak ada keterangan, lihat lampiran)',
        ``,
        footerText()
    ].join('\n')

    let content = { text: reportText }
    if (media) {
        const field = MEDIA_FIELD[media.mtype]
        if (field) {
            try {
                const buffer = await media.download()
                content = { [field]: buffer, mimetype: media.mime || undefined, caption: reportText }
            } catch {
                content = { text: reportText + `\n\n_(lampiran gagal diunduh)_` }
            }
        } else {
            content = { text: reportText + `\n\n_(ada lampiran, tapi jenisnya tidak didukung untuk diteruskan)_` }
        }
    }

    const { ok, fail } = await sendToOwners(sock, content)

    if (!ok) {
        return reply(`❌ Laporan gagal dikirim, owner belum bisa dihubungi lewat bot ini. Coba lagi nanti.`)
    }

    return reply(
        `✅ Laporan terkirim ke owner.\n` +
        `ID laporan: *${id}*\n` +
        (fail ? `_(${fail} tujuan gagal dikirimi, tapi laporan tetap sampai ke sebagian owner)_` : `Terima kasih sudah melapor, owner akan segera mengecek.`)
    )
}

handler.command = ['report']
handler.help = ['report <keterangan> (boleh reply gambar/video)']
handler.tags = ['main']

export default handler
