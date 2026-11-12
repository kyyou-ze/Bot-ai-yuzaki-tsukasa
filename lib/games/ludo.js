// ───────── lib/games/ludo.js ─────────
// Ludo 2-4 pemain, 4 bidak per pemain. Perlu angka 6 untuk keluar dari kandang.
// Jalur 52 kotak. progres bidak: 0=kandang, 1..51=jalur, 52..56=jalan masuk, 57=selesai.
// Dadu 6 / menangkap lawan / bidak sampai tujuan = dapat giliran tambahan.

import { store, tag, send, addCoin, coinOf, fmt, rnd, num } from './common.js'

const COLORS = ['🔴', '🟢', '🟡', '🔵']
const SLOT = [0, 2, 1, 3] // posisi awal tiap kursi (2 pemain duduk berseberangan)
const DONE = 57
const abs = (seat, prog) => (SLOT[seat] * 13 + prog - 1) % 52
const safe = (a) => a % 13 === 0 || a % 13 === 8
const data = () => { const s = store('ludo'); s.games ||= {}; return s }

const legalMoves = (g, seat, roll) => {
    const out = []
    g.players[seat].t.forEach((p, i) => {
        if (p === DONE) return
        if (p === 0) { if (roll === 6) out.push(i) } else if (p + roll <= DONE) out.push(i)
    })
    return out
}

const render = (g) => {
    const lines = g.players.map((pl, seat) => {
        const t = pl.t.map(p => p === 0 ? '🏠' : p === DONE ? '✅' : p > 51 ? `🏁${p - 51}` : `#${abs(seat, p)}`).join('  ')
        return `${COLORS[seat]} ${tag(pl.id)}${g.started && g.turn === seat ? ' 👈' : ''}\n   [1] [2] [3] [4]\n   ${t}`
    })
    return lines.join('\n') + `\n\n#n = nomor kotak jalur (0-51) • 🏁 = jalan masuk • ✅ = sampai`
}

