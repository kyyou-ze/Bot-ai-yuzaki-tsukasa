/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

// ===== MIME DETECTOR (zero-dependency) =====
function detectMime(buf) {
    if (!buf || buf.length < 12) return 'application/octet-stream'
    const hex = buf.slice(0, 12).toString('hex')

    // Video
    if (buf.slice(4, 8).toString() === 'ftyp') {
        const brand = buf.slice(8, 12).toString()
        if (/^(qt)/.test(brand)) return 'video/quicktime'
        if (/^3g/.test(buf.slice(8, 10).toString())) return 'video/3gpp'
        return 'video/mp4'
    }
    if (hex.startsWith('1a45dfa3')) return 'video/webm' // WebM / MKV

    // Image
    if (hex.startsWith('ffd8ff')) return 'image/jpeg'
    if (hex.startsWith('89504e47')) return 'image/png'
    if (buf.slice(0, 4).toString() === 'GIF8') return 'image/gif'
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp'

    // Audio
    if (buf.slice(0, 3).toString() === 'ID3' || hex.startsWith('fffb')) return 'audio/mpeg'
    if (buf.slice(0, 4).toString() === 'OggS') return 'audio/ogg'
    if (buf.slice(4, 8).toString() === 'ftyp' && /^M4A/.test(buf.slice(8, 11).toString())) return 'audio/mp4'

    return 'application/octet-stream'
}

function extFromMime(mime) {
    const map = {
        'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/3gpp': '3gp',
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
        'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a'
    }
    return map[mime] || 'bin'
}

// ===== HANDLER =====
const handler = async (m, { sock, jid, reply }) => {
    const q = m.quoted

    // 1. Pastikan user nge-reply pesan
    if (!q) {
        return reply('Reply status grup / status WhatsApp yang mau diambil ya kak~ 📥')
    }

    // 2. Ambil objek pesan (kadang strukturnya dibungkus m.quoted.message atau lainnya)
    const msgObj = q.message || q.msg || q
    const contentType = q.content || q.type || q.mtype || (msgObj && Object.keys(msgObj)[0])

    // 3. Validasi longgar: cek apakah mengandung unsur status, ATAU punya media
    const isStatus = /status/i.test(String(contentType))
    const isMedia = q.isMedia || q.mediaKey || msgObj?.videoMessage || msgObj?.imageMessage

    if (!isStatus && !isMedia) {
        return reply(
            '❌ Pesan yang di-reply bukan status!\n\n' +
            '> Pastikan kamu me-reply (swipe) pesan **Status / Status Grup** yang berisi media (Video/Gambar).'
        )
    }

    // 4. Coba download media
    let buffer
    try {
        // Kadang butuh m.quoted.download() langsung, kadang butuh objek msg-nya
        if (typeof q.download === 'function') {
            buffer = await q.download('buffer')
        } else if (typeof sock.downloadMediaMessage === 'function') {
            buffer = await sock.downloadMediaMessage(q)
        } else {
            throw new Error('Fungsi download tidak ditemukan di framework.')
        }
    } catch (err) {
        console.error('[getsw] download error:', err.message)
        return reply('❌ Gagal download media status.\n> Kemungkinan ini *Status Pribadi* (Story) yang dibatasi WhatsApp, bukan Status Grup. Coba reply Status Grup ya~')
    }

    if (!buffer || !buffer.length) {
        return reply('❌ Media status kosong atau gagal diunduh.')
    }

    // 5. Deteksi tipe file dan kirim balik
    const mimetype = detectMime(buffer)
    
    try {
        if (mimetype.startsWith('video/')) {
            await sock.sendMessage(jid, { 
                video: buffer, 
                mimetype, 
                caption: '📥 *Status berhasil diambil*' 
            }, { quoted: m })
        } else if (mimetype.startsWith('image/')) {
            await sock.sendMessage(jid, { 
                image: buffer, 
                mimetype, 
                caption: '📥 *Status berhasil diambil*' 
            }, { quoted: m })
        } else if (mimetype.startsWith('audio/')) {
            await sock.sendMessage(jid, { 
                audio: buffer, 
                mimetype, 
                ptt: false 
            }, { quoted: m })
        } else {
            await sock.sendMessage(jid, { 
                document: buffer, 
                mimetype: mimetype || 'application/octet-stream', 
                fileName: `status-${Date.now()}.${extFromMime(mimetype)}` 
            }, { quoted: m })
        }
    } catch (err) {
        console.error('[getsw] send error:', err.message)
        await reply('❌ Gagal mengirim media status.')
    }
}

handler.help = ['getsw']
handler.tags = ['tools']
handler.command = ['getsw']
handler.limit = true

export default handler