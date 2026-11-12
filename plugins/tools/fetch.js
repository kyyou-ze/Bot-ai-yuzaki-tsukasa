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


import dns from 'dns/promises'
import net from 'net'

const MAX_BYTES = 20 * 1024 * 1024
const MAX_TEXT = 3500
const MAX_REDIRECT = 5

function privateV4(ip) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a >= 224
}

function privateIp(ip) {
    if (net.isIPv4(ip)) return privateV4(ip)
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::') return true
    if (v.startsWith('::ffff:')) return net.isIPv4(v.slice(7)) ? privateV4(v.slice(7)) : true
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v)
}

async function assertPublic(url) {
    if (!/^https?:$/.test(url.protocol)) throw new Error('Hanya URL http / https yang didukung.')
    const host = url.hostname.replace(/^\[|\]$/g, '')
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map(r => r.address)
    if (!ips.length || ips.some(privateIp)) throw new Error('Alamat itu tidak diizinkan (jaringan internal).')
}

// ikuti redirect secara manual supaya tiap tujuan ikut dicek
async function fetchSafe(start) {
    let url = start
    for (let i = 0; i <= MAX_REDIRECT; i++) {
        await assertPublic(url)
        const res = await fetch(url, {
            redirect: 'manual',
            signal: AbortSignal.timeout(20_000),
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; BaseBot)', accept: '*/*' }
        })
        const loc = res.headers.get('location')
        if (res.status >= 300 && res.status < 400 && loc) {
            url = new URL(loc, url)
            continue
        }
        return { res, url }
    }
    throw new Error('Terlalu banyak redirect.')
}

async function readBody(res) {
    const declared = Number(res.headers.get('content-length') || 0)
    if (declared > MAX_BYTES) throw new Error('Ukuran file melebihi 20 MB.')
    const chunks = []
    let size = 0
    for await (const c of res.body) {
        size += c.length
        if (size > MAX_BYTES) throw new Error('Ukuran file melebihi 20 MB.')
        chunks.push(c)
    }
    return Buffer.concat(chunks)
}

function fileNameOf(res, url, fallbackExt) {
    const cd = res.headers.get('content-disposition') || ''
    const fromHeader = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1]
    const fromUrl = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '')
    const name = (fromHeader || fromUrl || 'file').replace(/[\\/:*?"<>|]/g, '_')
    return /\.[a-z0-9]{1,5}$/i.test(name) ? name : `${name}.${fallbackExt}`
}

const TEXT_EXT = /\.(txt|md|json|js|mjs|cjs|ts|jsx|tsx|html?|css|csv|xml|ya?ml|log|sh|py|php|java|c|cpp|h|go|rs|sql|ini|env|conf|toml)$/i

// kirim hasil ke chat sesuai jenis isinya (dipakai untuk URL maupun file)
async function deliver(m, sock, jid, { buffer, mime, filename }) {
    const isText = /^text\/|json|xml|javascript|yaml|csv/.test(mime) || TEXT_EXT.test(filename)

    if (isText) {
        let out = buffer.toString('utf8')
        if (/json/.test(mime) || /\.json$/i.test(filename)) { try { out = JSON.stringify(JSON.parse(out), null, 2) } catch {} }
        await m.reply(out.slice(0, 65536) || '(kosong)')
        return sock.sendMessage(jid, {
            document: Buffer.from(out, 'utf8'),
            fileName: filename,
            mimetype: mime && mime !== 'application/octet-stream' ? mime : 'text/plain'
        }, { quoted: m })
    }

    const caption = [
        '乂 *FETCH URL*',
        '',
        `📦 *Name:* ${filename}`,
        `📄 *Type:* ${mime}`,
        `📏 *Size:* ${(buffer.length / 1024 / 1024).toFixed(2)} MB`
    ].join('\n')

    if (mime === 'image/webp') return sock.sendMessage(jid, { sticker: buffer }, { quoted: m })
    if (/^image\//.test(mime)) return sock.sendMessage(jid, { image: buffer, mimetype: mime, caption }, { quoted: m })
    if (/^video\//.test(mime)) return sock.sendMessage(jid, { video: buffer, mimetype: mime, caption, fileName: filename }, { quoted: m })
    if (/^audio\//.test(mime)) return sock.sendMessage(jid, { audio: buffer, mimetype: mime, fileName: filename, ptt: false }, { quoted: m })
    return sock.sendMessage(jid, { document: buffer, mimetype: mime, fileName: filename, caption }, { quoted: m })
}

const EXT_OF = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'application/pdf': 'pdf', 'application/zip': 'zip' }

let handler = async (m, { sock, jid, text, prefix, command }) => {
    const urlInText = (text || '').match(/https?:\/\/\S+/i)?.[0]
    const file = !urlInText ? (m.isMedia ? m : (m.quoted?.isMedia ? m.quoted : null)) : null

    // ───────── mode file: reply / kirim file ─────────
    if (file) {
        const declared = Number(String(file.fileLength?.toString?.() ?? file.fileLength ?? 0))
        if (declared > MAX_BYTES) return m.reply('Ukuran file melebihi 20 MB.')

        let buffer
        try {
            buffer = await file.download()
        } catch (e) {
            return m.reply(`Gagal mengunduh file: ${e?.message || e}`)
        }
        if (buffer.length > MAX_BYTES) return m.reply('Ukuran file melebihi 20 MB.')

        const mime = String(file.mimetype || 'application/octet-stream').split(';')[0].trim().toLowerCase()
        const filename = file.fileName || `file.${EXT_OF[mime] || 'bin'}`
        return deliver(m, sock, jid, { buffer, mime, filename })
    }

    // ───────── mode URL ─────────
    const input = urlInText || (m.quoted?.text || '').match(/https?:\/\/\S+/i)?.[0]
    if (!input) {
        return m.reply(`Contoh:\n${prefix || '.'}${command} https://example.com/file.pdf\n\nAtau reply / kirim file (pdf, js, zip, dll) dengan caption *${prefix || '.'}${command}*`)
    }

    let target
    try { target = new URL(input) } catch { return m.reply('URL tidak valid.') }

    let res, url
    try {
        ({ res, url } = await fetchSafe(target))
    } catch (e) {
        return m.reply(`Gagal mengambil URL: ${e?.message || e}`)
    }

    const mime = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase()
    let buffer
    try {
        buffer = await readBody(res)
    } catch (e) {
        return m.reply(`Gagal membaca isi URL: ${e?.message || e}`)
    }

    const isText = /^text\/|json|xml|javascript|yaml|csv/.test(mime)
    const ext = /json/.test(mime) ? 'json' : /html/.test(mime) ? 'html' : isText ? 'txt' : (EXT_OF[mime] || 'bin')
    await deliver(m, sock, jid, { buffer, mime, filename: fileNameOf(res, url, ext) })
}

handler.command = ['get', 'fetch']
handler.tags = ['tools']
handler.cooldown = 8

export default handler
