// ───────── lib/games/common.js ─────────
// Helper bersama untuk folder game baru (dam, othello, ludo, ulartangga, poker, ceme, mafia,
// undercover, monopoli, bajaklaut, ninja, mafiakota, kampus, tycoon, esport, zombie).
// Data tersimpan di database game: game().arcade[nama] (database/rpg.json) lewat arcadeDb.

import { rpgCmd, arcadeDb, initRpgUser, fmt, shuffle, pickRandom, randomNumber } from '../rpg/bridge.js'
import { oneCommand } from '../engine/plugins.js'

export { fmt, shuffle, pickRandom, randomNumber }

export const now = () => Date.now()
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
export const rnd = (a, b) => randomNumber(a, b)
export const chance = (p) => Math.random() < p

// satu "kotak data" per game: store('dam') -> { games:{}, stats:{} ... }
export const store = (key) => {
    let s = arcadeDb[key]
    if (!s || typeof s !== 'object') { s = {}; arcadeDb[key] = s }
    return s
}

export const idOf = (jid) => String(jid || '').split('@')[0].split(':')[0]
export const tag = (jid) => '@' + idOf(jid)

// ───────── koin (sama dengan koin RPG / akun user bot) ─────────
export const wallet = (jid, name) => initRpgUser(jid, name || 'Pemain')
export const coinOf = (jid, name) => Number(wallet(jid, name).coin) || 0
export const addCoin = (jid, n, name) => {
    const u = wallet(jid, name)
    u.coin = Math.max(0, Math.floor((Number(u.coin) || 0) + n))
    return u.coin
}

// ───────── pembungkus command ─────────
// cmd('dam', 'dam-langkah', (A) => damRun(A, 'langkah'), 'deskripsi', { group: true })
export const cmd = (tags, name, run, desc, opts = {}) =>
    oneCommand(rpgCmd([name], run, { tags, desc, group: !!opts.group }), name)

// ───────── kirim pesan ─────────
export const send = (A, text, mentions = []) =>
    A.Bot.sendMessage(A.m.chat, { text: String(text), mentions: [...new Set(mentions)] }, { quoted: A.m })

export const sendTo = (A, jid, text, mentions = []) =>
    A.Bot.sendMessage(jid, { text: String(text), mentions }).then(() => true).catch(() => false)

// pesan pribadi ke pemain (kartu, peran rahasia, dll)
export const dm = (A, jid, text) => sendTo(A, jid, text)

export const needGroup = (A) => A.m.isGroup ? null : A.reply('Perintah ini hanya bisa digunakan di grup.')

// target dari mention / reply / nomor di teks
export const targetOf = (A) => {
    const men = A.m.mentionedJid
    if (Array.isArray(men) && men[0]) return men[0]
    const q = A.m.quoted?.sender
    if (q) return q
    const num = A.args.map(a => a.replace(/[^0-9]/g, '')).find(a => a.length >= 8 && a.length <= 16)
    return num ? num + '@s.whatsapp.net' : null
}

export const num = (v, d = NaN) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : d }

export const pad = (s, n) => String(s).padEnd(n)
export const timeLeft = (ms) => {
    const s = Math.ceil(ms / 1000)
    if (s < 60) return `${s} detik`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m} menit ${s % 60} detik`
    return `${Math.floor(m / 60)} jam ${m % 60} menit`
}

// huruf/angka lebar-penuh supaya sejajar dengan emoji di papan
const FW = { a: 'ａ', b: 'ｂ', c: 'ｃ', d: 'ｄ', e: 'ｅ', f: 'ｆ', g: 'ｇ', h: 'ｈ', 1: '１', 2: '２', 3: '３', 4: '４', 5: '５', 6: '６', 7: '７', 8: '８' }
export const fw = (c) => FW[c] || c

// Elo sederhana
export function eloUpdate(a, b, score) { // score: 1 menang A, 0.5 seri, 0 kalah
    const ea = 1 / (1 + 10 ** ((b - a) / 400))
    const k = 32
    return Math.round(a + k * (score - ea))
}

// pembuat file plugin (dipakai skrip generator dan tes)
export const HELP_FOOTER = ''
