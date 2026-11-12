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
 * Letak file: plugins/rich/tokox.js
 * Kartu rich: katalog toko (produk, harga, stok) dari lib/store/catalog.js.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { storeDB, available, stockLabel } from '../../lib/store/merchant.js'
import { CATS, catKey, deliveryLabel, autoSeed } from '../../lib/store/catalog.js'
import { primaryPrefix } from '../../lib/engine/plugins.js'

// ───────── kartu rich (mandiri: template, suntik data, kirim) ─────────

// Template kartu ini diambil dari GitHub. Kalau tidak terjangkau, dipakai file toko.html di folder plugin ini.
// Mau pindah folder GitHub? Isi global.richBaseUrl di config.js (nama file tetap toko.html).
const TEMPLATE_URL = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/toko.html'
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


let handler = async (m, { sock, prefix, reply }) => {
    await runCard({
        sock, m, reply,
        file: 'toko.html',
        title: 'Katalog Toko',
        emoji: '🛒',
        build: async () => {
            try { autoSeed() } catch {}

            const p = prefix || primaryPrefix() || '.'
            const products = Object.values(storeDB().products || {})

            if (!products.length) throw new Error('Katalog toko masih kosong.')

            const categories = Object.entries(CATS)
                .map(([key, cat]) => ({
                    key,
                    emoji: cat.emoji,
                    name: cat.name,
                    desc: cat.desc,
                    items: products
                        .filter(pr => catKey(pr) === key)
                        .sort((a, b) => (a.price || 0) - (b.price || 0))
                        .map(pr => ({
                            code: pr.code,
                            name: pr.name,
                            price: `Rp ${fmtNum(pr.price)}`,
                            desc: String(pr.desc || '').slice(0, 140),
                            stock: stockLabel(pr),
                            soldOut: available(pr) <= 0,
                            delivery: deliveryLabel(pr).replace(/^[^\p{L}]+/u, '')
                        }))
                }))
                .filter(c => c.items.length)

            return {
                prefix: p,
                shop: global.namebot || 'Toko',
                owner: global.ownername || global.creator || '',
                total: products.length,
                categories
            }
        }
    })
}

handler.command = ['tokox']
handler.help = ['tokox']
handler.tags = ['rich']

export default handler
