/**
 * Cek database SQLite lewat command (khusus owner)
 *
 *   .cekdb                 ringkasan: mesin, file, ukuran, status simpan
 *   .cekdb setting         semua pengaturan & PRAGMA SQLite + config.js terkait
 *   .cekdb tabel           isi per file logis (bot/rpg/store/tools) + grup data terbesar
 *   .cekdb besar [n]       baris terbesar di tabel kv (default 10)
 *   .cekdb cek [full]      quick_check (atau integrity_check kalau "full")
 *   .cekdb sync            samakan & bandingkan memori dengan isi file di disk
 *   .cekdb simpan          paksa simpan sekarang
 *   .cekdb checkpoint      gabungkan file -wal ke kaguya.db
 *   .cekdb vacuum [ya]     rapikan file database (butuh konfirmasi)
 *   .cekdb semua           laporan lengkap sekaligus
 */

import {
    sqliteInfo, sqliteBiggest, sqliteGroups, sqliteIntegrity, sqliteVerify,
    sqliteFlushForce, sqliteCheckpoint, sqliteVacuum, usingSqlite, DB_FILES
} from '../../lib/db/database.js'
import { fmtSize, wibStamp } from '../../lib/db/backup.js'
import { buttonsToText } from '../../lib/platform/wa.js'

const quick = (text, id) => ({ type: 'reply', text, id })
const onOff = (v) => (v ? 'ON ✅' : 'OFF ❌')
const nf = (n) => Number(n || 0).toLocaleString('id-ID')
const ago = (t) => {
    if (!t) return '-'
    const s = Math.max(0, Math.round((Date.now() - t) / 1000))
    if (s < 60) return `${s} detik lalu`
    if (s < 3600) return `${Math.round(s / 60)} menit lalu`
    if (s < 86400) return `${(s / 3600).toFixed(1)} jam lalu`
    return `${(s / 86400).toFixed(1)} hari lalu`
}
const cut = (s, n = 48) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s))

function sectionRingkas(i) {
    const aktif = i.backend === 'sqlite'
    const L = []
    L.push('🗄 *STATUS DATABASE*')
    L.push('')
    L.push(`Backend aktif : *${String(i.backend).toUpperCase()}* ${aktif ? '✅' : '⚠️ (bukan SQLite)'}`)
    L.push(`Mesin         : ${i.engine || '-'}`)
    L.push(`File          : ${i.file}`)
    L.push(`Ukuran db     : ${fmtSize(i.fileSize)}`)
    L.push(`File WAL      : ${fmtSize(i.walSize)}`)
    L.push(`File SHM      : ${fmtSize(i.shmSize)}`)
    L.push(`Terakhir ubah : ${i.fileMtime ? `${wibStamp(i.fileMtime)} WIB (${ago(i.fileMtime)})` : '-'}`)
    if (aktif) {
        L.push(`Total baris kv: ${nf(i.totalRows)}`)
        L.push(`Cache hash    : ${nf(i.hashRows)} baris`)
    }
    L.push('')
    L.push('💾 *Penyimpanan*')
    L.push(`Antrean tulis : ${i.pendingWrite ? 'ada (menunggu flush)' : 'kosong'}`)
    L.push(`Flush sukses  : ${nf(i.stat.flushes)}x`)
    L.push(`Flush terakhir: ${ago(i.stat.lastOkAt)}${i.stat.lastOkAt ? ` • ${i.stat.lastMs} ms • +${nf(i.stat.lastUp)} ubah/${nf(i.stat.lastDel)} hapus` : ''}`)
    L.push(`Error simpan  : ${nf(i.stat.errors)}${i.stat.lastErr ? `\n  ↳ ${i.stat.lastErr} (${ago(i.stat.lastErrAt)})` : ''}`)
    if (!aktif) {
        L.push('')
        L.push('⚠️ Bot sedang memakai JSON. Cek `.cekdb setting` untuk alasannya.')
    }
    return L.join('\n')
}

