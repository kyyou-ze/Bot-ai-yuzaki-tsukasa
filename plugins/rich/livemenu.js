import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
// Daftar semua kartu live (versi Kaguya: daftar statis, tidak membaca pluginloader Kaguya)
const { B } = require('../../lib/style')
const ITEMS = [
      ["breakout", "Breakout: pecahkan bata, 3 nyawa, level makin sulit"],
      ["calcx", "Kalkulator dasar & sains, hasil langsung, memori, riwayat"],
      ["catatan", "To-do list + catatan cepat"],
      ["destroy", "Destroy Any Website: demo hancurkan situs pixel di chat (pistol, shotgun, granat) + tombol buka game aslinya"],
      ["dinorun", "Dino Run: lompati kaktus dan burung, makin lama makin cepat"],
      ["isekai", "RPG isekai ala anime: tombol arah, kota, guild, toko, penginapan, hutan, gua, dan bos Naga Api (progres tersimpan)"],
      ["musikbot", "Pemutar musik: kartu playlist, cari, acak, favorit, top, lanjut + kirim audio"],
      ["dmp3", "Kirim lagu musik sebagai audio: .dmp3 <no|judul|acak|fav> (bisa beberapa nomor)"],
      ["flappy", "Flappy Bird: tap untuk lompat, skor terbaik tersimpan"],
      ["game", "2048, Snake, XO lawan bot, Tebak Angka"],
      ["games", "Arcade mini: Dino Runner, Tic Tac Toe, Doom, Flappy, Slot dalam satu kartu"],
      ["generator", "Generator password, palet warna, lempar dadu & koin"],
      ["geodash", "Geo Dash v2: portal pesawat/bola/UFO/wave, 3 level + musik"],
      ["igstalkx", "Stalk profil Instagram: kartu live, analisis, isi bio, foto HD, banding 2 akun"],
      ["konverter", "Konverter satuan: panjang, berat, volume, suhu, dll"],
      ["memory", "Game cocokkan kartu 3 level + rekor"],
      ["mines", "Minesweeper 3 level, mode bendera, timer & rekor"],
      ["paint", "Papan gambar: pensil, hapus, isi warna, undo"],
      ["piano", "Piano 2 oktaf: suara, rekam & putar, lagu demo"],
      ["pinx", "Cari & lihat gambar/video Pinterest langsung di dalam kartu WhatsApp"],
      ["pomox", "Pomodoro: timer fokus & istirahat dengan cincin progres dan hitungan sesi"],
      ["roda", "Roda putar pilihan sendiri: makan apa, truth or dare, undian"],
      ["spotifyx", "Cari & putar lagu Spotify + Dengerin Bareng langsung di dalam kartu WhatsApp"],
      ["tetris", "Tetris: tombol kontrol layar, ghost piece, level naik, skor terbaik tersimpan"],
      ["tools", "Timer, stopwatch, harga jual, diskon"],
      ["typing", "Tes kecepatan mengetik (WPM & akurasi), mode 30/60 detik"],
      ["wordle", "Tebak kata 5 huruf bahasa Indonesia, kata harian & acak"],
      ["yt", "Cari & putar video YouTube langsung di dalam kartu WhatsApp"]
]

module.exports = {
  name: 'cardmenu',
  alias: [],
  category: 'rich',
  desc: 'Daftar semua kartu HTML live',
  run: async ({ reply, prefix }) => {
    const list = ITEMS.map(([n, d]) => `𓏏 *${prefix}${n}*\n    ${d}`).join('\n')
    reply(`${global.namebot || 'Kaguya'}\n${B('LIVE CARD')}\n━━━━━━━━━━━━━━━━━━━━\n\n${list}\n\n_Total ${ITEMS.length} kartu, jalan langsung di dalam chat._`)
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

dioRegister("rich/livemenu", feature, libs)

let handler = (m, ctx) => dioRun("rich/livemenu", m, ctx)

handler.command = ['cardmenu']
handler.help = ['cardmenu']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'livemenu', { subs: false })
