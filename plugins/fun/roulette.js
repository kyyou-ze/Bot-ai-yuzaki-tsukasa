import { dioRegister, dioRun, dioSave, dioStore } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .roulette — roulette peluru kosplay (aman, hanya permainan): 6 ruang, 1 peluru; yang kena tersingkir. Penyintas terakhir menang.
        //   .roulette           buka lobi / ikut     .roulette mulai   mulai (min. 2 pemain, oleh pembuka lobi atau admin)
        //   .tembak             tarik pelatuk saat gilanmu (45 detik, lewat waktu = tersingkir)     .roulette batal   bubarkan
        const E = require('../../lib/ekstra'), { B } = require('../../lib/style')
        const games = new Map()
        const tag = (j) => '@' + j.split('@')[0]
        const say = (sock, chat, g, text) => sock.sendMessage(chat, { text, mentions: g.players }).catch(() => {})
        function end(chat) { const g = games.get(chat); if (g) clearTimeout(g.tm); games.delete(chat) }
        function turn(sock, chat) {
          const g = games.get(chat); if (!g) return
          if (g.alive.length === 1) { const w = g.alive[0], sc = E.addScore(w, g.names[w], 10 + 2 * g.players.length, 'roulette'); say(sock, chat, g, `𓋹 ${tag(w)} penyintas terakhir! +${10 + 2 * g.players.length} poin (total ${sc.pts})`); return end(chat) }
          clearTimeout(g.tm); g.cur = g.cur % g.alive.length
          say(sock, chat, g, `Giliran ${tag(g.alive[g.cur])} — ketik *.tembak* (45 detik)\nSisa: ${g.alive.map(tag).join(', ')}`)
          g.tm = setTimeout(() => { const x = games.get(chat); if (x !== g) return; const p = g.alive[g.cur]; say(sock, chat, g, `${tag(p)} membeku kehabisan waktu dan tersingkir.`); g.alive.splice(g.cur, 1); g.pos = Math.floor(Math.random() * 6); g.n = 0; turn(sock, chat) }, 45000)
        }
        module.exports = {
          name: 'roulette', alias: ['tembak', 'rr'], category: 'fun', group: true, noLimit: true, cmds: ['roulette', 'tembak'],
          desc: 'Roulette peluru (permainan grup): .roulette • .roulette mulai • .tembak',
          run: async ({ sock, m, command, args, prefix, reply, isAdmins, isOwner }) => {
            const g = games.get(m.chat), sub = (args[0] || '').toLowerCase()
            if (command === 'tembak') {
              if (!g || !g.started) return reply(`Tidak ada permainan berjalan. Buka lobi: ${prefix}roulette`)
              if (g.alive[g.cur] !== m.sender) return reply(g.alive.includes(m.sender) ? `Bukan gilamu. Sekarang giliran ${tag(g.alive[g.cur])}.` : 'Kamu sudah tersingkir / tidak ikut.')
              clearTimeout(g.tm)
              if (g.n === g.pos) { say(sock, m.chat, g, `💥 DOR! ${tag(m.sender)} tersingkir.`); g.alive.splice(g.cur, 1); g.pos = Math.floor(Math.random() * 6); g.n = 0 }
              else { g.n++; say(sock, m.chat, g, `*klik.* ${tag(m.sender)} selamat. (ruang ${g.n}/6)`); g.cur++ }
              return turn(sock, m.chat)
            }
            if (sub === 'batal') { if (!g) return reply('Tidak ada lobi.'); if (g.owner !== m.sender && !isAdmins && !isOwner) return reply('Hanya pembuka lobi / admin.'); end(m.chat); return reply('Permainan dibubarkan.') }
            if (sub === 'mulai') {
              if (!g || g.started) return reply(g ? 'Permainan sudah berjalan.' : `Belum ada lobi. Buka dengan ${prefix}roulette`)
              if (g.owner !== m.sender && !isAdmins && !isOwner) return reply('Hanya pembuka lobi / admin yang bisa memulai.')
              if (g.players.length < 2) return reply('Minimal 2 pemain.')
              g.started = true; g.alive = [...g.players].sort(() => Math.random() - 0.5); g.cur = 0; g.pos = Math.floor(Math.random() * 6); g.n = 0
              await say(sock, m.chat, g, `${B('ROULETTE')}\nPermainan dimulai! ${g.players.length} pemain.\nGiliran acak. Hanya permainan, tidak ada konsekuensi nyata.`)
              return turn(sock, m.chat)
            }
            if (g && g.started) return reply('Permainan sedang berjalan.')
            if (!g) {
              const ng = { owner: m.sender, players: [m.sender], names: { [m.sender]: m.pushName }, started: false }
              ng.tm = setTimeout(() => { if (games.get(m.chat) === ng && !ng.started) { games.delete(m.chat); sock.sendMessage(m.chat, { text: 'Lobi roulette kedaluwarsa.' }).catch(() => {}) } }, 180000)
              games.set(m.chat, ng); return say(sock, m.chat, ng, `${B('ROULETTE')}\nLobi dibuka oleh ${tag(m.sender)}.\nIkut: *${prefix}roulette* • Mulai: *${prefix}roulette mulai* (min. 2 pemain, lobi 3 menit)`)
            }
            if (g.players.includes(m.sender)) return reply('Kamu sudah di lobi.')
            if (g.players.length >= 8) return reply('Lobi penuh (maks 8).')
            g.players.push(m.sender); g.names[m.sender] = m.pushName
            return say(sock, m.chat, g, `${tag(m.sender)} bergabung. Pemain: ${g.players.length}`)
          },
        }
    }

