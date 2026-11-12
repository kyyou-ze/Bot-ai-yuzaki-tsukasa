import { waError } from '../../lib/platform/wa.js'
import { formatWib, saveDB } from '../../lib/core/system.js'
import { primaryPrefix } from '../../lib/engine/plugins.js'

// Terima / tolak permintaan bergabung ke grup (fitur "Setujui anggota baru" di info grup).
// Taruh di: plugins/group/accreq.js
//
//   .listreq                       lihat daftar yang minta masuk
//   .accreq all                    terima SEMUA
//   .accreq 10                     terima 10 pertama (sesuai urutan .listreq)
//   .accreq 628123456789 0812...   terima nomor tertentu (boleh banyak, pisah spasi / koma)
//   .tolakreq all | 10 | nomor     tolak, formatnya sama
//
// Auto respon (tanpa .accreq): di grup, admin cukup ketik
//   acc all        terima semua
//   acc 1          terima 1 pertama
// .acc juga dipakai fitur store (.acc INV-0001), jadi plugin ini menanganinya lebih dulu:
//   - "acc all" / "acc <jumlah>" / "acc <nomor>" di grup  -> terima permintaan masuk grup
//   - selain itu (mis. acc INV-0001, atau di chat pribadi) -> diteruskan ke fitur store seperti biasa
// Supaya plugin ini dipanggil lebih dulu dari store/acc.js, restart bot setelah memasang (urutan muat A-Z).
// .tolak sengaja tidak dipakai (bentrok dengan game & store): pakai .tolakreq.
//
// NOTIF OTOMATIS (tanpa command): begitu ada yang minta masuk grup, bot mengirim pesan ke grup
// yang memanggil admin, lengkap dengan tombol pilihan (single select):
//   - Acc semua / Acc 1 pertama / Acc 5 pertama
//   - Pilih nomor (personal): acc HANYA nomor yang dipilih
//   - Tolak semua / Tolak 1 pertama
// Permintaan yang masuk beruntun digabung jadi satu pesan (maks. 1 pesan per menit per grup).
//   .reqnotif off | on   matikan / nyalakan notif untuk grup ini (bawaan: nyala), khusus admin
//   .reqnotif all off|on matikan / nyalakan notif untuk SEMUA grup, khusus owner
// Syarat: bot admin di grup, "Setujui anggota baru" aktif.
//
// Khusus admin grup. Akun bot harus admin di grup itu.

const CHUNK = 20            // WhatsApp lebih aman diproses bertahap
const SHOW = 15             // maksimal baris yang ditampilkan di pesan
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const digitsOf = (j) => String(j || '').split('@')[0].split(':')[0].replace(/\D/g, '')
// 08xxx -> 628xxx
const normNum = (n) => {
    let d = String(n || '').replace(/\D/g, '')
    if (d.startsWith('0')) d = '62' + d.slice(1)
    return d
}
// nomor yang ditampilkan: pakai nomor telepon kalau ada (jid bisa berupa LID)
const phoneOf = (r) => digitsOf(r.phone_number || r.pn || r.jid)

const methodLabel = (r) => {
    const v = String(r.request_method || '').toLowerCase()
    if (v.includes('invite')) return 'lewat link'
    if (v.includes('linked')) return 'lewat komunitas'
    if (v.includes('non_admin')) return 'ditambah member'
    return ''
}

const rowText = (r, i) => {
    const t = Number(r.request_time)
    const when = Number.isFinite(t) && t > 0 ? formatWib(t < 1e12 ? t * 1000 : t) : ''
    const via = methodLabel(r)
    return `${i + 1}. @${phoneOf(r)}${via ? ` · ${via}` : ''}${when ? `\n    ${when}` : ''}`
}

async function getPending(sock, jid) {
    const list = await sock.groupRequestParticipantsList(jid)
    return Array.isArray(list) ? list.filter(r => r?.jid) : []
}

