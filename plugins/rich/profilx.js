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
 * Letak file: plugins/rich/profilx.js
 * Kartu rich: profil user (level, rank, bar EXP, limit, saldo, badge).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rpgStore, toPN, xpRange } from '../../lib/engine/plugins.js'
import { BADGES, store as extraStore, clanOf } from '../../lib/rpg/extra.js'
import { findPremium, formatRemaining, userOf } from '../../lib/core/data.js'

// ───────── kartu rich (mandiri: template, suntik data, kirim) ─────────

// Template kartu ini diambil dari GitHub. Kalau tidak terjangkau, dipakai file profile.html di folder plugin ini.
// Mau pindah folder GitHub? Isi global.richBaseUrl di config.js (nama file tetap profile.html).
const TEMPLATE_URL = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/profile.html'
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

const RANKS = [
    [100, 'Master'], [75, 'Diamond'], [50, 'Platinum'],
    [25, 'Gold'], [10, 'Silver'], [0, 'Bronze']
]

const rankOf = level => {
    const lv = Math.max(0, Number(level) || 0)
    return RANKS.find(([min]) => lv >= min)[1]
}

// Gambar diunduh bot, dikecilkan, lalu ditanam sebagai data URI
// (sandbox WhatsApp memblokir gambar dari internet).
async function imageUri(url, width = 120, quality = 70) {
    try {
        const res = await fetch(String(url), { signal: AbortSignal.timeout(15000) })
        if (!res.ok) return ''

        let buf = Buffer.from(await res.arrayBuffer())

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
async function avatarUri(sock, jid) {
    try {
        const url = await sock.profilePictureUrl(jid, 'image')
        return url ? await imageUri(url, 120) : ''
    } catch {
        return ''
    }
}


let handler = async (m, { sock, isOwner, reply }) => {
    await runCard({
        sock, m, reply,
        file: 'profile.html',
        title: 'Profil Card',
        emoji: '🪪',
        build: async () => {
            // target: orang yang di-mention / di-reply, kalau tidak ada = diri sendiri
            const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
            const self = target === m.sender
            const pn = await toPN(sock, target)
            const u = rpgStore().users[pn]

            if (!u) throw new Error('Data user belum ada. Pakai beberapa command bot dulu ya.')

            const level = Math.max(0, Number(u.level) || 0)
            const range = xpRange(level)
            const cur = Math.max(0, (Number(u.exp) || 0) - range.min)
            const need = Math.max(1, range.xp)
            const pct = Math.min(100, Math.round((cur / need) * 100))

            // badge
            const rec = extraStore().badges[pn] || {}
            const got = rec.got || {}
            const badges = BADGES.map(b => ({ e: b.e, n: b.n, d: b.d, got: !!got[b.id] }))

            // premium
            const prem = findPremium([userOf(pn)])
            const premium = prem
                ? { on: true, left: formatRemaining(prem[1].until) }
                : { on: false, left: '' }

            const clan = clanOf(pn)

            return {
                name: u.name || m.pushName || 'No Name',
                number: String(pn).split('@')[0],
                avatar: await avatarUri(sock, target),
                access: self && isOwner ? 'Owner' : premium.on ? 'Premium' : 'Free',
                rank: rankOf(level),
                role: u.role || 'Newbie',
                level,
                exp: fmtNum(u.exp),
                expCur: fmtNum(cur),
                expNeed: fmtNum(need),
                expPct: pct,
                limit: self && isOwner || premium.on ? '∞' : fmtNum(u.limit),
                money: fmtNum(u.money),
                bank: fmtNum(u.bank),
                health: `${Math.floor(u.health ?? 100)}/${u.maxhealth ?? 100}`,
                registered: !!u.registered,
                clan: clan?.name || '-',
                premium,
                cmd: rec.cmd || 0,
                streak: rec.streak || 0,
                days: rec.days || 0,
                badgeGot: badges.filter(b => b.got).length,
                badges
            }
        }
    })
}

handler.command = ['profilx']
handler.help = ['profilx']
handler.tags = ['rich']

export default handler
