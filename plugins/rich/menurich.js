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
 * Letak file: plugins/rich/menurich.js
 * Menu rich (kartu HTML liquid glass). Template diambil dari GitHub, lalu data
 * bot (kategori, command, akun) disuntikkan ke penanda DATA_START / DATA_END.
 * Kalau GitHub gagal diakses, dipakai plugins/rich/menu.html (kalau ada).
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { primaryPrefix, expandPlugins, rpgStore, toPN, menuCmds } from '../../lib/engine/plugins.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

// ───────── pengaturan ─────────

const SOURCE_URL = 'https://raw.githubusercontent.com/YanLynnn/data/refs/heads/main/menu.html'
const LOCAL_FILE = path.join(__dirname, 'menu.html')
const TTL_MS = 900000 // cache template 15 menit
// Foto hero. Bisa diganti lewat global.menuRichPhoto di config.js.
// Foto diunduh bot lalu ditanam ke HTML (sandbox WhatsApp memblokir gambar dari internet).
const PHOTO_URL = 'https://cdn.zass.in/fzKQWzR6Tp.jpg'
const PHOTO_TTL_MS = 6 * 3600000
const PHOTO_MAX_BYTES = 120 * 1024 // batas ukuran foto yang ditanam
const DEFAULT_BOT_JID = '867051314767696@bot'
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]

// Urutan kategori. Kategori lain dari tags plugin ditambahkan otomatis.
const CATEGORIES = [
    'rich', 'main', 'download', 'sticker', 'tools', 'search',
    'asisten', 'audio', 'canvas', 'channel',
    'clan', 'convert', 'economy', 'fun', 'game', 'github', 'group',
    'live', 'owner', 'panel', 'premium', 'relationship',
    'rpg', 'stalker', 'store', 'sewa-bot', 'user', 'vercel', 'vps'
]

const CAT_EMOJI = {
    rich: '✨', main: '🏠', download: '📥', sticker: '🖼️', tools: '🛠️', search: '🔍',
    asisten: '📒',
    audio: '🎧', canvas: '🖌️', channel: '📢', clan: '🏰', convert: '🔄',
    economy: '💰', fun: '🎭', game: '🎮', github: '🐙', group: '👥',
    live: '📡', owner: '👑', panel: '🖥️', premium: '💎',
    relationship: '💞', rpg: '⚔️', stalker: '🕵️', store: '🛒', 'sewa-bot': '🤖', user: '👤', vps: '☁️', vercel: '▲'
}

const RANKS = [
    [100, 'Master'], [75, 'Diamond'], [50, 'Platinum'],
    [25, 'Gold'], [10, 'Silver'], [0, 'Bronze']
]

// ───────── helper ─────────

