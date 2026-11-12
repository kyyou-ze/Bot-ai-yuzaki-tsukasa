// ───────── lib/games/ceme.js ─────────
// Ceme (remi 2 kartu, bisa tambah 1) — pemain lawan bandar. Nilai = jumlah poin % 10.
// A=1, 2-9 sesuai angka, 10/J/Q/K=0. Dua kartu bernilai 9 = "kartu mati" (bayar x2).
// Jaminan: tiap pemain menyetor 2x taruhan (sisa dikembalikan), bandar menyetor 2x taruhan x jumlah pemain.

import { store, tag, send, dm, addCoin, coinOf, fmt, num } from './common.js'
import { newDeck, handName } from './cards.js'

const data = () => { const s = store('ceme'); s.games ||= {}; return s }
export const pts = (c) => c.r === 12 ? 1 : c.r <= 7 ? c.r + 2 : 0 // r: 0='2'..7='9',8='10',9-11 J/Q/K=0,12=A
export const value = (cards) => cards.reduce((a, c) => a + pts(c), 0) % 10
export const natural = (cards) => cards.length === 2 && value(cards) === 9

export function settleCeme(g) {
    const bandar = g.bandar
    const bn = natural(bandar.cards), bv = value(bandar.cards)
    let bandarGet = 2 * g.bet * g.players.length
    const rows = g.players.map(p => {
        const pv = value(p.cards), pn = natural(p.cards)
        let d = 0
        if (pn && !bn) d = 2 * g.bet
        else if (bn && !pn) d = -2 * g.bet
        else if (pv > bv) d = g.bet
        else if (pv < bv) d = -g.bet
        bandarGet -= d
        return { p, pv, pn, d, refund: 2 * g.bet + d }
    })
    return { rows, bv, bn, bandarGet }
}

