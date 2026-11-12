import { dioRegister, dioRun, dioSave, dioStore, dioWib, persist, rpgUser } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
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
    "kreasi2": (module, exports, require) => {
            const sharp = require('sharp'), crypto = require('crypto')
            const hash = (s) => parseInt(crypto.createHash('md5').update(String(s)).digest('hex').slice(0, 8), 16)
            const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
            const svgBuf = (s) => Buffer.from(s)
            const pick = (r, a) => a[Math.floor(r() * a.length)]
            async function shapesImage(n, seed) {
              const W = 900, H = 600, r = rng(hash(seed)), items = [], cols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f78c6b']
              let guard = 0
              while (items.length < n && guard++ < 6000) {
                const s = 26 + r() * 22, x = s + 10 + r() * (W - 2 * s - 20), y = s + 10 + r() * (H - 2 * s - 20)
                if (items.every(i => Math.hypot(i.x - x, i.y - y) > i.s + s + 6)) items.push({ x, y, s, k: Math.floor(r() * 3), c: pick(r, cols), rot: r() * 360 })
              }
              const sh = items.map(i => i.k === 0 ? `<circle cx="${i.x}" cy="${i.y}" r="${i.s}" fill="${i.c}"/>` : i.k === 1 ? `<rect x="${i.x - i.s * 0.85}" y="${i.y - i.s * 0.85}" width="${i.s * 1.7}" height="${i.s * 1.7}" rx="6" fill="${i.c}" transform="rotate(${i.rot} ${i.x} ${i.y})"/>` : `<polygon points="${i.x},${i.y - i.s} ${i.x + i.s},${i.y + i.s * 0.8} ${i.x - i.s},${i.y + i.s * 0.8}" fill="${i.c}" transform="rotate(${i.rot} ${i.x} ${i.y})"/>`).join('')
              return { buf: await sharp(svgBuf(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f7f4ea"/>${sh}<rect x="3" y="3" width="${W - 6}" height="${H - 6}" fill="none" stroke="#2b2b2b" stroke-width="6"/></svg>`)).png().toBuffer(), count: items.length }
            }
            module.exports = { shapesImage }
        }
}

const feature = (module, exports, require) => {
        // .hitungbenda — bot menggambar bentuk warna-warni acak; hitung jumlah semuanya, ketik angkanya. Yang pertama tepat menang.
        //   .hitungbenda nyerah
        const K2 = require('../../lib/kreasi2'), E = require('../../lib/ekstra'), R = require('../../lib/rpg'), ST = require('../../lib/style')
        const games = new Map()
        const stop = (c) => { const g = games.get(c); if (g) clearTimeout(g.timer); games.delete(c) }

        module.exports = {
          name: 'hitungbenda', alias: ['hitunggambar', 'countgame', 'berapabenda'], category: 'fun', cmds: ['hitungbenda'],
          desc: 'Hitung jumlah bentuk di gambar acak buatan bot (menang dapat skor dan Money)',
          run: async ({ sock, m, args, reply, prefix }) => {
            const g = games.get(m.chat)
            if (String(args[0] || '').toLowerCase() === 'nyerah') { if (!g) return reply('Tidak ada soal yang berjalan.'); stop(m.chat); return reply(`Menyerah? Jumlahnya *${g.n}*`) }
            if (g) return reply(`Masih ada soal yang berjalan. Ketik angkanya, atau ${prefix}hitungbenda nyerah`)
            const lvl = ['mudah', 'sedang', 'sulit'].indexOf(String(args[0] || '').toLowerCase()), n0 = [12, 20, 32][lvl < 0 ? 1 : lvl]
            const want = n0 + Math.floor(Math.random() * 6), { buf, count } = await K2.shapesImage(want, String(Date.now()))
            const ng = { n: count }
            ng.timer = setTimeout(() => { if (games.get(m.chat) === ng) { games.delete(m.chat); sock.sendMessage(m.chat, { text: `Waktu habis! Jumlahnya *${ng.n}*` }).catch(() => {}) } }, 45000)
            games.set(m.chat, ng)
            await sock.sendMessage(m.chat, { image: buf, caption: `${ST.B('HITUNG BENDA')}\n━━━━━━━━━━━━━━━━━━━━\nAda berapa bentuk (lingkaran, kotak, segitiga) di gambar ini?\nKetik angkanya saja.\n\nWaktu 45 detik  •  Hadiah 100 gold + 10 poin\n_Tingkat: ${prefix}hitungbenda mudah|sedang|sulit_` }, { quoted: m })
          },
          before: async ({ sock, m, budy }) => {
            const g = games.get(m.chat); if (!g || !budy || !/^\d{1,3}$/.test(budy.trim())) return false
            if (parseInt(budy, 10) !== g.n) return false
            stop(m.chat)
            E.addScore(m.sender, m.pushName, 10, 'hitungbenda')
            const u = R.get(m.sender); let bonus = ''
            if (u) { const got = R.addGold(u, 100); R.save(); bonus = `\n+${R.fmt(got)} Money` }
            await sock.sendMessage(m.chat, { text: `Benar! @${m.sender.split('@')[0]} menghitung *${g.n}* bentuk.\n+10 poin game${bonus}`, mentions: [m.sender] }, { quoted: m })
            return true
          },
        }
    }

dioRegister("fun/hitungbenda", feature, libs)

let handler = (m, ctx) => dioRun("fun/hitungbenda", m, ctx)

handler.command = ['hitungbenda', 'berapabenda', 'countgame', 'hitunggambar']
handler.hide = ["hitunggambar", "countgame", "berapabenda"]
handler.help = ["hitungbenda"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'hitungbenda', { subs: false })
