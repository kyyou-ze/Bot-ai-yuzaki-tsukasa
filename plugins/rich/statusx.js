/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets/baileys
 * Type         : Plugins | ESM Modules
 * Creator      : YannRzy Tech
 * Recode       : Your Name
 *
 * Official Channels:
 * https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
 *
 * Copyright © YannRzy Tech 2026
 * All Rights Reserved.
 *
 * Plugin mandiri (tidak butuh lib/richcard.js).
 * Letak file: plugins/rich/statusx.js
 * Kartu rich: dashboard server (RAM, CPU, uptime, chat, koneksi WA/Telegram).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'
import { rpgStore } from '../../lib/engine/plugins.js'
import { getStats } from '../../lib/core/data.js'

// ───────── kartu rich (mandiri: template, suntik data, kirim) ─────────

// Template kartu ini diambil dari GitHub. Kalau tidak terjangkau, dipakai file status.html di folder plugin ini.
// Mau pindah folder GitHub? Isi global.richBaseUrl di config.js (nama file tetap status.html).
const TEMPLATE_URL = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/status.html'
const TTL_MS = 900000 // cache template 15 menit
const DEFAULT_BOT_JID = '867051314767696@bot'
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tplCache = new Map()

// JSON aman untuk ditanam di dalam <script>
const safeJson = obj => JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028|\u2029/g, '')

async function loadTemplate(file) {
    const hit = tplCache.get(file)
    if (hit && Date.now() - hit.at < TTL_MS) return hit.html

    const url = global.richBaseUrl
        ? String(global.richBaseUrl).replace(/\/?$/, '/') + file
        : TEMPLATE_URL
    let remoteErr = ''

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`status ${res.status}`)

        const html = await res.text()
        tplCache.set(file, { html, at: Date.now() })
        return html
    } catch (e) {
        remoteErr = e.message
        console.error(`[RICHCARD] Gagal ambil ${file} dari GitHub:`, e.message)
    }

    const local = path.join(__dirname, file)

    if (fs.existsSync(local)) {
        const html = fs.readFileSync(local, 'utf8')
        tplCache.set(file, { html, at: Date.now() })
        return html
    }

    throw new Error(`Template ${file} tidak ditemukan (GitHub: ${remoteErr}). Upload ke repo atau taruh di plugins/rich/${file}`)
}

// Suntik data ke penanda DATA_START / DATA_END (pakai fungsi supaya tanda $ aman).
function inject(html, data) {
    const re = /\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\//
    if (!re.test(html)) return html

    const json = safeJson(data)
    return html.replace(re, () => `/*DATA_START*/${json}/*DATA_END*/`)
}

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

async function sendCard(sock, m, html, title, emoji = '✨') {
    await sock.relayMessage(m.chat, buildPayload(html, title), {})

    try {
        await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } })
    } catch {}
}

/**
 * Jalankan satu kartu: ambil template + data, suntik, kirim.
 * build() boleh melempar Error('pesan'), pesannya dikirim ke user apa adanya.
 */
async function runCard({ sock, m, reply, file, title, emoji, build }) {
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

const fmtNum = n => Math.floor(Number(n) || 0).toLocaleString('id-ID')

const shortRuntime = sec => {
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


const cpuTimes = () => os.cpus().reduce((acc, c) => {
    const total = Object.values(c.times).reduce((s, t) => s + t, 0)
    return { idle: acc.idle + c.times.idle, total: acc.total + total }
}, { idle: 0, total: 0 })

async function cpuPercent() {
    const a = cpuTimes()
    await new Promise(r => setTimeout(r, 300))
    const b = cpuTimes()
    const total = b.total - a.total
    if (total <= 0) return 0
    return Math.max(0, Math.min(100, Math.round(100 * (1 - (b.idle - a.idle) / total))))
}

const mb = bytes => Math.round(bytes / 1048576)

let handler = async (m, { sock, reply }) => {
    await runCard({
        sock, m, reply,
        file: 'status.html',
        title: 'Server Status',
        emoji: '📊',
        build: async () => {
            const cpu = await cpuPercent()
            const totalMem = os.totalmem()
            const usedMem = totalMem - os.freemem()
            const rss = process.memoryUsage().rss
            const [l1, l5, l15] = os.loadavg()
            const st = getStats()

            // koneksi
            const waSock = global.sock && global.sock.platform !== 'telegram' ? global.sock : null
            const waOn = !!waSock && (waSock.ws?.readyState === undefined ? !!waSock.user : waSock.ws.readyState === 1)
            const tgOn = !!global.tgSock

            // ping dari waktu pesan masuk
            let ping = 0
            const ts = Number(m.messageTimestamp) || 0
            if (ts) ping = Math.max(0, Date.now() - (ts > 1e12 ? ts : ts * 1000))

            return {
                cpu,
                cpuModel: (os.cpus()[0]?.model || 'CPU').replace(/\s+/g, ' ').trim(),
                cores: os.cpus().length,
                load: [l1, l5, l15].map(v => v.toFixed(2)),
                ram: { used: mb(usedMem), total: mb(totalMem), pct: Math.round((usedMem / totalMem) * 100) },
                botram: { rss: mb(rss), pct: Math.min(100, Math.round((rss / totalMem) * 100)) },
                uptime: shortRuntime(process.uptime()),
                osUptime: shortRuntime(os.uptime()),
                node: process.version,
                platform: `${os.platform()} ${os.arch()}`,
                host: os.hostname(),
                ping: Math.round(ping),
                wa: { on: waOn, id: String(waSock?.user?.id || '').split('@')[0].split(':')[0] || '-' },
                tg: { on: tgOn },
                groups: Object.keys(global.db?.groups || {}).length,
                users: Object.keys(rpgStore().users || {}).length,
                plugins: Object.values(global.plugins || {}).filter(Boolean).length,
                cmdTotal: fmtNum(st.total),
                cmdToday: fmtNum(st.today),
                mode: global.public === true ? 'Public' : 'Self'
            }
        }
    })
}

handler.command = ['statusx']
handler.help = ['statusx']
handler.tags = ['rich']

export default handler
