/**
 * Backup database lewat command (khusus owner)
 *
 *   .backupdb                    backup sekarang (dikirim ke chat pribadi owner + disimpan di server)
 *   .setbackup                   lihat & atur auto backup (pakai tombol)
 *   .setbackup on|off            hidupkan / matikan auto backup
 *   .setbackup interval 30|6j|1h interval (menit | j = jam | h = hari), min 5 menit
 *   .setbackup kirim owner|ini|628xxx|<id grup>   tujuan pengiriman
 *   .setbackup lokal on|off      simpan salinan di server (folder database/backup-db)
 *   .setbackup maks 10           jumlah salinan lokal yang disimpan
 *   .setbackup reset             kembali ke pengaturan config.js
 *   .listbackup                  daftar salinan lokal
 *   .getbackup <no|nama>         kirim salinan lokal
 *   .delbackup <no|nama>         hapus salinan lokal
 *   .restoredb <no|nama>         kembalikan database dari salinan lokal
 */

import fs from 'fs'
import {
    getBackupConfig, setBackupConfig, resetBackupConfig, lastBackupAt,
    buildDbZip, saveLocalBackup, listLocalBackups, resolveBackup, backupPath, deleteLocalBackup,
    restoreFromZip, dbSizes, fmtSize, wibStamp,
    BACKUP_DIR, BACKUP_MAX_MB, INTERVAL_MIN, INTERVAL_MAX, KEEP_MAX
} from '../../lib/db/backup.js'
import { buttonsToText } from '../../lib/platform/wa.js'
import { saveDB } from '../../lib/db/database.js'

const quick = (text, id) => ({ type: 'reply', text, id })

const normalizeNumber = (raw) => String(raw || '').replace(/\D/g, '').replace(/^0/, '62')

// "30" | "30m" | "6j" | "6jam" | "1h" | "1hari" -> menit
function parseInterval(raw) {
    const m = String(raw || '').trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(m|menit|j|jam|h|hari)?$/)
    if (!m) return null
    const n = Number(m[1].replace(',', '.'))
    const unit = m[2] || 'm'
    const mult = unit.startsWith('j') ? 60 : unit.startsWith('h') ? 1440 : 1
    return Math.round(n * mult)
}

const fmtInterval = (min) => {
    if (min % 1440 === 0) return `${min / 1440} hari`
    if (min % 60 === 0) return `${min / 60} jam`
    return `${min} menit`
}

const describeTarget = (spec) => {
    if (spec === 'owner') return 'semua owner'
    if (Array.isArray(spec)) return spec.map((j) => String(j).replace(/@.*$/, '')).join(', ') || '-'
    return String(spec)
}

