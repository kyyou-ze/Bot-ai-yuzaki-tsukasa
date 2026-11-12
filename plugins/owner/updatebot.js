import fs from 'fs'
import path from 'path'
import os from 'os'
import zlib from 'zlib'
import { execFile } from 'child_process'
import { fileURLToPath } from 'url'

// ═══════════════════════════════════════════════════════════════
// .updatebot — update seluruh script bot dari chat, tanpa buka hosting.
//
//  1) Kirim / reply file .zip script baru + ketik  .updatebot
//  2) .updatebot <link zip>   (mis. https://github.com/user/repo/archive/refs/heads/main.zip)
//  3) .updatebot              (pakai global.updateUrl dari config.js kalau diisi)
//
// File yang sama persis dilewati, file berbeda ditimpa, file baru ditambahkan.
// Tidak ada file yang dihapus. Sebelum menimpa, versi lama dibackup supaya bisa .updatebot rollback.
// ═══════════════════════════════════════════════════════════════

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const BACKUP_ROOT = path.join(ROOT, 'database', 'update-backups')
const KEEP_BACKUPS = 3

const MAX_ZIP = 100 * 1024 * 1024        // ukuran zip maksimal
const MAX_ENTRY = 50 * 1024 * 1024       // ukuran satu file setelah diekstrak
const MAX_TOTAL = 300 * 1024 * 1024      // total hasil ekstrak (anti zip bomb)
const MAX_FILES = 5000

// Tidak pernah disentuh oleh update (data & session milik bot yang sedang berjalan).
const PROTECTED_DIRS = new Set(['session', 'database', 'db', 'node_modules', '.update-backups', '.file-backups'])
const PROTECTED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'])
// config.js dilewati supaya owner, API key, dan pengaturanmu tidak tertimpa. Pakai --config untuk menimpanya.
const CONFIG_FILE = 'config.js'

const ALLOWED_EXT = new Set([
    '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.html', '.css',
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.mp4', '.ttf', '.otf'
])

const USAGE = `*Update script bot*

1) Kirim / reply file .zip lalu ketik:
.updatebot

2) Lewat link zip:
.updatebot https://github.com/user/repo/archive/refs/heads/main.zip

3) Tanpa argumen = pakai global.updateUrl dari config.js

Opsi:
--dry         lihat perubahan saja, tidak menerapkan
--config      ikut menimpa config.js (bawaan: dilewati)
--norestart   jangan restart setelah update
--noinstall   jangan jalankan npm install

Lainnya:
.updatebot rollback  (kembalikan update terakhir)

_File lama dibackup otomatis. File tidak dihapus, hanya diperbarui dan ditambah. Folder session & db tidak pernah disentuh._`

// ─── zip reader (tanpa dependensi) ─────────────────────────────────────────

const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c >>> 0
    }
    return t
})()

function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

export function readZip(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('File bukan zip yang valid.')

    // End Of Central Directory dicari dari belakang
    let eocd = -1
    const min = Math.max(0, buf.length - 22 - 0xffff)
    for (let i = buf.length - 22; i >= min; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('File bukan zip yang valid (EOCD tidak ditemukan).')

    const total = buf.readUInt16LE(eocd + 10)
    const cdOffset = buf.readUInt32LE(eocd + 16)
    if (total === 0xffff || cdOffset === 0xffffffff) throw new Error('Zip64 (zip terlalu besar) tidak didukung.')
    if (total > MAX_FILES) throw new Error(`Zip berisi terlalu banyak entri (maks ${MAX_FILES}).`)

    const entries = []
    let pos = cdOffset
    for (let i = 0; i < total; i++) {
        if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Struktur zip rusak.')
        const flags = buf.readUInt16LE(pos + 8)
        const method = buf.readUInt16LE(pos + 10)
        const crc = buf.readUInt32LE(pos + 16)
        const csize = buf.readUInt32LE(pos + 20)
        const usize = buf.readUInt32LE(pos + 24)
        const nameLen = buf.readUInt16LE(pos + 28)
        const extraLen = buf.readUInt16LE(pos + 30)
        const commentLen = buf.readUInt16LE(pos + 32)
        const localOffset = buf.readUInt32LE(pos + 42)
        const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen)
        pos += 46 + nameLen + extraLen + commentLen
        entries.push({ name, flags, method, crc, csize, usize, localOffset })
    }
    return entries
}

