import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .nim — permainan Nim melawan bot: ambil benda dari satu tumpukan, yang mengambil terakhir menang
        const { B } = require('../../lib/style')
        const games = new Map(), TTL = 30 * 60 * 1000
        const show = (h) => '```\n' + h.map((n, i) => `${i + 1}: ${'●'.repeat(n) || '—'} (${n})`).join('\n') + '\n```'
        function botMove(h, easy) {
          const x = h.reduce((a, b) => a ^ b, 0), live = h.map((n, i) => [n, i]).filter(([n]) => n > 0)
          if (x && !(easy && Math.random() < 0.4)) for (const [n, i] of live) { const t = n ^ x; if (t < n) return [i, n - t] }
          const [n, i] = live[Math.floor(Math.random() * live.length)]; return [i, 1 + Math.floor(Math.random() * n)]
        }
        module.exports = {
          name: 'nim', alias: ['gamenim', 'ambilbatu'], category: 'fun', noLimit: true, cmds: ['nim'],
          desc: 'Game Nim vs bot: ambil dari satu tumpukan, pengambil terakhir menang',
          run: async ({ m, args, prefix, reply }) => {
            const key = m.chat + '|' + m.sender, a = String(args[0] || '').toLowerCase(); let g = games.get(key); if (g && Date.now() - g.t > TTL) { games.delete(key); g = null }
            if (a === 'stop') { games.delete(key); return reply('Permainan Nim dihentikan.') }
            if (!g || a === 'mudah' || a === 'sulit' || a === 'baru') {
              if (g && !['mudah', 'sulit', 'baru'].includes(a)) return reply('✕ Gunakan nim <tumpukan> <jumlah>')
              const easy = a !== 'sulit', h = [3, 5, 7]; games.set(key, { h, easy, t: Date.now() })
              return reply(`𓂀 ${B('NIM')} — ${easy ? 'mudah' : 'sulit'}\n${show(h)}Ambil sebanyak apa pun dari SATU tumpukan. Yang mengambil benda terakhir menang.\nGiliranmu: ${prefix}nim <tumpukan> <jumlah>   contoh ${prefix}nim 3 2\n_${prefix}nim sulit untuk bot yang bermain sempurna._`)
            }
            const i = parseInt(args[0], 10) - 1, n = parseInt(args[1], 10)
            if (!(i >= 0 && i < g.h.length) || !(n >= 1) || n > g.h[i]) return reply(`✕ Gerakan tidak sah.\n${show(g.h)}Format: ${prefix}nim <tumpukan> <jumlah> (jumlah ≤ isi tumpukan)`)
            g.h[i] -= n; g.t = Date.now()
            if (g.h.every(x => !x)) { games.delete(key); return reply(`${show(g.h)}𓋹 ${B('KAMU MENANG!')} Kamu mengambil yang terakhir.`) }
            const [bi, bn] = botMove(g.h, g.easy); g.h[bi] -= bn
            if (g.h.every(x => !x)) { games.delete(key); return reply(`Bot mengambil ${bn} dari tumpukan ${bi + 1}.\n${show(g.h)}𓆗 ${B('BOT MENANG.')} Coba lagi: ${prefix}nim`) }
            return reply(`Bot mengambil ${bn} dari tumpukan ${bi + 1}.\n${show(g.h)}Giliranmu.`)
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

dioRegister("fun/nim", feature, libs)

let handler = (m, ctx) => dioRun("fun/nim", m, ctx)

handler.command = ['nim', 'ambilbatu', 'gamenim']
handler.hide = ["gamenim", "ambilbatu"]
handler.help = ["nim"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'nim', { subs: false })
