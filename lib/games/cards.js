// ───────── lib/games/cards.js ─────────
// Kartu remi standar 52 + penilai tangan poker (dipakai poker & ceme).

import { shuffle } from './common.js'

export const SUITS = ['♠️', '♥️', '♦️', '♣️']
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const newDeck = () => {
    const d = []
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) d.push({ r, s })
    return shuffle(d)
}
export const cardName = (c) => RANKS[c.r] + SUITS[c.s]
export const handName = (cs) => cs.map(cardName).join(' ')

export const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']

// nilai 5 kartu -> [kategori, ...pemutus] (dibandingkan leksikografis)
export function eval5(cs) {
    const ranks = cs.map(c => c.r).sort((a, b) => b - a)
    const flush = cs.every(c => c.s === cs[0].s)
    const uniq = [...new Set(ranks)]
    let high = -1
    if (uniq.length === 5) {
        if (ranks[0] - ranks[4] === 4) high = ranks[0]
        else if (ranks[0] === 12 && ranks[1] === 3 && ranks[4] === 0) high = 3 // A-2-3-4-5
    }
    const cnt = {}
    for (const r of ranks) cnt[r] = (cnt[r] || 0) + 1
    const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1])
    const tb = groups.map(g => g[1])
    if (high >= 0 && flush) return [8, high]
    if (groups[0][0] === 4) return [7, ...tb]
    if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...tb]
    if (flush) return [5, ...ranks]
    if (high >= 0) return [4, high]
    if (groups[0][0] === 3) return [3, ...tb]
    if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...tb]
    if (groups[0][0] === 2) return [1, ...tb]
    return [0, ...ranks]
}

export const cmpHand = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const d = (a[i] ?? -1) - (b[i] ?? -1)
        if (d) return d
    }
    return 0
}

// terbaik dari 5-7 kartu
export function bestOf(cards) {
    let best = null
    const n = cards.length
    const pick = (start, acc) => {
        if (acc.length === 5) { const v = eval5(acc); if (!best || cmpHand(v, best.v) > 0) best = { v, cards: [...acc] }; return }
        for (let i = start; i < n; i++) { acc.push(cards[i]); pick(i + 1, acc); acc.pop() }
    }
    pick(0, [])
    return best
}