function extractEntry(buf, e) {
    if (e.flags & 1) throw new Error(`${e.name}: zip terenkripsi tidak didukung.`)
    if (e.usize > MAX_ENTRY) throw new Error(`${e.name}: file terlalu besar (maks ${MAX_ENTRY / 1024 / 1024}MB).`)

    const o = e.localOffset
    if (o + 30 > buf.length || buf.readUInt32LE(o) !== 0x04034b50) throw new Error(`${e.name}: header zip rusak.`)
    const start = o + 30 + buf.readUInt16LE(o + 26) + buf.readUInt16LE(o + 28)
    const raw = buf.subarray(start, start + e.csize)

    let data
    if (e.method === 0) data = Buffer.from(raw)
    else if (e.method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: MAX_ENTRY })
    else throw new Error(`${e.name}: metode kompresi ${e.method} tidak didukung.`)

    if (data.length !== e.usize || crc32(data) !== e.crc) throw new Error(`${e.name}: file rusak (CRC tidak cocok).`)
    return data
}

// ─── path ──────────────────────────────────────────────────────────────────

function cleanName(name) {
    const n = name.replace(/\\/g, '/').replace(/^(\.\/)+/, '')
    if (!n || n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return null
    const parts = n.split('/')
    if (parts.some(p => p === '..' || p === '')) return null
    return parts.join('/')
}

// Zip dari GitHub / folder yang di-zip punya satu folder pembungkus. Buang kalau memang begitu.
function stripWrapper(names) {
    if (names.includes('index.js') || names.includes('package.json')) return ''
    const first = new Set(names.map(n => n.split('/')[0]))
    if (first.size !== 1) return ''
    const root = [...first][0]
    return names.every(n => n.startsWith(root + '/')) ? root + '/' : ''
}

// ─── pemeriksaan sintaks ───────────────────────────────────────────────────

function checkSyntax(data, rel) {
    const ext = path.extname(rel).toLowerCase()
    if (ext === '.json') {
        try { JSON.parse(data.toString('utf8')) } catch (e) { return Promise.reject(new Error(e.message)) }
        return Promise.resolve()
    }
    if (!['.js', '.mjs', '.cjs'].includes(ext)) return Promise.resolve()

    // project ini ESM, jadi .js dicek sebagai .mjs
    const tmp = path.join(os.tmpdir(), `upd_${process.pid}_${Math.random().toString(36).slice(2)}${ext === '.cjs' ? '.cjs' : '.mjs'}`)
    fs.writeFileSync(tmp, data)
    return new Promise((resolve, reject) => {
        execFile(process.execPath, ['--check', tmp], (err, _o, stderr) => {
            try { fs.unlinkSync(tmp) } catch {}
            if (!err) return resolve()
            reject(new Error(String(stderr || err.message).split(tmp).join(rel).trim().split('\n').slice(0, 4).join('\n').slice(0, 400)))
        })
    })
}

async function checkAll(items, limit = 4) {
    const errors = []
    let i = 0
    await Promise.all(Array.from({ length: limit }, async () => {
        while (i < items.length) {
            const it = items[i++]
            try { await checkSyntax(it.data, it.rel) } catch (e) { errors.push(`• ${it.rel}\n${e.message}`) }
        }
    }))
    return errors
}

// ─── ambil zip ─────────────────────────────────────────────────────────────

function pickDoc(m) {
    const isZip = (n = '', mime = '') => /\.zip$/i.test(n) || /zip/i.test(mime)
    if (m.mtype === 'documentMessage' && isZip(m.msg?.fileName, m.msg?.mimetype)) return m.download
    if (m.quoted?.mtype === 'documentMessage' && isZip(m.quoted.fileName, m.quoted.mimetype)) return m.quoted.download
    return null
}

async function fetchZip(url) {
    const headers = global.updateToken ? { Authorization: `Bearer ${global.updateToken}` } : {}
    const res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(120000) })
    if (!res.ok) throw new Error(`Gagal mengunduh (HTTP ${res.status}).`)
    const len = Number(res.headers.get('content-length') || 0)
    if (len > MAX_ZIP) throw new Error('Zip terlalu besar (maks 100MB).')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_ZIP) throw new Error('Zip terlalu besar (maks 100MB).')
    return buf
}

// ─── backup & rollback ─────────────────────────────────────────────────────

function pruneBackups() {
    if (!fs.existsSync(BACKUP_ROOT)) return
    const dirs = fs.readdirSync(BACKUP_ROOT).filter(d => /^\d+$/.test(d)).sort((a, b) => Number(b) - Number(a))
    for (const d of dirs.slice(KEEP_BACKUPS)) fs.rmSync(path.join(BACKUP_ROOT, d), { recursive: true, force: true })
}

function latestBackup() {
    if (!fs.existsSync(BACKUP_ROOT)) return null
    const dirs = fs.readdirSync(BACKUP_ROOT).filter(d => /^\d+$/.test(d)).sort((a, b) => Number(b) - Number(a))
    return dirs[0] ? path.join(BACKUP_ROOT, dirs[0]) : null
}

function restoreFrom(dir) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'))
    for (const rel of manifest.replaced) {
        const dest = path.join(ROOT, rel)
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(path.join(dir, 'files', rel), dest)
    }
    for (const rel of manifest.added) fs.rmSync(path.join(ROOT, rel), { force: true })
    return manifest
}

