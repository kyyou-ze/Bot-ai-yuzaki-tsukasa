// ───────── lib/games/ulartangga.js ─────────
// Ular Tangga 2-6 pemain, papan 100 kotak. Dadu 6 = giliran tambahan.
// Taruhan opsional: pemenang membawa semua koin taruhan.

import { store, tag, send, addCoin, coinOf, fmt, rnd, num } from './common.js'

const COLORS = ['🔴', '🟢', '🟡', '🔵', '🟣', '🟠']
export const LADDERS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 }
export const SNAKES = { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 79 }
const data = () => { const s = store('ulartangga'); s.games ||= {}; return s }

const cell = (n, g) => {
    const here = g.players.map((p, i) => p.pos === n ? COLORS[i] : null).filter(Boolean)
    if (here.length) return here[0]
    if (n === 100) return '🏁'
    if (SNAKES[n]) return '🐍'
    if (LADDERS[n]) return '🪜'
    return '⬜'
}

export const renderBoard = (g) => {
    const rows = []
    for (let r = 9; r >= 0; r--) {
        const nums = Array.from({ length: 10 }, (_, c) => (r % 2 === 0 ? r * 10 + c + 1 : r * 10 + (9 - c) + 1))
        rows.push(nums.map(n => cell(n, g)).join(''))
    }
    const legend = `🪜 ${Object.entries(LADDERS).map(([a, b]) => `${a}→${b}`).join(' ')}\n🐍 ${Object.entries(SNAKES).map(([a, b]) => `${a}→${b}`).join(' ')}`
    const pl = g.players.map((p, i) => `${COLORS[i]} ${tag(p.id)}: ${p.pos}${g.started && g.turn === i ? ' 👈' : ''}`).join('\n')
    return `${rows.join('\n')}\n\n${pl}\n\n${legend}`
}

export async function ulartanggaRun(A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const s = data()
    const g = s.games[chat]
    const say = (t, men) => send(A, t, men || (g ? g.players.map(p => p.id) : []))
    const idx = g ? g.players.findIndex(p => p.id === sender) : -1
    const isHost = g && (sender === g.host || A.isAdmins || A.isOwner)

    if (sub === 'help') return say(`🐍 *Ular Tangga*\n\n• ${P}ulartangga [taruhan] — buat permainan\n• ${P}ulartangga-join — bergabung (2-6 pemain)\n• ${P}ulartangga-start — mulai\n• ${P}ulartangga-roll — kocok dadu\n• ${P}ulartangga-board — lihat papan\n• ${P}ulartangga-stop — hentikan (host/admin)\n\nSampai kotak 100 dengan angka PAS (kelebihan akan mundur). Dadu 6 = giliran tambahan. Pemenang membawa semua taruhan.`, [])

    if (sub === 'create') {
        if (g) return reply(`Sudah ada permainan. Ketik *${P}ulartangga-join*.`)
        const bet = Math.max(0, num(A.args[0], 0))
        if (bet && coinOf(sender) < bet) return reply(`Koinmu kurang untuk taruhan ${fmt(bet)}.`)
        if (bet) addCoin(sender, -bet)
        s.games[chat] = { host: sender, bet, players: [{ id: sender, pos: 0 }], started: false, turn: 0 }
        return say(`🐍 *Ular Tangga* dibuat oleh ${tag(sender)}${bet ? ` • taruhan ${fmt(bet)} koin/pemain` : ''}\nKetik *${P}ulartangga-join* untuk bergabung (maks 6).`, [sender])
    }
    if (!g) return reply(`Belum ada permainan. Ketik *${P}ulartangga* untuk membuat.`)

    switch (sub) {
        case 'join': {
            if (g.started) return reply('Permainan sudah berjalan.')
            if (idx >= 0) return reply('Kamu sudah bergabung.')
            if (g.players.length >= 6) return reply('Pemain penuh (6).')
            if (g.bet) { if (coinOf(sender) < g.bet) return reply(`Koinmu kurang untuk taruhan ${fmt(g.bet)}.`); addCoin(sender, -g.bet) }
            g.players.push({ id: sender, pos: 0 })
            return say(`✅ ${tag(sender)} bergabung sebagai ${COLORS[g.players.length - 1]} (${g.players.length}/6)`)
        }
        case 'start': {
            if (g.started) return reply('Sudah dimulai.')
            if (!isHost) return reply('Hanya host/admin yang bisa memulai.')
            if (g.players.length < 2) return reply('Minimal 2 pemain.')
            g.started = true; g.turn = 0
            return say(`🐍 Ular Tangga dimulai!\n\n${renderBoard(g)}\n\nGiliran ${tag(g.players[0].id)} — *${P}ulartangga-roll*`)
        }
        case 'board': return say(`🐍 *Ular Tangga*${g.bet ? ` • pot ${fmt(g.bet * g.players.length)} koin` : ''}\n\n${renderBoard(g)}`)
        case 'stop': {
            if (!isHost) return reply('Hanya host/admin yang bisa menghentikan.')
            if (g.bet) for (const p of g.players) addCoin(p.id, g.bet)
            delete s.games[chat]
            return say(`🛑 Ular Tangga dihentikan.${g.bet ? ' Taruhan dikembalikan.' : ''}`)
        }
        case 'roll': {
            if (!g.started) return reply(`Belum dimulai. Host ketik *${P}ulartangga-start*.`)
            if (idx !== g.turn) return reply(`Sekarang giliran ${tag(g.players[g.turn].id)}.`)
            const p = g.players[idx]
            const roll = rnd(1, 6)
            let pos = p.pos + roll
            let note = ''
            if (pos > 100) { pos = 100 - (pos - 100); note = ' (kelebihan, mundur!)' }
            if (LADDERS[pos]) { note += ` 🪜 naik tangga ${pos}→${LADDERS[pos]}!`; pos = LADDERS[pos] }
            else if (SNAKES[pos]) { note += ` 🐍 digigit ular ${pos}→${SNAKES[pos]}!`; pos = SNAKES[pos] }
            // menimpa pemain lain: lawan kembali ke 0
            g.players.forEach((o, oi) => { if (oi !== idx && o.pos === pos && pos > 0 && pos < 100) { o.pos = 0; note += ` 💥 ${tag(o.id)} tertimpa, kembali ke start!` } })
            p.pos = pos
            if (pos === 100) {
                const pot = g.bet * g.players.length
                if (pot) addCoin(p.id, pot)
                delete s.games[chat]
                return say(`🎲 ${tag(sender)} dapat *${roll}* → kotak 100!\n🏆 ${tag(sender)} MENANG Ular Tangga!${pot ? `\n🎁 Hadiah ${fmt(pot)} koin` : ''}`, [sender])
            }
            const extra = roll === 6
            if (!extra) g.turn = (g.turn + 1) % g.players.length
            return say(`🎲 ${tag(sender)} dapat *${roll}* → kotak ${pos}${note}\n\n${renderBoard(g)}\n\n${extra ? `➕ Dadu 6! ${tag(sender)} jalan lagi` : `Giliran ${tag(g.players[g.turn].id)}`} — *${P}ulartangga-roll*`)
        }
    }
    return reply(`Perintah tidak dikenal. Ketik *${P}ulartangga-help*.`)
}
