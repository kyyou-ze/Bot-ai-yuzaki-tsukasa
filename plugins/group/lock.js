import { waError } from '../../lib/platform/wa.js'
import { formatWib, saveDB } from '../../lib/core/system.js'

// opengc / closegc [durasi]  ->  contoh: closegc 30m  (tutup sekarang, buka lagi otomatis 30 menit kemudian)
// Jadwal disimpan di database PER GRUP (global.db.groups[jid].gctimer = { action, at }),
// jadi tetap jalan setelah bot restart dan tiap grup punya jadwalnya sendiri.

const UNIT = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }
const MAX_MS = 7 * UNIT.d
const timers = (global.__gcTimers ||= new Map())

const parseDuration = (t = '') => {
    const hit = String(t).trim().match(/^(\d+)\s*([smhd])$/i)
    return hit ? Math.min(Number(hit[1]) * UNIT[hit[2].toLowerCase()], MAX_MS) : 0
}

const label = (ms) => {
    const m = Math.round(ms / 60000)
    if (m >= 1440) return `${Math.round(m / 1440)} hari`
    if (m >= 60) return `${Math.round(m / 60)} jam`
    return `${Math.max(m, 1)} menit`
}

// jadwal lama (global.db.gctimers, satu daftar untuk semua grup) dipindah ke data grupnya masing-masing
function migrateTimers() {
    const old = global.db?.gctimers
    if (!old) return
    const groups = (global.db.groups ||= {})
    for (const [jid, t] of Object.entries(old)) if (t && !groups[jid]?.gctimer) (groups[jid] ||= {}).gctimer = t
    delete global.db.gctimers
    try { saveDB(global.db) } catch {}
}

const getTimer = (jid) => global.db?.groups?.[jid]?.gctimer || null
const setTimer = (jid, t) => {
    if (!global.db) return
    if (t) { ((global.db.groups ||= {})[jid] ||= {}).gctimer = t; return }
    const g = global.db.groups?.[jid]
    if (g) delete g.gctimer
}
const saveTimers = () => { try { saveDB(global.db) } catch {} }

function schedule(jid, action, at) {
    clearTimeout(timers.get(jid))

    const run = async () => {
        const sock = global.sock
        if (!sock?.user) return timers.set(jid, setTimeout(run, 10000)) // bot belum tersambung, coba lagi

        try {
            await sock.groupSettingUpdate(jid, action === 'open' ? 'not_announcement' : 'announcement')
            await sock.sendMessage(jid, { text: action === 'open' ? '🔓 Grup dibuka otomatis, semua member bisa chat.' : '🔒 Grup ditutup otomatis, hanya admin yang bisa chat.' })
        } catch (e) {
            console.error('[GC TIMER]', e.message)
        }
        timers.delete(jid)
        setTimer(jid, null)
        saveTimers()
    }

    timers.set(jid, setTimeout(run, Math.max(1000, at - Date.now())))
}

// pulihkan jadwal yang tersimpan (dipanggil saat plugin dimuat)
migrateTimers()
for (const [jid, g] of Object.entries(global.db?.groups || {})) {
    const t = g?.gctimer
    if (t && !timers.has(jid)) schedule(jid, t.action, t.at)
}

let handler = async (m, { sock, text, command, jid, reply }) => {
    migrateTimers()
    const open = command === 'opengc'
    const ms = parseDuration(text)

    if (text && !ms) return reply(`Durasi tidak valid. Contoh: ${command} 30m (s = detik, m = menit, h = jam, d = hari, maks 7 hari)`)

    try {
        await sock.groupSettingUpdate(jid, open ? 'not_announcement' : 'announcement')
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }

    // perintah tanpa durasi membatalkan jadwal lama
    clearTimeout(timers.get(jid))
    timers.delete(jid)
    setTimer(jid, null)

    if (!ms) {
        saveTimers()
        return reply(open ? '🔓 Grup dibuka, semua member bisa chat.' : '🔒 Grup ditutup, hanya admin yang bisa chat.')
    }

    const next = open ? 'close' : 'open'
    const at = Date.now() + ms
    setTimer(jid, { action: next, at }) // jadwal grup ini saja
    saveTimers()
    schedule(jid, next, at)

    return reply(`${open ? '🔓 Grup dibuka' : '🔒 Grup ditutup'} selama ${label(ms)}.\nOtomatis ${next === 'open' ? 'dibuka' : 'ditutup'} lagi: ${formatWib(at)}`)
}

handler.command = ['lock', 'opengc', 'closegc']
handler.as = 'opengc'
handler.tags = ['group']
handler.group = true

export default handler
