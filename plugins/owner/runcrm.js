/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Owner — RUNCRM2 / RUNCRM2-SNIPP (jalankan hasil .crm2 / .crm-snipp)
 * Type    : Plugins | ESM Modules
 *
 * Contoh:
 *   (reply file .js hasil .crm2)        → .runcrm2        → pesannya dikirim ulang ke chat ini
 *   (reply snippet hasil .crm-snipp)    → .runcrm2-snipp  → pesannya dikirim ulang ke chat ini
 *
 * Keamanan: hanya owner, dan yang dijalankan HANYA kode berbentuk
 *   sock.relayMessage(jid, { ...objek literal... }, {})
 * Kode lain (fungsi, require, process, dsb.) ditolak, bukan dieksekusi.
 */

import vm from 'vm'
import { generateWAMessageFromContent, jidNormalizedUser, downloadMediaMessage } from '@whiskeysockets/baileys'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

const MAX_CODE = 2 * 1024 * 1024 // 2 MB

// ───────── ambil teks kode dari pesan yang di-reply ─────────

function unwrap(content) {
    if (!content || typeof content !== 'object') return content
    if (content.ephemeralMessage?.message) return unwrap(content.ephemeralMessage.message)
    if (content.viewOnceMessage?.message) return unwrap(content.viewOnceMessage.message)
    if (content.viewOnceMessageV2?.message) return unwrap(content.viewOnceMessageV2.message)
    if (content.viewOnceMessageV2Extension?.message) return unwrap(content.viewOnceMessageV2Extension.message)
    if (content.documentWithCaptionMessage?.message) return unwrap(content.documentWithCaptionMessage.message)
    return content
}

function quotedContent(m) {
    return unwrap(
        m.quoted?.message ||
        m.msg?.contextInfo?.quotedMessage ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        null
    )
}

// kode dari blok snippet (rich response) hasil .crm-snipp
function codeFromSnippet(content) {
    const rich =
        content?.botForwardedMessage?.message?.richResponseMessage ||
        content?.richResponseMessage ||
        null
    const sub = rich?.submessages?.find(s => s?.codeMetadata?.codeBlocks?.length)
    if (!sub) return null
    return sub.codeMetadata.codeBlocks.map(b => b?.codeContent ?? '').join('')
}

async function codeFromDocument(m, content) {
    const doc = content?.documentMessage
    if (!doc) return null
    if (Number(doc.fileLength || 0) > MAX_CODE) throw new Error('File kode terlalu besar')

    let buf
    if (typeof m.quoted?.download === 'function') {
        buf = await m.quoted.download()
    } else {
        const key = {
            remoteJid: m.chat,
            id: m.msg?.contextInfo?.stanzaId,
            participant: m.msg?.contextInfo?.participant
        }
        buf = await downloadMediaMessage({ key, message: content }, 'buffer', {})
    }
    if (!buf?.length) throw new Error('Gagal mengunduh file')
    if (buf.length > MAX_CODE) throw new Error('File kode terlalu besar')
    return Buffer.from(buf).toString('utf-8')
}

function codeFromText(content) {
    return content?.conversation || content?.extendedTextMessage?.text || null
}

// ───────── parser aman: hanya objek literal ─────────

function parseRelayCode(raw) {
    const code = String(raw || '').trim()

    const mt = code.match(
        /^(?:=>\s*)?(?:sock|conn)\.relayMessage\(\s*(?:jid|m\.chat)\s*,\s*([\s\S]*?)\s*,\s*\{\s*\}\s*\)\s*;?$/
    )
    if (!mt) throw new Error('Format kode tidak dikenali. Harus berbentuk: sock.relayMessage(jid, { ... }, {})')

    const literal = mt[1].trim()
    if (!literal.startsWith('{') && !literal.startsWith('[')) throw new Error('Isi relay bukan objek')

    // buang string, key tanpa kutip, dan konstanta; sisanya hanya boleh tanda baca/angka
    const stripped = literal
        .replace(/"(?:\\.|[^"\\\n])*"/g, '0')
        .replace(/[A-Za-z_$][A-Za-z0-9_$]*(?=\s*:)/g, '0')
        .replace(/\b(?:true|false|null|undefined)\b/g, '0')

    if (!/^[\s{}\[\],:\-+.\d]*$/.test(stripped)) {
        throw new Error('Kode ditolak: berisi ekspresi selain objek literal')
    }

    const value = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 2000 })
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
        throw new Error('Isi relay kosong atau tidak valid')
    }
    return value
}

// ───────── handler ─────────

let handler = async (m, { conn, isOwner, usedPrefix, command, sender }) => {
    const p = usedPrefix || '.'
    const cmd = String(command || '').toLowerCase()
    const isSnippet = cmd.includes('snipp')
    const reply = text => conn.sendMessage(m.chat, { text: String(text) }, { quoted: m })

    if (!isOwner) return reply('Ehh ini khusus owner aja lho~ 🌸 yamete kudasai (≧◡≦)')

    const content = quotedContent(m)
    if (!content) {
        return reply(
            isSnippet
                ? `❌ Reply snippet hasil *${p}crm-snipp* dulu, lalu ketik *${p}${cmd}*`
                : `❌ Reply file .js hasil *${p}crm2* dulu, lalu ketik *${p}${cmd}*`
        )
    }

    try {
        // runcrm2 → file .js (atau teks kode); runcrm2-snipp → snippet (atau teks kode)
        let code = isSnippet
            ? codeFromSnippet(content) || codeFromText(content)
            : (await codeFromDocument(m, content)) || codeFromText(content)

        if (!code) {
            return reply(
                isSnippet
                    ? '❌ Pesan yang di-reply bukan snippet kode. Kalau yang kamu punya file .js, pakai *' + p + 'runcrm2*.'
                    : '❌ Pesan yang di-reply bukan file .js / teks kode. Kalau yang kamu punya snippet, pakai *' + p + 'runcrm2-snipp*.'
            )
        }

        const relayContent = parseRelayCode(code)

        const botJid = conn.user?.id ? jidNormalizedUser(conn.user.id) : sender
        const relayMsg = generateWAMessageFromContent(m.chat, relayContent, { userJid: botJid, quoted: m })

        await conn.relayMessage(relayMsg.key.remoteJid, relayMsg.message, { messageId: relayMsg.key.id })

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    } catch (error) {
        console.error('RUNCRM ERROR:', error)
        return reply('❌ Gagal menjalankan CRM.\n\n' + (error?.message || error))
    }
}

handler.help = ['runcrm']
handler.tags = ['owner']
handler.command = ['runcrm']
handler.owner = true

const __plugin = wrapClassic(handler)
__plugin.tags = ['owner']

// satu command = nama file; runcrm2-snipp jadi sub-command (tetap bisa dipanggil langsung)
export default oneCommand(__plugin, 'runcrm')