function sectionSetting(i) {
    const L = []
    L.push('⚙️ *PENGATURAN DATABASE*')
    L.push('')
    L.push('*config.js*')
    L.push(`global.dbEngine      : ${i.engineSetting}`)
    L.push(`global.hanyaTerdaftar: ${onOff(i.hanyaTerdaftar)}`)
    L.push('')
    L.push('*Lingkungan*')
    L.push(`Node.js        : ${i.node}`)
    L.push(`node:sqlite    : ${i.nodeSqlite ? 'tersedia ✅' : 'tidak ada ❌'}`)
    L.push(`better-sqlite3 : ${i.betterSqlite ? 'terpasang ✅' : 'tidak ada ❌'}`)
    L.push(`Folder database: ${i.dir}`)
    L.push(`Folder bisa ditulis: ${i.dirWritable ? 'ya ✅' : 'TIDAK ❌'}`)
    if (i.pragmas) {
        const p = i.pragmas
        const pageBytes = Number(p.page_size) * Number(p.page_count)
        const freeBytes = Number(p.page_size) * Number(p.freelist_count)
        L.push('')
        L.push('*PRAGMA SQLite*')
        L.push(`journal_mode   : ${p.journal_mode}`)
        L.push(`synchronous    : ${p.synchronous} (${{ 0: 'OFF', 1: 'NORMAL', 2: 'FULL', 3: 'EXTRA' }[p.synchronous] ?? '?'})`)
        L.push(`busy_timeout   : ${p.busy_timeout} ms`)
        L.push(`wal_autocheckpt: ${p.wal_autocheckpoint} halaman`)
        L.push(`encoding       : ${p.encoding}`)
        L.push(`user_version   : ${p.user_version}`)
        L.push(`page_size      : ${nf(p.page_size)} B`)
        L.push(`page_count     : ${nf(p.page_count)} (${fmtSize(pageBytes)})`)
        L.push(`freelist_count : ${nf(p.freelist_count)} (${fmtSize(freeBytes)} bisa dipadatkan)`)
    }
    L.push('')
    L.push('*Struktur*')
    if (i.tables.length) for (const t of i.tables) L.push(`• ${t.type}: ${t.name}`)
    else L.push('• (tidak ada / SQLite tidak aktif)')
    L.push('')
    L.push('*Skema:* kv(f, p, t, v) — f=file logis, p=path JSON, t=o/v, v=isi JSON')
    return L.join('\n')
}

function sectionTabel(i, groups) {
    const L = []
    L.push('📚 *ISI DATABASE*')
    L.push('')
    L.push('*Per file logis (di SQLite)*')
    if (i.perFile.length) {
        for (const r of i.perFile) L.push(`• ${r.f}: ${nf(r.rows)} baris • ${fmtSize(Number(r.bytes))}`)
    } else L.push('• (kosong)')
    L.push('')
    L.push('*Di memori (global.db)*')
    for (const m of i.memory) L.push(`• ${m.name}: ${m.keys} key`)
    L.push('')
    L.push('*Fungsi tiap file*')
    for (const [name, { desc }] of Object.entries(DB_FILES)) L.push(`• ${name}: ${cut(desc, 90)}`)
    if (groups.length) {
        L.push('')
        L.push('*Grup data terbesar*')
        for (const g of groups.slice(0, 12)) L.push(`• ${g.key}: ${nf(g.rows)} baris • ${fmtSize(g.bytes)}`)
    }
    L.push('')
    L.push('*File JSON lama*')
    const adaJson = i.jsonFiles.filter((f) => f.size)
    if (adaJson.length) for (const f of adaJson) L.push(`• ${f.file}: ${fmtSize(f.size)} (${ago(f.mtime)})`)
    else L.push('• tidak ada (sudah dipindah ke SQLite)')
    if (i.archived.length) {
        L.push('')
        L.push(`*Arsip sebelum migrasi* (${i.archived.length} file)`)
        for (const a of i.archived.slice(0, 8)) L.push(`• ${cut(a.name, 60)} • ${fmtSize(a.size)}`)
    }
    return L.join('\n')
}

function sectionBesar(rows) {
    const L = ['🐘 *BARIS TERBESAR*', '']
    if (!rows.length) L.push('(kosong)')
    rows.forEach((r, n) => L.push(`${n + 1}. ${r.f} ${cut(r.p, 52)}\n    ${fmtSize(Number(r.bytes))}`))
    return L.join('\n')
}