export async function ludoRun(A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const s = data()
    const g = s.games[chat]
    const say = (t, men) => send(A, t, men || (g ? g.players.map(p => p.id) : []))
    const seatOf = (jid) => g ? g.players.findIndex(p => p.id === jid) : -1
    const refund = () => { if (g.bet) for (const p of g.players) addCoin(p.id, g.bet) }

    if (sub === 'help' || sub === 'info') {
        return say(`🎲 *Ludo*\n\n• ${P}ludo [taruhan] — buat permainan (opsional taruhan koin per pemain)\n• ${P}ludo-join — bergabung (2-4 pemain)\n• ${P}ludo-start — mulai\n• ${P}ludo-roll — kocok dadu saat giliranmu\n• ${P}ludo-move <1-4> — jalankan bidak nomor tertentu\n• ${P}ludo-board — lihat papan\n• ${P}ludo-stop — hentikan (host/admin)\n\nAturan: perlu *6* untuk keluar kandang. Dadu 6, menangkap lawan, atau bidak sampai tujuan = giliran tambahan. 3x angka 6 berturut-turut = giliran hangus. Kotak 0, 8, 13, 21, 26, 34, 39, 47 aman dari tangkapan. Bidak harus pas masuk ke tujuan (57). Pemenang membawa pulang semua taruhan.`, [])
    }

    if (sub === 'create') {
        if (g) return reply(`Sudah ada permainan Ludo di grup ini. Ketik *${P}ludo-join* atau *${P}ludo-board*.`)
        const bet = Math.max(0, num(A.args[0], 0))
        if (bet && coinOf(sender) < bet) return reply(`Koinmu kurang untuk taruhan ${fmt(bet)}.`)
        if (bet) addCoin(sender, -bet)
        s.games[chat] = { host: sender, bet, players: [{ id: sender, t: [0, 0, 0, 0] }], started: false, turn: 0, roll: null, sixes: 0 }
        return say(`🎲 *Ludo* dibuat oleh ${tag(sender)}${bet ? ` • taruhan ${fmt(bet)} koin/pemain` : ''}\nKetik *${P}ludo-join* untuk bergabung (maks 4). Mulai dengan *${P}ludo-start*.`, [sender])
    }

    if (!g) return reply(`Belum ada permainan Ludo. Ketik *${P}ludo* untuk membuat.`)
    const me = seatOf(sender)

    switch (sub) {
        case 'join': {
            if (g.started) return reply('Permainan sudah berjalan.')
            if (me >= 0) return reply('Kamu sudah bergabung.')
            if (g.players.length >= 4) return reply('Pemain sudah penuh (4).')
            if (g.bet) { if (coinOf(sender) < g.bet) return reply(`Koinmu kurang untuk taruhan ${fmt(g.bet)}.`); addCoin(sender, -g.bet) }
            g.players.push({ id: sender, t: [0, 0, 0, 0] })
            return say(`✅ ${tag(sender)} bergabung sebagai ${COLORS[g.players.length - 1]} (${g.players.length}/4)`)
        }
        case 'start': {
            if (g.started) return reply('Permainan sudah dimulai.')
            if (sender !== g.host && !A.isAdmins && !A.isOwner) return reply('Hanya host/admin yang bisa memulai.')
            if (g.players.length < 2) return reply('Minimal 2 pemain.')
            g.started = true; g.turn = 0; g.roll = null; g.sixes = 0
            return say(`🎲 Ludo dimulai!\n\n${render(g)}\n\nGiliran ${tag(g.players[0].id)} — ketik *${P}ludo-roll*`)
        }
        case 'board':
            return say(`🎲 *Ludo*${g.bet ? ` • pot ${fmt(g.bet * g.players.length)} koin` : ''}\n\n${render(g)}${g.started ? `\n\nGiliran ${tag(g.players[g.turn].id)}${g.roll ? ` (dadu ${g.roll}, pilih bidak: ${P}ludo-move <nomor>)` : ''}` : ''}`)
        case 'stop': {
            if (sender !== g.host && !A.isAdmins && !A.isOwner) return reply('Hanya host/admin yang bisa menghentikan.')
            refund(); delete s.games[chat]
            return say(`🛑 Ludo dihentikan.${g.bet ? ' Taruhan dikembalikan.' : ''}`)
        }
    }

    if (!g.started) return reply(`Permainan belum dimulai. Host ketik *${P}ludo-start*.`)
    if (me !== g.turn) return reply(`Sekarang giliran ${tag(g.players[g.turn].id)}.`)
    const seat = g.turn
    const nextTurn = () => { g.turn = (g.turn + 1) % g.players.length; g.roll = null; g.sixes = 0 }

    const doMove = async (idx) => {
        const pl = g.players[seat]
        const roll = g.roll
        let note = ''
        let bonus = roll === 6
        pl.t[idx] = pl.t[idx] === 0 ? 1 : pl.t[idx] + roll
        const p = pl.t[idx]
        if (p === DONE) { note += `\n🎉 Bidak ${idx + 1} sampai tujuan!`; bonus = true }
        else if (p <= 51) {
            const a = abs(seat, p)
            if (!safe(a)) {
                g.players.forEach((o, os) => {
                    if (os === seat) return
                    o.t.forEach((q, qi) => {
                        if (q > 0 && q <= 51 && abs(os, q) === a) { o.t[qi] = 0; note += `\n💥 Bidak ${tag(o.id)} ditangkap & kembali ke kandang!`; bonus = true }
                    })
                })
            }
        }
        if (pl.t.every(x => x === DONE)) {
            const pot = g.bet * g.players.length
            if (pot) addCoin(pl.id, pot)
            delete s.games[chat]
            return say(`🏆 ${tag(pl.id)} (${COLORS[seat]}) MENANG Ludo!${pot ? `\n🎁 Hadiah ${fmt(pot)} koin` : ''}`, [pl.id])
        }
        g.roll = null
        if (bonus && g.sixes < 3) {
            return say(`🎲 ${tag(pl.id)} jalan ${roll} (bidak ${idx + 1}).${note}\n➕ Giliran tambahan! Ketik *${P}ludo-roll*`)
        }
        nextTurn()
        return say(`🎲 ${tag(pl.id)} jalan ${roll} (bidak ${idx + 1}).${note}\n\n${render(g)}\n\nGiliran ${tag(g.players[g.turn].id)} — *${P}ludo-roll*`)
    }

    if (sub === 'roll') {
        if (g.roll) return reply(`Kamu sudah melempar dadu (${g.roll}). Pilih bidak: *${P}ludo-move <1-4>*`)
        const roll = rnd(1, 6)
        g.roll = roll
        g.sixes = roll === 6 ? g.sixes + 1 : 0
        if (g.sixes >= 3) {
            nextTurn()
            return say(`🎲 ${tag(sender)} dapat 6 tiga kali berturut-turut — giliran hangus!\nGiliran ${tag(g.players[g.turn].id)} — *${P}ludo-roll*`)
        }
        const opts = legalMoves(g, seat, roll)
        if (!opts.length) {
            nextTurn()
            return say(`🎲 ${tag(sender)} dapat *${roll}* — tidak ada bidak yang bisa jalan.\nGiliran ${tag(g.players[g.turn].id)} — *${P}ludo-roll*`)
        }
        if (opts.length === 1) { await say(`🎲 ${tag(sender)} dapat *${roll}*. Hanya 1 langkah mungkin, otomatis dijalankan.`); return doMove(opts[0]) }
        return say(`🎲 ${tag(sender)} dapat *${roll}*! Pilih bidak: ${opts.map(i => i + 1).join(', ')}\nKetik *${P}ludo-move <nomor>*`)
    }

    if (sub === 'move') {
        if (!g.roll) return reply(`Lempar dadu dulu: *${P}ludo-roll*`)
        const idx = num(A.args[0]) - 1
        if (!legalMoves(g, seat, g.roll).includes(idx)) return reply(`Bidak itu tidak bisa jalan. Pilihan: ${legalMoves(g, seat, g.roll).map(i => i + 1).join(', ')}`)
        return doMove(idx)
    }

    return reply(`Perintah tidak dikenal. Ketik *${P}ludo-help*.`)
}
