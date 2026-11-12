import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .kapal  Kapal Perang vs bot, papan 7x7. Tembak: .kapal <kolom A-G><baris 1-7>, contoh .kapal C4
        const { B } = require('../../lib/style')
        const games = new Map(), TTL = 45 * 60 * 1000, N = 7, FLEET = [4, 3, 3, 2], COL = 'ABCDEFG'
        const rnd = (n) => Math.floor(Math.random() * n)
        function place() {
          const occ = Array(N * N).fill(-1), ships = []
          FLEET.forEach((len, id) => {
            for (let tries = 0; tries < 500; tries++) {
              const h = Math.random() < 0.5, r = rnd(h ? N : N - len + 1), c = rnd(h ? N - len + 1 : N), cells = Array.from({ length: len }, (_, k) => (h ? r * N + c + k : (r + k) * N + c))
              if (cells.every(i => occ[i] < 0)) { cells.forEach(i => (occ[i] = id)); ships.push({ id, len, cells }); return }
            }
            throw new Error('gagal menempatkan kapal')
          })
          return { occ, ships }
        }
        const sunk = (f, shots) => f.ships.filter(s => s.cells.every(i => shots.has(i)))
        const done = (f, shots) => sunk(f, shots).length === f.ships.length
        function botPick(g) {
          const hits = [...g.botShots].filter(i => g.mine.occ[i] >= 0 && !sunk(g.mine, g.botShots).some(s => s.cells.includes(i)))
          const cand = new Set(); for (const i of hits) { const r = (i / N) | 0, c = i % N; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N && !g.botShots.has(rr * N + cc)) cand.add(rr * N + cc) } }
          if (cand.size) { const a = [...cand]; return a[rnd(a.length)] }
          const free = []; for (let i = 0; i < N * N; i++) if (!g.botShots.has(i) && ((i / N | 0) + i % N) % 2 === 0) free.push(i)   // pola papan catur
          const any = free.length ? free : [...Array(N * N).keys()].filter(i => !g.botShots.has(i)); return any[rnd(any.length)]
        }
        function board(f, shots, showShips) {
          const L = ['  ' + COL.split('').join(' ')]
          for (let r = 0; r < N; r++) { let row = `${r + 1} `; for (let c = 0; c < N; c++) { const i = r * N + c, hit = shots.has(i), ship = f.occ[i] >= 0; row += (hit ? (ship ? 'X' : 'o') : showShips && ship ? '#' : '.') + ' ' } L.push(row.trimEnd()) }
          return L.join('\n')
        }
        const view = (g) => '```\nPAPAN LAWAN (tembakanmu)\n' + board(g.enemy, g.myShots, false) + '\n\nARMADAMU (tembakan bot)\n' + board(g.mine, g.botShots, true) + '\n```\n_X kena • o meleset • # kapalmu_'
        const parse = (s) => { const m = String(s || '').toUpperCase().match(/^([A-G])([1-7])$/); return m ? (+m[2] - 1) * N + COL.indexOf(m[1]) : -1 }
        const name = (i) => COL[i % N] + ((i / N | 0) + 1)
        function shoot(f, shots, i) { shots.add(i); const hit = f.occ[i] >= 0, s = hit ? f.ships.find(x => x.id === f.occ[i]) : null; return { hit, sunk: !!(s && s.cells.every(k => shots.has(k))), len: s && s.len } }
        module.exports = {
          name: 'kapal', alias: ['kapalperang', 'battleship'], category: 'fun', noLimit: true, cmds: ['kapal'],
          desc: 'Kapal Perang vs bot di papan 7x7: tenggelamkan 4 kapal lawan sebelum armadamu habis',
          place, botPick, board, shoot, parse, done, games,
          run: async ({ m, args, prefix, reply }) => {
            const key = m.chat + '|' + m.sender, a = String(args[0] || '').toLowerCase(), p = prefix + 'kapal'; let g = games.get(key); if (g && Date.now() - g.t > TTL) { games.delete(key); g = null }
            if (a === 'stop' || a === 'nyerah') { if (!g) return reply('Tidak ada permainan.'); games.delete(key); return reply('Permainan dihentikan. Posisi kapal bot:\n```\n' + board(g.enemy, new Set(), true) + '\n```') }
            if (!g || a === 'baru' || a === 'mulai') {
              if (g && a !== 'baru' && a !== 'mulai') return reply(view(g))
              g = { enemy: place(), mine: place(), myShots: new Set(), botShots: new Set(), t: Date.now() }; games.set(key, g)
              return reply(`𓂀 ${B('KAPAL PERANG')}\nMasing-masing punya 4 kapal (panjang 4, 3, 3, 2). Tenggelamkan semua kapal bot lebih dulu.\n${view(g)}\nTembak: ${p} <kolom><baris>   contoh ${p} C4`)
            }
            const i = parse(args[0]); if (i < 0) return reply(`Koordinat tidak valid. Pakai kolom A-G dan baris 1-7, mis. ${p} C4\n${view(g)}`)
            if (g.myShots.has(i)) return reply(`${name(i)} sudah pernah ditembak. Pilih kotak lain.`)
            g.t = Date.now(); const me = shoot(g.enemy, g.myShots, i); let t = `Tembakanmu ${name(i)}: ${me.sunk ? `KENA dan kapal (panjang ${me.len}) TENGGELAM` : me.hit ? 'KENA' : 'meleset'}.\n`
            if (done(g.enemy, g.myShots)) { games.delete(key); return reply(`${t}𓂀 ${B('KAMU MENANG')}! Semua kapal bot tenggelam dalam ${g.myShots.size} tembakan.`) }
            const bi = botPick(g), bt = shoot(g.mine, g.botShots, bi); t += `Bot menembak ${name(bi)}: ${bt.sunk ? `KENA, kapalmu (panjang ${bt.len}) tenggelam` : bt.hit ? 'KENA' : 'meleset'}.\n`
            if (done(g.mine, g.botShots)) { games.delete(key); return reply(`${t}${view(g)}\n𓂀 ${B('BOT MENANG')}. Armadamu habis. Coba lagi: ${p} baru`) }
            return reply(t + view(g))
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

dioRegister("fun/kapal", feature, libs)

let handler = (m, ctx) => dioRun("fun/kapal", m, ctx)

handler.command = ['kapal', 'battleship', 'kapalperang']
handler.hide = ["kapalperang", "battleship"]
handler.help = ["kapal"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'kapal', { subs: false })
