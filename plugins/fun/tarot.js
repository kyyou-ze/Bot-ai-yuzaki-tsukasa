import { dioRegister, dioRun, dioSave, dioStore } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .tarot [pertanyaan] — tarik 3 kartu Major Arcana (masa lalu • kini • depan). Hiburan semata; hasil konsisten per orang per hari per pertanyaan
        const { B } = require('../../lib/style'), K = require('../../lib/praktis')
        const KARTU = [
          ['0 • Si Bodoh (The Fool)', 'awal baru, spontanitas, berani melompat', 'ceroboh, ragu, belum siap'],
          ['I • Penyihir (The Magician)', 'kemampuan, fokus, sumber daya cukup', 'tipu daya, bakat tak terpakai'],
          ['II • Pendeta Wanita (High Priestess)', 'intuisi, rahasia, mendengar batin', 'mengabaikan firasat, informasi tersembunyi'],
          ['III • Permaisuri (The Empress)', 'kelimpahan, kasih sayang, kreativitas', 'terlalu bergantung, kreativitas macet'],
          ['IV • Kaisar (The Emperor)', 'struktur, kepemimpinan, stabilitas', 'kaku, mengatur berlebihan'],
          ['V • Pemuka Agama (Hierophant)', 'tradisi, bimbingan, nilai bersama', 'menentang aturan, ingin jalan sendiri'],
          ['VI • Kekasih (The Lovers)', 'pilihan penting, hubungan, keselarasan nilai', 'ketidakcocokan, ragu memilih'],
          ['VII • Kereta Perang (The Chariot)', 'tekad, kemenangan lewat disiplin', 'kehilangan arah, agresif'],
          ['VIII • Kekuatan (Strength)', 'keberanian lembut, sabar, pengendalian diri', 'ragu pada diri sendiri, mudah marah'],
          ['IX • Pertapa (The Hermit)', 'merenung, mencari makna, menyendiri sejenak', 'terlalu menarik diri, kesepian'],
          ['X • Roda Nasib (Wheel of Fortune)', 'perubahan siklus, peluang datang', 'kemunduran sementara, melawan arus'],
          ['XI • Keadilan (Justice)', 'kejujuran, sebab-akibat, keputusan adil', 'tidak adil, menghindari tanggung jawab'],
          ['XII • Orang Tergantung (Hanged Man)', 'sudut pandang baru, menunggu dengan sadar', 'menunda tanpa arah, pengorbanan sia-sia'],
          ['XIII • Kematian (Death)', 'akhir yang membuka babak baru (bukan kematian harfiah)', 'sulit melepas, takut berubah'],
          ['XIV • Keseimbangan (Temperance)', 'moderasi, harmoni, jalan tengah', 'berlebihan, tidak seimbang'],
          ['XV • Iblis (The Devil)', 'keterikatan, kebiasaan yang mengekang', 'melepaskan diri, sadar akan rantai'],
          ['XVI • Menara (The Tower)', 'guncangan mendadak, kebenaran terungkap', 'menghindari kehancuran, perubahan ditunda'],
          ['XVII • Bintang (The Star)', 'harapan, pemulihan, ketenangan', 'putus asa, kehilangan kepercayaan'],
          ['XVIII • Bulan (The Moon)', 'ilusi, ketidakpastian, perasaan samar', 'kebingungan mereda, rahasia terbuka'],
          ['XIX • Matahari (The Sun)', 'sukacita, keberhasilan, energi positif', 'optimisme berlebihan, kebahagiaan tertunda'],
          ['XX • Penghakiman (Judgement)', 'panggilan untuk bangkit, evaluasi diri', 'ragu pada panggilan, menyalahkan diri'],
          ['XXI • Dunia (The World)', 'penyelesaian, pencapaian utuh', 'hampir selesai, butuh penutupan'],
        ]
        const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
        const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
        module.exports = {
          name: 'tarot', alias: ['kartutarot', 'tarik3'], category: 'fun', noLimit: true, cmds: ['tarot'],
          desc: 'Tarik 3 kartu tarot Major Arcana (masa lalu, kini, depan) untuk hiburan',
          run: async ({ m, text, reply }) => {
            const q = String(text || '').trim().slice(0, 120), r = rng(hash(`${m.sender}|${K.dayKey()}|${q.toLowerCase()}`)), idx = []
            while (idx.length < 3) { const i = Math.floor(r() * KARTU.length); if (!idx.includes(i)) idx.push(i) }
            const pos = ['Masa lalu', 'Masa kini', 'Masa depan']
            let t = `𓂀 ${B('TAROT')}${q ? `\n_"${q}"_` : ''}\n\n`
            idx.forEach((i, n) => { const rev = r() < 0.35, [nm, up, rv] = KARTU[i]; t += `${B(pos[n])} — *${nm}*${rev ? ' (terbalik)' : ''}\n   ${rev ? rv : up}\n\n` })
            return reply(t + '_Hiburan dan bahan refleksi saja, bukan ramalan pasti. Keputusan penting tetap kamu yang pegang._')
          },
        }
    }

const libs = {
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

dioRegister("fun/tarot", feature, libs)

let handler = (m, ctx) => dioRun("fun/tarot", m, ctx)

handler.command = ['tarot', 'kartutarot', 'tarik3']
handler.hide = ["kartutarot", "tarik3"]
handler.help = ["tarot"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'tarot', { subs: false })
