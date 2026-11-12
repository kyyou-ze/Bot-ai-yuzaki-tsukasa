/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Tools — ambil pesan dari pesan yang di-reply (quoted of quoted)
 * Type    : Plugins | ESM Modules
 *
 * Contoh:  reply pesan yang isinya balasan ke pesan lain + .q
 *          → bot kirim ulang pesan asli yang dibalas itu (teks / foto / video / audio / stiker / dokumen)
 *
 * Catatan: WhatsApp membuang rantai reply dari pesan yang di-quote, jadi isi balasan
 * bersarang tidak ikut terkirim ke bot. Plugin ini memasang listener messages.upsert
 * sendiri dan menyimpan pesan-pesan balasan di cache (6 jam, maks 3000). Artinya hanya
 * pesan yang masuk SETELAH bot/plugin ini aktif yang bisa diambil.
 */

import { getContentType, normalizeMessageContent, downloadContentFromMessage } from '@whiskeysockets/baileys'

const MEDIA_FIELD_MAP = {
    imageMessage: 'image',
    videoMessage: 'video',
    audioMessage: 'audio',
    stickerMessage: 'sticker',
    documentMessage: 'document'
}

// ───────── cache pesan balasan: id pesan → quotedMessage di dalamnya ─────────
const TTL = 6 * 60 * 60 * 1000
const MAX = 3000

// state ditaruh di global supaya tetap satu saat plugin di-reload (hot reload chokidar)
const S = (global.__qOfQ ||= { cache: new Map(), hooked: new WeakSet(), timer: null })

function remember(raw) {
    try {
        const id = raw?.key?.id
        const msg = normalizeMessageContent(raw?.message)
        if (!id || !msg) return
        const type = getContentType(msg)
        const nested = msg[type]?.contextInfo?.quotedMessage
        if (!nested) return
        S.cache.set(id, { nested, at: Date.now() })
        if (S.cache.size > MAX) {
            const now = Date.now()
            for (const [k, v] of S.cache) if (now - v.at > TTL) S.cache.delete(k)
            while (S.cache.size > MAX) S.cache.delete(S.cache.keys().next().value)
        }
    } catch {}
}

function hook(sock) {
    if (!sock?.ev || S.hooked.has(sock)) return
    S.hooked.add(sock)
    sock.ev.on('messages.upsert', ({ messages }) => { for (const raw of messages || []) remember(raw) })
}

// socket bisa diganti saat reconnect → cek berkala dan pasang ulang
hook(global.sock)
clearInterval(S.timer)
S.timer = setInterval(() => hook(global.sock), 5000)
S.timer.unref?.()

let handler = async (m, { sock, reply }) => {
    hook(sock)

    const q = m.quoted
    if (!q) return reply('Reply pesan yang mau diambil "pesan yang di-reply"-nya.')

    // 1) cache buatan plugin ini, 2) cadangan: contextInfo bawaan (jarang tersedia)
    const nestedQuoted = S.cache.get(q.id)?.nested || q.contextInfo?.quotedMessage
    if (!nestedQuoted) {
        return reply(
            'Isi pesan yang dibalas tidak ditemukan.\n\n' +
            'Kemungkinan: pesan yang kamu reply memang bukan balasan, atau pesan itu masuk sebelum bot/plugin ini aktif ' +
            '(cache baru terisi sejak plugin dimuat).'
        )
    }

    const normalized = normalizeMessageContent(nestedQuoted)
    const type = getContentType(normalized)
    const field = MEDIA_FIELD_MAP[type]

    try {
        // teks
        if (type === 'conversation' || type === 'extendedTextMessage') {
            const text = normalized.conversation || normalized.extendedTextMessage?.text
            if (!text) return reply('❌ Isi pesan kosong / tidak terbaca.')
            return await sock.sendMessage(m.chat, { text }, { quoted: m })
        }

        // media → unduh lalu kirim ulang sesuai tipe
        if (field) {
            const content = normalized[type]
            const stream = await downloadContentFromMessage(content, field)
            const chunks = []
            for await (const chunk of stream) chunks.push(chunk)
            const buffer = Buffer.concat(chunks)

            const opts = { [field]: buffer }
            if (content?.mimetype) opts.mimetype = content.mimetype
            if (content?.caption) opts.caption = content.caption
            if (field === 'audio') opts.ptt = !!content?.ptt
            if (field === 'video') opts.gifPlayback = !!content?.gifPlayback
            if (field === 'document') opts.fileName = content?.fileName || `file-${Date.now()}`

            return await sock.sendMessage(m.chat, opts, { quoted: m })
        }

        // tipe lain (kontak / lokasi / poll, dll) → relay apa adanya
        return await sock.relayMessage(m.chat, normalized, { messageId: 'QQ' + Date.now() })
    } catch (e) {
        console.error('[Q ERROR]', e)
        return reply(`❌ Gagal mengambil pesan: ${e.message}`)
    }
}

handler.command = ['q']
handler.help = ['q (reply pesan yang membalas pesan lain)']
handler.tags = ['tools']
handler.owner = true

export default handler
