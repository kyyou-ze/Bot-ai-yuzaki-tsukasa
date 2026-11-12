/**
 * Panel pengaturan fitur tambahan lewat command (khusus owner) — semuanya pakai tombol.
 *
 *   .setfitur                       daftar fitur + status (pilih lewat tombol)
 *   .setfitur <fitur>               detail & tombol pengaturan satu fitur
 *   .setfitur <fitur> on|off        hidupkan / matikan
 *   .setfitur <fitur> reset         kembali ke pengaturan awal (mati)
 *   .setfitur semua off             matikan semua fitur
 *   .setfitur reset                 kembalikan semua pengaturan ke awal
 *   .setfitur blacklist tambah|hapus <nomor|grup|command|kata> <nilai>
 *
 * Semua fitur awalnya MATI. Pengaturan disimpan di database (global.db.fitur.cfg),
 * berlaku langsung tanpa restart dan tidak hilang saat bot restart.
 * Auto backup database diatur lewat .setbackup.
 */

import { fiturCfg, cfg as extraCfg } from '../../lib/engine/features.js'
import { X as extraFiturCfg } from '../../lib/rpg/extra.js'
import { buttonsToText } from '../../lib/platform/wa.js'
import { saveDB } from '../../lib/db/database.js'

const quick = (text, id) => ({ type: 'reply', text, id })

const HARI = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
const hariChoices = HARI.map((h) => ({ v: h, t: h[0].toUpperCase() + h.slice(1) }))
const boolChoices = (yes, no) => [{ v: true, t: yes }, { v: false, t: no }]
const numChoices = (arr, fmt) => arr.map((n) => ({ v: n, t: fmt(n) }))
const rp = (n) => (n ? `Rp ${n.toLocaleString('id-ID')}` : 'Gratis')
const jamFmt = (n) => `${String(n).padStart(2, '0')}:00 WIB`
const kirimChoices = [{ v: 'owner', t: 'Ke owner' }, { v: 'chat', t: 'Ke chat asal' }]