const hex = n => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const randomResponseId = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`

const rankOf = level => {
    const lv = Math.max(0, Number(level) || 0)
    return RANKS.find(([min]) => lv >= min)[1]
}

const fmtNum = n => Math.floor(Number(n) || 0).toLocaleString('id-ID')

// JSON aman untuk ditanam di dalam <script>
const safeJson = obj => JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028|\u2029/g, '')

const shortRuntime = sec => {
    sec = Math.max(0, Math.floor(Number(sec) || 0))
    const d = Math.floor(sec / 86400)
    const h = Math.floor((sec % 86400) / 3600)
    const mi = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (d) return `${d}d ${h}h`
    if (h) return `${h}h ${mi}m`
    if (mi) return `${mi}m ${s}s`
    return `${s}s`
}

const readPkg = file => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

const getCategories = h => {
    const tags = Array.isArray(h.tags) ? h.tags : h.tags ? [h.tags] : []
    return [...new Set(tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
}

// ───────── kumpulkan command ─────────

function collect({ isOwner, isPremium }) {
    const groups = new Map()
    let features = 0
    let commands = 0

    for (const h of expandPlugins()) {
        if (!h || !h.command || h.command instanceof RegExp || h.disabled) continue

        const hidden = Array.isArray(h.hide) ? h.hide : []
        const all = menuCmds(h)
        const cmds = all.filter(c => !hidden.includes(c))

        if (!all.length) continue

        // total fitur/command dihitung dari semua plugin (sama persis dengan .t / .menu)
        features++
        commands += all.length

        const tags = getCategories(h)
        const categories = tags.length ? tags : [h.owner ? 'owner' : 'main']

        if ((h.owner || categories.includes('owner')) && !isOwner) continue
        if (h.premium && !isPremium) continue

        for (const cat of categories) {
            if (!groups.has(cat)) groups.set(cat, new Set())
            for (const c of cmds) groups.get(cat).add(c)
        }
    }

    const order = [
        ...CATEGORIES.filter(k => groups.has(k)),
        ...[...groups.keys()].filter(k => !CATEGORIES.includes(k) && k !== 'owner').sort(),
        ...(groups.has('owner') ? ['owner'] : [])
    ]

    return {
        features,
        commands,
        categories: order.map(name => ({
            name,
            emoji: CAT_EMOJI[name] || '📁',
            cmds: [...groups.get(name)].sort((a, b) => a.localeCompare(b))
        }))
    }
}

async function getRpg(sock, m, { isOwner, isPremium }) {
    try {
        const pn = await toPN(sock, m.sender)
        const u = rpgStore().users[pn]
        if (!u) return null

        return {
            level: u.level ?? 0,
            exp: fmtNum(u.exp),
            money: fmtNum(u.money),
            limit: isOwner || isPremium ? '∞' : fmtNum(u.limit)
        }
    } catch {
        return null
    }
}

// ───────── ambil template ─────────

let cache = null
let cacheAt = 0

async function loadTemplate() {
    if (cache && Date.now() - cacheAt < TTL_MS) return cache

    try {
        const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`status ${res.status}`)

        cache = await res.text()
        cacheAt = Date.now()
        return cache
    } catch (e) {
        console.error('[MENURICH] Gagal ambil template dari GitHub:', e.message)

        // cadangan: file lokal plugins/rich/menu.html
        if (fs.existsSync(LOCAL_FILE)) {
            cache = fs.readFileSync(LOCAL_FILE, 'utf8')
            cacheAt = Date.now()
            return cache
        }

        throw new Error(`Gagal ambil template menu (${e.message}). Upload menu.html ke repo GitHub atau taruh di plugins/rich/menu.html`)
    }
}

// Suntik data ke penanda DATA_START / DATA_END (pakai fungsi supaya tanda $ aman).
function inject(html, data) {
    const re = /\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\//
    if (!re.test(html)) return html

    const json = safeJson(data)
    return html.replace(re, () => `/*DATA_START*/${json}/*DATA_END*/`)
}

// ───────── foto hero (diunduh lalu dikecilkan, ditanam sebagai data URI) ─────────

let photoCache = null
let photoAt = 0

async function loadPhoto() {
    if (photoCache !== null && Date.now() - photoAt < PHOTO_TTL_MS) return photoCache

    const url = global.menuRichPhoto || PHOTO_URL
    let uri = ''

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
        if (!res.ok) throw new Error(`status ${res.status}`)

        let buf = Buffer.from(await res.arrayBuffer())
        let mime = 'image/jpeg'

        try {
            const sharp = (await import('sharp')).default
            buf = await sharp(buf)
                .resize({ width: 520, withoutEnlargement: true })
                .jpeg({ quality: 70, mozjpeg: true })
                .toBuffer()
        } catch (e) {
            console.error('[MENURICH] sharp gagal, pakai foto asli:', e.message)
            mime = String(res.headers.get('content-type') || 'image/jpeg').split(';')[0]
        }

        if (buf.length <= PHOTO_MAX_BYTES * 3) {
            uri = `data:${mime};base64,${buf.toString('base64')}`
        } else {
            console.error(`[MENURICH] foto terlalu besar (${Math.round(buf.length / 1024)} KB), dilewati`)
        }
    } catch (e) {
        console.error('[MENURICH] Gagal ambil foto:', e.message)
    }

    // hasil kosong tidak di-cache lama supaya dicoba lagi
    photoCache = uri
    photoAt = uri ? Date.now() : Date.now() - PHOTO_TTL_MS + 60000
    return uri
}

// ───────── kirim kartu rich ─────────

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

// ───────── plugin ─────────

let handler = async (m, { sock, prefix, isOwner, isPremium, reply }) => {
    const send = text => reply
        ? reply(text)
        : sock.sendMessage(m.chat, { text }, { quoted: m })

    try {
        const p = prefix || primaryPrefix() || '.'
        const [template, rpg, photo] = await Promise.all([
            loadTemplate(),
            getRpg(sock, m, { isOwner, isPremium }),
            loadPhoto()
        ])

        const { features, commands, categories } = collect({ isOwner, isPremium })
        const level = rpg?.level ?? 0
        const botPkg = readPkg(path.join(rootDir, 'package.json'))
        const libPkg = readPkg(path.join(rootDir, 'node_modules/@whiskeysockets/baileys/package.json'))

        const data = {
            bot: global.namebot || 'Bot',
            name: m.pushName || 'No Name',
            prefix: p,
            mode: global.public === true ? 'Public' : 'Self',
            photo,
            features,
            commands,
            info: [
                ['Versi', botPkg?.version || '1.0.0'],
                ['Runtime', shortRuntime(process.uptime())],
                ['Tipe', botPkg?.type === 'module' ? 'ESM' : 'CommonJS'],
                ['Library', `Baileys ${libPkg?.version || '-'}`],
                ['Node', process.version],
                ['Platform', `${os.platform()} ${os.arch()}`],
                ['Memori', `${Math.round(process.memoryUsage().rss / 1048576)} MB / ${(os.totalmem() / 1073741824).toFixed(1)} GB`],
                ['Plugin', String(Object.values(global.plugins || {}).filter(Boolean).length)],
                ['Prefix', p],
                ['Owner', global.ownername || global.creator || '-']
            ],
            account: [
                ['Akses', isOwner ? 'Owner' : isPremium ? 'Premium' : 'Free'],
                ['Rank', rankOf(level)],
                ['Level', String(level)],
                ['EXP', String(rpg?.exp ?? 0)],
                ['Limit', String(rpg?.limit ?? (isOwner || isPremium ? '∞' : 0))],
                ['Saldo', `Rp ${rpg?.money ?? 0}`]
            ],
            categories
        }

        const html = inject(template, data)

        await sock.relayMessage(m.chat, buildPayload(html, `${data.bot} Menu`), {})

        try {
            await sock.sendMessage(m.chat, { react: { text: '🫧', key: m.key } })
        } catch {}
    } catch (e) {
        console.error('[MENURICH] gagal kirim:', e.message)
        await send(`❌ Menu rich gagal dikirim: ${e.message}`).catch(() => null)
    }
}

handler.command = ['menurich']
handler.help = ['menurich']
handler.tags = ['rich']

export default handler
