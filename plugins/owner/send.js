import { spawn } from 'child_process'
import { isType, mediaNode } from '../../lib/core/system.js'

// Gabungan: send + sendvn
//   .send 628xxx|Halo bang            -> kirim pesan teks
//   .send vn 628xxx|https://a.mp3     -> kirim VN dari link   (alias lama: .sendvn)
//   .send vn 628xxx  (reply audio)    -> kirim VN dari audio yang di-reply
//   .send 628xxx     (reply audio)    -> otomatis kirim sebagai VN
const MEDIA_TYPES = ['audioMessage', 'videoMessage']

// ───────── konversi ke opus ─────────
function toOpus(input) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', [
            '-v', 'error', '-i', 'pipe:0', '-vn',
            '-c:a', 'libopus', '-b:a', '64k', '-ac', '1', '-ar', '48000',
            '-f', 'ogg', 'pipe:1'
        ])

        const out = []
        let err = ''

        ff.stdout.on('data', d => out.push(d))
        ff.stderr.on('data', d => { err += d })
        ff.on('error', reject)
        ff.on('close', code => {
            const buf = Buffer.concat(out)
            if (code === 0 && buf.length) resolve(buf)
            else reject(new Error(err.trim() || `ffmpeg exit ${code}`))
        })

        ff.stdin.on('error', () => {})
        ff.stdin.end(input)
    })
}

async function sendVN(sock, jid, source) {
    try {
        const opus = await toOpus(source)
        await sock.sendMessage(jid, { audio: opus, mimetype: 'audio/ogg; codecs=opus', ptt: true })
    } catch (e) {
        console.error('[SEND] Konversi VN gagal, kirim sebagai audio biasa:', e.message)
        await sock.sendMessage(jid, { audio: source, mimetype: 'audio/mpeg', ptt: false })
    }
}

// ───────── target: nomor / JID ─────────
function toJid(target) {
    if (target.endsWith('@g.us') || target.endsWith('@s.whatsapp.net')) return target
    const number = target.replace(/[^0-9]/g, '')
    return number ? number + '@s.whatsapp.net' : null
}

async function checkExists(sock, jid) {
    if (!jid.endsWith('@s.whatsapp.net')) return true
    const check = await sock.onWhatsApp(jid)
    return !!check?.[0]?.exists
}

// ───────── plugin ─────────
let handler = async (m, { sock, text, reply, prefix, command }) => {
    let input = String(text || '').trim()

    // mode: eksplisit lewat `vn` / alias .sendvn, atau otomatis kalau reply audio tanpa pesan
    let vn = command === 'sendvn'
    if (/^vn(\s|$)/i.test(input)) {
        vn = true
        input = input.replace(/^vn\s*/i, '')
    }

    const quotedType = MEDIA_TYPES.find(t => isType(m, t))
    if (!vn && quotedType && input && !input.includes('|')) vn = true

    if (!input) {
        return reply(
            `*Send (owner)*\n` +
            `• ${prefix}send 628xxx|Halo bang  → kirim teks\n` +
            `• ${prefix}send vn 628xxx|https://link-audio.mp3  → kirim VN dari link\n` +
            `• Reply audio + ${prefix}send 628xxx  → kirim VN`
        )
    }

    const [rawTarget, ...rest] = input.split('|')
    const content = rest.join('|').trim()
    const target = rawTarget.trim()

    if (!target) return reply('Nomor/JID tidak valid.')

    const jid = toJid(target)
    if (!jid) return reply('Nomor tidak valid.')

    try {
        if (!(await checkExists(sock, jid))) {
            return reply('Nomor tersebut tidak terdaftar di WhatsApp.')
        }

        // ── kirim teks ──
        if (!vn) {
            if (!content) return reply('Pesan tidak boleh kosong.\nContoh: ' + prefix + 'send 628xxx|Halo bang')
            await sock.sendMessage(jid, { text: content })
            return reply(`Berhasil mengirim pesan ke:\n${jid}`)
        }

        // ── kirim VN ──
        let source
        if (/^https?:\/\//i.test(content)) {
            const res = await fetch(content)
            if (!res.ok) return reply(`Download audio gagal (${res.status}).`)
            source = Buffer.from(await res.arrayBuffer())
        } else {
            if (!quotedType) return reply('Kirim link audio setelah tanda |, atau reply sebuah audio.')
            source = await mediaNode(m, quotedType).download()
        }

        if (!source?.length) return reply('Audio kosong atau gagal diunduh.')

        await sendVN(sock, jid, source)
        return reply(`Berhasil mengirim VN ke:\n${jid}`)
    } catch (e) {
        console.error(e)
        return reply(`Gagal mengirim ${vn ? 'VN' : 'pesan'}.\n\n${e.message}`)
    }
}

handler.command = ['send', 'sendvn']
handler.hide = ['sendvn']
handler.help = ['send <nomor>|<pesan>', 'send vn <nomor>|<link>']
handler.tags = ['owner']
handler.owner = true

export default handler
