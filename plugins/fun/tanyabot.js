import { dioRegister, dioRun, dioSave, dioStore } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // Tanya Bot: jawaban hiburan untuk pertanyaan iseng. Jawaban konsisten untuk pertanyaan yang sama pada hari yang sama.
        //   .apakah <pertanyaan> • .kapankah <pertanyaan> • .siapakah <pertanyaan> (grup) • .berapakah <pertanyaan> • .8ball <pertanyaan>
        const K = require('../../lib/praktis'), { B } = require('../../lib/style')
        const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
        const seeded = (arr, seed) => arr[hash(seed) % arr.length]
        const YN = ['Ya, pasti.', 'Sepertinya iya.', 'Bisa jadi.', 'Peluangnya besar.', 'Kemungkinannya kecil.', 'Tidak.', 'Jangan terlalu berharap.', 'Tentu saja tidak.', 'Hmm, aku ragu...', '100% yakin!', 'Tanyakan lagi nanti ya.', 'Menurut perhitunganku: iya.']
        const BALL = ['Pasti begitu.', 'Tanpa keraguan.', 'Ya, tentu saja.', 'Kamu bisa mengandalkannya.', 'Sepertinya baik.', 'Tanda-tandanya mengarah ke ya.', 'Jawabannya kabur, coba lagi.', 'Tanyakan lagi nanti.', 'Lebih baik tidak kukatakan sekarang.', 'Konsentrasi dan tanya lagi.', 'Jangan berharap begitu.', 'Jawabanku: tidak.', 'Sumberku bilang tidak.', 'Prospeknya kurang bagus.', 'Sangat meragukan.']
        const WHEN = (seed) => { const n = 2 + (hash(seed + 'n') % 88); return ['Besok.', 'Minggu depan.', `${n} hari lagi.`, `${1 + (n % 11)} bulan lagi.`, `${1 + (n % 9)} tahun lagi.`, 'Sebentar lagi.', 'Nanti kalau sudah siap.', 'Tidak akan pernah.', 'Hari ini juga!', 'Setelah kamu berhenti menunda-nunda.'] }

        module.exports = {
          name: 'apakah', alias: ['kapankah', 'siapakah', 'berapakah', '8ball', 'bolasihir'], category: 'fun', noLimit: true, cmds: ['apakah', 'kapankah', 'siapakah', 'berapakah', '8ball'],
          desc: 'Tanya Bot: .apakah / .kapankah / .siapakah / .berapakah / .8ball — jawaban hiburan',
          run: async ({ sock, m, command, text, prefix, reply, isGroup, groupMetadata }) => {
            const c = command === 'bolasihir' ? '8ball' : command, q = String(text || K.quotedText(m)).trim().replace(/\?+$/, '')
            if (!q) return reply(`🔮 ${B('TANYA BOT')}\n${prefix}apakah dia suka aku\n${prefix}kapankah aku kaya\n${prefix}siapakah yang paling ganteng _(grup)_\n${prefix}berapakah umurku nanti\n${prefix}8ball aku lulus?`)
            const seed = c + '|' + q.toLowerCase() + '|' + K.dayKey(), head = `🔮 ${B('TANYA BOT')}\n❓ ${c} ${q}?\n💬 `
            if (c === 'siapakah') {
              if (!isGroup) return reply('✕ .siapakah hanya bisa dipakai di grup.')
              const ps = ((groupMetadata && groupMetadata.participants) || []).map(p => p.id).filter(Boolean)
              if (!ps.length) return reply('✕ Daftar anggota grup tidak terbaca.')
              const who = seeded(ps, seed)
              return sock.sendMessage(m.chat, { text: `${head}*@${String(who).split('@')[0]}*`, mentions: [who] }, { quoted: m })
            }
            const ans = c === 'apakah' ? seeded(YN, seed) : c === '8ball' ? seeded(BALL, seed) : c === 'kapankah' ? seeded(WHEN(seed), seed)
              : `${hash(seed) % 101}${/persen|%|kemungkinan|peluang|yakin/i.test(q) ? '%' : ''}`
            return reply(`${head}*${ans}*`)
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

dioRegister("fun/tanyabot", feature, libs)

let handler = (m, ctx) => dioRun("fun/tanyabot", m, ctx)

handler.command = ['berapakah', '8ball', 'bolasihir']
handler.hide = ["bolasihir"]
handler.help = ["berapakah", "8ball"]
handler.tags = ['fun']

const __plugin = handler

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'tanyabot', { as: 'berapakah' })
