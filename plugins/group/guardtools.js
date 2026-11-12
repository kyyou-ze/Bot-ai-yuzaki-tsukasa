import { getMeta, resolveTargets, botIsAdmin, waError, updateGroupSetting } from '../../lib/platform/wa.js'
import { memberIds } from '../../lib/core/data.js'
import {
    addEntry, delEntry, listEntries, applyPreset, PRESETS, saveBackup, restoreBackup, dashboard, parseHM, fmtHM, installGuardPlus
} from '../../lib/group/guardplus.js'

// Perintah pendukung penjaga & setting grup (khusus admin):
//   .gsetting                          dasbor semua pengaturan grup
//   .preset ketat|sedang|longgar|off   paket keamanan sekali klik
//   .trusted add|del|list @user        member tepercaya (dikecualikan dari semua penjaga)
//   .blmember add|del|list @user       blacklist: otomatis dikeluarkan saat join
//   .hukuman on|off|mute <warn-ke> <menit>   hukuman bertingkat: warn -> mute -> kick
//   .jadwalgc buka 06:00 tutup 22:00   jadwal buka/tutup grup harian (WIB)
//   .gsetbackup / .gsetrestore [kode]  simpan, pulihkan, atau salin setting ke grup lain
//   .autoclear on|off|<detik>          hapus otomatis pesan welcome/goodbye/promote/demote bot

installGuardPlus()

const num = (j) => String(j || '').split('@')[0].split(':')[0]
const ON = ['on', 'aktif']
const OFF = ['off', 'mati', 'nonaktif']

