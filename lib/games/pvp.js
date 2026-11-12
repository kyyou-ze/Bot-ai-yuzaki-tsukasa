// ───────── lib/games/pvp.js ─────────
// Mesin PvP 1 lawan 1 untuk game papan (dam, othello, ...): tantangan, giliran, timer,
// menyerah, seri, history, rank (Elo) dan top 10. Aturan tiap game ada di definisi `def`.
//
// def = {
//   key, title, icon, reward,            // reward = koin untuk pemenang
//   sides: ['Merah', 'Biru'],            // nama sisi (index 0 jalan duluan)
//   moveHelp: 'c3 d4',
//   init() -> state,
//   render(state, g) -> teks papan,
//   move(state, side, args) -> { err } | { msg?, next?, end?: { winner: 0|1|-1, reason } },
//   extra?: { hint(A, g, side) , skor(A, g) }   // sub-command tambahan
// }

import { store, tag, send, now, addCoin, fmt, targetOf, num, eloUpdate, clamp, timeLeft } from './common.js'

const PENDING_MS = 5 * 60 * 1000
const DEFAULT_LIMIT = 30 * 60 * 1000

const data = (def) => {
    const s = store(def.key)
    s.games ||= {}
    s.stats ||= {}
    s.hist ||= []
    return s
}

const statOf = (s, jid) => (s.stats[jid] ||= { w: 0, l: 0, d: 0, elo: 1000 })

