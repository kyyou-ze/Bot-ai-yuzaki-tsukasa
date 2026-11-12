import { dioRegister, dioRun, dioSave, dioStore } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .hilo — Hi-Lo kartu: tebak kartu berikutnya lebih TINGGI atau lebih RENDAH. Tiap tebakan benar menambah streak.
        //   .hilo            mulai   •  jawab langsung: tinggi / rendah   •  .hiloambil  bank poin (= streak)   •  .hilostop  menyerah
        // Salah tebak = streak hangus. Kartu sama = seri (kartu baru). Poin masuk .topgame. 90 detik tanpa jawaban = berakhir.
        const E = require('../../lib/ekstra'), { B } = require('../../lib/style')
        const games = new Map()
        const RANK = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'], SUIT = ['♠', '♥', '♦', '♣']
        const draw = () => ({ r: Math.floor(Math.random() * 13), s: SUIT[Math.floor(Math.random() * 4)] })
        const show = (c) => `[ ${RANK[c.r]}${c.s} ]`
        const kill = (k) => { const g = games.get(k); if (g) clearTimeout(g.tm); games.delete(k) }
        const arm = (sock, chat, k) => { const g = games.get(k); clearTimeout(g.tm); g.tm = setTimeout(() => { if (games.get(k) === g) { games.delete(k); sock.sendMessage(chat, { text: `Hi-Lo berakhir (tidak ada jawaban). Streak ${g.streak} hangus.` }).catch(() => {}) } }, 90000) }
        const ANS = { tinggi: 1, atas: 1, naik: 1, high: 1, higher: 1, 'lebih tinggi': 1, rendah: -1, bawah: -1, turun: -1, low: -1, lower: -1, 'lebih rendah': -1 }
        module.exports = {
          name: 'hilo', alias: ['hiloambil', 'hilostop', 'higherlower'], category: 'fun', noLimit: true, cmds: ['hilo', 'hiloambil', 'hilostop'],
          desc: 'Hi-Lo kartu: tebak tinggi/rendah, kumpulkan streak (.hilo, .hiloambil, .hilostop)',
          run: async ({ sock, m, command, reply, prefix }) => {
            const k = m.chat + '|' + m.sender, g = games.get(k)
            if (command === 'hiloambil') {
              if (!g) return reply(`Tidak ada permainan. Mulai: ${prefix}hilo`)
              if (!g.streak) return reply('Streak masih 0, tebak dulu satu kartu.')
              kill(k); const sc = E.addScore(m.sender, m.pushName, g.streak, 'hilo')
              return reply(`𓋹 Poin diambil! Streak *${g.streak}* → +${g.streak} poin (total ${sc.pts})`)
            }
            if (command === 'hilostop') { if (!g) return reply('Tidak ada permainan.'); kill(k); return reply(`Menyerah. Streak ${g.streak} hangus.`) }
            if (g) return reply(`${B('HI-LO')}\nKartu sekarang ${show(g.card)}  •  streak *${g.streak}*\nJawab: *tinggi* atau *rendah*`)
            const ng = { card: draw(), streak: 0 }; games.set(k, ng); arm(sock, m.chat, k)
            return reply(`${B('HI-LO')} • ${m.pushName || 'Pemain'}\n━━━━━━━━━━━━━━━━━━━━\nKartu sekarang ${show(ng.card)}\nBerikutnya lebih *tinggi* atau *rendah*?\n\n_2 terendah, A tertinggi • ${prefix}hiloambil untuk bank poin_`)
          },
          before: async ({ sock, m, budy, reply }) => {
            const k = m.chat + '|' + m.sender, g = games.get(k); if (!g || !budy) return false
            const guess = ANS[budy.trim().toLowerCase()]; if (!guess) return false
            const nx = draw()
            if (nx.r === g.card.r) { g.card = nx; arm(sock, m.chat, k); await reply(`Seri! Kartu baru ${show(nx)}. Tebak lagi: *tinggi* / *rendah*`); return true }
            if ((nx.r > g.card.r ? 1 : -1) === guess) {
              g.streak++; const prev = g.card; g.card = nx; arm(sock, m.chat, k)
              await reply(`𓋹 Benar! ${show(prev)} → ${show(nx)}\nStreak *${g.streak}*\nLanjut (*tinggi*/*rendah*) atau *.hiloambil* untuk ambil ${g.streak} poin.`); return true
            }
            kill(k); await reply(`✕ Salah! ${show(g.card)} → ${show(nx)}\nStreak ${g.streak} hangus. Main lagi: .hilo`); return true
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

dioRegister("fun/hilo", feature, libs)

let handler = (m, ctx) => dioRun("fun/hilo", m, ctx)

handler.command = ['hilo', 'higherlower', 'hiloambil', 'hilostop']
handler.hide = ["higherlower"]
handler.help = ["hilo", "hiloambil", "hilostop"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'hilo')