// ─── helper tampilan ───────────────────────────────────────────────────────

const list = (arr, max = 12) => arr.slice(0, max).map(x => `  ${x}`).join('\n') + (arr.length > max ? `\n  …dan ${arr.length - max} lainnya` : '')

function depsChanged(oldRaw, newRaw) {
    try {
        const a = JSON.parse(oldRaw), b = JSON.parse(newRaw)
        return JSON.stringify([a.dependencies, a.optionalDependencies]) !== JSON.stringify([b.dependencies, b.optionalDependencies])
    } catch {
        return false
    }
}

function npmInstall() {
    const bin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    return new Promise((resolve, reject) => {
        execFile(bin, ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: ROOT, timeout: 10 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 }, (err, _o, stderr) => {
            if (err) return reject(new Error(String(stderr || err.message).trim().split('\n').slice(-4).join('\n')))
            resolve()
        })
    })
}

// Panggil plugin .restart yang sudah ada (restart penuh + kabar online lagi)
async function doRestart(m, ctx) {
    const plugin = Object.values(global.plugins || {}).find(p => Array.isArray(p?.command) && p.command.includes('restart'))
    if (!plugin) return false
    await plugin(m, { ...ctx, text: '', command: 'restart' })
    return true
}

let busy = false

// ─── plugin ────────────────────────────────────────────────────────────────

