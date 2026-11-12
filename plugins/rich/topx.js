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
 * Letak file: plugins/rich/topx.js
 * Kartu rich: leaderboard level, saldo, command terbanyak, dan command terpopuler.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rpgStore, toPN } from '../../lib/engine/plugins.js'
import { getStats, userOf } from '../../lib/core/data.js'

// ───────── kartu rich (mandiri: template, suntik data, kirim) ─────────

// Template kartu ini diambil dari GitHub. Kalau tidak terjangkau, dipakai file top.html di folder plugin ini.
// Mau pindah folder GitHub? Isi global.richBaseUrl di config.js (nama file tetap top.html).
const TEMPLATE_URL = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/top.html'
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


const TOP = 10

let handler = async (m, { sock, reply }) => {
    await runCard({
        sock, m, reply,
        file: 'top.html',
        title: 'Leaderboard',
        emoji: '🏆',
        build: async () => {
            const pn = await toPN(sock, m.sender)
            const users = Object.entries(rpgStore().users || {})

            const board = (rows, valueOf, subOf) => rows
                .slice(0, TOP)
                .map(([jid, u], i) => ({
                    rank: i + 1,
                    name: u.name || String(jid).split('@')[0],
                    value: valueOf(u),
                    sub: subOf ? subOf(u) : '',
                    me: jid === pn
                }))

            // posisi user di sebuah papan
            const posOf = (rows, valueOf) => {
                const i = rows.findIndex(([jid]) => jid === pn)
                return i < 0 ? null : { rank: i + 1, value: valueOf(rows[i][1]) }
            }

            const byLevel = [...users].sort((a, b) =>
                (Number(b[1].level) || 0) - (Number(a[1].level) || 0) ||
                (Number(b[1].exp) || 0) - (Number(a[1].exp) || 0))

            const wealth = u => (Number(u.money) || 0) + (Number(u.bank) || 0)
            const bySaldo = [...users].sort((a, b) => wealth(b[1]) - wealth(a[1]))

            // statistik command
            const st = getStats()
            const rawUsers = Object.entries(global.db?.stats?.users || {})
                .sort((a, b) => (b[1].n || 0) - (a[1].n || 0))
            const myKey = userOf(pn)
            const myCmdIdx = rawUsers.findIndex(([k]) => k === myKey)

            return {
                prefix: '.',
                total: st.total,
                today: st.today,
                tabs: [
                    {
                        id: 'level', name: 'Level', emoji: '⭐',
                        rows: board(byLevel, u => `Lv ${u.level ?? 0}`, u => `${fmtNum(u.exp)} EXP`),
                        me: posOf(byLevel, u => `Lv ${u.level ?? 0}`)
                    },
                    {
                        id: 'saldo', name: 'Saldo', emoji: '💰',
                        rows: board(bySaldo, u => `Rp ${fmtNum(wealth(u))}`),
                        me: posOf(bySaldo, u => `Rp ${fmtNum(wealth(u))}`)
                    },
                    {
                        id: 'cmd', name: 'Aktif', emoji: '⚡',
                        rows: rawUsers.slice(0, TOP).map(([k, v], i) => ({
                            rank: i + 1, name: v.name || `+${k}`, value: `${fmtNum(v.n)} cmd`, sub: '', me: k === myKey
                        })),
                        me: myCmdIdx < 0 ? null : { rank: myCmdIdx + 1, value: `${fmtNum(rawUsers[myCmdIdx][1].n)} cmd` }
                    },
                    {
                        id: 'populer', name: 'Populer', emoji: '🔥',
                        rows: st.commands.slice(0, TOP).map(([k, n], i) => ({
                            rank: i + 1, name: `.${k}`, value: `${fmtNum(n)}x`, sub: '', me: false
                        })),
                        me: null
                    }
                ]
            }
        }
    })
}

handler.command = ['topx']
handler.help = ['topx']
handler.tags = ['rich']

export default handler
