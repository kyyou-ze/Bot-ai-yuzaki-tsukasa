// ───────── lib/games/monopoli.js ─────────
// Monopoli Nusantara 2-6 pemain, papan 28 petak dengan kota-kota Indonesia.
// Uang dalam game: 1.500 (bukan koin RPG). Taruhan koin opsional → pemenang membawa pot.
// Menang: pemain terakhir yang tidak bangkrut, atau kekayaan terbesar setelah 25 putaran.

import { store, tag, send, addCoin, coinOf, fmt, rnd, num, now, pickRandom } from './common.js'

const COLORS = ['🔴', '🟢', '🟡', '🔵', '🟣', '🟠']
const START_CASH = 1500, GO = 200, JAIL = 10, MAX_ROUNDS = 25, AFK_MS = 5 * 60 * 1000
const MULT = [1, 3, 5, 7, 10]
const data = () => { const s = store('monopoli'); s.games ||= {}; return s }

// type: go | prop | rail | tax | chance | chest | jail | free | gojail
export const BOARD = [
    { t: 'go', n: '🏁 START' },
    { t: 'prop', n: 'Kupang', p: 60, grp: 1 }, { t: 'chest', n: '📦 Dana Umum' }, { t: 'prop', n: 'Mataram', p: 60, grp: 1 },
    { t: 'tax', n: '💸 Pajak Penghasilan', p: 100 }, { t: 'rail', n: '🚉 Stasiun Gambir', p: 200 },
    { t: 'prop', n: 'Pontianak', p: 100, grp: 2 }, { t: 'chance', n: '❓ Kesempatan' },
    { t: 'prop', n: 'Palembang', p: 100, grp: 2 }, { t: 'prop', n: 'Padang', p: 120, grp: 2 },
    { t: 'jail', n: '⛓️ Penjara (kunjungan)' },
    { t: 'prop', n: 'Makassar', p: 140, grp: 3 }, { t: 'rail', n: '🚉 Stasiun Bandung', p: 200 },
    { t: 'prop', n: 'Banjarmasin', p: 140, grp: 3 }, { t: 'prop', n: 'Manado', p: 160, grp: 3 },
    { t: 'chest', n: '📦 Dana Umum' }, { t: 'free', n: '🅿️ Parkir Bebas' },
    { t: 'prop', n: 'Semarang', p: 180, grp: 4 }, { t: 'chance', n: '❓ Kesempatan' },
    { t: 'prop', n: 'Medan', p: 180, grp: 4 }, { t: 'rail', n: '🚉 Stasiun Senen', p: 200 },
    { t: 'prop', n: 'Surabaya', p: 200, grp: 4 }, { t: 'gojail', n: '👮 Masuk Penjara' },
    { t: 'prop', n: 'Yogyakarta', p: 240, grp: 5 }, { t: 'prop', n: 'Bandung', p: 260, grp: 5 },
    { t: 'tax', n: '💎 Pajak Barang Mewah', p: 150 },
    { t: 'prop', n: 'Jakarta', p: 300, grp: 6 }, { t: 'prop', n: 'Bali', p: 320, grp: 6 }
]
const GROUPS = {}
BOARD.forEach((b, i) => { if (b.grp) (GROUPS[b.grp] ||= []).push(i) })

const owns = (g, pi, idx) => g.own[idx] && g.own[idx].o === pi
const fullSet = (g, pi, idx) => GROUPS[BOARD[idx].grp].every(i => owns(g, pi, i))
export const rentOf = (g, idx) => {
    const b = BOARD[idx], o = g.own[idx]
    if (!o) return 0
    if (b.t === 'rail') return 25 * 2 ** (BOARD.map((x, i) => (x.t === 'rail' && owns(g, o.o, i) ? 1 : 0)).reduce((a, c) => a + c, 0) - 1)
    const base = Math.ceil(b.p / 10)
    return base * MULT[o.h] * (o.h === 0 && fullSet(g, o.o, idx) ? 2 : 1)
}
const worth = (g, pi) => {
    const p = g.players[pi]
    let w = p.cash
    for (const [i, o] of Object.entries(g.own)) if (o.o === pi) w += BOARD[i].p + o.h * Math.floor(BOARD[i].p / 2)
    return w
}
const alive = (g) => g.players.filter(p => p.alive)

