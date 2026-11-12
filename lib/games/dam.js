// ───────── lib/games/dam.js ─────────
// Dam / Checkers 8x8. Sisi 0 (merah 🔴) jalan duluan ke atas, sisi 1 (biru 🔵) ke bawah.
// Lompat (makan) wajib; boleh lompat beruntun; bidak mencapai ujung jadi raja (🟥 / 🟦).

import { pvpRun } from './pvp.js'
import { fw } from './common.js'

const FILES = 'abcdefgh'
const sqOf = (t) => {
    const m = /^([a-h])([1-8])$/i.exec(String(t).trim())
    return m ? { x: FILES.indexOf(m[1].toLowerCase()), y: parseInt(m[2], 10) - 1 } : null
}
const name = (x, y) => FILES[x] + (y + 1)
const inb = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8
const mine = (p, side) => p && (side === 0 ? p === 'w' || p === 'W' : p === 'b' || p === 'B')
const isKing = (p) => p === 'W' || p === 'B'
const dirs = (p) => isKing(p) ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : p === 'w' ? [[1, 1], [-1, 1]] : [[1, -1], [-1, -1]]

export const damInit = () => {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null))
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 !== 0) continue
        if (y < 3) b[y][x] = 'w'
        else if (y > 4) b[y][x] = 'b'
    }
    return { b, idle: 0 }
}

// lompatan yang mungkin dari (x,y) untuk bidak p
const jumps = (b, x, y, side) => {
    const p = b[y][x], out = []
    for (const [dx, dy] of dirs(p)) {
        const mx = x + dx, my = y + dy, tx = x + 2 * dx, ty = y + 2 * dy
        if (!inb(tx, ty)) continue
        const mid = b[my][mx]
        if (mid && !mine(mid, side) && !b[ty][tx]) out.push({ x: tx, y: ty, cx: mx, cy: my })
    }
    return out
}
const steps = (b, x, y) => {
    const p = b[y][x], out = []
    for (const [dx, dy] of dirs(p)) if (inb(x + dx, y + dy) && !b[y + dy][x + dx]) out.push({ x: x + dx, y: y + dy })
    return out
}
const allJumpers = (b, side) => {
    const out = []
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (mine(b[y][x], side) && jumps(b, x, y, side).length) out.push(name(x, y))
    return out
}
const hasMoves = (b, side) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (mine(b[y][x], side) && (jumps(b, x, y, side).length || steps(b, x, y).length)) return true
    return false
}
const count = (b, side) => b.flat().filter(p => mine(p, side)).length

export function damMove(st, side, args) {
    const sq = args.join(' ').split(/[\s,>\-x:]+/).filter(Boolean).map(sqOf)
    if (sq.length < 2 || sq.some(v => !v)) return { err: 'Format langkah: kotak asal lalu tujuan, contoh `c3 d4`. Lompat beruntun: `c3 e5 g7`.' }
    const b = st.b
    let { x, y } = sq[0]
    const piece = b[y][x]
    if (!mine(piece, side)) return { err: `Di ${name(x, y)} tidak ada bidakmu.` }
    const must = allJumpers(b, side)
    const first = sq[1]
    const isJump = Math.abs(first.x - x) === 2
    if (must.length && !isJump) return { err: `Kamu wajib melompat (makan) dulu. Bidak yang bisa lompat: ${must.join(', ')}.` }

    let p = piece, captured = 0, justKinged = false
    const nb = b.map(r => r.slice())
    nb[y][x] = null
    for (let i = 1; i < sq.length; i++) {
        const t = sq[i]
        const dx = t.x - x, dy = t.y - y
        if (justKinged) return { err: 'Bidak yang baru jadi raja harus berhenti.' }
        if (!inb(t.x, t.y) || (t.x + t.y) % 2 !== 0) return { err: `${name(t.x, t.y)} bukan kotak gelap.` }
        if (nb[t.y][t.x]) return { err: `${name(t.x, t.y)} sudah terisi.` }
        const okDir = dirs(p).some(([ddx, ddy]) => Math.sign(dx) === ddx && Math.sign(dy) === ddy)
        if (!okDir) return { err: 'Bidak biasa hanya boleh maju (raja boleh ke segala arah diagonal).' }
        if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
            if (sq.length > 2) return { err: 'Langkah biasa tidak bisa digabung dengan lompatan.' }
        } else if (Math.abs(dx) === 2 && Math.abs(dy) === 2) {
            const mx = x + dx / 2, my = y + dy / 2
            if (!nb[my][mx] || mine(nb[my][mx], side)) return { err: `Tidak ada bidak lawan untuk dilompati di ${name(mx, my)}.` }
            nb[my][mx] = null; captured++
        } else return { err: `Langkah ${name(x, y)} → ${name(t.x, t.y)} tidak valid.` }
        x = t.x; y = t.y
        if (!isKing(p) && ((side === 0 && y === 7) || (side === 1 && y === 0))) { p = p.toUpperCase(); justKinged = true }
    }
    nb[y][x] = p
    // lompatan harus dituntaskan
    if (captured && !justKinged && jumps(nb, x, y, side).length) return { err: `Lompatan harus dilanjutkan dari ${name(x, y)} (masih ada bidak yang bisa dimakan).` }
    st.b = nb
    st.idle = captured || !isKing(piece) ? 0 : st.idle + 1
    const foe = 1 - side
    if (!count(nb, foe) || !hasMoves(nb, foe)) return { end: { winner: side, reason: count(nb, foe) ? 'Lawan tidak punya langkah lagi.' : 'Semua bidak lawan habis.' } }
    if (st.idle >= 40) return { end: { winner: -1, reason: '40 langkah raja tanpa lompatan/kemajuan.' } }
    return { msg: captured ? `💥 Memakan ${captured} bidak!${justKinged ? ' 👑 Naik jadi raja!' : ''}` : justKinged ? '👑 Naik jadi raja!' : '' }
}

export function damRender(st) {
    const sym = { w: '🔴', W: '🟥', b: '🔵', B: '🟦' }
    const rows = []
    for (let y = 7; y >= 0; y--) {
        let r = fw(String(y + 1))
        for (let x = 0; x < 8; x++) r += st.b[y][x] ? sym[st.b[y][x]] : ((x + y) % 2 === 0 ? '🟫' : '⬜')
        rows.push(r)
    }
    rows.push('　' + FILES.split('').map(fw).join(''))
    const a = count(st.b, 0), z = count(st.b, 1)
    return rows.join('\n') + `\n🔴 Merah: ${a} bidak • 🔵 Biru: ${z} bidak`
}

export const DAM = {
    key: 'dam', title: 'Dam', icon: '🔴', reward: 300,
    sides: ['Merah 🔴', 'Biru 🔵'], moveHelp: 'c3 d4',
    rules: 'Dam 8x8 seperti checkers.\n• Bidak jalan diagonal maju 1 kotak gelap.\n• Lompat (makan) lawan WAJIB, boleh beruntun: `c3 e5 g7`.\n• Sampai ujung papan → jadi raja (🟥/🟦), boleh mundur.\n• Menang jika bidak lawan habis / tidak bisa jalan.',
    init: damInit, render: damRender, move: damMove
}

export const damRun = (A, sub) => pvpRun(DAM, A, sub)