// ═══════════════ NOTIF OTOMATIS: ada yang minta masuk ═══════════════
const DEBOUNCE = () => Number(global.reqJoinDelay ?? 4000)      // tunggu sebentar, gabungkan permintaan beruntun
const COOLDOWN = () => Number(global.reqJoinCooldown ?? 60000)  // maks. 1 notif per grup per menit
const notifyTimers = (global.__reqJoinTimers ||= new Map())
const lastNotify = (global.__reqJoinLast ||= new Map())

const notifyOn = (jid) => !global.db?.reqnotifAllOff && !global.db?.reqnotifOff?.[jid]

function buildNotice(pending, p) {
    const N = pending.length
    const list = pending.slice(0, 5).map((r, i) => {
        const via = methodLabel(r)
        return `${i + 1}. +${phoneOf(r)}${via ? ` · ${via}` : ''}`
    }).join('\n')
    const more = N > 5 ? `\n…dan ${N - 5} lainnya` : ''

    const terima = [{ title: `✅ Acc semua (${N})`, description: 'Terima semua yang menunggu', id: `${p}accreq all` }]
    if (N > 1) terima.push({ title: '✅ Acc 1 pertama', description: 'Terima yang paling lama menunggu', id: `${p}accreq 1` })
    if (N > 5) terima.push({ title: '✅ Acc 5 pertama', description: 'Terima 5 yang paling lama menunggu', id: `${p}accreq 5` })

    // personal: acc / tolak hanya nomor yang dipilih
    const personal = pending.slice(0, 5).map((r, i) => ({
        title: `${i + 1}. +${phoneOf(r)}`.slice(0, 24),
        description: `Acc nomor ini saja${methodLabel(r) ? ` (${methodLabel(r)})` : ''}`,
        id: `${p}accreq ${phoneOf(r)}`
    }))

    const tolak = [{ title: '❌ Tolak semua', description: 'Tolak semua yang menunggu', id: `${p}tolakreq all` }]
    if (N > 1) tolak.push({ title: '❌ Tolak 1 pertama', description: 'Tolak yang paling lama menunggu', id: `${p}tolakreq 1` })

    return {
        text: `📥 *PERMINTAAN BERGABUNG*\n\n*${N}* orang menunggu persetujuan:\n${list}${more}\n\nAdmin, pilih tindakan lewat tombol di bawah 👇`,
        footer: `Tolak nomor tertentu: ${p}tolakreq <nomor> · Matikan notif: ${p}reqnotif off`,
        buttons: [{
            type: 'list',
            text: '📋 Pilih tindakan',
            sections: [
                { title: 'Terima', rows: terima },
                { title: 'Pilih nomor (personal)', rows: personal },
                { title: 'Tolak', rows: tolak }
            ]
        }]
    }
}

async function sendNotice(sock, jid) {
    let pending
    try { pending = await getPending(sock, jid) } catch { return } // bot bukan admin / fitur persetujuan mati
    if (!pending.length) {
        // daftar di server kadang belum terbarui saat event baru masuk: coba sekali lagi
        await sleep(3000)
        try { pending = await getPending(sock, jid) } catch { return }
        if (!pending.length) return
    }

    let admins = []
    try {
        const meta = await sock.groupMetadata(jid)
        const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(j => digitsOf(j))
        admins = (meta?.participants || []).filter(x => x.admin && !me.includes(digitsOf(x.id))).map(x => x.id).slice(0, 50)
    } catch { }

    const p = primaryPrefix() ?? '.'
    const n = buildNotice(pending, p)
    lastNotify.set(jid, Date.now())

    // mentions tanpa teks @ = admin tetap dapat notifikasi, pesan tetap rapi (gaya hidetag)
    try {
        await sock.sendButtons(jid, { text: n.text, footer: n.footer, buttons: n.buttons, mentions: admins })
    } catch {
        const fallback = pending.slice(0, 5).map((r, i) => `• ${p}accreq ${phoneOf(r)}`).join('\n')
        await sock.sendMessage(jid, { text: `${n.text}\n\n${p}accreq all → terima semua\n${fallback}`, mentions: admins })
    }
}