const CARDS = [
    ['🎁 Menang lomba! Terima 100.', (g, p) => { p.cash += 100 }],
    ['🎁 Bonus tahunan! Terima 150.', (g, p) => { p.cash += 150 }],
    ['🩺 Biaya dokter. Bayar 80.', (g, p) => { p.cash -= 80 }],
    ['🚓 Ditilang. Bayar 50.', (g, p) => { p.cash -= 50 }],
    ['🚀 Maju ke START! Terima 200.', (g, p) => { p.pos = 0; p.cash += GO }],
    ['🚶 Maju 3 petak.', (g, p, env) => { env.move = 3 }],
    ['⏪ Mundur 3 petak.', (g, p, env) => { env.move = -3 }],
    ['⛓️ Langsung ke penjara!', (g, p) => { p.pos = JAIL; p.jail = 1 }],
    ['🎂 Ulang tahun! Tiap pemain memberimu 20.', (g, p) => { for (const o of alive(g)) if (o !== p) { const a = Math.min(20, Math.max(0, o.cash)); o.cash -= a; p.cash += a } }],
    ['🏘️ Iuran RT. Bayar 30 ke tiap pemain.', (g, p) => { for (const o of alive(g)) if (o !== p) { p.cash -= 30; o.cash += 30 } }]
]

export function render(g) {
    const rows = g.players.map((p, i) => {
        const props = Object.entries(g.own).filter(([, o]) => o.o === i).map(([k, o]) => `${BOARD[k].n}${o.h ? '🏠'.repeat(Math.min(o.h, 3)) + (o.h === 4 ? '🏨' : '') : ''}`)
        return `${COLORS[i]} ${tag(p.id)}${p.alive ? '' : ' ☠️'}${g.started && g.turn === i ? ' 👈' : ''}\n   💰 ${fmt(p.cash)} • 📍 ${BOARD[p.pos].n}${p.jail ? ' (di penjara)' : ''}\n   🏘️ ${props.length ? props.join(', ') : '-'}`
    })
    return rows.join('\n')
}

