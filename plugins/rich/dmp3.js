import { dioRun, dioRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
// .dmp3 <no|judul|acak> — kirim lagu Kaguya Musik langsung sebagai pesan audio (tanpa kartu HTML)
//   .dmp3 1 5 9      -> beberapa lagu sekaligus (maksimal 3)
//   .dmp3 fav        -> kirim satu lagu acak dari favoritmu
const M = require('../live/musikbot').M, ST = require('../../lib/style')
const busy = new Set()
module.exports = {
  name: 'dmp3', alias: [], category: 'rich', cmds: ['dmp3'],
  desc: 'Kirim lagu musik sebagai audio: .dmp3 <no|judul|acak|fav> (bisa beberapa nomor)',
  run: async ({ sock, m, text, args, prefix, reply }) => {
    const tracks = await M.getTracks()
    if (!tracks.length) return reply('Belum ada lagu terbaca dari Google Drive.')
    const q = text.trim()
    if (!q) return reply(`Format: ${prefix}dmp3 <no|judul|acak|fav>\nBeberapa sekaligus: ${prefix}dmp3 1 5 9\nLihat daftar: ${prefix}musikbot list`)
    let picks = []
    if (/^(acak|random)$/i.test(q)) picks = [tracks[Math.floor(Math.random() * tracks.length)]]
    else if (/^(fav|favorit)$/i.test(q)) {
      const f = M.favs(m.sender).map(id => tracks.find(t => t.id === id)).filter(Boolean)
      if (!f.length) return reply(`Favoritmu masih kosong. Tambah: ${prefix}musikbot fav <no>`)
      picks = [f[Math.floor(Math.random() * f.length)]]
    } else if (args.length > 1 && args.every(a => /^\d+$/.test(a))) picks = [...new Set(args.map(a => M.find(tracks, a)).filter(Boolean))].slice(0, 3)
    else { const t = M.find(tracks, q); if (t) picks = [t] }
    if (!picks.length) return reply(`Lagu "${ST.cut(q, 40)}" tidak ditemukan.`)
    if (busy.has(m.sender)) return reply('Masih menyiapkan lagumu, tunggu sebentar ya.')
    busy.add(m.sender)
    try {
      for (const t of picks) {
        await reply(`Menyiapkan: ${ST.cut(t.artist + ' - ' + t.title, 60)} ...`)
        const ok = await require('../live/musikbot').sendAudio(sock, m, t, reply)
        if (ok) M.countPlay(m.sender, t.id)
      }
    } finally { busy.delete(m.sender) }
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

dioRegister("rich/dmp3", feature, libs)

let handler = (m, ctx) => dioRun("rich/dmp3", m, ctx)

handler.command = ['dmp3']
handler.help = ['dmp3']
handler.tags = ['rich']

export default handler
