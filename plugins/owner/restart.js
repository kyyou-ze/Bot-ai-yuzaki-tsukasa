import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { saveDB } from '../../lib/core/system.js'
import { sleep } from '../../lib/core/system.js'

// ───────── pengaturan ─────────
// Tempat menyimpan info "bot barusan di-restart" supaya pesan bisa diedit setelah online lagi.
const MARKER = './database/runtime/restart.json'

// Cek folder bisa ditulis; kalau tidak, coba chmod lalu buat ulang folder (isi lama disimpan di <nama>.old-<waktu>).
// Ditulis lokal di sini supaya plugin ini tetap jalan walau core-system.js belum diperbarui.
function ensureWritableDir(dir) {
    const ok = () => {
        try {
            fs.mkdirSync(dir, { recursive: true })
            const probe = path.join(dir, `.w${process.pid}`)
            fs.writeFileSync(probe, '1')
            fs.unlinkSync(probe)
            return true
        } catch { return false }
    }
    if (ok()) return true
    try { fs.chmodSync(dir, 0o777) } catch {}
    if (ok()) return true
    try {
        const backup = `${dir}.old-${Date.now()}`
        fs.renameSync(dir, backup)
        fs.mkdirSync(dir, { recursive: true })
        for (const f of fs.readdirSync(backup)) {
            try { fs.cpSync(path.join(backup, f), path.join(dir, f), { recursive: true }) } catch {}
        }
        return ok()
    } catch { return false }
}

// Cadangan kalau folder database tidak bisa ditulis (dipakai bersama MARKER).
const MARKER_FALLBACK = path.join(os.tmpdir(), 'kaguya-restart.json')

// Tulis info restart; kalau folder database ditolak, pakai folder sementara.
function writeMarker(info) {
    const json = JSON.stringify(info)
    try {
        ensureWritableDir('./database/runtime')
        fs.writeFileSync(MARKER, json)
        return
    } catch (e) {
        console.error('[RESTART] Marker di database gagal, pakai folder sementara:', e.message)
    }
    try { fs.writeFileSync(MARKER_FALLBACK, json) } catch (e) {
        // tetap lanjut restart; hanya pesan "online lagi" yang tidak akan diedit
        console.error('[RESTART] Marker cadangan juga gagal:', e.message)
    }
}

// Baca marker dari lokasi utama, lalu cadangan.
function readMarker() {
    for (const file of [MARKER, MARKER_FALLBACK]) {
        try {
            const info = JSON.parse(fs.readFileSync(file, 'utf8'))
            try { fs.unlinkSync(file) } catch {}
            return info
        } catch {}
    }
    return null
}

// Info restart yang lebih tua dari ini dianggap basi dan diabaikan.
const MARKER_TTL = 5 * 60 * 1000

// Jeda sebelum proses dimatikan, supaya pesan, database, dan session sempat tertulis.
const FLUSH_DELAY = 1500

// Jeda setelah koneksi terbuka sebelum kabar "online lagi" dikirim
// (index.js juga menunggu 5 detik sebelum mengirim notifikasi tersambung).
const READY_DELAY = 5500

// Batas waktu menunggu bot tersambung kembali.
const READY_TIMEOUT = 3 * 60 * 1000

// Cara restart penuh. Bisa diubah lewat config.js: global.restartMode = 'auto' | 'exit' | 'spawn'
//  - exit  : proses dimatikan, lalu dihidupkan lagi oleh pengelolanya (panel, pm2, docker).
//  - spawn : proses menjalankan salinan dirinya sendiri lalu mati (VPS, Termux, terminal biasa).
//  - auto  : pilih sendiri sesuai lingkungan.

// id pesan perintah restart yang sudah diproses; mencegah pesan yang terkirim ulang
// setelah bot menyala lagi memicu restart berulang.
global.__restartHandled ||= new Set()

let restarting = false

