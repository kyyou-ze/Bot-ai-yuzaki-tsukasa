// ───────── lib/games/othello.js ─────────
// Othello / Reversi 8x8. Sisi 0 = hitam ⚫ (jalan duluan), sisi 1 = putih ⚪.

import { pvpRun } from './pvp.js'
import { fw } from './common.js'

const FILES = 'abcdefgh'
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
const inb = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8
const sqOf = (t) => {
    const m = /^([a-h])([1-8])$/i.exec(String(t || '').trim())
    return m ? { x: FILES.indexOf(m[1].toLowerCase()), y: parseInt(m[2], 10) - 1 } : null
}

export const othelloInit = () => {
    const b = Array.from({ length: 8 }, () => Array(8).fill(-1))
    b[3][3] = 1; b[4][4] = 1; b[3][4] = 0; b[4][3] = 0 // d4,e5 putih; e4,d5 hitam
    return { b, passes: 0 }
}

// bidak yang terbalik kalau `side` taruh di (x,y)
export const flips = (b, x, y, side) => {
    if (!inb(x, y) || b[y][x] !== -1) return []
    const out = []
    for (const [dx, dy] of DIRS) {
        const line = []
        let cx = x + dx, cy = y + dy
        while (inb(cx, cy) && b[cy][cx] === 1 - side) { line.push([cx, cy]); cx += dx; cy += dy }
        if (line.length && inb(cx, cy) && b[cy][cx] === side) out.push(...line)
    }
    return out
}
export const legal = (b, side) => {
    const out = []
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (flips(b, x, y, side).length) out.push(FILES[x] + (y + 1))
    return out
}
export const score = (b) => {
    let a = 0, z = 0
    for (const r of b) for (const c of r) { if (c === 0) a++; else if (c === 1) z++ }
    return [a, z]
}

export function othelloMove(st, side, args) {
    const t = sqOf(args[0])
    if (!t) return { err: 'Format langkah: kotak tujuan, contoh `d3`.' }
    const f = flips(st.b, t.x, t.y, side)
    if (!f.length) return { err: `Langkah ${args[0].toLowerCase()} tidak valid (harus membalik minimal 1 bidak lawan). Coba lihat petunjuk dengan hint.` }
    st.b[t.y][t.x] = side
    for (const [x, y] of f) st.b[y][x] = side
    st.passes = 0
    const foe = 1 - side
    const [a, z] = score(st.b)
    let msg = `🔄 ${f.length} bidak terbalik.`
    let next = foe
    if (!legal(st.b, foe).length) {
        if (!legal(st.b, side).length) {
            return { end: { winner: a === z ? -1 : a > z ? 0 : 1, reason: `Papan buntu. Skor akhir ⚫ ${a} - ${z} ⚪.` } }
        }
        next = side
        msg += `\n⏭️ Lawan tidak punya langkah, giliran dilewati — kamu jalan lagi.`
    }
    if (a + z === 64) return { end: { winner: a === z ? -1 : a > z ? 0 : 1, reason: `Papan penuh. Skor akhir ⚫ ${a} - ${z} ⚪.` } }
    return { msg, next }
}

export function othelloRender(st) {
    const hints = new Set()
    const rows = []
    for (let y = 7; y >= 0; y--) {
        let r = fw(String(y + 1))
        for (let x = 0; x < 8; x++) r += st.b[y][x] === 0 ? '⚫' : st.b[y][x] === 1 ? '⚪' : '🟩'
        rows.push(r)
    }
    rows.push('　' + FILES.split('').map(fw).join(''))
    const [a, z] = score(st.b)
    return rows.join('\n') + `\n⚫ Hitam: ${a} • ⚪ Putih: ${z}`
}

export const OTHELLO = {
    key: 'othello', title: 'Othello', icon: '⚫', reward: 300,
    sides: ['Hitam ⚫', 'Putih ⚪'], moveHelp: 'd3',
    rules: 'Othello (Reversi) 8x8.\n• Taruh bidak di kotak kosong yang mengapit bidak lawan (lurus/diagonal) → bidak yang terapit terbalik jadi warnamu.\n• Tidak ada langkah → giliran otomatis dilewati.\n• Menang: bidak terbanyak saat papan penuh/buntu.',
    extraHelp: ['hint — daftar langkah legal', 'skor — skor sekarang'],
    init: othelloInit, render: othelloRender, move: othelloMove,
    extra: {
        hint: async ({ g, me, reply }) => {
            if (me !== g.turn) return reply('Hint hanya untuk pemain yang sedang giliran.')
            return reply(`💡 Langkah legal: ${legal(g.st.b, me).join(', ')}`)
        },
        skor: async ({ g, say }) => {
            const [a, z] = score(g.st.b)
            return say(`📊 Skor Othello: ⚫ ${a} - ${z} ⚪`)
        }
    }
}

export const othelloRun = (A, sub) => pvpRun(OTHELLO, A, sub)
