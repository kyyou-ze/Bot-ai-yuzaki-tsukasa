/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 * Plugin  : Owner — CRM2 / CRM2-SNIPP (relay pesan reply + kode relay-nya)
 * Type    : Plugins | ESM Modules
 *
 * Contoh:
 *   (reply pesan) .crm2        → relay ulang pesan + kirim kodenya sebagai file .js
 *   (reply pesan) .crm-snipp   → relay ulang pesan + kirim kodenya sebagai snippet
 */

import { generateWAMessageFromContent, jidNormalizedUser } from '@whiskeysockets/baileys'
import { wrapClassic, oneCommand } from '../../lib/engine/plugins.js'

// ───────── helper ─────────

function unwrap(content) {
    if (!content || typeof content !== 'object') return content

    if (content.ephemeralMessage?.message) return unwrap(content.ephemeralMessage.message)
    if (content.viewOnceMessage?.message) return unwrap(content.viewOnceMessage.message)
    if (content.viewOnceMessageV2?.message) return unwrap(content.viewOnceMessageV2.message)
    if (content.viewOnceMessageV2Extension?.message) return unwrap(content.viewOnceMessageV2Extension.message)
    if (content.documentWithCaptionMessage?.message) return unwrap(content.documentWithCaptionMessage.message)

    return content
}

function normalizeForRelay(rawContent) {
    const content = unwrap(rawContent)

    if (typeof content?.conversation === 'string') {
        const { conversation, ...rest } = content
        return { ...rest, extendedTextMessage: { text: conversation } }
    }

    return content
}

function toJsLiteral(value, indent = 2, seen = new WeakSet(), depth = 0) {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'string') return JSON.stringify(value)
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'bigint') return value.toString()
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return JSON.stringify(Buffer.from(value).toString('base64'))
    }
    if (typeof value !== 'object') return JSON.stringify(value)
    if (depth > 40) return '"[MaxDepth]"'
    if (seen.has(value)) return '"[Circular]"'

    seen.add(value)

    const pad = ' '.repeat(indent)
    const padClose = ' '.repeat(Math.max(indent - 2, 0))
    let result

    if (Array.isArray(value)) {
        if (!value.length) {
            result = '[]'
        } else {
            const items = value.map(v => pad + toJsLiteral(v, indent + 2, seen, depth + 1))
            result = `[\n${items.join(',\n')}\n${padClose}]`
        }
    } else {
        const keys = Object.keys(value).filter(k => typeof value[k] !== 'function' && value[k] !== undefined)

        if (!keys.length) {
            result = '{}'
        } else {
            const lines = keys.map(key => {
                const keyStr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
                return `${pad}${keyStr}: ${toJsLiteral(value[key], indent + 2, seen, depth + 1)}`
            })
            result = `{\n${lines.join(',\n')}\n${padClose}}`
        }
    }

    seen.delete(value)
    return result
}

// properti tambahan dari framework bot yang bukan bagian pesan WhatsApp asli
const FRAMEWORK_DECORATED_KEYS = new Set([
    'mtype', 'id', 'chat', 'isBaileys', 'sender', 'fromMe', 'mentionedJid', 'fakeObj',
    'delete', 'copyNForward', 'download', 'key', 'participant', 'text', 'body', 'name',
    'pushName', 'viewonce', 'download1'
])

function stripFrameworkProps(content) {
    if (!content || typeof content !== 'object') return content

    const output = {}
    for (const key of Object.keys(content)) {
        if (FRAMEWORK_DECORATED_KEYS.has(key)) continue
        if (typeof content[key] === 'function') continue
        output[key] = content[key]
    }
    return output
}

function buildReadableSendCode(content) {
    try {
        const clean = stripFrameworkProps(content)
        // pakai `sock` dan `jid` karena itu variabel yang tersedia di eval `=>` / `>` bot ini (bukan `conn`)
        return `=> sock.relayMessage(\n  jid,\n  ${toJsLiteral(clean)},\n  {}\n)`
    } catch (error) {
        return `// Gagal generate relay_code: ${error?.message || error}`
    }
}

function typeNameFromContent(content) {
    const clean = stripFrameworkProps(content)
    const key = Object.keys(clean)[0] || 'UnknownMessage'
    return key.charAt(0).toUpperCase() + key.slice(1)
}

const KEYWORDS = 'const|let|var|function|return|class|static|new|async|await|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|import|export|from|default|extends|typeof|instanceof|in|of|delete|void|yield'
const TOKEN_RE = new RegExp(
    `(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|'(?:\\\\.|[^'\\\\])*'|"(?:\\\\.|[^"\\\\])*"|\`(?:\\\\.|[^\`\\\\])*\`|\\b(?:${KEYWORDS})\\b|\\b(?:true|false|null|undefined)\\b|\\b\\d+(?:\\.\\d+)?\\b)`,
    'g'
)
const KEYWORD_RE = new RegExp(`^(${KEYWORDS})$`)