// dipanggil dari event Baileys "group.join-request"
async function onRequest(sock, u) {
    if (!u || u.action !== 'created') return // abaikan dibatalkan / ditolak
    const jid = u.id
    if (!jid || !String(jid).endsWith('@g.us') || !notifyOn(jid) || notifyTimers.has(jid)) return
    const wait = Math.max(DEBOUNCE(), (lastNotify.get(jid) || 0) + COOLDOWN() - Date.now())
    notifyTimers.set(jid, setTimeout(async () => {
        notifyTimers.delete(jid)
        try { await sendNotice(sock, jid) } catch (e) { console.error('[REQJOIN]', e.message) }
    }, wait))
}

// pasang pendengar event sekali per koneksi. Logika lewat global.__reqJoinHandler supaya
// kalau plugin ini di-update (.editplugin), versi barunya langsung dipakai tanpa restart.
global.__reqJoinHandler = onRequest
function hook(sock) {
    if (!sock?.ev || sock.__reqJoinHook) return
    sock.__reqJoinHook = true
    sock.ev.on('group.join-request', (u) => { Promise.resolve(global.__reqJoinHandler?.(sock, u)).catch(() => { }) })
}
hook(global.sock)
clearInterval(global.__reqJoinWatch)
// koneksi baru (reconnect) otomatis dipasangi lagi
global.__reqJoinWatch = setInterval(() => hook(global.sock), 5000)
global.__reqJoinWatch.unref?.()

// "acc all" / "acc 5" / "acc 628xxx" = permintaan masuk grup. ID order store (INV-0001) punya huruf, jadi tidak tertukar.
const isJoinForm = (tokens) => tokens.length > 0 && tokens.every(t =>
    /^(all|semua|everyone)$/i.test(t) || /^\d{1,4}$/.test(t) || normNum(t).length >= 8)

async function storeAcc(m, ctx) {
    const mod = await import('../store/acc.js').catch(() => null)
    const run = mod?.default
    if (typeof run !== 'function') return ctx.reply(`Format: ${ctx.prefix || '.'}acc <all|jumlah|nomor>   (terima permintaan masuk grup)`)
    if (run.owner && !ctx.isOwner) return ctx.reply(global.mess?.owner || 'Khusus owner.')
    return run(m, ctx)
}

// ═══════════════ HANDLER AKSES: group / admin / owner ═══════════════
// Dicek per command di dalam handler (bukan handler.group = true di plugin), karena .acc juga milik
// store dan harus tetap jalan di chat pribadi. Owner otomatis lolos cek admin & group-admin.
//   group : hanya di dalam grup
//   admin : admin grup (owner lolos)
//   owner : hanya owner
//   silent: kalau ditolak cukup reaksi 🚫 (tombol notif bisa ditekan siapa saja, jangan spam grup)
const ACCESS = {
    accreq:    { group: true, admin: true, silent: true },
    accjoin:   { group: true, admin: true, silent: true },
    tolakreq:  { group: true, admin: true, silent: true },
    tolakjoin: { group: true, admin: true, silent: true },
    rejectreq: { group: true, admin: true, silent: true },
    listreq:   { group: true, admin: true },
    reqjoin:   { group: true, admin: true },
    reqnotif:  { group: true, admin: true }
}
const OWNER_ONLY = { group: false, admin: false, owner: true }

// true = ditolak (balasan sudah dikirim)
async function denied(m, ctx, rule) {
    const { sock, jid, reply, isOwner, isAdmin } = ctx
    const isGroup = String(jid || '').endsWith('@g.us')
    if (rule.owner && !isOwner) { await reply(global.mess?.owner || 'Khusus owner.'); return true }
    if (rule.group && !isGroup) { await reply(global.mess?.group || 'Fitur ini cuma jalan di dalam grup ya!'); return true }
    if (rule.admin && !isAdmin && !isOwner) {
        if (rule.silent) await sock.sendMessage(jid, { react: { text: '🚫', key: m.key } }).catch(() => null)
        else await reply(global.mess?.admin || 'Khusus admin.')
        return true
    }
    return false
}