// group: fitur -> global.fitur | extra -> global.extra | extraFitur -> global.extraFitur
// path : lokasi section di dalam group (default [key])
const FEATURES = [
    // ── Ekonomi & RPG ──
    { key: 'marketplace', group: 'fitur', cat: 'Ekonomi & RPG', emoji: '🛒', label: 'Marketplace', desc: 'Jual-beli item antar user (.market .mjual .mbeli)',
        opts: [
            { field: 'pajakPersen', label: '💸 Pajak', choices: numChoices([0, 2, 5, 10], (n) => `${n}%`) },
            { field: 'maxListing', label: '📦 Maks Listing', choices: numChoices([3, 5, 10], (n) => `${n} per user`) },
            { field: 'durasiHari', label: '⏳ Durasi', choices: numChoices([3, 7, 14], (n) => `${n} hari`) }
        ] },
    { key: 'eventshop', group: 'fitur', path: ['eventShop'], cat: 'Ekonomi & RPG', emoji: '🎪', label: 'Shop Event', desc: 'Diskon & barang event (.eventshop .eventbuy). Daftar event diisi lewat kode, bawaannya kosong.', opts: [] },
    { key: 'streak', group: 'fitur', path: ['reward', 'streak'], cat: 'Ekonomi & RPG', emoji: '🔥', label: 'Streak Hadiah', desc: 'Bonus streak untuk .harian dan .mingguan', opts: [] },
    { key: 'jambahagia', group: 'extra', path: ['jamBahagia'], cat: 'Ekonomi & RPG', emoji: '🎉', label: 'Jam Bahagia', desc: 'Hadiah dikali pengali pada jam tertentu',
        opts: [
            { field: 'pengali', label: '✖️ Pengali', choices: numChoices([2, 3, 5], (n) => `×${n}`) },
            { field: 'jam', label: '🕐 Jam', choices: [
                { v: [[12, 13], [19, 21]], t: '12-13 & 19-21' },
                { v: [[19, 21]], t: '19-21 saja' },
                { v: [[12, 14], [18, 22]], t: '12-14 & 18-22' },
                { v: [[0, 24]], t: 'Sepanjang hari' }
            ] }
        ] },
    { key: 'misi', group: 'extra', cat: 'Ekonomi & RPG', emoji: '📋', label: 'Misi Harian', desc: 'Misi harian dengan bonus (.misi)', opts: [] },
    { key: 'referral', group: 'extra', cat: 'Ekonomi & RPG', emoji: '🤝', label: 'Referral', desc: 'Undang teman dapat hadiah (.invite .kodeinvite)',
        opts: [{ field: 'maxUndangan', label: '👥 Maks Undangan', choices: numChoices([10, 25, 50, 100], (n) => `${n} orang`) }] },

    // ── Clan & Sosial ──
    { key: 'clan', group: 'fitur', cat: 'Clan & Sosial', emoji: '🏰', label: 'Clan & War', desc: 'Clan, donasi, dan war antar clan (.clan)',
        opts: [
            { field: 'biayaBuat', label: '💰 Biaya Buat', choices: numChoices([0, 50000, 100000, 250000], rp) },
            { field: 'maxAnggota', label: '👥 Maks Anggota', choices: numChoices([10, 20, 30, 50], (n) => `${n} anggota`) },
            { field: 'wajibGuild', label: '🛡 Wajib Guild', choices: boolChoices('Wajib ikut guild', 'Tidak wajib') }
        ] },
    { key: 'turnamen', group: 'extraFitur', cat: 'Clan & Sosial', emoji: '🏆', label: 'Turnamen Clan', desc: 'Turnamen mingguan antar clan, diumumkan ke grup',
        opts: [
            { field: 'hariReset', label: '📅 Hari Tutup', choices: hariChoices },
            { field: 'jamReset', label: '🕐 Jam Tutup', choices: numChoices([18, 20, 21, 22], jamFmt) },
            { field: 'minAnggota', label: '👥 Min Anggota', choices: numChoices([2, 3, 5], (n) => `${n} anggota`) }
        ] },
    { key: 'lbmingguan', group: 'fitur', path: ['lbMingguan'], cat: 'Clan & Sosial', emoji: '🥇', label: 'Leaderboard Mingguan', desc: 'Peringkat mingguan + hadiah, diumumkan ke grup',
        opts: [
            { field: 'mode', label: '📊 Mode', choices: [{ v: 'naik', t: 'Kenaikan' }, { v: 'total', t: 'Total' }] },
            { field: 'hariReset', label: '📅 Hari Reset', choices: hariChoices },
            { field: 'jamReset', label: '🕐 Jam Reset', choices: numChoices([18, 20, 21, 22], jamFmt) }
        ] },
    { key: 'badge', group: 'extraFitur', cat: 'Clan & Sosial', emoji: '🎖', label: 'Badge', desc: 'Badge pencapaian user', opts: [] },
    { key: 'trial', group: 'extraFitur', cat: 'Clan & Sosial', emoji: '🎁', label: 'Trial Premium', desc: 'Trial premium gratis, sekali per user',
        opts: [{ field: 'hari', label: '📆 Lama Trial', choices: numChoices([1, 3, 7, 14], (n) => `${n} hari`) }] },

    // ── Sistem ──
    { key: 'antidelete', group: 'fitur', cat: 'Sistem', emoji: '🗑', label: 'Anti Delete (global)', desc: 'Pesan yang dihapus diteruskan ke owner / chat asal',
        opts: [
            { field: 'kirimKe', label: '📤 Kirim', choices: kirimChoices },
            { field: 'grup', label: '👥 Grup', choices: boolChoices('Berlaku di grup', 'Tidak di grup') },
            { field: 'pribadi', label: '👤 Pribadi', choices: boolChoices('Berlaku di pribadi', 'Tidak di pribadi') }
        ] },
    { key: 'antiedit', group: 'fitur', cat: 'Sistem', emoji: '✏️', label: 'Anti Edit (global)', desc: 'Pesan yang diedit diteruskan ke owner / chat asal',
        opts: [
            { field: 'kirimKe', label: '📤 Kirim', choices: kirimChoices },
            { field: 'grup', label: '👥 Grup', choices: boolChoices('Berlaku di grup', 'Tidak di grup') },
            { field: 'pribadi', label: '👤 Pribadi', choices: boolChoices('Berlaku di pribadi', 'Tidak di pribadi') }
        ] },
    { key: 'antiviewonce', group: 'fitur', cat: 'Sistem', emoji: '👁', label: 'Anti Sekali Lihat (global)', desc: 'Media sekali lihat diteruskan ke owner / chat asal',
        opts: [
            { field: 'kirimKe', label: '📤 Kirim', choices: kirimChoices },
            { field: 'grup', label: '👥 Grup', choices: boolChoices('Berlaku di grup', 'Tidak di grup') },
            { field: 'pribadi', label: '👤 Pribadi', choices: boolChoices('Berlaku di pribadi', 'Tidak di pribadi') }
        ] },
    { key: 'logcommand', group: 'fitur', path: ['logCommand'], cat: 'Sistem', emoji: '📜', label: 'Log Command', desc: 'Catat command yang dipakai dan kirim ringkasannya ke owner',
        opts: [
            { field: 'intervalMenit', label: '⏱ Interval', choices: [{ v: 0, t: 'Tiap command' }, { v: 10, t: 'Tiap 10 menit' }, { v: 30, t: 'Tiap 30 menit' }, { v: 60, t: 'Tiap 1 jam' }] },
            { field: 'simpanFile', label: '💾 Simpan File', choices: boolChoices('Simpan ke file', 'Jangan simpan') },
            { field: 'abaikanOwner', label: '👑 Abaikan Owner', choices: boolChoices('Abaikan owner', 'Catat owner') }
        ] },
    { key: 'laporanharian', group: 'fitur', path: ['laporanHarian'], cat: 'Sistem', emoji: '🗒', label: 'Laporan Harian', desc: 'Ringkasan aktivitas bot dikirim ke owner tiap hari',
        opts: [{ field: 'jam', label: '🕐 Jam Kirim', choices: numChoices([6, 12, 18, 21], jamFmt) }] },
    { key: 'blacklist', group: 'fitur', cat: 'Sistem', emoji: '🚫', label: 'Blacklist', desc: 'Abaikan nomor, grup, command, atau kata tertentu (owner selalu lolos). Isi daftar: .setfitur blacklist tambah <nomor|grup|command|kata> <nilai>',
        opts: [{ field: 'balas', label: '💬 Balas User', choices: boolChoices('Beri tahu user', 'Diam saja') }] }
]

const BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]))
const CATS = [...new Set(FEATURES.map((f) => f.cat))]
const BL_LISTS = ['nomor', 'grup', 'command', 'kata']

// ───────── baca & tulis pengaturan ─────────
const pathOf = (f) => f.path || [f.key]

const section = (f) => {
    if (f.group === 'fitur') return pathOf(f).reduce((o, k) => o?.[k], fiturCfg()) || {}
    if (f.group === 'extra') return extraCfg(f.key) || {}
    return extraFiturCfg()[f.key] || {}
}

const root = () => {
    if (!global.db) throw new Error('Database belum siap')
    const fitur = (global.db.fitur ||= {})
    const c = (fitur.cfg ||= {})
    for (const g of ['fitur', 'extra', 'extraFitur']) c[g] ||= {}
    return c
}

const setVal = (f, field, value) => {
    let node = root()[f.group]
    for (const k of pathOf(f)) node = (node[k] ||= {})
    node[field] = value
    saveDB(global.db)
}

const clearFeature = (f) => {
    let node = root()[f.group]
    const p = pathOf(f)
    for (const k of p.slice(0, -1)) { node = node?.[k]; if (!node) return }
    delete node[p[p.length - 1]]
    saveDB(global.db)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const curIdx = (f, o) => o.choices.findIndex((c) => same(c.v, section(f)[o.field]))
const curLabel = (f, o) => {
    const i = curIdx(f, o)
    return i >= 0 ? o.choices[i].t : String(section(f)[o.field] ?? '-')
}
const isOn = (f) => !!section(f).on

// ───────── plugin ─────────
let handler = async (m, { sock, jid, text, reply, usedPrefix, prefix }) => {
    if (m.fromMe && m.isGroup) return
    const p = usedPrefix ?? prefix ?? '.'
    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    const id = (s = '') => `${p}setfitur${s ? ' ' + s : ''}`

    const sendBtn = async (body, buttons) => {
        try {
            return await sock.sendButtons(jid, { text: body, footer: global.namebot || 'Kaguya', buttons }, { quoted: m })
        } catch {
            const extra = buttonsToText(buttons)
            return reply(extra ? `${body}\n\n${extra}` : body)
        }
    }

    // ── tampilan: daftar semua fitur ──
    const showList = (note = '') => {
        const aktif = FEATURES.filter(isOn).length
        const lines = CATS.map((c) =>
            `*${c}*\n` + FEATURES.filter((f) => f.cat === c).map((f) => `${isOn(f) ? '✅' : '❌'} ${f.emoji} ${f.label}`).join('\n')
        ).join('\n\n')
        const body = `${note ? note + '\n\n' : ''}*[ PENGATURAN FITUR ]*\n\nAktif: ${aktif} dari ${FEATURES.length} fitur\n\n${lines}\n\n_Auto backup database diatur lewat ${p}setbackup._`
        return sendBtn(body, [
            {
                type: 'single_select',
                text: '⚙️ Pilih Fitur',
                sections: CATS.map((c) => ({
                    title: c,
                    rows: FEATURES.filter((f) => f.cat === c).map((f) => ({
                        title: `${f.emoji} ${f.label}`,
                        description: isOn(f) ? '✅ aktif' : '❌ mati',
                        id: id(f.key)
                    }))
                }))
            },
            quick('💾 Auto Backup', `${p}setbackup`),
            quick('🔴 Matikan Semua', id('semua off')),
            quick('↩️ Reset Semua', id('reset'))
        ])
    }

    // ── tampilan: detail satu fitur ──
    const showFeature = (f, note = '') => {
        const s = section(f)
        let body = `${note ? note + '\n\n' : ''}*[ ${f.emoji} ${f.label.toUpperCase()} ]*\n\n${f.desc}\n\nStatus: ${s.on ? '✅ aktif' : '❌ mati'}`
        for (const o of f.opts) body += `\n${o.label}: ${curLabel(f, o)}`
        if (f.key === 'blacklist') body += '\n' + BL_LISTS.map((l) => `Daftar ${l}: ${(s[l] || []).length ? s[l].join(', ') : '-'}`).join('\n')

        const buttons = [quick(s.on ? '⏸ Matikan' : '▶️ Hidupkan', id(`${f.key} ${s.on ? 'off' : 'on'}`))]
        for (const o of f.opts) {
            const ci = curIdx(f, o)
            buttons.push({
                type: 'single_select',
                text: o.label,
                sections: [{
                    title: o.label.replace(/^\S+\s/, ''),
                    rows: o.choices.map((c, i) => ({
                        title: c.t,
                        description: i === ci ? 'sedang dipakai' : '',
                        id: id(`${f.key} set ${o.field} ${i}`)
                    }))
                }]
            })
        }
        buttons.push(quick('⬅️ Daftar Fitur', id()))
        return sendBtn(body, buttons)
    }

    const sub = (args[0] || '').toLowerCase()

    if (!sub || sub === 'status' || sub === 'list') return showList()

    if (sub === 'reset' || (sub === 'semua' && (args[1] || '').toLowerCase() === 'reset')) {
        root(); delete global.db.fitur.cfg; saveDB(global.db)
        return showList('Semua pengaturan dikembalikan ke awal (semua fitur mati) ↩️')
    }

    if (sub === 'semua') {
        const v = (args[1] || '').toLowerCase()
        if (v !== 'off') return reply(`Contoh: *${id('semua off')}* atau *${id('reset')}*`)
        for (const f of FEATURES) setVal(f, 'on', false)
        return showList('Semua fitur dimatikan ❌')
    }

    const f = BY_KEY[sub]
    if (!f) return reply(`Fitur *${sub}* tidak ada. Pilih lewat tombol di *${id()}*.`)

    const act = (args[1] || '').toLowerCase()
    if (!act) return showFeature(f)

    if (act === 'on' || act === 'off') {
        setVal(f, 'on', act === 'on')
        return showFeature(f, `${f.label} ${act === 'on' ? 'dihidupkan ✅' : 'dimatikan ❌'}`)
    }

    if (act === 'reset') {
        clearFeature(f)
        return showFeature(f, `Pengaturan ${f.label} dikembalikan ke awal ↩️`)
    }

    if (act === 'set') {
        const o = f.opts.find((x) => x.field.toLowerCase() === (args[2] || '').toLowerCase())
        const i = Number(args[3])
        if (!o || !Number.isInteger(i) || !o.choices[i]) return showFeature(f, 'Pilihan tidak valid, gunakan tombol di bawah.')
        setVal(f, o.field, o.choices[i].v)
        return showFeature(f, `${o.label.replace(/^\S+\s/, '')}: ${o.choices[i].t} ✅`)
    }

    // daftar blacklist (satu-satunya yang butuh teks, karena isinya bebas)
    if (f.key === 'blacklist' && (act === 'tambah' || act === 'hapus')) {
        const list = (args[2] || '').toLowerCase()
        let val = args.slice(3).join(' ').trim()
        if (!BL_LISTS.includes(list) || !val) return reply(`Contoh:\n*${id('blacklist tambah nomor 628123456789')}*\n*${id('blacklist hapus kata spam')}*\nJenis: ${BL_LISTS.join(' | ')}`)
        if (list === 'nomor') val = val.replace(/\D/g, '').replace(/^0/, '62')
        if (list === 'command') val = val.replace(/^[^\w]+/, '').toLowerCase()
        if (!val) return reply('Nilainya tidak valid.')
        const cur = [...(section(f)[list] || [])]
        const has = cur.map((x) => String(x).toLowerCase()).includes(val.toLowerCase())
        if (act === 'tambah' && has) return showFeature(f, `${val} sudah ada di daftar ${list}.`)
        if (act === 'hapus' && !has) return showFeature(f, `${val} tidak ada di daftar ${list}.`)
        const next = act === 'tambah' ? [...cur, val] : cur.filter((x) => String(x).toLowerCase() !== val.toLowerCase())
        setVal(f, list, next)
        return showFeature(f, `${val} ${act === 'tambah' ? 'ditambahkan ke' : 'dihapus dari'} daftar ${list} ✅`)
    }

    return showFeature(f)
}

handler.help = ['setfitur']
handler.tags = ['owner']
handler.command = ['setfitur', 'aturfitur']
handler.owner = true

export default handler
