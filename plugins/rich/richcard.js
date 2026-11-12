/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : Helper kartu rich (HTML card)
 * Type         : Lib | ESM Modules
 *
 * Letak file: lib/richcard.js
 * Dipakai plugins/rich/profilx.js, topx.js, statusx.js, grupx.js, tokox.js, strukx.js
 *
 * Alur: ambil template HTML (GitHub, cadangan file lokal plugins/rich/*.html)
 *       -> suntik data bot ke penanda DATA_START / DATA_END -> kirim sebagai rich response.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCAL_DIR = path.join(__dirname, '../plugins/rich')

// Folder GitHub tempat template (profil.html, top.html, dst). Ganti lewat global.richBaseUrl di config.js.
const DEFAULT_BASE = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/'
const TTL_MS = 900000 // cache template 15 menit

const DEFAULT_BOT_JID = '867051314767696@bot'
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]

// ───────── helper umum ─────────

export const fmtNum = n => Math.floor(Number(n) || 0).toLocaleString('id-ID')
export const rp = n => `Rp ${fmtNum(n)}`

const RANKS = [
    [100, 'Master'], [75, 'Diamond'], [50, 'Platinum'],
    [25, 'Gold'], [10, 'Silver'], [0, 'Bronze']
]

export const rankOf = level => {
    const lv = Math.max(0, Number(level) || 0)
    return RANKS.find(([min]) => lv >= min)[1]
}

export const shortRuntime = sec => {
    sec = Math.max(0, Math.floor(Number(sec) || 0))
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const mi = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (d) return `${d}d ${h}h ${mi}m`
    if (h) return `${h}h ${mi}m`
    if (mi) return `${mi}m ${s}s`
    return `${s}s`
}

export const wibDate = ms => new Date(ms).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
})

// JSON aman untuk ditanam di dalam <script>
export const safeJson = obj => JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028|\u2029/g, '')

// ───────── template ─────────

const cache = new Map()

export async function loadTemplate(file) {
    const hit = cache.get(file)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.html

    const base = String(global.richBaseUrl || DEFAULT_BASE).replace(/\/?$/, '/')
    let remoteErr = ''

    try {
        const res = await fetch(base + file, { signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`status ${res.status}`)

        const html = await res.text()
        cache.set(file, { html, at: Date.now() })
        return html
    } catch (e) {
        remoteErr = e.message
        console.error(`[RICHCARD] Gagal ambil ${file} dari GitHub:`, e.message)
    }

    // cadangan: file lokal plugins/rich/<file>
    const local = path.join(LOCAL_DIR, file)

    if (fs.existsSync(local)) {
        const html = fs.readFileSync(local, 'utf8')
        cache.set(file, { html, at: Date.now() })
        return html
    }

    throw new Error(`Template ${file} tidak ditemukan (GitHub: ${remoteErr}). Upload ke repo atau taruh di plugins/rich/${file}`)
}

// Suntik data ke penanda DATA_START / DATA_END (pakai fungsi supaya tanda $ aman).
export function inject(html, data) {
    const re = /\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\//
    if (!re.test(html)) return html

    const json = safeJson(data)
    return html.replace(re, () => `/*DATA_START*/${json}/*DATA_END*/`)
}

// ───────── gambar (diunduh lalu ditanam sebagai data URI) ─────────
// Sandbox WhatsApp memblokir jaringan, jadi gambar dari internet tidak bisa dimuat langsung.

export async function imageUri(source, width = 120, quality = 70) {
    try {
        let buf

        if (Buffer.isBuffer(source)) {
            buf = source
        } else {
            const res = await fetch(String(source), { signal: AbortSignal.timeout(15000) })
            if (!res.ok) return ''
            buf = Buffer.from(await res.arrayBuffer())
        }

        try {
            const sharp = (await import('sharp')).default
            buf = await sharp(buf)
                .resize({ width, height: width, fit: 'cover' })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer()
        } catch {
            if (buf.length > 60 * 1024) return '' // tanpa sharp, foto besar dilewati
        }

        return `data:image/jpeg;base64,${buf.toString('base64')}`
    } catch {
        return ''
    }
}

// Foto profil user / grup. Kosong kalau tidak ada atau privasi.
export async function avatarUri(sock, jid) {
    try {
        const url = await sock.profilePictureUrl(jid, 'image')
        return url ? await imageUri(url, 120) : ''
    } catch {
        return ''
    }
}

// ───────── kirim kartu rich ─────────

const hex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const randomResponseId = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`

function buildPayload(html, title) {
    return {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: { capabilityMetadata: { capabilities: KAPABILITAS } }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{ messageType: 2, messageText: title }],
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify({
                            response_id: randomResponseId(),
                            sections: [{
                                view_model: {
                                    primitive: {
                                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                                        payload: html,
                                        trusted_sources: []
                                    },
                                    __typename: 'GenAISingleLayoutViewModel'
                                }
                            }]
                        })).toString('base64')
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid: DEFAULT_BOT_JID },
                        forwardOrigin: 4
                    }
                }
            }
        }
    }
}

export async function sendCard(sock, m, html, title, emoji = '✨') {
    await sock.relayMessage(m.chat, buildPayload(html, title), {})

    try {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch {}
}

/**
 * Jalankan satu kartu: ambil template + data, suntik, kirim.
 * build() boleh melempar Error('pesan') — pesannya dikirim ke user apa adanya.
 */
export async function runCard({ sock, m, reply, file, title, emoji, build }) {
    const say = text => (reply
        ? reply(text)
        : sock.sendMessage(m.chat, { text }, { quoted: m }))

    try {
        const [html, data] = await Promise.all([loadTemplate(file), build()])
        data.bot ||= global.namebot || 'Bot'

        await sendCard(sock, m, inject(html, data), title, emoji)
    } catch (e) {
        console.error(`[RICHCARD:${title}] gagal:`, e.message)
        await say(`❌ ${e.message}`).catch(() => null)
    }
}