let handler = async (m, { sock, jid, sender, text, command, reply, isOwner, usedPrefix, prefix }) => {
    if (m.fromMe && m.isGroup) return
    const p = usedPrefix ?? prefix ?? '.'
    const args = String(text || '').trim().split(/\s+/).filter(Boolean)

    // kirim pesan + tombol; kalau tombol gagal, kirim teks biasa + daftar perintahnya
    const sendBtn = async (body, buttons) => {
        try {
            return await sock.sendButtons(jid, { text: body, footer: global.namebot || 'Kaguya', buttons }, { quoted: m })
        } catch {
            const extra = buttonsToText(buttons)
            return reply(extra ? `${body}\n\n${extra}` : body)
        }
    }

    // file backup dikirim ke chat pribadi (jangan ke grup)
    const fileTarget = m.isGroup ? sender : jid
    const sendFile = async (buf, fileName, caption) => {
        await sock.sendMessage(fileTarget, { document: buf, fileName, mimetype: 'application/zip', caption })
        if (m.isGroup) await sock.sendMessage(jid, { text: 'File backup sudah dikirim ke chat pribadi kamu.', mentions: [sender] }, { quoted: m })
    }

    const settingButtons = (c) => [
        quick(c.on ? '⏸ Matikan Auto Backup' : '▶️ Hidupkan Auto Backup', `${p}setbackup ${c.on ? 'off' : 'on'}`),
        {
            type: 'single_select',
            text: '⏱ Atur Interval',
            sections: [{
                title: 'Auto backup tiap...',
                rows: [15, 30, 60, 180, 360, 720, 1440].map((mnt) => ({
                    title: fmtInterval(mnt),
                    description: c.intervalMenit === mnt ? 'sedang dipakai' : '',
                    id: `${p}setbackup interval ${mnt}`
                }))
            }]
        },
        quick('📍 Kirim ke Chat Ini', `${p}setbackup kirim ini`),
        quick('👤 Kirim ke Owner', `${p}setbackup kirim owner`),
        quick(c.simpanLokal ? '🗂 Matikan Salinan Lokal' : '🗂 Hidupkan Salinan Lokal', `${p}setbackup lokal ${c.simpanLokal ? 'off' : 'on'}`),
        quick('💾 Backup Sekarang', `${p}backupdb`),
        quick('📋 List Backup', `${p}listbackup`)
    ]

    const statusText = (c) => {
        const last = lastBackupAt()
        const next = c.on && last ? wibStamp(last + c.intervalMenit * 60000) + ' WIB' : '-'
        const sizes = dbSizes()
        const total = sizes.reduce((a, b) => a + b.size, 0)
        return (
            `*[ BACKUP DATABASE ]*\n\n` +
            `Auto backup  : ${c.on ? '✅ aktif' : '❌ mati'}\n` +
            `Interval     : ${fmtInterval(c.intervalMenit)}\n` +
            `Kirim ke     : ${describeTarget(c.kirimKe)}\n` +
            `Salinan lokal: ${c.simpanLokal ? `✅ simpan ${c.maksLokal} terakhir (${BACKUP_DIR})` : '❌ mati'}\n` +
            `Terakhir     : ${last ? wibStamp(last) + ' WIB' : '-'}\n` +
            `Berikutnya   : ${next}\n\n` +
            `*Database sekarang* (${fmtSize(total)})\n` +
            sizes.map((s) => `• ${s.file} — ${fmtSize(s.size)}`).join('\n') + `\n\n` +
            `Salinan tersimpan: ${listLocalBackups().length}`
        )
    }

    // ───────── .backupdb ─────────
    if (command === 'backupdb') {
        await reply('Membuat backup database...')
        let built
        try { built = buildDbZip() } catch (e) { return reply(`Backup gagal: ${e.message}`) }
        if (!built) return reply('Tidak ada file database yang bisa dibackup.')

        const c = getBackupConfig()
        let savedLocal = false
        if (c.simpanLokal) {
            try { saveLocalBackup(built.zip, built.fileName, c.maksLokal); savedLocal = true } catch (e) { console.error('[backupdb] simpan lokal:', e.message) }
        }

        const info = `💾 *BACKUP DATABASE*\n\nWaktu  : ${wibStamp()} WIB\nFile   : ${built.files}\nUkuran : ${built.mb.toFixed(2)} MB`
        const after = [quick('📋 List Backup', `${p}listbackup`), quick('⚙️ Pengaturan', `${p}setbackup`)]

        if (built.mb > BACKUP_MAX_MB) {
            return sendBtn(
                `${info}\n\nUkuran melebihi batas kirim WhatsApp (${BACKUP_MAX_MB} MB), jadi file tidak dikirim.` +
                (savedLocal ? `\nSalinan tersimpan di server: *${BACKUP_DIR}/${built.fileName}*` : '\nHidupkan salinan lokal supaya backup tetap tersimpan di server.'),
                after
            )
        }

        try {
            await sendFile(built.zip, built.fileName, info + (savedLocal ? '\n\nSalinan juga disimpan di server.' : ''))
        } catch (e) {
            return sendBtn(`Backup dibuat tapi gagal dikirim: ${e.message}${savedLocal ? `\nSalinan ada di server: ${BACKUP_DIR}/${built.fileName}` : ''}`, after)
        }
        return sendBtn('Backup selesai ✅', after)
    }

    // ───────── .setbackup ─────────
    if (command === 'setbackup') {
        const sub = (args[0] || '').toLowerCase()
        let note = ''

        if (!sub || sub === 'status') {
            const c = getBackupConfig()
            return sendBtn(statusText(c), settingButtons(c))
        }

        if (sub === 'on' || sub === 'off') {
            const turningOn = sub === 'on'
            setBackupConfig({ on: turningOn })
            if (turningOn) {
                // mulai hitung dari sekarang supaya tidak langsung mengirim backup lama
                const fitur = (global.db.fitur ||= {})
                fitur.backupLast = Date.now()
                saveDB(global.db)
            }
            note = `Auto backup ${turningOn ? 'dihidupkan ✅' : 'dimatikan ❌'}.`
        } else if (sub === 'interval') {
            const mnt = parseInterval(args[1])
            if (!mnt) return reply(`Format interval: *${p}setbackup interval 30* (menit), *6j* (jam), atau *1h* (hari).`)
            if (mnt < INTERVAL_MIN || mnt > INTERVAL_MAX) return reply(`Interval harus antara ${INTERVAL_MIN} menit sampai ${fmtInterval(INTERVAL_MAX)}.`)
            setBackupConfig({ intervalMenit: mnt })
            note = `Interval auto backup: tiap ${fmtInterval(mnt)}.`
        } else if (sub === 'kirim') {
            const targets = args.slice(1)
            if (!targets.length) return reply(`Contoh:\n*${p}setbackup kirim owner*\n*${p}setbackup kirim ini*\n*${p}setbackup kirim 628xxx 628yyy*\n*${p}setbackup kirim 120363xxx@g.us*`)

            let spec
            if (targets.length === 1 && /^owner$/i.test(targets[0])) spec = 'owner'
            else if (targets.length === 1 && /^(ini|here|chat)$/i.test(targets[0])) spec = [m.isGroup ? jid : (sender || jid)]
            else {
                spec = []
                for (const t of targets) {
                    if (t.includes('@')) spec.push(t)
                    else {
                        const n = normalizeNumber(t)
                        if (n.length < 8) return reply(`Tujuan tidak valid: ${t}`)
                        spec.push(`${n}@s.whatsapp.net`)
                    }
                }
            }
            setBackupConfig({ kirimKe: spec })
            note = `Tujuan pengiriman: ${describeTarget(spec)}.`
        } else if (sub === 'lokal') {
            const v = (args[1] || '').toLowerCase()
            if (!['on', 'off'].includes(v)) return reply(`Contoh: *${p}setbackup lokal on* atau *off*`)
            setBackupConfig({ simpanLokal: v === 'on' })
            note = `Salinan lokal ${v === 'on' ? 'dihidupkan ✅' : 'dimatikan ❌'}.`
        } else if (sub === 'maks') {
            const n = Math.floor(Number(args[1]))
            if (!Number.isFinite(n) || n < 1 || n > KEEP_MAX) return reply(`Contoh: *${p}setbackup maks 10* (1–${KEEP_MAX})`)
            setBackupConfig({ maksLokal: n })
            note = `Salinan lokal yang disimpan: ${n} terakhir.`
        } else if (sub === 'reset') {
            resetBackupConfig()
            note = 'Pengaturan dikembalikan ke config.js.'
        } else {
            return reply(
                `*Pengaturan backup database*\n\n` +
                `${p}setbackup — status & tombol\n` +
                `${p}setbackup on|off\n` +
                `${p}setbackup interval 30 | 6j | 1h\n` +
                `${p}setbackup kirim owner | ini | 628xxx | <id grup>\n` +
                `${p}setbackup lokal on|off\n` +
                `${p}setbackup maks 10\n` +
                `${p}setbackup reset`
            )
        }

        const c = getBackupConfig()
        return sendBtn(`${note}\n\n${statusText(c)}`, settingButtons(c))
    }

    // ───────── .listbackup ─────────
    if (command === 'listbackup') {
        const list = listLocalBackups()
        if (!list.length) {
            return sendBtn(`Belum ada salinan backup di server (${BACKUP_DIR}).`, [quick('💾 Backup Sekarang', `${p}backupdb`), quick('⚙️ Pengaturan', `${p}setbackup`)])
        }

        const lines = list.map((b, i) => `${i + 1}. ${b.name}\n    ${wibStamp(b.mtime)} WIB • ${fmtSize(b.size)}`)
        const rows = (cmd) => list.slice(0, 10).map((b, i) => ({
            title: `${i + 1}. ${wibStamp(b.mtime)} WIB`,
            description: `${fmtSize(b.size)} • ${b.name}`.slice(0, 72),
            id: `${p}${cmd} ${b.name}`
        }))

        return sendBtn(
            `*Salinan backup di server (${list.length})*\n\n${lines.join('\n')}` +
            (list.length > 10 ? `\n\nTombol hanya menampilkan 10 terbaru. Yang lain: *${p}getbackup <no>*` : ''),
            [
                { type: 'single_select', text: '📥 Kirim File', sections: [{ title: 'Kirim file backup', rows: rows('getbackup') }] },
                { type: 'single_select', text: '♻️ Restore', sections: [{ title: 'Kembalikan database dari...', rows: rows('restoredb') }] },
                { type: 'single_select', text: '🗑 Hapus', sections: [{ title: 'Hapus salinan', rows: rows('delbackup') }] },
                quick('💾 Backup Sekarang', `${p}backupdb`),
                quick('⚙️ Pengaturan', `${p}setbackup`)
            ]
        )
    }

    // ───────── .getbackup / .delbackup / .restoredb ─────────
    if (['getbackup', 'delbackup', 'restoredb'].includes(command)) {
        if (!args[0]) {
            const list = listLocalBackups()
            if (!list.length) return reply(`Belum ada salinan backup di server (${BACKUP_DIR}).`)
            return reply(`Sebutkan nomor atau nama filenya, contoh: *${p}${command} 1*\nLihat daftar: *${p}listbackup*`)
        }
        const b = resolveBackup(args[0])
        if (!b) return sendBtn('Backup tidak ditemukan.', [quick('📋 List Backup', `${p}listbackup`)])

        if (command === 'getbackup') {
            if (b.size / 1048576 > BACKUP_MAX_MB) return reply(`File ${b.name} berukuran ${fmtSize(b.size)}, melebihi batas kirim WhatsApp (${BACKUP_MAX_MB} MB). Ambil langsung dari folder ${BACKUP_DIR} di server.`)
            try {
                await sendFile(fs.readFileSync(backupPath(b.name)), b.name, `💾 ${b.name}\n${wibStamp(b.mtime)} WIB • ${fmtSize(b.size)}`)
            } catch (e) {
                return reply(`Gagal mengirim file: ${e.message}`)
            }
            return
        }

        if (command === 'delbackup') {
            deleteLocalBackup(b.name)
            return sendBtn(`Salinan ${b.name} dihapus.`, [quick('📋 List Backup', `${p}listbackup`)])
        }

        // restoredb: dua langkah, harus konfirmasi "ya"
        if ((args[1] || '').toLowerCase() !== 'ya') {
            return sendBtn(
                `⚠️ *Restore database*\n\n` +
                `Sumber : ${b.name}\n${wibStamp(b.mtime)} WIB • ${fmtSize(b.size)}\n\n` +
                `Data bot sekarang (user, grup, premium, RPG, toko, dst.) akan DIGANTI dengan isi backup ini. ` +
                `Kondisi sekarang disimpan otomatis dulu sebagai salinan *pre-restore* supaya bisa dibatalkan.\n\n` +
                `Lanjutkan?`,
                [quick('✅ Ya, Restore', `${p}restoredb ${b.name} ya`), quick('❌ Batal', `${p}listbackup`)]
            )
        }

        await reply('Merestore database...')
        try {
            const r = await restoreFromZip(fs.readFileSync(backupPath(b.name)))
            return sendBtn(
                `Restore selesai ✅\n\n` +
                `File dipulihkan: ${r.files.join(', ')}\n` +
                `Key data: ${r.keys}${r.media ? `\nMedia: ${r.media}` : ''}\n` +
                (r.safetyName ? `Kondisi sebelumnya disimpan sebagai *${r.safetyName}*.\n` : '') +
                `\nRestart bot disarankan supaya semua fitur membaca data hasil restore.`,
                [quick('🔄 Restart Bot', `${p}restart`), quick('📋 List Backup', `${p}listbackup`)]
            )
        } catch (e) {
            return reply(`Restore gagal: ${e.message}`)
        }
    }
}

handler.help = ['backupdb', 'backupdb setbackup', 'backupdb listbackup', 'backupdb getbackup', 'backupdb delbackup', 'backupdb restoredb']
handler.tags = ['owner']
handler.command = ['backupdb', 'delbackup', 'getbackup', 'listbackup', 'restoredb', 'setbackup']
handler.owner = true

export default handler