const libs = {
    "ekstra": (module, exports, require) => {
        // Pembantu fitur Ekstra: skor game global, acak, normalisasi teks, jam WIB
        const K = require('./praktis')
        const rnd = (a) => a[Math.floor(Math.random() * a.length)]
        const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
        const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
        const hourWIB = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date())) % 24
        const timeWIB = (t = Date.now()) => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t)).replace('.', ':')

        // skor game dipakai bersama (anagram, kuis, mathrush, sambungkata) -> .topgame
        function addScore(jid, name, pts, game) {
          const g = K.get(jid, 'game', { pts: 0, win: 0, by: {} })
          g.pts += pts; g.win += 1; g.name = name || g.name || String(jid).split('@')[0]; g.by = g.by || {}; g.by[game] = (g.by[game] || 0) + 1
          K.set(jid, 'game', g); return g
        }
        const top = (n = 10) => Object.entries(K.all()).filter(([, v]) => v && v.game && v.game.pts > 0).map(([jid, v]) => ({ jid, ...v.game })).sort((a, b) => b.pts - a.pts).slice(0, n)
        const medal = (i) => ['𝐈', '𝐈𝐈', '𝐈𝐈𝐈'][i] || `${i + 1}.`
        const num = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : NaN }
        const isAdmin = (c) => c.isAdmins || c.isCreator || c.m.key.fromMe
        module.exports = { rnd, shuffle, norm, hourWIB, timeWIB, addScore, top, medal, num, isAdmin }
    },
    praktis: (module) => {
        const get = (jid, key, fb) => { const d = dioStore().praktis[jid]; return d && d[key] !== undefined ? d[key] : fb }
        const set = (jid, key, val) => { const s = dioStore().praktis; (s[jid] ||= {})[key] = val; dioSave(); return val }
        const all = () => dioStore().praktis
        const TZ = 'Asia/Jakarta'
        const dayKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
        const addDays = (k, n) => { const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
        const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        const fmtTanggal = (k) => { const d = new Date(k + 'T00:00:00Z'); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
        const rupiah = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID')
        const bar = (f, len = 10) => { const on = Math.round(Math.max(0, Math.min(1, f)) * len); return '█'.repeat(on) + '░'.repeat(len - on) }
        const quotedText = (m) => ((m.quoted && (m.quoted.text || m.quoted.caption)) || '').trim()
        const mentions = (m) => [...new Set([...(m.msg?.contextInfo?.mentionedJid || []), ...(m.mentionedJid || [])])]
        module.exports = { get, set, all, dayKey, addDays, fmtTanggal, rupiah, bar, quotedText, mentions, BULAN, HARI }
    },
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

dioRegister("fun/roulette", feature, libs)

let handler = (m, ctx) => dioRun("fun/roulette", m, ctx)

handler.command = ['roulette', 'rr', 'tembak']
handler.hide = ["rr"]
handler.help = ["roulette", "tembak"]
handler.tags = ['fun']
handler.group = true

const __plugin = handler

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'roulette')