let handler = async (m, ctx) => {
    const { sock, jid, text = '', reply } = ctx
    const args = text.trim().split(/\s+/).filter(Boolean)
    const flags = new Set(args.filter(a => a.startsWith('--')).map(a => a.toLowerCase()))
    const rest = args.filter(a => !a.startsWith('--'))
    const dry = flags.has('--dry')

    if (busy) return reply('Update lain masih berjalan, tunggu sebentar.')
    busy = true

    let sent = null
    const say = async (t) => {
        if (sent?.key) {
            const ok = await sock.sendMessage(jid, { text: t, edit: sent.key }).then(() => true).catch(() => false)
            if (ok) return
        }
        sent = await reply(t)
    }

    try {
        // ── rollback ──
        if (['rollback', 'undo', 'kembalikan'].includes((rest[0] || '').toLowerCase())) {
            const dir = latestBackup()
            if (!dir) return reply('Belum ada backup update yang bisa dikembalikan.')
            const manifest = restoreFrom(dir)
            fs.rmSync(dir, { recursive: true, force: true })
            await say(`↩️ Rollback selesai: ${manifest.replaced.length} file dikembalikan, ${manifest.added.length} file baru dihapus.${flags.has('--norestart') ? '' : '\n🔄 Bot restart...'}`)
            if (!flags.has('--norestart')) await doRestart(m, ctx)
            return
        }

        // ── ambil zip ──
        const url = rest.find(a => /^https?:\/\//i.test(a)) || (!pickDoc(m) && !rest.length ? global.updateUrl : null)
        const download = pickDoc(m)
        if (!download && !url) return reply(USAGE)

        await say('⏳ Mengambil file update...')
        const zip = download ? await download() : await fetchZip(url)
        if (!zip?.length) throw new Error('File zip kosong / gagal diunduh.')
        if (zip.length > MAX_ZIP) throw new Error('Zip terlalu besar (maks 100MB).')

        // ── baca isi zip ──
        const entries = readZip(zip).filter(e => !e.name.endsWith('/') && !e.name.startsWith('__MACOSX/'))
        if (!entries.length) throw new Error('Zip kosong.')

        const cleaned = entries.map(e => ({ e, name: cleanName(e.name) }))
        const bad = cleaned.filter(c => !c.name)
        if (bad.length) throw new Error(`Path berbahaya di dalam zip, update dibatalkan:\n${list(bad.map(b => b.e.name), 5)}`)

        const prefix = stripWrapper(cleaned.map(c => c.name))
        const total = entries.reduce((n, e) => n + e.usize, 0)
        if (total > MAX_TOTAL) throw new Error('Isi zip terlalu besar setelah diekstrak.')

        // ── bandingkan dengan file sekarang ──
        const skipped = []
        const items = []
        for (const { e, name } of cleaned) {
            const rel = prefix ? name.slice(prefix.length) : name
            const parts = rel.split('/')
            const ext = path.extname(rel).toLowerCase()

            if (parts.some(p => p.startsWith('.'))) { skipped.push(`${rel} (file tersembunyi)`); continue }
            if (PROTECTED_DIRS.has(parts[0]) || PROTECTED_FILES.has(rel)) { skipped.push(`${rel} (dilindungi)`); continue }
            if (rel === CONFIG_FILE && !flags.has('--config')) { skipped.push(`${rel} (pengaturanmu dipertahankan)`); continue }
            if (!ALLOWED_EXT.has(ext)) { skipped.push(`${rel} (ekstensi ${ext || 'kosong'} tidak diizinkan)`); continue }

            const full = path.resolve(ROOT, rel)
            if (!full.startsWith(ROOT + path.sep)) { skipped.push(`${rel} (di luar folder bot)`); continue }

            items.push({ e, rel, full, data: extractEntry(zip, e) })
        }

        const added = [], changed = [], same = []
        for (const it of items) {
            if (!fs.existsSync(it.full)) { it.kind = 'add'; added.push(it.rel) }
            else if (fs.readFileSync(it.full).equals(it.data)) same.push(it.rel)
            else { it.kind = 'change'; changed.push(it.rel) }
        }
        const todo = items.filter(i => i.kind)

        // ── cek sintaks semua file yang akan ditulis ──
        const errors = await checkAll(todo)
        if (errors.length) {
            return say(`❌ Update dibatalkan, ada file dengan error sintaks (belum ada yang diubah):\n\n${errors.slice(0, 5).join('\n\n')}${errors.length > 5 ? `\n\n…dan ${errors.length - 5} file lain` : ''}`)
        }

        const summary =
            `➕ Baru: *${added.length}*\n♻️ Diperbarui: *${changed.length}*\n⏭️ Sama: *${same.length}*\n🚫 Dilewati: *${skipped.length}*` +
            (added.length ? `\n\n*File baru*\n${list(added)}` : '') +
            (changed.length ? `\n\n*Diperbarui*\n${list(changed)}` : '') +
            (skipped.length ? `\n\n*Dilewati*\n${list(skipped, 6)}` : '')

        if (!todo.length) return say(`✅ Script sudah versi terbaru, tidak ada yang berubah.\n\n${summary}`)
        if (dry) return say(`🔍 *Simulasi update* (belum diterapkan)\n\n${summary}`)

        // ── backup lalu tulis ──
        const stamp = String(Date.now())
        const bdir = path.join(BACKUP_ROOT, stamp)
        const oldPkg = fs.existsSync(path.join(ROOT, 'package.json')) ? fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8') : null
        const written = []

        try {
            for (const it of todo) {
                if (it.kind === 'change') {
                    const b = path.join(bdir, 'files', it.rel)
                    fs.mkdirSync(path.dirname(b), { recursive: true })
                    fs.copyFileSync(it.full, b)
                }
            }
            fs.mkdirSync(bdir, { recursive: true })
            fs.writeFileSync(path.join(bdir, 'manifest.json'), JSON.stringify({ at: Date.now(), replaced: changed, added }))

            for (const it of todo) {
                fs.mkdirSync(path.dirname(it.full), { recursive: true })
                const tmp = `${it.full}.upd-tmp`
                fs.writeFileSync(tmp, it.data)
                fs.renameSync(tmp, it.full)
                written.push(it.rel)
            }
        } catch (e) {
            // gagal di tengah jalan: kembalikan semuanya
            try { restoreFrom(bdir) } catch {}
            fs.rmSync(bdir, { recursive: true, force: true })
            throw new Error(`Gagal menulis file (${e.message}). Perubahan sudah dikembalikan.`)
        }
        pruneBackups()

        // ── dependensi baru ──
        let installNote = ''
        const newPkg = todo.find(i => i.rel === 'package.json')
        if (newPkg && oldPkg && !flags.has('--noinstall') && depsChanged(oldPkg, newPkg.data.toString('utf8'))) {
            await say(`${summary}\n\n📦 Dependensi berubah, menjalankan npm install (bisa beberapa menit)...`)
            try {
                await npmInstall()
                installNote = '\n\n📦 npm install selesai.'
            } catch (e) {
                installNote = `\n\n⚠️ npm install gagal, jalankan manual di hosting:\n${e.message}`
            }
        } else if (newPkg && oldPkg && depsChanged(oldPkg, newPkg.data.toString('utf8'))) {
            installNote = '\n\n⚠️ Dependensi berubah tapi npm install dilewati. Jalankan manual kalau ada error modul.'
        }

        const restart = !flags.has('--norestart')
        await say(`✅ *Update selesai*\n\n${summary}${installNote}\n\n_Salah? ketik .updatebot rollback_${restart ? '\n🔄 Bot restart...' : '\nℹ️ Restart manual (.restart) supaya perubahan aktif.'}`)
        if (restart) {
            const ok = await doRestart(m, ctx)
            if (!ok) await reply('Plugin restart tidak ditemukan, restart manual dari hosting.')
        }
    } catch (e) {
        console.error('[UPDATEBOT]', e)
        await say(`❌ Update gagal: ${e.message}`)
    } finally {
        busy = false
    }
}

handler.command = ['updatebot']
handler.tags = ['owner']
handler.owner = true

export default handler
