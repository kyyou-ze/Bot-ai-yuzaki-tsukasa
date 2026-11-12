import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // Hiburan ringan: roast (bercanda, tidak kasar), puji, would-you-rather, angka rahasia
        const { targets, tag } = require('../../lib/grouputil'), ST = require('../../lib/style')
        const pick = (a) => a[Math.floor(Math.random() * a.length)]
        const ROAST = ['{x} itu orangnya konsisten: konsisten bilang "sebentar lagi" padahal sudah 2 jam.', 'Baterai {x} sering habis, mirip semangat Senin pagi.', '{x} bilang mau tidur cepat, lalu scroll sampai matahari terbit.', 'Kalau kesabaran {x} diukur, hasilnya sama dengan sinyal di lift: hilang.', '{x} selalu "OTW", padahal belum mandi.', 'Kulkas {x} isinya cuma harapan dan air putih.', '{x} bisa menemukan chat lama dalam 3 detik, tapi kunci motor butuh 30 menit.', 'Notifikasi {x} lebih ramai dari kehidupan sosialnya (dan itu grup promo).', '{x} itu multitasking: panik, rebahan, dan lapar sekaligus.', 'Alarm {x} ada 9, yang bangun tetap yang ke-10: ibunya.']
        const PUJI = ['{x} itu seperti Wi-Fi gratis: bikin semua orang senang saat hadir.', '{x} punya aura yang bikin grup ini lebih hangat. Terima kasih sudah ada!', 'Kalau ada penghargaan teman terbaik, {x} sudah masuk nominasi tetap.', '{x} adalah bukti bahwa orang baik itu nyata.', 'Tawa {x} menular, dan itu aset langka.', '{x} selalu ada saat dibutuhkan. Salut!', 'Otak {x} encer, hatinya lebih encer lagi (maksudnya baik).', 'Dunia butuh lebih banyak orang seperti {x}.']
        const WYR = [['punya kemampuan terbang', 'punya kemampuan menghilang'], ['selalu telat 10 menit', 'selalu kecepatan 20 menit lebih awal'], ['makan nasi terus seumur hidup', 'makan mi terus seumur hidup'], ['tinggal di pantai', 'tinggal di pegunungan'], ['bisa baca pikiran', 'bisa melihat masa depan'], ['tidak pernah bosan', 'tidak pernah lelah'], ['liburan ke luar angkasa', 'liburan ke dasar laut'], ['jadi orang paling pintar', 'jadi orang paling beruntung'], ['hidup tanpa musik', 'hidup tanpa film'], ['bisa bicara dengan hewan', 'bisa bicara semua bahasa manusia'], ['kerja dari rumah selamanya', 'kerja sambil keliling dunia'], ['selalu hujan di akhir pekan', 'selalu panas terik di hari kerja']]
        const secret = new Map()   // chat -> { n, tries, t }

        module.exports = {
          name: 'roast', alias: ['puji', 'wyr', 'pilihan', 'angka', 'tebakangka'], category: 'fun', cmds: ['roast', 'puji', 'wyr', 'tebakangka'], noLimit: true,
          desc: 'Roast bercanda, puji, would-you-rather, dan tebak angka 1-100',
          run: async ({ sock, m, text, command, prefix, reply }) => {
            const send = (t, mentions = []) => sock.sendMessage(m.chat, { text: t, mentions }, { quoted: m })
            if (command === 'roast' || command === 'puji') {
              const t = targets(m, text)[0] || m.sender
              return send(`${ST.B(command.toUpperCase())}\n━━━━━━━━━━━━━━━━━━━━\n` + pick(command === 'roast' ? ROAST : PUJI).replace(/\{x\}/g, tag(t)) + (command === 'roast' ? '\n\n_Bercanda ya, jangan baper._' : ''), [t])
            }
            if (command === 'wyr' || command === 'pilihan') { const [a, b] = pick(WYR); return reply(`${ST.B('WOULD YOU RATHER')}\n━━━━━━━━━━━━━━━━━━━━\nPilih satu:\n\n🅰️ ${a}\n\n🅱️ ${b}\n\n_Balas A atau B beserta alasanmu!_`) }
            // tebak angka: .tebakangka (mulai) lalu .angka <n>
            const n = parseInt(text, 10), g = secret.get(m.chat)
            if (command === 'tebakangka' || !g) {
              if (command === 'angka' && !g && !Number.isNaN(n)) return reply(`Belum ada permainan. Mulai: ${prefix}tebakangka`)
              const ng = { n: 1 + Math.floor(Math.random() * 100), tries: 0 }; secret.set(m.chat, ng)
              setTimeout(() => { if (secret.get(m.chat) === ng) secret.delete(m.chat) }, 10 * 60 * 1000)
              return reply(`${ST.B('TEBAK ANGKA')}\n━━━━━━━━━━━━━━━━━━━━\nAku memilih angka 1-100.\nTebak dengan: ${prefix}angka <angka>\nWaktu 10 menit, semua anggota chat boleh menebak.`)
            }
            if (!(n >= 1 && n <= 100)) return reply(`Tebak angka 1-100: ${prefix}angka <angka>`)
            g.tries++
            if (n === g.n) { secret.delete(m.chat); return send(`Benar! Angkanya *${g.n}*. @${m.sender.split('@')[0]} menang setelah ${g.tries} tebakan.`, [m.sender]) }
            return reply(`${n} terlalu ${n < g.n ? 'KECIL ⬆️' : 'BESAR ⬇️'}  (tebakan ke-${g.tries})`)
          },
        }
    }

const libs = {
    grouputil: (module) => {
        const clean = (s) => String(s || '').replace(/[^0-9]/g, '')
        const targets = (m, text) => {
            const set = new Set()
            for (const j of m.mentionedJid || []) set.add(j)
            if (m.quoted && m.quoted.sender) set.add(m.quoted.sender)
            for (const w of String(text || '').split(/[\s,]+/)) {
                const n = clean(w)
                if (n.length >= 8 && n.length <= 15) set.add(n + '@s.whatsapp.net')
            }
            return [...set]
        }
        module.exports = { targets, tag: (jid) => '@' + String(jid).split('@')[0], clean }
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

dioRegister("fun/roast", feature, libs)

let handler = (m, ctx) => dioRun("fun/roast", m, ctx)

handler.command = ['roast', 'angka', 'pilihan', 'puji', 'tebakangka', 'wyr']
handler.hide = ["pilihan", "angka"]
handler.help = ["roast", "puji", "wyr", "tebakangka"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'roast')
