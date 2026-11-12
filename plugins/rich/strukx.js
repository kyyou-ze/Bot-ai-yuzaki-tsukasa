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
 * Letak file: plugins/rich/strukx.js
 * Kartu rich: struk / invoice (order toko, sewa bot, premium).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { storeDB, STATUS } from '../../lib/store/merchant.js'
import { getRental, findPremium, formatRemaining, userOf } from '../../lib/core/data.js'
import { toPN } from '../../lib/engine/plugins.js'

// ───────── kartu rich (mandiri: template, suntik data, kirim) ─────────

// Template kartu ini diambil dari GitHub. Kalau tidak terjangkau, dipakai file struk.html di folder plugin ini.
// Mau pindah folder GitHub? Isi global.richBaseUrl di config.js (nama file tetap struk.html).
const TEMPLATE_URL = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/struk.html'
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

const wibDate = ms => new Date(ms).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short'
})


const digits = s => String(s || '').replace(/\D/g, '')
const rp = n => `Rp ${fmtNum(n)}`
const clean = s => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim()

let handler = async (m, { sock, jid, text, prefix, isOwner, reply }) => {
    await runCard({
        sock, m, reply,
        file: 'struk.html',
        title: 'Struk',
        emoji: '🧾',
        build: async () => {
            const arg = String(text || '').trim()
            const pn = await toPN(sock, m.sender)
            const mine = digits(pn)
            const p = prefix || '.'

            // ─── struk order toko: .strukx INV-0001 ───
            const orders = Object.values(storeDB().orders || {})
            const wantInv = /^(inv-?)?\d+$/i.test(arg) ? `INV-${digits(arg).padStart(4, '0')}` : ''
            let order = wantInv ? orders.find(o => o.id === wantInv) : null

            // tanpa argumen: order terakhir milik user (kalau ada)
            if (!arg) {
                order = orders
                    .filter(o => digits(o.buyer).includes(mine))
                    .sort((a, b) => b.createdAt - a.createdAt)[0] || null
            }

            if (order) {
                if (!isOwner && !digits(order.buyer).includes(mine)) {
                    throw new Error('Struk ini bukan milikmu.')
                }

                const done = order.status === 'done'

                return {
                    type: 'ORDER TOKO',
                    no: order.id,
                    date: wibDate(order.createdAt),
                    status: clean(STATUS[order.status] || order.status),
                    paid: done,
                    rows: [
                        ['Produk', order.name],
                        ['Kode', order.code],
                        ['Harga', rp(order.price)],
                        ['Kode unik', rp(order.unique || 0)],
                        ['Pembeli', `@${digits(order.buyer)}`]
                    ],
                    total: rp(order.total),
                    note: done ? 'Terima kasih sudah berbelanja.' : `Cek pembayaran dengan ${p}cekorder ${order.id}`
                }
            }

            if (wantInv) throw new Error(`Order ${wantInv} tidak ditemukan.`)

            // ─── struk sewa bot: .strukx sewa (di grup) ───
            if (/^sewa$/i.test(arg) || (!arg && m.isGroup && getRental(jid))) {
                if (!m.isGroup) throw new Error('Struk sewa dipakai di dalam grup yang menyewa bot.')

                const r = getRental(jid)
                if (!r) throw new Error('Grup ini belum menyewa bot.')

                const active = r.until === null || r.until > Date.now()

                return {
                    type: 'SEWA BOT',
                    no: `SEWA-${digits(jid).slice(-6)}`,
                    date: wibDate(r.added || Date.now()),
                    status: active ? 'Aktif' : 'Habis',
                    paid: active,
                    rows: [
                        ['Grup', r.name || String(jid).split('@')[0]],
                        ['Paket', r.plan || '-'],
                        ['Mulai', wibDate(r.firstAdded || r.added || Date.now())],
                        ['Berakhir', r.until === null ? 'Permanen' : wibDate(r.until)],
                        ['Sisa', active ? formatRemaining(r.until) : 'habis']
                    ],
                    total: active ? 'LUNAS' : 'BERAKHIR',
                    note: 'Perpanjang lewat menu sewa sebelum masa aktif habis.'
                }
            }

            // ─── struk premium: .strukx premium ───
            if (/^premium$/i.test(arg) || !arg) {
                const prem = findPremium([userOf(pn)])
                if (!prem) throw new Error(`Tidak ada struk untuk ditampilkan.\nCoba: ${p}strukx INV-0001, ${p}strukx sewa, atau ${p}strukx premium`)

                const v = prem[1]

                return {
                    type: 'PREMIUM',
                    no: `PRM-${digits(pn).slice(-6)}`,
                    date: wibDate(v.added || Date.now()),
                    status: 'Aktif',
                    paid: true,
                    rows: [
                        ['Akun', `@${digits(pn)}`],
                        ['Label', v.label || '-'],
                        ['Berakhir', v.until === null ? 'Permanen' : wibDate(v.until)],
                        ['Sisa', formatRemaining(v.until)]
                    ],
                    total: 'AKTIF',
                    note: 'Terima kasih sudah menjadi user premium.'
                }
            }

            throw new Error(`Format: ${p}strukx INV-0001 | ${p}strukx sewa | ${p}strukx premium`)
        }
    })
}

handler.command = ['strukx']
handler.help = ['strukx']
handler.tags = ['rich']

export default handler
