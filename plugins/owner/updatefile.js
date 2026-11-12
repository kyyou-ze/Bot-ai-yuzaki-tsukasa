import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const BACKUP_DIR = path.join(ROOT, 'database', 'file-backups')
const TITLE = 'File Manager'

const ALLOWED_EXT = ['.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.html']
// db/ diblok: db.json dipegang di memori bot dan ditulis ulang tiap ada perubahan
const BLOCKED_DIRS = ['session', 'node_modules', 'plugins', 'database', 'db']
const KEEP_BACKUPS = 5
const MAX_FILE = 5 * 1024 * 1024

const USAGE = `*Perbarui file bot* (selain plugins)

1) Lewat file
Kirim / reply file lalu ketik:
.updatefile            (nama file = nama aslinya, di folder utama)
.updatefile lib/myfunc.js

2) Lewat kode ketikan
.updatefile index.js
<isi kode di baris bawah>

3) Reply pesan berisi kode
.updatefile handler.js

Tambah --restart di akhir kalau bot perlu restart otomatis (butuh pm2 / panel yang auto-restart).

Lainnya:
.getfile handler.js       (ambil file saat ini)
.restorefile handler.js   (kembalikan versi sebelumnya)

Untuk plugin pakai .addplugin`

function resolveTarget(input = '') {
    const name = input.replace(/\\/g, '/').replace(/^\.?\/+/, '')
    if (!name || !/^[\w\-./]+$/.test(name)) return { error: 'Nama / path file tidak valid. Pakai huruf, angka, _ - . dan /' }

    const full = path.resolve(ROOT, name)
    if (!full.startsWith(ROOT + path.sep)) return { error: 'Path di luar folder bot ditolak.' }

    const rel = path.relative(ROOT, full).replace(/\\/g, '/')
    const parts = rel.split('/')
    if (parts.some(p => p.startsWith('.'))) return { error: 'File / folder tersembunyi tidak boleh diubah.' }
    if (parts[0] === 'plugins') return { error: 'Untuk file di folder plugins pakai .addplugin' }
    if (BLOCKED_DIRS.includes(parts[0])) return { error: `Folder ${parts[0]} tidak boleh diubah.` }
    if (!ALLOWED_EXT.includes(path.extname(rel).toLowerCase())) {
        return { error: `Ekstensi harus salah satu dari: ${ALLOWED_EXT.join(' ')}` }
    }
    return { full, rel }
}

// ─── backup ────────────────────────────────────────────────────────────────

const backupKey = rel => rel.replace(/\//g, '__') + '.'

function listBackups(rel) {
    if (!fs.existsSync(BACKUP_DIR)) return []
    const key = backupKey(rel)
    const stamp = f => Number(f.slice(key.length, -4))
    return fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith(key) && f.endsWith('.bak') && /^\d+$/.test(f.slice(key.length, -4)))
        .sort((a, b) => stamp(b) - stamp(a))
}

function makeBackup(rel, full) {
    if (!fs.existsSync(full)) return false
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    fs.copyFileSync(full, path.join(BACKUP_DIR, `${backupKey(rel)}${Date.now()}.bak`))
    for (const old of listBackups(rel).slice(KEEP_BACKUPS)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old))
    }
    return true
}

// ─── validasi ──────────────────────────────────────────────────────────────

function checkSyntax(code, rel) {
    const ext = path.extname(rel).toLowerCase()
    if (ext === '.json') {
        JSON.parse(code)
        return Promise.resolve()
    }
    if (!['.js', '.mjs', '.cjs'].includes(ext)) return Promise.resolve()

    // project ini ESM ("type": "module"), jadi .js dicek sebagai .mjs
    const tmp = path.join(os.tmpdir(), `syntax_${Date.now()}${ext === '.cjs' ? '.cjs' : '.mjs'}`)
    fs.writeFileSync(tmp, code)
    return new Promise((resolve, reject) => {
        execFile(process.execPath, ['--check', tmp], (err, _out, stderr) => {
            try { fs.unlinkSync(tmp) } catch {}
            if (!err) return resolve()
            const msg = String(stderr || err.message).split(tmp).join(rel).trim().slice(0, 700)
            reject(new Error(msg))
        })
    })
}

// ─── helper pesan ──────────────────────────────────────────────────────────

function pickDoc(m) {
    if (m.mtype === 'documentMessage') return { fileName: m.msg?.fileName || '', download: m.download }
    if (m.quoted?.mtype === 'documentMessage') return { fileName: m.quoted.fileName || '', download: m.quoted.download }
    return null
}

function cleanCode(code = '') {
    return code
        .replace(/^\s*```[a-z]*[ \t]*\r?\n?/i, '')
        .replace(/\r?\n?```\s*$/, '')
        .trim()
}