function sectionCek(r) {
    return [
        `🔎 *${r.mode.toUpperCase()}*`,
        '',
        `Hasil : ${r.ok ? 'OK, tidak ada kerusakan ✅' : 'ADA MASALAH ❌'}`,
        `Waktu : ${r.ms} ms`,
        ...(r.ok ? [] : ['', ...r.result.map((x) => `• ${cut(x, 100)}`), '', 'Saran: .backupdb sekarang, lalu pertimbangkan .restoredb dari backup terakhir.'])
    ].join('\n')
}

let handler = async (m, { sock, jid, text, reply, usedPrefix, prefix }) => {
    if (m.fromMe && m.isGroup) return
    const p = usedPrefix ?? prefix ?? '.'
    const args = String(text || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    const sub = args[0] || 'ringkas'

    const sendBtn = async (body, buttons) => {
        try {
            return await sock.sendButtons(jid, { text: body, footer: global.namebot || 'Kaguya', buttons }, { quoted: m })
        } catch {
            const extra = buttonsToText(buttons)
            return reply(extra ? `${body}\n\n${extra}` : body)
        }
    }
    const menuButtons = [
        quick('⚙️ Setting', `${p}cekdb setting`),
        quick('📚 Isi', `${p}cekdb tabel`),
        quick('🔎 Cek Integritas', `${p}cekdb cek`),
        quick('🔄 Sinkron', `${p}cekdb sync`)
    ]

    try {
        if (sub === 'ringkas' || sub === 'status' || sub === 'info') {
            return sendBtn(sectionRingkas(sqliteInfo()), menuButtons)
        }
        if (sub === 'setting' || sub === 'config' || sub === 'pragma') {
            return sendBtn(sectionSetting(sqliteInfo()), [quick('🗄 Status', `${p}cekdb`), quick('📚 Isi', `${p}cekdb tabel`)])
        }
        if (sub === 'tabel' || sub === 'isi' || sub === 'data') {
            return sendBtn(sectionTabel(sqliteInfo(), sqliteGroups()), [quick('🐘 Terbesar', `${p}cekdb besar`), quick('🗄 Status', `${p}cekdb`)])
        }
        if (sub === 'besar' || sub === 'top') {
            return sendBtn(sectionBesar(sqliteBiggest(Number(args[1]) || 10)), [quick('📚 Isi', `${p}cekdb tabel`)])
        }

        // sisanya hanya bermakna kalau SQLite aktif
        if (!usingSqlite()) {
            return reply('SQLite sedang tidak aktif (bot memakai JSON), jadi perintah ini tidak bisa dipakai.\nCek alasannya lewat `' + p + 'cekdb setting`.')
        }

        if (sub === 'cek' || sub === 'check' || sub === 'integrity') {
            await reply(args[1] === 'full' ? 'Menjalankan integrity_check (bisa agak lama)...' : 'Menjalankan quick_check...')
            const r = sqliteIntegrity(args[1] === 'full')
            return sendBtn(sectionCek(r), args[1] === 'full' ? [quick('🗄 Status', `${p}cekdb`)] : [quick('🔬 Cek Full', `${p}cekdb cek full`), quick('🗄 Status', `${p}cekdb`)])
        }
        if (sub === 'sync' || sub === 'verify') {
            await reply('Menyimpan antrean lalu membandingkan memori dengan isi file...')
            const r = sqliteVerify()
            return sendBtn(
                `🔄 *SINKRONISASI*\n\nMemori vs file ${r.sama ? 'SAMA ✅' : 'BERBEDA ⚠️'}\nWaktu: ${r.ms} ms` +
                (r.sama ? '' : '\n\nAda data di memori yang belum/tidak sama di disk. Coba `' + p + 'cekdb simpan`, lalu ulangi. Kalau tetap beda, cek `' + p + 'cekdb status` bagian Error simpan.'),
                [quick('💾 Simpan Sekarang', `${p}cekdb simpan`), quick('🗄 Status', `${p}cekdb`)]
            )
        }
        if (sub === 'simpan' || sub === 'flush' || sub === 'save') {
            const r = sqliteFlushForce()
            return sendBtn(`💾 Data tersimpan ke SQLite (${r.ms} ms).`, [quick('🔄 Sinkron', `${p}cekdb sync`), quick('🗄 Status', `${p}cekdb`)])
        }
        if (sub === 'checkpoint' || sub === 'wal') {
            const r = sqliteCheckpoint()
            return sendBtn(`🧹 *WAL checkpoint*\n\nUkuran WAL: ${fmtSize(r.before)} → ${fmtSize(r.after)}\nBusy: ${r.busy ?? '-'} • log: ${r.log ?? '-'} • tercatat: ${r.checkpointed ?? '-'}`, [quick('🗄 Status', `${p}cekdb`)])
        }
        if (sub === 'vacuum' || sub === 'rapikan') {
            if (args[1] !== 'ya') {
                const i = sqliteInfo()
                const free = Number(i.pragmas?.page_size) * Number(i.pragmas?.freelist_count)
                return sendBtn(
                    `⚠️ *VACUUM database*\n\nMenyusun ulang file kaguya.db supaya ukurannya padat.\nUkuran sekarang: ${fmtSize(i.fileSize + i.walSize)}\nRuang kosong yang bisa dipadatkan: ${fmtSize(free)}\n\nButuh ruang disk sebesar file database dan bot sempat berhenti merespons sebentar. Disarankan jalankan \`${p}backupdb\` dulu.\n\nLanjutkan?`,
                    [quick('✅ Ya, Rapikan', `${p}cekdb vacuum ya`), quick('💾 Backup Dulu', `${p}backupdb`), quick('❌ Batal', `${p}cekdb`)]
                )
            }
            await reply('Merapikan database...')
            const r = sqliteVacuum()
            return sendBtn(`✅ *VACUUM selesai*\n\nUkuran: ${fmtSize(r.before)} → ${fmtSize(r.after)}`, [quick('🗄 Status', `${p}cekdb`)])
        }
        if (sub === 'semua' || sub === 'full' || sub === 'all') {
            const i = sqliteInfo()
            const chk = sqliteIntegrity(false)
            const v = sqliteVerify()
            const body = [
                sectionRingkas(i),
                sectionSetting(i),
                sectionTabel(i, sqliteGroups()),
                sectionBesar(sqliteBiggest(5)),
                sectionCek(chk),
                `🔄 Memori vs file: ${v.sama ? 'SAMA ✅' : 'BERBEDA ⚠️'} (${v.ms} ms)`
            ].join('\n\n━━━━━━━━━━━━━━\n\n')
            // pesan dipecah supaya tidak melewati batas panjang WhatsApp
            const parts = body.match(/[\s\S]{1,3500}(?:\n|$)/g) || [body]
            for (const part of parts) await reply(part.trimEnd())
            return
        }

        return sendBtn(
            `Sub-perintah tidak dikenal: *${sub}*\n\n` +
            `*${p}cekdb* — ringkasan\n*${p}cekdb setting* — pengaturan & PRAGMA\n*${p}cekdb tabel* — isi per file\n*${p}cekdb besar [n]* — baris terbesar\n` +
            `*${p}cekdb cek [full]* — cek kerusakan\n*${p}cekdb sync* — bandingkan memori & disk\n*${p}cekdb simpan* — paksa simpan\n` +
            `*${p}cekdb checkpoint* — rapikan WAL\n*${p}cekdb vacuum* — padatkan file\n*${p}cekdb semua* — laporan lengkap`,
            menuButtons
        )
    } catch (e) {
        return reply(`Gagal: ${e.message}`)
    }
}

handler.help = ['cekdb', 'cekdb setting', 'cekdb tabel', 'cekdb besar', 'cekdb cek', 'cekdb sync', 'cekdb simpan', 'cekdb checkpoint', 'cekdb vacuum', 'cekdb semua']
handler.tags = ['owner']
handler.command = ['cekdb', 'dbinfo', 'cekdatabase', 'statusdb']
handler.owner = true

export default handler