export async function monopoliRun(A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const s = data()
    const g = s.games[chat]
    const say = (t, men) => send(A, t, men || (g ? g.players.map(p => p.id) : []))
    const pi = g ? g.players.findIndex(p => p.id === sender) : -1
    const isHost = () => g && (sender === g.host || A.isAdmins || A.isOwner)

    if (sub === 'help') return say(`🎩 *Monopoli Nusantara*\n\n• ${P}monopoli [taruhan] — buat permainan\n• ${P}monopoli-join / ${P}monopoli-start\n• ${P}monopoli-roll — lempar dadu\n• ${P}monopoli-beli — beli petak yang kamu injak\n• ${P}monopoli-lewat — tidak jadi beli\n• ${P}monopoli-bangun <kota> — bangun rumah (butuh 1 set warna, maks 4 tingkat)\n• ${P}monopoli-jual <kota> — jual ke bank (50% harga)\n• ${P}monopoli-bayar — bayar 50 untuk keluar penjara\n• ${P}monopoli-board — status semua pemain\n• ${P}monopoli-stop\n\nUang awal ${fmt(START_CASH)}. Lewat START +${GO}. Dadu kembar = jalan lagi (3x kembar = penjara). Menang: lawan bangkrut semua, atau terkaya setelah ${MAX_ROUNDS} putaran. Pemenang membawa taruhan koin (jika ada).`, [])

    if (sub === 'create') {
        if (g) return reply(`Sudah ada permainan. Ketik *${P}monopoli-join*.`)
        const bet = Math.max(0, num(A.args[0], 0))
        if (bet && coinOf(sender) < bet) return reply(`Koinmu kurang untuk taruhan ${fmt(bet)}.`)
        if (bet) addCoin(sender, -bet)
        s.games[chat] = { host: sender, bet, players: [{ id: sender, cash: START_CASH, pos: 0, jail: 0, alive: true }], own: {}, started: false, turn: 0, rolled: false, pending: null, doubles: 0, turns: 0, last: now() }
        return say(`🎩 *Monopoli Nusantara* dibuat oleh ${tag(sender)}${bet ? ` • taruhan ${fmt(bet)} koin/pemain` : ''}\nKetik *${P}monopoli-join* (2-6 pemain), host ketik *${P}monopoli-start*.`, [sender])
    }
    if (!g) return reply(`Belum ada permainan. Ketik *${P}monopoli*.`)

    const pot = () => g.bet * g.players.length
    const cur = () => g.players[g.turn]

    const finish = async (wi, why) => {
        const w = g.players[wi]
        if (pot()) addCoin(w.id, pot())
        delete s.games[chat]
        return say(`🏆 *${tag(w.id)} MEMENANGKAN Monopoli!* ${why}${pot() ? `\n🎁 Hadiah ${fmt(pot())} koin` : ''}\n\nKekayaan akhir:\n${g.players.map((p, i) => `${COLORS[i]} ${tag(p.id)}: ${fmt(worth(g, i))}`).join('\n')}`, g.players.map(p => p.id))
    }
    const bankrupt = async (i, to) => {
        const p = g.players[i]
        p.alive = false
        let note = `💥 ${tag(p.id)} BANGKRUT!`
        if (to != null) { g.players[to].cash += Math.max(0, p.cash) ; note += ` Aset diambil alih ${tag(g.players[to].id)}.` }
        p.cash = 0
        for (const [k, o] of Object.entries(g.own)) if (o.o === i) { if (to != null) g.own[k] = { o: to, h: o.h }; else delete g.own[k] }
        await say(note)
        const left = alive(g)
        if (left.length === 1) return finish(g.players.indexOf(left[0]), 'Semua lawan bangkrut.')
        return null
    }
    const endTurn = async () => {
        g.pending = null; g.rolled = false; g.doubles = 0
        let n = 0
        do { g.turn = (g.turn + 1) % g.players.length; n++ } while (!cur().alive && n <= g.players.length)
        g.turns++
        g.last = now()
        if (g.turns >= MAX_ROUNDS * alive(g).length) {
            const best = g.players.map((_, i) => i).filter(i => g.players[i].alive).sort((a, b) => worth(g, b) - worth(g, a))[0]
            return finish(best, `Batas ${MAX_ROUNDS} putaran tercapai — dia yang terkaya.`)
        }
        return say(`➡️ Giliran ${tag(cur().id)} ${COLORS[g.turn]} — *${P}monopoli-roll*${cur().jail ? ` (di penjara: lempar dadu kembar, atau *${P}monopoli-bayar* 50)` : ''}`)
    }
    const after = async () => {
        if (g.pending) return null
        if (g.doubles > 0 && cur().alive && !cur().jail) return say(`🎲 Dadu kembar! ${tag(cur().id)} jalan lagi — *${P}monopoli-roll*`).then(() => { g.rolled = false })
        return endTurn()
    }

    const land = async (i) => {
        const p = g.players[i]
        const b = BOARD[p.pos]
        let text = `${COLORS[i]} ${tag(p.id)} mendarat di *${b.n}*`
        const env = {}
        switch (b.t) {
            case 'prop': case 'rail': {
                const o = g.own[p.pos]
                if (!o) {
                    if (p.cash >= b.p) { g.pending = { idx: p.pos }; text += ` (harga ${fmt(b.p)}, uangmu ${fmt(p.cash)})\nBeli: *${P}monopoli-beli* • Lewati: *${P}monopoli-lewat*` }
                    else text += `\nUang tidak cukup untuk membeli (${fmt(b.p)}).`
                } else if (o.o === i) text += '\nPetak milikmu sendiri.'
                else {
                    const rent = rentOf(g, p.pos)
                    const owner = g.players[o.o]
                    if (p.cash >= rent) { p.cash -= rent; owner.cash += rent; text += `\n💸 Bayar sewa ${fmt(rent)} ke ${tag(owner.id)}.` }
                    else { await say(text + `\n💸 Sewa ${fmt(rent)} tidak sanggup dibayar!`); return bankrupt(i, o.o) }
                }
                break
            }
            case 'tax':
                if (p.cash >= b.p) { p.cash -= b.p; text += `\n💸 Bayar pajak ${fmt(b.p)}.` }
                else { await say(text + '\n💸 Tidak sanggup bayar pajak!'); return bankrupt(i, null) }
                break
            case 'gojail': p.pos = JAIL; p.jail = 1; g.doubles = 0; text += '\n⛓️ Kamu masuk penjara!'; break
            case 'chance': case 'chest': {
                const [msg, fn] = pickRandom(CARDS)
                fn(g, p, env)
                text += `\n${msg}`
                if (p.cash < 0) { await say(text); return bankrupt(i, null) }
                break
            }
            default: break
        }
        await say(text)
        if (env.move) {
            p.pos = (p.pos + env.move + BOARD.length) % BOARD.length
            if (env.move > 0 && p.pos < env.move) { p.cash += GO }
            return land(i)
        }
        return null
    }

    // AFK: giliran dilewati otomatis
    if (g.started && now() - g.last > AFK_MS && cur()) {
        g.last = now()
        await say(`⏰ ${tag(cur().id)} AFK, giliran dilewati.`)
        const wasJail = false
        void wasJail
        return endTurn()
    }

    switch (sub) {
        case 'join': {
            if (g.started) return reply('Permainan sudah berjalan.')
            if (pi >= 0) return reply('Kamu sudah bergabung.')
            if (g.players.length >= 6) return reply('Pemain penuh (6).')
            if (g.bet) { if (coinOf(sender) < g.bet) return reply(`Koinmu kurang untuk taruhan ${fmt(g.bet)}.`); addCoin(sender, -g.bet) }
            g.players.push({ id: sender, cash: START_CASH, pos: 0, jail: 0, alive: true })
            return say(`✅ ${tag(sender)} bergabung sebagai ${COLORS[g.players.length - 1]} (${g.players.length}/6)`)
        }
        case 'start': {
            if (g.started) return reply('Sudah dimulai.')
            if (!isHost()) return reply('Hanya host/admin yang bisa memulai.')
            if (g.players.length < 2) return reply('Minimal 2 pemain.')
            g.started = true; g.turn = 0; g.last = now()
            return say(`🎩 Monopoli dimulai!\n\n${render(g)}\n\nGiliran ${tag(cur().id)} — *${P}monopoli-roll*`)
        }
        case 'board': return say(`🎩 *Monopoli Nusantara*${pot() ? ` • pot ${fmt(pot())} koin` : ''}\n\n${render(g)}`)
        case 'stop': {
            if (!isHost()) return reply('Hanya host/admin yang bisa menghentikan.')
            if (g.bet) for (const p of g.players) addCoin(p.id, g.bet)
            delete s.games[chat]
            return say(`🛑 Monopoli dihentikan.${g.bet ? ' Taruhan dikembalikan.' : ''}`)
        }
    }

    if (!g.started) return reply(`Belum dimulai. Host ketik *${P}monopoli-start*.`)
    if (pi < 0 || !g.players[pi].alive) return reply('Kamu bukan pemain aktif.')
    if (pi !== g.turn) return reply(`Sekarang giliran ${tag(cur().id)}.`)
    const me = g.players[pi]

    switch (sub) {
        case 'bayar': {
            if (!me.jail) return reply('Kamu tidak di penjara.')
            if (g.rolled) return reply('Sudah melempar dadu.')
            if (me.cash < 50) return reply('Uang tidak cukup (50).')
            me.cash -= 50; me.jail = 0
            return say(`🔓 ${tag(sender)} membayar 50 dan bebas dari penjara. Ketik *${P}monopoli-roll*.`)
        }
        case 'roll': {
            if (g.rolled) return reply('Kamu sudah melempar dadu giliran ini.')
            if (g.pending) return reply(`Putuskan dulu: *${P}monopoli-beli* atau *${P}monopoli-lewat*.`)
            const d1 = rnd(1, 6), d2 = rnd(1, 6), dbl = d1 === d2
            g.rolled = true
            let head = `🎲 ${tag(sender)} melempar ${d1} + ${d2} = *${d1 + d2}*${dbl ? ' (kembar!)' : ''}`
            if (me.jail) {
                if (dbl) { me.jail = 0; head += ' — bebas dari penjara!' }
                else if (me.jail >= 3) { me.jail = 0; me.cash -= 50; head += ' — 3 giliran habis, bayar 50 & keluar.' }
                else { me.jail++; await say(head + ' — masih di penjara.'); return endTurn() }
            }
            if (dbl) g.doubles++; else g.doubles = 0
            if (g.doubles >= 3) { me.pos = JAIL; me.jail = 1; g.doubles = 0; await say(head + '\n🚨 3x kembar! Masuk penjara.'); return endTurn() }
            const old = me.pos
            me.pos = (me.pos + d1 + d2) % BOARD.length
            if (me.pos < old) { me.cash += GO; head += `\n🏁 Lewat START +${GO}` }
            await say(head)
            const r = await land(pi)
            if (!s.games[chat]) return r
            return after()
        }
        case 'beli': {
            if (!g.pending) return reply('Tidak ada petak yang bisa dibeli.')
            const b = BOARD[g.pending.idx]
            if (me.cash < b.p) return reply('Uang tidak cukup.')
            me.cash -= b.p; g.own[g.pending.idx] = { o: pi, h: 0 }
            g.pending = null
            await say(`🏠 ${tag(sender)} membeli *${b.n}* seharga ${fmt(b.p)}. Sisa uang ${fmt(me.cash)}.`)
            return after()
        }
        case 'lewat': {
            if (!g.pending) return reply('Tidak ada yang perlu dilewati.')
            g.pending = null
            await say(`⏭️ ${tag(sender)} tidak membeli.`)
            return after()
        }
        case 'bangun': case 'jual': {
            if (g.pending) return reply('Selesaikan dulu pembelian petak.')
            if (g.rolled) return reply(`Hanya bisa sebelum melempar dadu (*${P}monopoli-${sub}* di awal giliranmu).`)
            const q = A.args.join(' ').toLowerCase()
            const idx = BOARD.findIndex(b => (b.t === 'prop' || b.t === 'rail') && b.n.toLowerCase().includes(q) && q)
            if (idx < 0) return reply(`Sebutkan nama kota, contoh: *${P}monopoli-${sub} jakarta*`)
            if (!owns(g, pi, idx)) return reply('Itu bukan petakmu.')
            const o = g.own[idx]
            if (sub === 'bangun') {
                if (BOARD[idx].t !== 'prop') return reply('Stasiun tidak bisa dibangun.')
                if (!fullSet(g, pi, idx)) return reply('Kamu harus menguasai semua kota satu warna dulu.')
                if (o.h >= 4) return reply('Sudah tingkat maksimum (hotel).')
                const cost = Math.floor(BOARD[idx].p / 2)
                if (me.cash < cost) return reply(`Uang tidak cukup (${fmt(cost)}).`)
                me.cash -= cost; o.h++
                return say(`🏗️ ${tag(sender)} membangun di *${BOARD[idx].n}* (tingkat ${o.h}/4, sewa ${fmt(rentOf(g, idx))}). Biaya ${fmt(cost)}.`)
            }
            const gain = Math.floor((BOARD[idx].p + o.h * Math.floor(BOARD[idx].p / 2)) / 2)
            me.cash += gain; delete g.own[idx]
            return say(`💱 ${tag(sender)} menjual *${BOARD[idx].n}* ke bank seharga ${fmt(gain)}.`)
        }
    }
    return reply(`Perintah tidak dikenal. Ketik *${P}monopoli-help*.`)
}
