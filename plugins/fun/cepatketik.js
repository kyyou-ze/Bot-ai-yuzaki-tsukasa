import { dioRegister, dioRun, dioSave, dioStore, dioWib, persist, rpgUser } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .cepatketik — bot mengirim kalimat; orang pertama yang mengetik PERSIS sama menang. Waktu dan kecepatan (kata per menit) dicatat.
        //   .cepatketik [mudah|sedang|sulit]   .cepatketik nyerah
        const E = require('../../lib/ekstra'), R = require('../../lib/rpg'), ST = require('../../lib/style')
        const SENT = {
          mudah: ['kucing duduk di atas meja', 'hari ini cuaca sangat cerah', 'saya suka makan nasi goreng', 'adik bermain bola di lapangan', 'ibu membeli sayur di pasar', 'burung terbang tinggi di langit'],
          sedang: ['bot kaguya siap melayani semua perintahmu', 'kecepatan mengetik melatih ketelitian jari', 'matahari terbit dari timur dan terbenam di barat', 'belajar sedikit setiap hari lebih baik daripada sekaligus', 'kopi hangat menemani malam yang panjang', 'jangan menunda pekerjaan yang bisa selesai sekarang'],
          sulit: ['pak budi berangkat ke bandung naik kereta api pukul enam pagi', 'seekor kelinci putih melompati pagar kayu sambil membawa tiga wortel', 'keberhasilan adalah hasil dari kerja keras, ketekunan, dan doa', 'dalam keheningan malam, terdengar suara jangkrik dari kejauhan', 'perjalanan seribu mil dimulai dari satu langkah kecil'],
        }
        const games = new Map()
        const stop = (c) => { const g = games.get(c); if (g) clearTimeout(g.timer); games.delete(c) }
        const same = (a, b) => String(a).trim().toLowerCase().replace(/\s+/g, ' ') === String(b).trim().toLowerCase().replace(/\s+/g, ' ')

        module.exports = {
          name: 'cepatketik', alias: ['typerace', 'ketikcepat', 'adumengetik'], category: 'fun', cmds: ['cepatketik'],
          desc: 'Adu cepat mengetik kalimat dari bot; yang pertama persis sama menang (mudah/sedang/sulit)',
          run: async ({ sock, m, args, reply, prefix }) => {
            const sub = String(args[0] || '').toLowerCase(), g = games.get(m.chat)
            if (sub === 'nyerah') { if (!g) return reply('Tidak ada soal yang berjalan.'); stop(m.chat); return reply('Dibatalkan. Tidak ada pemenang.') }
            if (g) return reply(`Masih ada soal yang berjalan. Ketik kalimatnya, atau ${prefix}cepatketik nyerah`)
            const lvl = SENT[sub] ? sub : 'sedang', s = E.rnd(SENT[lvl]), ng = { s, lvl, t0: 0 }
            games.set(m.chat, ng)
            await sock.sendMessage(m.chat, { text: `${ST.B('CEPAT KETIK')} (${lvl})\n━━━━━━━━━━━━━━━━━━━━\nOrang pertama yang mengetik kalimat ini PERSIS sama menang. Huruf besar-kecil boleh bebas.\n\n> ${s}\n\nWaktu 60 detik  •  Poin ${{ mudah: 5, sedang: 10, sulit: 15 }[lvl]}\n_Tingkat: ${prefix}cepatketik mudah|sedang|sulit_` }, { quoted: m })
            ng.t0 = Date.now()
            ng.timer = setTimeout(() => { if (games.get(m.chat) === ng) { games.delete(m.chat); sock.sendMessage(m.chat, { text: 'Waktu habis! Tidak ada yang berhasil.' }).catch(() => {}) } }, 60000)
          },
          before: async ({ sock, m, budy }) => {
            const g = games.get(m.chat); if (!g || !g.t0 || !budy || !same(budy, g.s)) return false
            const sec = Math.max(0.5, (Date.now() - g.t0) / 1000)
            stop(m.chat)
            const wpm = Math.round((g.s.split(' ').length / sec) * 60), pts = { mudah: 5, sedang: 10, sulit: 15 }[g.lvl]
            E.addScore(m.sender, m.pushName, pts, 'cepatketik')
            const u = R.get(m.sender); let bonus = ''
            if (u) { const got = R.addGold(u, pts * 10); R.save(); bonus = `\n+${R.fmt(got)} Money` }
            await sock.sendMessage(m.chat, { text: `Selesai! @${m.sender.split('@')[0]} menang dalam *${sec.toFixed(1)} detik* (${wpm} kata/menit)\n+${pts} poin game${bonus}`, mentions: [m.sender] }, { quoted: m })
            return true
          },
        }
    }

const libs = {
    rpg: (module) => {
        const fmt = (n) => Math.floor(n).toLocaleString('id-ID')
        const user = (jid) => rpgUser(jid)
        module.exports = {
            fmt, today: dioWib, save: () => persist(),
            get: (jid) => (jid ? user(jid) : null),
            addGold: (u, n) => { const v = Math.floor(Number(n) || 0); u.money = (Number(u.money) || 0) + v; return v },
            addExp: (u, n) => { const v = Math.floor(Number(n) || 0); u.exp = (Number(u.exp) || 0) + v; return { amt: v, up: false, lvl: u.level || 1 } }
        }
    },
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

dioRegister("fun/cepatketik", feature, libs)

let handler = (m, ctx) => dioRun("fun/cepatketik", m, ctx)

handler.command = ['cepatketik', 'adumengetik', 'ketikcepat', 'typerace']
handler.hide = ["typerace", "ketikcepat", "adumengetik"]
handler.help = ["cepatketik"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'cepatketik', { subs: false })
