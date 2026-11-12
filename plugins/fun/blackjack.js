import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .bj — Blackjack lawan bandar (bot). Hiburan murni, tidak memakai gold RPG.
        //   .bj -> mulai   |   .tarik -> ambil kartu   |   .stand -> berhenti
        const ST = require('../../lib/style')
        const games = new Map()   // chat|sender
        const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        const deck = () => { const d = []; for (const s of SUITS) for (const r of RANKS) d.push({ r, s }); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]] } return d }
        const val = (hand) => { let t = 0, a = 0; for (const c of hand) { if (c.r === 'A') { a++; t += 11 } else t += 'JQK'.includes(c.r) ? 10 : +c.r } while (t > 21 && a-- > 0) t -= 10; return t }
        const fmt = (h, hide) => h.map((c, i) => hide && i === 1 ? '🂠' : c.r + c.s).join(' ')
        const board = (g, hide) => `${ST.B('BLACKJACK')}\n━━━━━━━━━━━━━━━━━━━━\nBandar: ${fmt(g.dealer, hide)}${hide ? '' : ` (${val(g.dealer)})`}\nKamu  : ${fmt(g.me)} (${val(g.me)})\n`

        module.exports = {
          name: 'bj', alias: ['blackjack', 'tarik', 'stand'], category: 'fun', cmds: ['bj'], noLimit: true,
          desc: 'Blackjack lawan bandar: .bj, .tarik, .stand',
          run: async ({ m, command: cmd, prefix, reply }) => {
            const command = cmd === 'tarik' ? 'hit' : cmd
            const key = m.chat + '|' + m.sender
            let g = games.get(key)
            if (command === 'bj' || command === 'blackjack') {
              const d = deck(); g = { d, me: [d.pop(), d.pop()], dealer: [d.pop(), d.pop()] }; games.set(key, g)
              if (val(g.me) === 21) { games.delete(key); return reply(board(g, false) + '\n*BLACKJACK!* ' + (val(g.dealer) === 21 ? 'Bandar juga 21, seri.' : 'Kamu menang.')) }
              return reply(board(g, true) + `\n${prefix}tarik untuk ambil kartu • ${prefix}stand untuk berhenti`)
            }
            if (!g) return reply(`Belum ada permainan. Mulai: ${prefix}bj`)
            if (command === 'hit') {
              g.me.push(g.d.pop())
              if (val(g.me) > 21) { games.delete(key); return reply(board(g, false) + '\n*Bust!* Kartumu lewat 21. Bandar menang.') }
              if (val(g.me) === 21) return module.exports.run({ m, command: 'stand', prefix, reply })
              return reply(board(g, true) + `\n${prefix}tarik • ${prefix}stand`)
            }
            while (val(g.dealer) < 17) g.dealer.push(g.d.pop())
            games.delete(key)
            const a = val(g.me), b = val(g.dealer)
            return reply(board(g, false) + '\n' + (b > 21 ? '*Bandar bust. Kamu menang!*' : a > b ? '*Kamu menang!*' : a < b ? '*Bandar menang.*' : '*Seri.*') + `\n_Main lagi: ${prefix}bj_`)
          },
        }
    }

const libs = {
    style: (module) => {
        const B = (t) => String(t ?? '').replace(/[A-Za-z0-9]/g, (c) => {
            const k = c.charCodeAt(0)
            return String.fromCodePoint(k >= 97 ? 0x1D41A + k - 97 : k >= 65 ? 0x1D400 + k - 65 : 0x1D7CE + k - 48)
        })
        const plain = (t) => String(t ?? '').normalize('NFKC').replace(/[\u{13000}-\u{1342F}]/gu, '').replace(/\s+/g, ' ').trim()
        const cut = (t, n) => { const a = Array.from(String(t ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('') }
        module.exports = { B, plain, cut, fx: (t) => t, ancientize: (t) => t, content: (c) => c, on: () => false }
    },
}

dioRegister("fun/blackjack", feature, libs)

let handler = (m, ctx) => dioRun("fun/blackjack", m, ctx)

handler.command = ['blackjack', 'bj', 'stand', 'tarik']
handler.hide = ["blackjack", "tarik", "stand"]
handler.help = ["bj"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'blackjack')