// ───────── helper ─────────
function pickMethod() {
    const forced = String(global.restartMode || 'auto').toLowerCase()
    if (forced === 'exit' || forced === 'spawn') return forced

    const managed =
        'pm_id' in process.env ||          // pm2
        !!process.env.P_SERVER_UUID ||     // Pterodactyl
        !!process.env.DYNO ||              // Heroku
        fs.existsSync('/.dockerenv')       // Docker

    return managed ? 'exit' : 'spawn'
}

async function relaunch() {
    const method = pickMethod()
    console.log(`[RESTART] Merestart bot (metode: ${method})`)

    if (method === 'spawn') {
        const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
            cwd: process.cwd(),
            env: process.env,
            detached: true,
            stdio: 'inherit'
        })

        // pastikan proses baru benar-benar jalan sebelum yang lama dimatikan
        await new Promise((resolve, reject) => {
            child.once('spawn', resolve)
            child.once('error', reject)
        })

        child.unref()
        process.exit(0)
    }

    // kode non-nol supaya pengelola proses menganggapnya perlu dinyalakan ulang
    process.exit(1)
}

// Tunggu bot tersambung lagi, lalu edit pesan "Merestart..." jadi kabar online.
async function announceOnline(info, previous = null) {
    const deadline = Date.now() + READY_TIMEOUT

    while (Date.now() < deadline) {
        const sock = global.sock
        const open = sock && sock !== previous && (sock.ws?.isOpen ?? !!sock.user)

        if (open) {
            await sleep(READY_DELAY)
            if (global.sock !== sock) continue

            const took = ((Date.now() - info.at) / 1000).toFixed(1)
            const text = `Bot sudah online lagi (${took} detik).`

            try {
                if (info.key) await sock.sendMessage(info.jid, { text, edit: info.key })
                else await sock.sendMessage(info.jid, { text })
            } catch {
                try { await sock.sendMessage(info.jid, { text }) } catch {}
            }
            return
        }

        await sleep(1500)
    }
}

// ───────── setelah bot menyala dari restart ─────────
// Dijalankan saat plugin dimuat: kalau ada info restart yang masih baru, kabari chat pemicunya.
;(function resumeAfterRestart() {
    const info = readMarker()
    if (!info || !info.jid || Date.now() - info.at > MARKER_TTL) return
    if (info.id) global.__restartHandled.add(info.id)

    announceOnline(info).catch(e => console.error('[RESTART]', e.message))
})()

// ───────── plugin ─────────
let handler = async (m, { sock, jid, text, reply, example }) => {
    const id = m.id || m.key?.id
    if (id && global.__restartHandled.has(id)) return // pesan lama yang terkirim ulang

    if (restarting) return reply('Restart masih berjalan, tunggu sebentar.')

    const arg = (text || '').trim().toLowerCase()
    const soft = ['soft', 'reconnect'].includes(arg)
    if (arg && !soft && arg !== 'hard') return example('soft  (kosongkan untuk restart penuh)')

    restarting = true
    if (id) global.__restartHandled.add(id)

    const sent = await reply(soft ? 'Menyambungkan ulang koneksi...' : 'Merestart bot...')
    const info = { jid, key: sent?.key, id, at: Date.now(), mode: soft ? 'soft' : 'full' }

    try {
        if (soft) {
            // putus koneksi; index.js otomatis menyambung ulang dalam beberapa detik
            sock.end(new Error('restart soft'))
            announceOnline(info, sock).finally(() => { restarting = false })
            return
        }

        writeMarker(info)
        try { saveDB(global.db) } catch {}

        await sleep(FLUSH_DELAY)
        await relaunch()
    } catch (e) {
        restarting = false
        try { fs.unlinkSync(MARKER) } catch {}
        try { fs.unlinkSync(MARKER_FALLBACK) } catch {}
        console.error('[RESTART]', e)
        await sock.sendMessage(jid, { text: `Gagal restart: ${e.message}`, ...(sent?.key ? { edit: sent.key } : {}) }).catch(() => null)
    }
}

handler.command = ['restart']
handler.tags = ['owner']
handler.owner = true

export default handler