function restartNote(rel, restart) {
    if (restart) return '🔄 Bot restart sebentar lagi...'
    if (rel === 'config.js') return '✔️ Langsung berlaku (config.js di-reload otomatis).'
    if (rel === 'package.json') return '⚠️ Jalankan npm install, lalu restart bot.'
    if (/\.(m|c)?js$/.test(rel)) return '⚠️ Perlu restart bot supaya berlaku (tambah --restart, atau restart manual).'
    return ''
}

function scheduleRestart() {
    setTimeout(() => process.exit(0), 1500)
}

// ─── commands ──────────────────────────────────────────────────────────────

async function updateFile(m, { firstToken, rest, restart, notifReply }) {
    const doc = pickDoc(m)
    let target, code

    if (doc) {
        const hasExt = ALLOWED_EXT.includes(path.extname(firstToken).toLowerCase())
        const relPath = hasExt
            ? firstToken
            : (firstToken ? `${firstToken}/` : '') + (doc.fileName || '')
        target = resolveTarget(relPath)
        if (target.error) return notifReply(target.error, TITLE)
        const buffer = await doc.download()
        if (buffer.length > MAX_FILE) return notifReply('File terlalu besar (maks 5 MB).', TITLE)
        code = buffer.toString('utf8')
    } else {
        if (!firstToken) return notifReply(USAGE, TITLE)
        target = resolveTarget(firstToken)
        if (target.error) return notifReply(target.error, TITLE)
        code = rest || m.quoted?.text || ''
    }

    code = cleanCode(code)
    if (!code) return notifReply(USAGE, TITLE)

    const { full, rel } = target

    try {
        await checkSyntax(code, rel)
    } catch (e) {
        return notifReply(`Kode tidak valid, file TIDAK diubah.\n\n${e.message}`, TITLE)
    }

    const existed = fs.existsSync(full)
    const backedUp = makeBackup(rel, full)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, code + '\n')

    const note = restartNote(rel, restart)
    await notifReply(
        `✅ ${rel} ${existed ? 'diperbarui' : 'dibuat'}\n` +
        (backedUp ? `💾 Versi lama disimpan (.restorefile ${rel})\n` : '') +
        (note ? `\n${note}` : ''),
        TITLE
    )
    if (restart) scheduleRestart()
}

async function restoreFile(m, { firstToken, restart, notifReply }) {
    if (!firstToken) return notifReply('Contoh:\n.restorefile handler.js', TITLE)
    const target = resolveTarget(firstToken)
    if (target.error) return notifReply(target.error, TITLE)

    const { full, rel } = target
    const [latest] = listBackups(rel)
    if (!latest) return notifReply(`Belum ada backup untuk ${rel}.`, TITLE)

    const code = fs.readFileSync(path.join(BACKUP_DIR, latest), 'utf8')
    try {
        await checkSyntax(code, rel)
    } catch (e) {
        return notifReply(`Backup tidak lolos cek, tidak dipulihkan.\n\n${e.message}`, TITLE)
    }

    makeBackup(rel, full) // versi sekarang jadi backup, jadi bisa di-restore balik
    fs.writeFileSync(full, code)
    fs.unlinkSync(path.join(BACKUP_DIR, latest))

    const note = restartNote(rel, restart)
    await notifReply(`↩️ ${rel} dikembalikan ke versi sebelumnya.${note ? `\n\n${note}` : ''}`, TITLE)
    if (restart) scheduleRestart()
}

async function getFile(m, { conn, firstToken, notifReply }) {
    if (!firstToken) return notifReply('Contoh:\n.getfile handler.js', TITLE)
    const target = resolveTarget(firstToken)
    if (target.error) return notifReply(target.error, TITLE)
    if (!fs.existsSync(target.full)) return notifReply(`${target.rel} tidak ditemukan.`, TITLE)

    await conn.sendMessage(m.chat, {
        document: fs.readFileSync(target.full),
        fileName: path.basename(target.rel),
        mimetype: target.rel.endsWith('.json') ? 'application/json' : 'text/plain'
    }, { quoted: m })
}

let handler = async (m, { sock: conn, command, text }) => {
    const notifReply = (t, title = 'Notification') => conn.sendMessage(m.chat, { text: `*${title}*\n\n${t}` }, { quoted: m })
    try {
        let raw = (text || '').replace(/^\s+/, '')

        let restart = false
        raw = raw.replace(/(^|\s)--restart\b/gi, (_, sp) => { restart = true; return sp })
        raw = raw.replace(/^\s+/, '')

        const firstToken = raw.match(/^\S*/)[0]
        const rest = raw.slice(firstToken.length).replace(/^[ \t]*\r?\n?/, '')
        const ctx = { conn, firstToken, rest, restart, notifReply }

        if (/^(update|up|set)/.test(command)) return await updateFile(m, ctx)
        if (/^restore/.test(command)) return await restoreFile(m, ctx)
        return await getFile(m, ctx)
    } catch (e) {
        console.error(e)
        await notifReply(`${e.name}: ${e.message}`, 'File Manager Error')
    }
}

handler.command = ['updatefile', 'getfile', 'restorefile']
handler.tags = ['owner']
handler.owner = true

export default handler