export async function pvpRun(def, A, sub) {
    const { m, sender, reply } = A
    const P = A.prefix || '.'
    const K = def.key
    if (!m.isGroup) return reply('Perintah ini hanya bisa digunakan di grup.')
    const chat = m.chat
    const s = data(def)
    const say = (t, men) => send(A, t, men || [])
    let g = s.games[chat]

    const finish = async (game, winner, reason) => {
        const [a, b] = game.p
        const sa = statOf(s, a), sb = statOf(s, b)
        const score = winner === -1 ? 0.5 : winner === 0 ? 1 : 0
        const ea = sa.elo, eb = sb.elo
        sa.elo = eloUpdate(ea, eb, score)
        sb.elo = eloUpdate(eb, ea, 1 - score)
        if (winner === -1) { sa.d++; sb.d++ } else if (winner === 0) { sa.w++; sb.l++ } else { sb.w++; sa.l++ }
        let bonus = ''
        if (winner !== -1 && def.reward) {
            addCoin(game.p[winner], def.reward)
            bonus = `\n🎁 Hadiah ${tag(game.p[winner])}: +${fmt(def.reward)} koin`
        }
        s.hist.unshift({ a, b, w: winner, n: game.n, at: now(), reason, chat })
        if (s.hist.length > 100) s.hist.length = 100
        delete s.games[game.chat]
        const head = winner === -1 ? `🤝 *${def.title}* berakhir SERI` : `🏆 *${def.title}* — pemenang: ${tag(game.p[winner])} (${def.sides[winner]})`
        await say(`${head}\n${reason}${bonus}\n\nElo: ${tag(a)} ${sa.elo} (${sa.elo - ea >= 0 ? '+' : ''}${sa.elo - ea}) | ${tag(b)} ${sb.elo} (${sb.elo - eb >= 0 ? '+' : ''}${sb.elo - eb})`, [a, b])
    }

    // kedaluwarsa: tantangan tanpa jawaban / giliran melewati batas waktu
    if (g) {
        if (!g.on && now() - g.at > PENDING_MS) { delete s.games[chat]; g = null }
        else if (g.on && now() - g.last > g.limit) {
            const loser = g.turn
            await finish(g, 1 - loser, `⏰ ${tag(g.p[loser])} kehabisan waktu (${timeLeft(g.limit)} per langkah).`)
            g = null
        }
    }
    const idx = (jid) => g ? g.p.indexOf(jid) : -1
    const board = () => `${def.icon} *${def.title}*\n${tag(g.p[0])} (${def.sides[0]}) vs ${tag(g.p[1])} (${def.sides[1]})\n\n${def.render(g.st, g)}\n\n` +
        `Giliran: ${tag(g.p[g.turn])} (${def.sides[g.turn]})\nLangkah: *${P}${K}-langkah ${def.moveHelp}* • sisa waktu ${timeLeft(Math.max(0, g.limit - (now() - g.last)))}`

    switch (sub) {
        case 'create': {
            if (g) return say(g.on ? `Sudah ada permainan ${def.title} di grup ini. Lihat dengan *${P}${K}-board*.` : `Masih ada tantangan ${def.title} yang menunggu jawaban.`)
            const foe = targetOf(A)
            if (!foe) return reply(`Tantang seseorang dengan cara: *${P}${K} @user* (atau balas pesannya).\nPanduan: *${P}${K}-help*`)
            if (foe === sender) return reply('Tidak bisa menantang diri sendiri.')
            if (foe === (A.Bot.user?.jid)) return reply('Bot tidak ikut bermain 😅')
            s.games[chat] = { chat, p: [sender, foe], on: false, at: now(), st: null, turn: 0, n: 0, limit: DEFAULT_LIMIT, last: now(), draw: null, log: [] }
            return say(`${def.icon} ${tag(sender)} menantang ${tag(foe)} main *${def.title}*!\n${tag(foe)}, ketik *${P}${K}-terima* untuk setuju atau *${P}${K}-tolak* untuk menolak (kedaluwarsa 5 menit).`, [sender, foe])
        }

        case 'terima': {
            if (!g) return reply(`Tidak ada tantangan ${def.title}. Buat dengan *${P}${K} @user*.`)
            if (g.on) return reply('Permainan sudah berjalan.')
            if (sender !== g.p[1]) return reply('Hanya orang yang ditantang yang bisa menerima.')
            g.on = true; g.st = def.init(); g.last = now()
            return say(`✅ Tantangan diterima!\n\n${board()}`, g.p)
        }

        case 'tolak': {
            if (!g) return reply('Tidak ada tantangan.')
            if (g.on) return reply(`Permainan sudah berjalan. Gunakan *${P}${K}-menyerah* kalau ingin berhenti.`)
            if (idx(sender) < 0) return reply('Kamu bukan peserta tantangan ini.')
            delete s.games[chat]
            return say(`❌ Tantangan ${def.title} dibatalkan oleh ${tag(sender)}.`, [sender])
        }

        case 'board': {
            if (!g || !g.on) return reply(`Belum ada permainan ${def.title}.`)
            return say(board(), g.p)
        }

        case 'langkah': {
            if (!g || !g.on) return reply(`Belum ada permainan ${def.title} yang berjalan.`)
            const me = idx(sender)
            if (me < 0) return reply('Kamu bukan pemain di permainan ini.')
            if (me !== g.turn) return reply(`Sekarang giliran ${tag(g.p[g.turn])}.`)
            if (!A.args.length) return reply(`Format: *${P}${K}-langkah ${def.moveHelp}*`)
            const r = def.move(g.st, me, A.args)
            if (r.err) return reply('❌ ' + r.err)
            g.n++; g.last = now(); g.draw = null
            g.log.push(`${g.n}. ${def.sides[me]}: ${A.args.join(' ')}`)
            if (g.log.length > 400) g.log.shift()
            if (r.end) {
                await say(`${def.render(g.st, g)}`)
                return finish(g, r.end.winner, r.end.reason)
            }
            g.turn = r.next ?? 1 - me
            return say(`${r.msg ? r.msg + '\n\n' : ''}${board()}`, g.p)
        }

        case 'menyerah': {
            if (!g || !g.on) return reply('Tidak ada permainan yang berjalan.')
            const me = idx(sender)
            if (me < 0) return reply('Kamu bukan pemain di permainan ini.')
            return finish(g, 1 - me, `🏳️ ${tag(sender)} menyerah.`)
        }

        case 'draw': {
            if (!g || !g.on) return reply('Tidak ada permainan yang berjalan.')
            const me = idx(sender)
            if (me < 0) return reply('Kamu bukan pemain di permainan ini.')
            if (g.draw === null || g.draw === me) {
                g.draw = me
                return say(`🤝 ${tag(sender)} menawarkan seri. ${tag(g.p[1 - me])} ketik *${P}${K}-draw* untuk menerima.`, g.p)
            }
            return finish(g, -1, '🤝 Kedua pemain sepakat seri.')
        }

        case 'timer': {
            const min = num(A.args[0])
            if (!g) return reply(`Belum ada permainan. Timer bawaan: ${timeLeft(DEFAULT_LIMIT)} per langkah.`)
            if (Number.isNaN(min)) return reply(`⏱️ Batas waktu: ${timeLeft(g.limit)} per langkah.\nSisa giliran ini: ${timeLeft(Math.max(0, g.limit - (now() - g.last)))}\nUbah: *${P}${K}-timer <menit 1-120>*`)
            if (idx(sender) < 0) return reply('Hanya pemain yang bisa mengubah timer.')
            g.limit = clamp(min, 1, 120) * 60000
            g.last = now()
            return say(`⏱️ Batas waktu diubah: ${timeLeft(g.limit)} per langkah.`)
        }

        case 'history': {
            const mine = s.hist.filter(h => h.a === sender || h.b === sender).slice(0, 10)
            if (!mine.length) return reply('Belum ada riwayat permainanmu.')
            const lines = mine.map((h, i) => {
                const opp = h.a === sender ? h.b : h.a
                const res = h.w === -1 ? '🤝 Seri' : (h.w === 0 ? h.a : h.b) === sender ? '✅ Menang' : '❌ Kalah'
                return `${i + 1}. ${res} vs ${tag(opp)} • ${h.n} langkah • ${new Date(h.at).toLocaleDateString('id-ID')}`
            })
            return say(`📜 *Riwayat ${def.title}* ${tag(sender)}\n\n${lines.join('\n')}`, [sender, ...mine.map(h => h.a === sender ? h.b : h.a)])
        }

        case 'rank': {
            const st = statOf(s, sender)
            const sorted = Object.entries(s.stats).sort((a, b) => b[1].elo - a[1].elo)
            const pos = sorted.findIndex(([j]) => j === sender) + 1
            return say(`🏅 *Rank ${def.title}* ${tag(sender)}\n\nPeringkat: #${pos}/${sorted.length}\nElo: ${st.elo}\nMenang: ${st.w} • Kalah: ${st.l} • Seri: ${st.d}`, [sender])
        }

        case 'top10': {
            const top = Object.entries(s.stats).filter(([, v]) => v.w + v.l + v.d > 0).sort((a, b) => b[1].elo - a[1].elo).slice(0, 10)
            if (!top.length) return reply('Leaderboard masih kosong.')
            const medal = ['🥇', '🥈', '🥉']
            return say(`🏆 *Top 10 ${def.title}*\n\n${top.map(([j, v], i) => `${medal[i] || (i + 1) + '.'} ${tag(j)} — Elo ${v.elo} (${v.w}M/${v.l}K/${v.d}S)`).join('\n')}`, top.map(([j]) => j))
        }

        case 'help':
            return say(`${def.icon} *${def.title}*\n\n${def.rules}\n\n*Perintah*\n• ${P}${K} @user — tantang pemain\n• ${P}${K}-terima / ${P}${K}-tolak\n• ${P}${K}-langkah ${def.moveHelp}\n• ${P}${K}-board — lihat papan\n${def.extraHelp ? def.extraHelp.map(x => `• ${P}${K}-${x}`).join('\n') + '\n' : ''}• ${P}${K}-menyerah • ${P}${K}-draw (seri)\n• ${P}${K}-timer <menit>\n• ${P}${K}-history • ${P}${K}-rank • ${P}${K}-top10\n\nPemenang mendapat ${fmt(def.reward)} koin + Elo naik.`)

        default:
            if (def.extra?.[sub]) {
                if (!g || !g.on) return reply('Tidak ada permainan yang berjalan.')
                const me = idx(sender)
                return def.extra[sub]({ A, g, me, say, reply, P })
            }
            return reply(`Perintah tidak dikenal. Ketik *${P}${K}-help*.`)
    }
}