export async function cemeRun(A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const s = data()
    const g = s.games[chat]
    const say = (t, men) => send(A, t, men || (g ? [g.host, ...g.players.map(p => p.id)] : []))
    const refundAll = () => {
        for (const p of g.players) addCoin(p.id, 2 * g.bet)
        if (g.started) addCoin(g.host, 2 * g.bet * g.players.length)
    }
    const isHost = () => g && (sender === g.host || A.isAdmins || A.isOwner)

    if (sub === 'help') return say(`🎴 *Ceme*\n\n• ${P}ceme <taruhan> — jadi bandar & buka meja\n• ${P}ceme-join — ikut melawan bandar (maks 8)\n• ${P}ceme-start — bagi kartu (host)\n• ${P}ceme-hit — tambah 1 kartu (maks 3 kartu)\n• ${P}ceme-stand — cukup\n• ${P}ceme-hand — kirim ulang kartu via DM\n• ${P}ceme-open — buka kartu (host, paksa)\n• ${P}ceme-stop — batalkan & kembalikan koin\n\nNilai = jumlah poin % 10 (A=1, 10/J/Q/K=0). Dua kartu bernilai 9 = *kartu mati*: bayar x2. Seri = tidak ada yang bayar. Bandar otomatis tambah kartu bila nilainya ≤ 4. Setiap pemain menyetor jaminan 2x taruhan (sisa dikembalikan).`, [])

    if (sub === 'create') {
        if (g) return reply(`Sudah ada meja ceme. Ketik *${P}ceme-join*.`)
        const bet = num(A.args[0])
        if (Number.isNaN(bet) || bet < 10) return reply(`Format: *${P}ceme <taruhan min 10>*`)
        s.games[chat] = { host: sender, bet, players: [], started: false, bandar: null, deck: null }
        return say(`🎴 *Ceme* dibuka! Bandar: ${tag(sender)}\nTaruhan: ${fmt(bet)} koin/pemain (jaminan ${fmt(bet * 2)})\nKetik *${P}ceme-join* untuk melawan bandar.`, [sender])
    }
    if (!g) return reply(`Belum ada meja ceme. Ketik *${P}ceme <taruhan>*.`)
    const pl = g.players.find(p => p.id === sender)

    const settle = async () => {
        while (value(g.bandar.cards) <= 4 && g.bandar.cards.length < 3 && !natural(g.bandar.cards)) g.bandar.cards.push(g.deck.pop())
        const r = settleCeme(g)
        for (const row of r.rows) addCoin(row.p.id, row.refund)
        addCoin(g.host, r.bandarGet)
        delete s.games[chat]
        const lines = r.rows.map(x => `${tag(x.p.id)}: ${handName(x.p.cards)} = *${x.pv}*${x.pn ? ' 🌟kartu mati' : ''} → ${x.d > 0 ? `menang +${fmt(x.d)}` : x.d < 0 ? `kalah ${fmt(x.d)}` : 'seri'}`)
        const net = r.bandarGet - 2 * g.bet * g.players.length
        return say(`🎴 *Hasil Ceme*\nBandar ${tag(g.host)}: ${handName(g.bandar.cards)} = *${r.bv}*${r.bn ? ' 🌟kartu mati' : ''}\n\n${lines.join('\n')}\n\nBandar ${net >= 0 ? 'untung' : 'rugi'} ${fmt(Math.abs(net))} koin`, [g.host, ...g.players.map(p => p.id)])
    }
    const checkAllDone = async () => (g.players.every(p => p.done) ? settle() : null)

    switch (sub) {
        case 'join': {
            if (g.started) return reply('Permainan sudah dimulai.')
            if (sender === g.host) return reply('Kamu bandar, tidak perlu join.')
            if (pl) return reply('Kamu sudah join.')
            if (g.players.length >= 8) return reply('Meja penuh (8).')
            if (coinOf(sender) < 2 * g.bet) return reply(`Koinmu kurang untuk jaminan ${fmt(2 * g.bet)}.`)
            addCoin(sender, -2 * g.bet)
            g.players.push({ id: sender, cards: [], done: false })
            return say(`✅ ${tag(sender)} ikut melawan bandar (${g.players.length} pemain)`)
        }
        case 'start': {
            if (g.started) return reply('Sudah dimulai.')
            if (!isHost()) return reply('Hanya host/admin yang bisa memulai.')
            if (!g.players.length) return reply('Belum ada pemain yang join.')
            const need = 2 * g.bet * g.players.length
            if (coinOf(g.host) < need) return reply(`Koin bandar kurang untuk jaminan ${fmt(need)}.`)
            addCoin(g.host, -need)
            g.started = true; g.deck = newDeck()
            g.bandar = { cards: [g.deck.pop(), g.deck.pop()] }
            for (const p of g.players) p.cards = [g.deck.pop(), g.deck.pop()]
            let failed = []
            for (const p of g.players) {
                const ok = await dm(A, p.id, `🎴 *Ceme* — kartumu: ${handName(p.cards)} = *${value(p.cards)}*${natural(p.cards) ? ' 🌟kartu mati!' : ''}\nBalas di grup: *${P}ceme-hit* (tambah) atau *${P}ceme-stand* (cukup)`)
                if (!ok) failed.push(p.id)
                if (natural(p.cards)) p.done = true
            }
            await say(`🎴 Kartu dibagi! Cek chat pribadi.${failed.length ? `\n⚠️ Gagal DM: ${failed.map(tag).join(', ')} — chat bot dulu lalu ketik *${P}ceme-hand*.` : ''}\nPemain: ketik *${P}ceme-hit* atau *${P}ceme-stand*.`)
            return checkAllDone()
        }
        case 'hand': {
            if (!pl || !g.started) return reply('Kamu tidak sedang main.')
            const ok = await dm(A, sender, `🎴 Kartumu: ${handName(pl.cards)} = *${value(pl.cards)}*`)
            return reply(ok ? '📩 Dikirim via chat pribadi.' : '❌ Gagal DM. Chat bot dulu.')
        }
        case 'hit': case 'stand': {
            if (!g.started) return reply('Belum dimulai.')
            if (!pl) return reply('Kamu bukan pemain.')
            if (pl.done) return reply('Kamu sudah selesai.')
            if (sub === 'hit') {
                pl.cards.push(g.deck.pop())
                await dm(A, sender, `🎴 Kartumu: ${handName(pl.cards)} = *${value(pl.cards)}*`)
                pl.done = true
                await say(`➕ ${tag(sender)} menambah kartu.`)
            } else { pl.done = true; await say(`✋ ${tag(sender)} cukup.`) }
            return checkAllDone()
        }
        case 'open': {
            if (!g.started) return reply('Belum dimulai.')
            if (!isHost()) return reply('Hanya host/admin yang bisa membuka.')
            return settle()
        }
        case 'stop': {
            if (!isHost()) return reply('Hanya host/admin yang bisa membatalkan.')
            refundAll(); delete s.games[chat]
            return say('🛑 Meja ceme dibatalkan, semua jaminan dikembalikan.')
        }
    }
    return reply(`Perintah tidak dikenal. Ketik *${P}ceme-help*.`)
}