let handler = async (m, ctx) => {
    const { sock, text = '', command, jid, prefix, reply, example } = ctx
    const p = prefix || '.'
    const raw = text.trim()
    const sub = (raw.split(/\s+/)[0] || '').toLowerCase()
    const value = raw.slice(sub.length).trim()
    const g = () => global.db.groups?.[jid] || {}

    try {
        // ───────── dasbor ─────────
        if (command === 'gsetting') return reply(await dashboard(sock, jid, p))

        // ───────── preset ─────────
        if (command === 'preset') {
            if (sub === 'off' || PRESETS[sub]) {
                applyPreset(jid, sub)
                const meta = await getMeta(sock, jid, true).catch(() => null)
                const warn = meta && !botIsAdmin(sock, meta) ? '\n\n⚠️ Bot belum jadi admin, penjaga tidak bisa menghapus pesan / mengeluarkan member.' : ''
                return reply(sub === 'off'
                    ? '🛡️ Semua penjaga proteksi dimatikan.'
                    : `🛡️ Preset *${sub}* diterapkan.\n${Object.keys(PRESETS[sub]).join(', ')}\n+ hukuman bertingkat (mute di warn ke-2, kick di batas warn).\n\nLihat hasilnya: ${p}gsetting${warn}`)
            }
            return reply(`🛡️ *PRESET KEAMANAN*\n${p}preset longgar → antilink, antitoxic, antivirtex\n${p}preset sedang → + antispam, antiphishing, antiswgc\n${p}preset ketat → + antilink semua, forward, tag massal, promosi, bot lain, anti-raid, tag status\n${p}preset off → matikan semua penjaga\n\n_Fitur seperti antimedia, slowmode, antiasing, antipromote tidak disentuh preset._`)
        }

        // ───────── trusted & blacklist ─────────
        if (command === 'trusted' || command === 'blmember') {
            const field = command === 'trusted' ? 'trusted' : 'blacklist'
            const title = command === 'trusted' ? 'TRUSTED' : 'BLACKLIST'
            if (sub === 'list') {
                const rows = listEntries(jid, field)
                if (!rows.length) return reply(`${title} kosong.`)
                return reply(`*▢ ${title}* (${rows.length})\n${rows.map(e => `-▢ @${num(e.jid || e.ids[0])}${e.reason ? ` (${e.reason})` : ''}`).join('\n')}`, { mentions: rows.map(e => e.jid).filter(Boolean) })
            }
            if (!['add', 'del'].includes(sub)) {
                return reply(command === 'trusted'
                    ? `⭐ *TRUSTED*\nMember tepercaya dikecualikan dari semua penjaga (antilink, antispam, dst).\n\n${p}trusted add @user\n${p}trusted del @user\n${p}trusted list`
                    : `🚫 *BLACKLIST MEMBER*\nMember di daftar ini otomatis dikeluarkan saat masuk grup.\n\n${p}blmember add @user [alasan]\n${p}blmember del @user\n${p}blmember list`)
            }
            const meta = await getMeta(sock, jid, true)
            const found = resolveTargets(m, value, meta)
            const nums = (value.match(/\d{8,15}/g) || []).map(n => n.replace(/^0/, '62'))
            if (!found.length && !nums.length) return example(`${sub} @user  (atau reply pesannya)`)

            const reason = value.replace(/@\d+/g, '').replace(/\d{8,15}/g, '').trim().slice(0, 60)
            const lines = [], mentions = []
            const targets = found.map(t => ({ ids: memberIds(t), jid: t.id, admin: !!t.admin }))
            for (const n of nums) if (!targets.some(t => t.ids.includes(n))) targets.push({ ids: [n], jid: `${n}@s.whatsapp.net`, admin: false })

            for (const t of targets) {
                mentions.push(t.jid)
                const tag = `@${num(t.jid)}`
                if (sub === 'del') {
                    lines.push(`-▢ ${tag} ${delEntry(jid, field, t.ids) ? 'dihapus dari daftar' : 'tidak ada di daftar'}`)
                    continue
                }
                if (field === 'blacklist' && t.admin) { lines.push(`-▢ ${tag} (admin) dilewati`); continue }
                addEntry(jid, field, t.ids, t.jid, reason ? { reason } : {})
                let extra = ''
                if (field === 'blacklist' && found.some(f => f.id === t.jid)) {
                    if (botIsAdmin(sock, meta)) {
                        const ok = await sock.groupParticipantsUpdate(jid, [t.jid], 'remove').then(() => true).catch(() => false)
                        extra = ok ? ' dan dikeluarkan' : ' (gagal dikeluarkan)'
                    } else extra = ' (bot belum admin, tidak bisa mengeluarkan)'
                }
                lines.push(`-▢ ${tag} ditambahkan${extra}`)
            }
            return reply(lines.join('\n'), { mentions })
        }

        // ───────── hukuman bertingkat ─────────
        if (command === 'hukuman') {
            const cfg = g().hukuman || {}
            if (ON.includes(sub)) { updateGroupSetting(jid, 'hukuman', { on: true, muteAt: cfg.muteAt || 2, muteMin: cfg.muteMin || 10 }); return reply(`Hukuman bertingkat *ON*.\nPelanggar: warn → di warn ke-${cfg.muteAt || 2} di-mute ${cfg.muteMin || 10} menit → dikeluarkan di batas ${p}setwarn.`) }
            if (OFF.includes(sub)) { updateGroupSetting(jid, 'hukuman', { on: false }); return reply('Hukuman bertingkat *OFF*.') }
            if (sub === 'mute') {
                const [a, b] = value.split(/\s+/).map(Number)
                if (!Number.isInteger(a) || a < 1 || a > 19 || !Number.isInteger(b) || b < 1 || b > 1440) return reply(`Format: ${p}hukuman mute <warn ke 1-19> <menit 1-1440>\nContoh: ${p}hukuman mute 2 10`)
                updateGroupSetting(jid, 'hukuman', { on: true, muteAt: a, muteMin: b })
                return reply(`Di warn ke-*${a}* pelanggar di-mute *${b} menit*.`)
            }
            return reply(`⚖️ *HUKUMAN BERTINGKAT*: ${cfg.on ? 'ON' : 'OFF'}\nWarn ke-${cfg.muteAt || 2} → mute ${cfg.muteMin || 10} menit\nBatas warn → keluar (${p}setwarn)\n\n${p}hukuman on|off\n${p}hukuman mute <warn ke> <menit>\n_Berlaku untuk semua penjaga (antilink, antitoxic, antispam, dst), walau fitur itu belum memakai mode warn._`)
        }

        // ───────── jadwal buka/tutup grup ─────────
        if (command === 'jadwalgc') {
            const j = g().jadwalgc
            if (OFF.includes(sub) || sub === 'hapus') { updateGroupSetting(jid, 'jadwalgc', { open: undefined, close: undefined, last: undefined }); return reply('Jadwal buka/tutup grup dihapus.') }
            const open = raw.match(/(?:buka|open)\s+(\d{1,2}[:.]\d{2})/i)?.[1]
            const close = raw.match(/(?:tutup|close)\s+(\d{1,2}[:.]\d{2})/i)?.[1]
            if (open || close) {
                if ((open && parseHM(open) === null) || (close && parseHM(close) === null)) return reply('Jam tidak valid. Pakai format 24 jam, contoh 06:00 atau 22:30.')
                updateGroupSetting(jid, 'jadwalgc', { ...(open ? { open: fmtHM(open) } : {}), ...(close ? { close: fmtHM(close) } : {}) })
                const now = g().jadwalgc
                return reply(`🕒 *JADWAL GRUP* (WIB)\n🔓 Buka : ${now.open || '-'}\n🔒 Tutup : ${now.close || '-'}\n\n_Bot harus admin. Hapus: ${p}jadwalgc off_`)
            }
            return reply(`🕒 *JADWAL GRUP* (WIB)\n🔓 Buka : ${j?.open || '-'}\n🔒 Tutup : ${j?.close || '-'}\n\n${p}jadwalgc buka 06:00 tutup 22:00\n${p}jadwalgc tutup 23:00  (ubah salah satu)\n${p}jadwalgc off\n_Tiap hari, waktu WIB. Untuk tutup sementara pakai ${p}closegc 30m._`)
        }

        // ───────── backup / restore ─────────
        if (command === 'gsetbackup') {
            const meta = await getMeta(sock, jid).catch(() => null)
            const { code, count } = saveBackup(jid, meta?.subject)
            return reply(`💾 Backup setting tersimpan (${count} kelompok setting).\nKode: *${code}*\n\nPulihkan di grup ini: ${p}gsetrestore\nSalin ke grup lain: kirim *${p}gsetrestore ${code}* di grup tujuan (harus admin).\n_Daftar member (trusted, blacklist, warn, mute) tidak ikut disalin._`)
        }
        if (command === 'gsetrestore') {
            const code = (sub || g().lastBackup || '').toLowerCase()
            if (!code) return reply(`Belum ada backup. Buat dulu dengan ${p}gsetbackup`)
            const b = restoreBackup(jid, code)
            if (!b) return reply(`Kode backup *${code}* tidak ditemukan.`)
            return reply(`✅ Setting dipulihkan dari backup *${code}*${b.name ? ` (${b.name})` : ''}.\nLihat hasilnya: ${p}gsetting`)
        }

        // ───────── hapus otomatis notifikasi bot ─────────
        if (command === 'autoclear') {
            const cfg = g().autoclear || {}
            const n = parseInt(sub, 10)
            if (Number.isInteger(n)) {
                if (n < 5 || n > 3600) return reply('Durasi 5-3600 detik.')
                updateGroupSetting(jid, 'autoclear', { on: true, sec: n })
                return reply(`🧹 Pesan welcome / goodbye / promote / demote dari bot dihapus otomatis setelah *${n} detik*.`)
            }
            if (ON.includes(sub)) { updateGroupSetting(jid, 'autoclear', { on: true, sec: cfg.sec || 60 }); return reply(`🧹 Autoclear *ON* (${cfg.sec || 60} detik).`) }
            if (OFF.includes(sub)) { updateGroupSetting(jid, 'autoclear', { on: false }); return reply('🧹 Autoclear *OFF*.') }
            return reply(`🧹 *AUTOCLEAR*: ${cfg.on ? `ON (${cfg.sec || 60} detik)` : 'OFF'}\nMenghapus otomatis pesan welcome, goodbye, promote, dan demote dari bot supaya grup tidak penuh.\n\n${p}autoclear on|off\n${p}autoclear <detik>  (5-3600)\n_Notifikasi sistem WhatsApp sendiri ("X bergabung") tidak bisa dihapus bot._`)
        }
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['gsetting', 'preset', 'trusted', 'blmember', 'hukuman', 'jadwalgc', 'gsetbackup', 'gsetrestore', 'autoclear']
handler.tags = ['group']
handler.group = true
handler.admin = true

export default handler