let handler = async (m, ctx) => {
    const { sock, text, command, prefix, jid, reply, isOwner, isAdmin } = ctx
    const cmd = String(command || '').toLowerCase()
    const isGroup = String(jid || '').endsWith('@g.us')

    // .acc: permintaan masuk grup kalau bentuknya "all" / angka / nomor, selain itu milik store
    if (cmd === 'acc') {
        const tk = String(text || '').split(/[\s,;]+/).filter(Boolean)
        if (!isGroup || !isJoinForm(tk)) return storeAcc(m, ctx)
        if (!isAdmin && !isOwner) return // bukan admin: diam saja (tidak spam grup)
    } else {
        const argNow = String(text || '').trim().toLowerCase()
        // .reqnotif all on|off = saklar global, khusus owner (bisa dari mana saja)
        const globalSwitch = cmd === 'reqnotif' && /^(all|semua|global)\b/.test(argNow)
        if (await denied(m, ctx, globalSwitch ? OWNER_ONLY : (ACCESS[cmd] || { group: true, admin: true }))) return
    }

    // .reqnotif on|off
    if (cmd === 'reqnotif') {
        const arg = String(text || '').trim().toLowerCase()
        const off = (global.db.reqnotifOff ||= {})
        const gm = arg.match(/^(?:all|semua|global)\s*(\S*)/)
        if (gm) {
            const v = gm[1]
            if (/^(off|mati|0|false)$/.test(v)) { global.db.reqnotifAllOff = true; try { saveDB(global.db) } catch { } return reply('🔕 Notif permintaan masuk *dimatikan untuk SEMUA grup*.') }
            if (/^(on|nyala|1|true)$/.test(v)) { delete global.db.reqnotifAllOff; try { saveDB(global.db) } catch { } return reply('🔔 Notif permintaan masuk *dinyalakan untuk semua grup* (kecuali yang dimatikan per grup).') }
            return reply(`Notif global: *${global.db.reqnotifAllOff ? 'MATI' : 'NYALA'}*\n\n${prefix}reqnotif all on\n${prefix}reqnotif all off`)
        }
        if (/^(off|mati|0|false)$/.test(arg)) { off[jid] = true; try { saveDB(global.db) } catch { } return reply('🔕 Notif permintaan masuk grup *dimatikan* untuk grup ini.') }
        if (/^(on|nyala|1|true)$/.test(arg)) { delete off[jid]; try { saveDB(global.db) } catch { } return reply('🔔 Notif permintaan masuk grup *dinyalakan* untuk grup ini.') }
        return reply(`Notif permintaan masuk: *${off[jid] ? 'MATI' : 'NYALA'}*\n\n${prefix}reqnotif on\n${prefix}reqnotif off`)
    }

    const isReject = /^(tolakreq|tolakjoin|rejectreq)$/.test(cmd)
    const isList = /^(listreq|reqjoin)$/.test(cmd)

    let pending
    try {
        pending = await getPending(sock, jid)
    } catch (e) {
        return reply(`Gagal mengambil daftar permintaan.\n${waError(e)}`)
    }

    // ───────── .listreq ─────────
    if (isList) {
        if (!pending.length) {
            return reply('📭 Tidak ada permintaan bergabung.\n\n_Pastikan "Setujui anggota baru" aktif di info grup._')
        }
        const rows = pending.slice(0, SHOW).map(rowText).join('\n')
        const more = pending.length > SHOW ? `\n…dan ${pending.length - SHOW} lainnya` : ''
        return reply(
            `📥 *PERMINTAAN BERGABUNG* (${pending.length})\n\n${rows}${more}\n\n` +
            `acc all → terima semua\nacc 10 → terima 10 pertama\n${prefix}tolakreq all → tolak semua`,
            { mentions: pending.slice(0, SHOW).map(r => `${phoneOf(r)}@s.whatsapp.net`) }
        )
    }

    // ───────── .acc / .tolak ─────────
    const tokens = String(text || '').split(/[\s,;]+/).filter(Boolean)

    if (!tokens.length) {
        return reply(
            `*${isReject ? 'TOLAK' : 'TERIMA'} PERMINTAAN BERGABUNG*\n\n` +
            `Menunggu: *${pending.length}* permintaan\n\n` +
            `Contoh:\n` +
            `${prefix}${cmd} all\n` +
            `${prefix}${cmd} 10\n` +
            `${prefix}${cmd} 628123456789 08123456780\n\n` +
            `Lihat daftar: ${prefix}listreq`
        )
    }

    if (!pending.length) return reply('📭 Tidak ada permintaan bergabung yang menunggu.')

    let targets = []
    const first = tokens[0].toLowerCase()

    if (/^(all|semua|everyone)$/.test(first)) {
        targets = pending
    } else if (tokens.length === 1 && /^\d{1,4}$/.test(first)) {
        const n = Number(first)
        if (n < 1) return reply('Jumlah minimal 1.')
        targets = pending.slice(0, n)
    } else {
        const wanted = new Set(tokens.map(normNum).filter(n => n.length >= 8))
        if (!wanted.size) return reply(`Format salah. Ketik *${prefix}${cmd}* untuk lihat contoh.`)
        targets = pending.filter(r => wanted.has(phoneOf(r)) || wanted.has(digitsOf(r.jid)))
        if (!targets.length) return reply('Nomor itu tidak ada di daftar permintaan.\nCek dengan ' + prefix + 'listreq')
    }

    if (targets.length > CHUNK) await reply(`⏳ Memproses ${targets.length} permintaan...`)

    const action = isReject ? 'reject' : 'approve'
    const okList = []
    let failed = 0
    let lastError = ''

    for (let i = 0; i < targets.length; i += CHUNK) {
        const part = targets.slice(i, i + CHUNK)
        try {
            const res = await sock.groupRequestParticipantsUpdate(jid, part.map(r => r.jid), action)
            if (Array.isArray(res) && res.length) {
                for (const r of res) {
                    const hit = part.find(p => p.jid === r.jid)
                    if (String(r.status) === '200') okList.push(hit || { jid: r.jid })
                    else failed++
                }
            } else {
                okList.push(...part)
            }
        } catch (e) {
            failed += part.length
            lastError = waError(e)
            if (/bukan admin/i.test(lastError)) break // tidak ada gunanya lanjut
        }
        if (i + CHUNK < targets.length) await sleep(1200)
    }

    const done = isReject ? 'ditolak' : 'diterima'
    const icon = isReject ? '❌' : '✅'
    const shown = okList.slice(0, SHOW).map(r => `• @${phoneOf(r) || digitsOf(r.jid)}`).join('\n')
    const rest = okList.length > SHOW ? `\n…dan ${okList.length - SHOW} lainnya` : ''

    let out = `${icon} *${okList.length}* permintaan ${done}`
    if (failed) out += `\n⚠️ ${failed} gagal${lastError ? `: ${lastError}` : ''}`
    if (okList.length) out += `\n\n${shown}${rest}`
    const left = Math.max(0, pending.length - okList.length)
    out += `\n\nSisa menunggu: ${left}`

    return reply(out, { mentions: okList.slice(0, SHOW).map(r => `${phoneOf(r) || digitsOf(r.jid)}@s.whatsapp.net`) })
}

handler.command = ['accreq', 'tolakreq', 'listreq', 'accjoin', 'tolakjoin', 'reqjoin', 'reqnotif', 'acc']
handler.help = ['accreq <all|jumlah|nomor>', 'tolakreq <all|jumlah|nomor>', 'listreq', 'reqnotif <on|off>']
handler.tags = ['group']
// group & admin dicek di dalam handler (supaya .acc milik store tetap jalan di chat pribadi untuk owner)

export default handler
