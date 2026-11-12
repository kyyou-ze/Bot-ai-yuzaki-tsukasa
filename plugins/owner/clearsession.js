import { cleanSessionFiles } from '../../lib/db/session-backup.js'

// Bersihkan sesi enkripsi rusak (penyebab "Bad MAC") TANPA logout. Fungsi intinya ada di
// lib/db/session-backup.js (cleanSessionFiles), dipakai juga oleh `npm run clean-session`.
const fmt = (bytes) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`

let handler = async (m, { reply }) => {
    const { found, files, bytes, failed } = cleanSessionFiles()
    if (!found) return reply('Folder session tidak ditemukan.')

    return reply(
        `* CLEAR SESSION*\n` +
        `File dihapus : *${files}*\n` +
        `Ruang kosong : *${fmt(bytes)}*` +
        (failed ? `\nGagal hapus : ${failed} file` : '') +
        `\n\n_creds.json tetap aman, bot tidak logout. Sesi chat akan terbentuk ulang otomatis; kalau ada pesan sempat gagal terbaca sebentar, itu normal._`
    )
}

handler.command = ['clearsession', 'clean-session', 'cleansession']
handler.help = ['clearsession']
handler.tags = ['owner']
handler.owner = true

export default handler