function makeCodeBlocks(code) {
    const blocks = []
    const regex = new RegExp(TOKEN_RE.source, 'g')
    let lastIndex = 0
    let match

    while ((match = regex.exec(code)) !== null) {
        if (match.index > lastIndex) {
            blocks.push({ highlightType: 0, codeContent: code.slice(lastIndex, match.index) })
        }

        const token = match[0]
        let highlightType = 0

        if (KEYWORD_RE.test(token)) highlightType = 1
        else if (/^(true|false|null|undefined)$/.test(token)) highlightType = 2
        else if (/^\d/.test(token)) highlightType = 2
        else if (/^['"`]/.test(token)) highlightType = 3
        else if (/^\/\//.test(token) || /^\/\*/.test(token)) highlightType = 4

        blocks.push({ highlightType, codeContent: token })
        lastIndex = regex.lastIndex
    }

    if (lastIndex < code.length) {
        blocks.push({ highlightType: 0, codeContent: code.slice(lastIndex) })
    }

    return blocks
}

// kirim kode relay sebagai snippet (rich response dengan blok kode)
async function sendSnippet(conn, m, content) {
    const code = buildReadableSendCode(content)

    await conn.relayMessage(
        m.chat,
        {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        submessages: [
                            {
                                messageType: 2,
                                messageText: 'Berikut kode relay-nya. Klik tombol "Lihat kode", lalu ikon Salin untuk menyalin kodenya.'
                            },
                            {
                                messageType: 5,
                                codeMetadata: {
                                    codeLanguage: 'javascript',
                                    codeBlocks: makeCodeBlocks(code)
                                }
                            }
                        ],
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: { botJid: '0@bot' },
                            forwardOrigin: 4
                        }
                    }
                }
            }
        },
        {}
    )
}

// ───────── handler ─────────

let handler = async (m, { conn, isOwner, usedPrefix, command, args, sender }) => {
    const sendReply = text => conn.sendMessage(m.chat, { text: String(text) }, { quoted: m })

    if (!isOwner) {
        return sendReply('Ehh ini khusus owner aja lho~ 🌸 yamete kudasai (≧◡≦)')
    }

    const rawQuoted =
        m.quoted?.message ||
        m.msg?.contextInfo?.quotedMessage ||
        m.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        (m.quoted?.mtype ? { [m.quoted.mtype]: m.quoted } : null)

    if (!rawQuoted) {
        return sendReply(`❌ Reply pesan yang mau di-relay dulu, lalu ketik *${(usedPrefix || '.') + command}*`)
    }

    try {
        const unwrapped = unwrap(rawQuoted)

        if (!unwrapped || typeof unwrapped !== 'object' || !Object.keys(unwrapped).length) {
            return sendReply('❌ Jenis pesan ini belum didukung untuk di-relay.')
        }

        const relayContent = normalizeForRelay(rawQuoted)
        const botJid = conn.user?.id ? jidNormalizedUser(conn.user.id) : sender

        const relayMsg = generateWAMessageFromContent(m.chat, relayContent, {
            userJid: botJid,
            quoted: m
        })

        await conn.relayMessage(relayMsg.key.remoteJid, relayMsg.message, {
            messageId: relayMsg.key.id
        })

        const isSnippet =
            String(command || '').toLowerCase().includes('snipp') ||
            (args || []).some(x => String(x).toLowerCase().includes('snipp'))

        if (isSnippet) {
            try {
                await sendSnippet(conn, m, unwrapped)
            } catch (error) {
                return sendReply(`⚠️ Gagal kirim snippet: ${error?.message || error}`)
            }
            return
        }

        const filename = `${typeNameFromContent(unwrapped)}.js`

        await conn.sendMessage(
            m.chat,
            {
                document: Buffer.from(buildReadableSendCode(unwrapped), 'utf-8'),
                fileName: filename,
                mimetype: 'text/javascript',
                caption: `📄 ${filename}`
            },
            { quoted: m }
        )

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
    } catch (error) {
        console.error('CRM2 ERROR:', error)
        return sendReply('❌ Gagal membuat CRM.\n\n' + (error?.message || error))
    }
}

handler.help = ['crm2']
handler.tags = ['owner']
handler.command = ['crm2']
handler.owner = true

const __plugin = wrapClassic(handler)
__plugin.tags = ['owner']

// satu command = nama file; crm-snipp jadi sub-command (tetap bisa dipanggil langsung)
export default oneCommand(__plugin, 'crm2')
