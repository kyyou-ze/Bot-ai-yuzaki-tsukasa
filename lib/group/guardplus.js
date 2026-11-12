import { saveDB, isOwnerNumber } from '../core/system.js'
import { memberIds } from '../core/data.js'
import { getMeta, botIsAdmin, findMember, resolveTargets, updateGroupSetting } from '../platform/wa.js'

// ═══════════════════════════════════════════════════════════════════════════
//  GUARD PLUS: proteksi & setting grup tambahan
//  Dipakai oleh: plugins/group/guard.js (fitur on/off) dan plugins/group/guardtools.js (perintah)
//  Dipanggil dari lib/platform/wa.js lewat hook global:
//    global.guardPlusMessage  (tiap pesan grup)      global.onGuardPlusJoin  (member masuk)
//    global.onGuardPlusAdmin  (promote / demote)      global.gpAutoClear      (hapus otomatis notif bot)
//  Semua data per grup tersimpan di global.db.groups[jid].<fitur>
// ═══════════════════════════════════════════════════════════════════════════

export const BASE_FEATURES = ['antilink', 'antitoxic', 'antispam', 'antidelete', 'autoreply', 'antisticker', 'antiswgc', 'antitagsw', 'antiviewonce', 'antiedit', 'notiflevel']
export const PLUS_FEATURES = ['antivirtex', 'antiforward', 'antitag', 'antipromo', 'antimedia', 'antibot', 'antiphishing', 'slowmode', 'antiraid', 'antiasing', 'antipromote']
// fitur yang tidak ikut menyala saat `.enable all` (butuh pengaturan dulu / berdampak besar)
export const PLUS_OPT_IN = ['antimedia', 'slowmode', 'antiasing', 'antipromote']
// fitur pesan yang mendukung warn & kick
export const PLUS_WARNABLE = ['antivirtex', 'antiforward', 'antitag', 'antipromo', 'antimedia', 'antibot', 'antiphishing']
// fitur yang diperiksa di setiap pesan (dipakai wa.js untuk early-return)
export const PLUS_MSG_KEYS = [...PLUS_WARNABLE, 'slowmode']

export const PLUS_TITLE = {
    antivirtex: 'ANTIVIRTEX', antiforward: 'ANTIFORWARD', antitag: 'ANTITAG', antipromo: 'ANTIPROMO',
    antimedia: 'ANTIMEDIA', antibot: 'ANTIBOT', antiphishing: 'ANTIPHISHING', slowmode: 'SLOWMODE',
    antiraid: 'ANTIRAID', antiasing: 'ANTIASING', antipromote: 'ANTIPROMOTE'
}

export const PLUS_ALIAS = {
    virtex: 'antivirtex', forward: 'antiforward', fwd: 'antiforward', mention: 'antitag', tagmassal: 'antitag',
    promo: 'antipromo', jualan: 'antipromo', media: 'antimedia', bot: 'antibot', phishing: 'antiphishing',
    shortlink: 'antiphishing', slow: 'slowmode', raid: 'antiraid', asing: 'antiasing', promote: 'antipromote', antidemote: 'antipromote'
}

export const DEFAULT_PROMO = [
    'open bo', 'open jasa', 'jasa pembuatan', 'slot gacor', 'judi online', 'judi bola', 'pinjol', 'pinjaman cepat',
    'jual akun', 'followers murah', 'jasa follower', 'jasa joki', 'sewa bot', 'jasa top up', 'order sekarang',
    'daftar sekarang bonus', 'bonus new member', 'deposit pulsa', 'togel'
]

export const MEDIA_KINDS = ['foto', 'video', 'gif', 'vn', 'audio', 'dokumen', 'kontak', 'lokasi', 'poll', 'sticker']

const SHORTENERS = [
    'bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 's.id', 'ow.ly', 'goo.gl', 'buff.ly',
    'rebrand.ly', 'tiny.cc', 't.ly', 'v.gd', 'shrtco.de', 'bitly.ws', 'cli.re', 'soo.gd', 'shorturl.asia', 'clk.sh'
]
const RISKY_TLD = ['tk', 'ml', 'ga', 'cf', 'gq', 'zip', 'mov']

// ───────── helper ─────────
const peek = (jid) => global.db?.groups?.[jid] || null
const grp = (jid) => ((global.db.groups ||= {})[jid] ||= {})
const save = () => { try { saveDB(global.db) } catch {} }
const num = (j) => String(j || '').split('@')[0].split(':')[0]
const uniq = (a) => [...new Set(a)]
const flag = (v) => (v ? 'ON' : 'OFF')
const botIds = (sock) => [sock.user?.id, sock.user?.lid].filter(Boolean).map(num)
const jidOf = (p) => (typeof p === 'string' ? p : (p?.id || p?.phoneNumber || ''))
const idsOfParticipant = (p) => (typeof p === 'string' ? [num(p)] : uniq(memberIds(p)))

// daftar entri anggota { kunci: { ids, jid, at, ... } } (trusted, blacklist, allow)
const entryKey = (map, ids) => Object.keys(map || {}).find(k => map[k]?.ids?.some(i => ids.includes(i)))
export const inList = (g, field, ids) => !!entryKey(g?.[field], ids)
export function addEntry(jid, field, ids, memberJid, extra = {}) {
    const map = (grp(jid)[field] ||= {})
    const key = entryKey(map, ids) || ids[0]
    map[key] = { ids: uniq([...(map[key]?.ids || []), ...ids]), jid: memberJid, at: Date.now(), ...extra }
    save()
}
export function delEntry(jid, field, ids) {
    const map = peek(jid)?.[field]
    const key = entryKey(map, ids)
    if (!key) return false
    delete map[key]
    save()
    return true
}
export const listEntries = (jid, field) => Object.values(peek(jid)?.[field] || {})

// pemberitahuan "bot bukan admin" dibatasi sekali tiap 10 menit per grup
const notices = new Map()
async function notice(sock, jid, text) {
    const now = Date.now()
    if (now - (notices.get(jid + text) || 0) < 10 * 60_000) return
    notices.set(jid + text, now)
    if (notices.size > 200) notices.delete(notices.keys().next().value)
    await sock.sendMessage(jid, { text }).catch(() => null)
}

// ───────── detektor (fungsi murni, mudah dites) ─────────
export function isVirtex(body, max = 4000) {
    if (!body) return false
    if (body.length > max) return true
    const marks = (body.match(/\p{M}/gu) || []).length
    if (marks > 80 && marks / body.length > 0.3) return true
    if ((body.match(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g) || []).length > 40) return true
    if ((body.match(/\n/g) || []).length > 200) return true
    return false
}

export const normalizeText = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9@./\s]/g, ' ').replace(/\s+/g, ' ').trim()
export const hasPromo = (body, words) => {
    const t = ` ${normalizeText(body)} `
    return (words || DEFAULT_PROMO).find(w => t.includes(` ${normalizeText(w)} `) || t.includes(normalizeText(w)))
}

export function mediaKind(m) {
    switch (m.mtype) {
        case 'imageMessage': return 'foto'
        case 'videoMessage': return m.msg?.gifPlayback ? 'gif' : 'video'
        case 'audioMessage': return m.msg?.ptt ? 'vn' : 'audio'
        case 'documentMessage': case 'documentWithCaptionMessage': return 'dokumen'
        case 'contactMessage': case 'contactsArrayMessage': return 'kontak'
        case 'locationMessage': case 'liveLocationMessage': return 'lokasi'
        case 'pollCreationMessage': case 'pollCreationMessageV2': case 'pollCreationMessageV3': return 'poll'
        case 'stickerMessage': return 'sticker'
        default: return null
    }
}

const BOT_TYPES = ['buttonsMessage', 'listMessage', 'templateMessage', 'interactiveMessage', 'productMessage', 'highlyStructuredMessage']
// Member biasa tidak bisa mengirim tombol / list / interactive; ID pesan "BAE5…" khas library bot.
export function looksBot(m, layers) {
    if (layers.some(l => BOT_TYPES.some(k => l?.[k]))) return true
    return /^BAE5[0-9A-F]{12}$/i.test(String(m.id || m.key?.id || ''))
}

export function ctxInfo(m, layers) {
    for (const l of layers) for (const v of Object.values(l || {})) if (v && typeof v === 'object' && v.contextInfo) return v.contextInfo
    return m.msg?.contextInfo || {}
}

const shortRe = new RegExp(`(^|[^a-z0-9.-])(${SHORTENERS.map(s => s.replace(/\./g, '\\.')).join('|')})\\/\\S+`, 'i')
export function badLink(body, extraDomains = []) {
    if (!body) return null
    const s = body.match(shortRe)
    if (s) return `link pendek (${s[2].toLowerCase()})`
    const re = /\b(?:https?:\/\/|www\.)([^\s/?#:]+)/gi
    let hit
    while ((hit = re.exec(body))) {
        const host = hit[1].toLowerCase().replace(/[.,;)]+$/, '')
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return 'link alamat IP'
        if (host.includes('xn--')) return 'domain mencurigakan (punycode)'
        if (RISKY_TLD.includes(host.split('.').pop())) return `domain berisiko (.${host.split('.').pop()})`
        if (extraDomains.some(d => host === d || host.endsWith('.' + d))) return `domain terlarang (${host})`
    }
    for (const d of extraDomains) if (body.toLowerCase().includes(d)) return `domain terlarang (${d})`
    return null
}

export const parseHM = (t) => {
    const hit = String(t || '').match(/^(\d{1,2})[:.](\d{2})$/)
    if (!hit) return null
    const h = Number(hit[1]), mi = Number(hit[2])
    return h > 23 || mi > 59 ? null : h * 60 + mi
}
export const fmtHM = (t) => { const v = parseHM(t); return v === null ? null : `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}` }

// ───────── penjaga pesan (dipanggil dari groupGuard) ─────────
const slowLast = new Map()

export async function plusMessage(sock, m, { g, layers, exempt, hit }) {
    const body = m.body || ''
    const violate = async (cfg, reason) => {
        if (await exempt()) return false
        await hit(reason, !!cfg.kick, !!cfg.warn)
        return true
    }

    if (g.antibot?.on && looksBot(m, layers) && await violate(g.antibot, 'pesan bot lain tidak diizinkan di grup ini.')) return true

    if (g.antivirtex?.on && isVirtex(body, g.antivirtex.max || 4000) && await violate(g.antivirtex, 'pesan virtex / terlalu besar dilarang.')) return true

    if (g.antiforward?.on) {
        const ci = ctxInfo(m, layers)
        const forwarded = g.antiforward.many ? Number(ci.forwardingScore || 0) >= 5 : (ci.isForwarded || Number(ci.forwardingScore || 0) > 0)
        if (forwarded && await violate(g.antiforward, 'dilarang meneruskan pesan (forward) di grup ini.')) return true
    }

    if (g.antitag?.on) {
        const ci = ctxInfo(m, layers)
        const n = (ci.mentionedJid?.length || 0) + (ci.groupMentions?.length || 0)
        if (n >= (g.antitag.max || 5) && await violate(g.antitag, `dilarang me-mention ${g.antitag.max || 5} orang atau lebih sekaligus.`)) return true
    }

    if (g.antipromo?.on && body) {
        const word = hasPromo(body, g.antipromo.words)
        if (word && await violate(g.antipromo, 'dilarang promosi / jualan di grup ini.')) return true
    }

    if (g.antiphishing?.on && body) {
        const bad = badLink(body, g.antiphishing.domains || [])
        if (bad && await violate(g.antiphishing, `dilarang mengirim ${bad}.`)) return true
    }

    if (g.antimedia?.on && g.antimedia.kinds?.length) {
        const kind = mediaKind(m)
        if (kind && g.antimedia.kinds.includes(kind) && await violate(g.antimedia, `dilarang mengirim ${kind} di grup ini.`)) return true
    }

    if (g.slowmode?.on && g.slowmode.sec > 0) {
        const key = m.chat + m.sender
        const now = Date.now()
        const last = slowLast.get(key) || 0
        if (now - last < g.slowmode.sec * 1000) {
            if (!(await exempt())) { await hit(`slowmode aktif, beri jeda ${g.slowmode.sec} detik antar pesan.`, false, false); return true }
        }
        slowLast.set(key, now)
        if (slowLast.size > 1000) slowLast.delete(slowLast.keys().next().value)
    }
    return false
}

// ───────── member masuk: blacklist, anti-asing, anti-raid ─────────
const raidLog = new Map() // jid -> [{ t, jid }]

export async function plusJoin(sock, update) {
    const { id: jid, participants = [], action, author } = update || {}
    if (action !== 'add' || !jid?.endsWith('@g.us')) return
    const g = peek(jid)
    if (!g) return
    const wantBl = g.blacklist && Object.keys(g.blacklist).length
    if (!(wantBl || g.antiraid?.on || (g.antiasing?.on && g.antiasing.codes?.length))) return

    const bots = botIds(sock)
    const meta = await getMeta(sock, jid, true).catch(() => null)
    const canKick = !!meta && botIsAdmin(sock, meta)
    const adder = meta && author ? findMember(meta, jidOf(author)) : null
    const byAdmin = !!adder?.admin
    const kicked = []

    for (const p of participants) {
        const target = jidOf(p)
        const ids = idsOfParticipant(p)
        if (!target || ids.some(i => bots.includes(i))) continue
        if (inList(g, 'trusted', ids)) continue

        let reason = null
        if (wantBl && inList(g, 'blacklist', ids)) reason = 'ada di blacklist grup'

        if (!reason && g.antiasing?.on && g.antiasing.codes?.length) {
            const pn = [p?.phoneNumber, p?.jid, jidOf(p)].filter(Boolean).find(x => String(x).endsWith('@s.whatsapp.net'))
            const number = pn ? num(pn) : null
            let owner = false
            for (const i of ids) if (await isOwnerNumber(sock, i)) owner = true
            if (number && !owner && !g.antiasing.codes.some(c => number.startsWith(c))) reason = `kode negara +${number.slice(0, 3)}… tidak diizinkan`
        }

        if (reason) {
            if (!canKick) { await notice(sock, jid, '⚠️ Bot *belum jadi admin*, jadi member terlarang tidak bisa dikeluarkan otomatis.'); continue }
            const ok = await sock.groupParticipantsUpdate(jid, [target], 'remove').then(() => true).catch(() => false)
            if (ok) {
                kicked.push(target)
                await sock.sendMessage(jid, { text: `🚫 @${num(target)} dikeluarkan otomatis: ${reason}.`, mentions: [target] }).catch(() => null)
            }
            continue
        }

        // anti-raid: hitung join (join yang dilakukan admin tidak dihitung)
        if (g.antiraid?.on && !byAdmin) {
            const log = raidLog.get(jid) || []
            log.push({ t: Date.now(), jid: target })
            raidLog.set(jid, log)
        }
    }

    if (g.antiraid?.on) await checkRaid(sock, jid, g.antiraid, meta, canKick)
}

async function checkRaid(sock, jid, cfg, meta, canKick) {
    const win = (cfg.minutes || 2) * 60_000
    const now = Date.now()
    const log = (raidLog.get(jid) || []).filter(x => now - x.t < win)
    raidLog.set(jid, log)
    if (log.length < (cfg.max || 8) || (cfg.until && cfg.until > now)) return

    const lockMin = cfg.lock || 30
    updateGroupSetting(jid, 'antiraid', { until: now + lockMin * 60_000 })
    const admins = (meta?.participants || []).filter(x => x.admin).map(x => x.id)
    const intruders = uniq(log.map(x => x.jid))
    if (!canKick) return notice(sock, jid, `🚨 *ANTI-RAID*: ${log.length} member masuk dalam ${cfg.minutes || 2} menit, tapi bot belum jadi admin sehingga tidak bisa mengunci grup.`)

    await sock.groupSettingUpdate(jid, 'announcement').catch(() => null)
    let removed = 0
    if (cfg.kick) removed = await sock.groupParticipantsUpdate(jid, intruders, 'remove').then(() => intruders.length).catch(() => 0)
    raidLog.delete(jid)
    await sock.sendMessage(jid, {
        text: `🚨 *ANTI-RAID AKTIF*\n${log.length} member masuk dalam ${cfg.minutes || 2} menit.\n🔒 Grup dikunci ${lockMin} menit (hanya admin yang bisa chat).${removed ? `\n🚫 ${removed} member baru dikeluarkan.` : ''}\n\nAdmin: ${admins.map(a => '@' + num(a)).join(' ')}\nBuka lebih awal: antiraid buka`,
        mentions: admins
    }).catch(() => null)
}

export async function raidUnlock(sock, jid) {
    updateGroupSetting(jid, 'antiraid', { until: undefined })
    await sock.groupSettingUpdate(jid, 'not_announcement').catch(() => null)
    await sock.sendMessage(jid, { text: '🔓 Anti-raid selesai, grup dibuka kembali.' }).catch(() => null)
}

// ───────── promote / demote tanpa izin ─────────
export async function plusAdmin(sock, update) {
    const { id: jid, participants = [], action, author } = update || {}
    const cfg = peek(jid)?.antipromote
    if (!cfg?.on || !['promote', 'demote'].includes(action)) return
    const authorJid = jidOf(author)
    if (!authorJid) return
    const bots = botIds(sock)
    if (bots.includes(num(authorJid))) return // hasil revert bot sendiri

    const meta = await getMeta(sock, jid, true).catch(() => null)
    if (!meta) return
    const am = findMember(meta, authorJid)
    const aids = uniq([num(authorJid), ...(am ? memberIds(am) : []), ...(typeof author === 'object' ? memberIds(author) : [])])
    const creator = [meta.owner, meta.ownerPn, meta.ownerJid].filter(Boolean).map(num)
    if (aids.some(i => creator.includes(i))) return
    for (const i of aids) if (await isOwnerNumber(sock, i)) return
    if (entryKey(cfg.allow, aids)) return

    if (!botIsAdmin(sock, meta)) return notice(sock, jid, '⚠️ Antipromote butuh bot jadi admin untuk membatalkan perubahan admin.')
    const targets = participants.map(jidOf).filter(Boolean).filter(j => !bots.includes(num(j)))
    if (!targets.length) return

    const back = action === 'promote' ? 'demote' : 'promote'
    const ok = await sock.groupParticipantsUpdate(jid, targets, back).then(() => true).catch(() => false)
    await sock.sendMessage(jid, {
        text: `🛡️ *ANTIPROMOTE*\n@${num(authorJid)} tidak diizinkan ${action === 'promote' ? 'menaikkan' : 'menurunkan'} admin.\n${ok ? 'Perubahan dibatalkan' : 'Gagal membatalkan perubahan'} untuk ${targets.map(t => '@' + num(t)).join(' ')}.\n_Izinkan admin tertentu: antipromote allow @user_`,
        mentions: [authorJid, ...targets]
    }).catch(() => null)
}

// ───────── hapus otomatis notifikasi bot (welcome/goodbye/promote/demote) ─────────
export function autoClear(sock, chat, sent) {
    const c = peek(chat)?.autoclear
    if (!c?.on || !sent?.key) return
    const t = setTimeout(() => sock.sendMessage(chat, { delete: sent.key }).catch(() => null), (c.sec || 60) * 1000)
    t.unref?.()
}

// ───────── pemeriksa waktu: jadwal buka/tutup grup + akhir anti-raid ─────────
export async function sweep() {
    const sock = global.sock
    if (!sock?.user || !global.db?.groups) return
    const now = Date.now()
    const wib = new Date(now + 7 * 36e5)
    const today = wib.toISOString().slice(0, 10)
    const cur = wib.getUTCHours() * 60 + wib.getUTCMinutes()

    for (const [jid, g] of Object.entries(global.db.groups)) {
        if (!jid.endsWith('@g.us') || !g) continue
        const j = g.jadwalgc
        if (j) {
            for (const ev of ['open', 'close']) {
                const t = parseHM(j[ev])
                if (t === null || cur < t || cur >= t + 10 || j.last?.[ev] === today) continue
                j.last = { ...(j.last || {}), [ev]: today }
                save()
                try {
                    await sock.groupSettingUpdate(jid, ev === 'open' ? 'not_announcement' : 'announcement')
                    await sock.sendMessage(jid, { text: ev === 'open' ? `🔓 Grup dibuka otomatis (jadwal ${fmtHM(j.open)} WIB).` : `🔒 Grup ditutup otomatis (jadwal ${fmtHM(j.close)} WIB).` })
                } catch (e) { console.error('[JADWALGC]', e?.message || e) }
            }
        }
        if (g.antiraid?.until && g.antiraid.until <= now) await raidUnlock(sock, jid).catch(() => null)
    }
}

// ───────── preset keamanan ─────────
const PROTECT = ['antilink', 'antitoxic', 'antispam', 'antisticker', 'antiswgc', 'antitagsw', ...PLUS_WARNABLE.filter(f => !PLUS_OPT_IN.includes(f)), 'antiraid']
const SEDANG = {
    antilink: { on: true, warn: true }, antitoxic: { on: true, warn: true }, antispam: { on: true, warn: true },
    antivirtex: { on: true, warn: true }, antiphishing: { on: true, warn: true }, antiswgc: { on: true, warn: true }
}
export const PRESETS = {
    longgar: { antilink: { on: true, warn: true }, antitoxic: { on: true, warn: true }, antivirtex: { on: true, warn: true } },
    sedang: SEDANG,
    ketat: {
        ...SEDANG,
        antilink: { on: true, all: true, warn: true }, antitagsw: { on: true, warn: true },
        antiforward: { on: true, warn: true, many: true }, antitag: { on: true, warn: true, max: 5 },
        antipromo: { on: true, warn: true }, antibot: { on: true, warn: true },
        antiraid: { on: true }
    }
}

export function applyPreset(jid, name) {
    if (name !== 'off' && !PRESETS[name]) return false
    for (const k of PROTECT) if (peek(jid)?.[k]?.on) updateGroupSetting(jid, k, { on: false })
    if (name === 'off') { updateGroupSetting(jid, 'hukuman', { on: false }); return true }
    for (const [k, v] of Object.entries(PRESETS[name])) updateGroupSetting(jid, k, v)
    updateGroupSetting(jid, 'hukuman', { on: true, muteAt: 2, muteMin: 10 })
    return true
}

// ───────── backup / restore / salin setting ─────────
const SNAP_KEYS = [...BASE_FEATURES, ...PLUS_FEATURES, 'welcome', 'goodbye', 'promote', 'demote', 'warn', 'hukuman', 'jadwalgc', 'autoclear', 'captcha']

export function snapshotOf(jid) {
    const g = peek(jid) || {}
    const out = {}
    for (const k of SNAP_KEYS) if (g[k] !== undefined) out[k] = JSON.parse(JSON.stringify(g[k]))
    if (out.warn) out.warn = { limit: out.warn.limit }
    if (out.captcha) delete out.captcha.pending
    if (out.antipromote) delete out.antipromote.allow
    if (out.antiraid) delete out.antiraid.until
    if (out.jadwalgc) delete out.jadwalgc.last
    return out
}

export function saveBackup(jid, name) {
    const store = (global.db.gsetBackups ||= {})
    const code = Math.random().toString(36).slice(2, 8)
    store[code] = { from: jid, name: name || '', at: Date.now(), data: snapshotOf(jid) }
    grp(jid).lastBackup = code
    const keys = Object.keys(store)
    if (keys.length > 50) for (const k of keys.sort((a, b) => store[a].at - store[b].at).slice(0, keys.length - 50)) delete store[k]
    save()
    return { code, count: Object.keys(store[code].data).length }
}

export function restoreBackup(jid, code) {
    const b = global.db.gsetBackups?.[code]
    if (!b) return null
    const g = grp(jid)
    for (const k of SNAP_KEYS) {
        if (b.data[k] === undefined) delete g[k]
        else g[k] = k === 'warn' ? { ...(g.warn || {}), limit: b.data.warn.limit } : JSON.parse(JSON.stringify(b.data[k]))
    }
    save()
    return b
}

// ───────── dasbor pengaturan ─────────
export async function dashboard(sock, jid, p = '.') {
    const g = peek(jid) || {}
    const meta = await getMeta(sock, jid, true).catch(() => null)
    const all = [...BASE_FEATURES, ...PLUS_FEATURES]
    const on = all.filter(f => g[f]?.on)
    const off = all.filter(f => !g[f]?.on)
    const n = (o) => Object.keys(o || {}).length
    const eph = meta?.ephemeralDuration
    const rows = [
        `┃ 👥 Member : ${meta?.participants?.length ?? '-'}`,
        `┃ 🤖 Bot admin : ${meta ? (botIsAdmin(sock, meta) ? '✅' : '❌ (jadikan admin)') : '-'}`,
        `┃ 💬 Chat : ${meta?.announce ? '🔒 hanya admin' : '🔓 semua member'}`,
        `┃ ⏳ Pesan sementara : ${eph ? Math.round(eph / 86400) + ' hari' : 'mati'}`,
        `┃ 📥 Persetujuan join : ${meta?.joinApprovalMode ? 'ON' : 'OFF'}`
    ]
    const extra = [
        `┃ ⚠️ Batas warn : ${g.warn?.limit || 3}  | Hukuman bertingkat : ${flag(g.hukuman?.on)}${g.hukuman?.on ? ` (mute di warn ke-${g.hukuman.muteAt || 2}, ${g.hukuman.muteMin || 10} mnt)` : ''}`,
        `┃ 👋 Welcome : ${flag(g.welcome?.on)} | Goodbye : ${flag(g.goodbye?.on)} | Captcha : ${flag(g.captcha?.on)}`,
        `┃ 🕒 Jadwal : ${g.jadwalgc ? `buka ${fmtHM(g.jadwalgc.open) || '-'} / tutup ${fmtHM(g.jadwalgc.close) || '-'} WIB` : 'mati'}`,
        `┃ 🐢 Slowmode : ${g.slowmode?.on && g.slowmode.sec ? g.slowmode.sec + ' detik' : 'mati'}`,
        `┃ 🧹 Hapus otomatis notif bot : ${g.autoclear?.on ? (g.autoclear.sec || 60) + ' detik' : 'mati'}`,
        `┃ ⭐ Trusted : ${n(g.trusted)} | 🚫 Blacklist : ${n(g.blacklist)} | 🔇 Mute : ${n(g.muted)}`
    ]
    return `╭─▣「 *PENGATURAN GRUP* 」▣─╮\n${meta?.subject ? `┃ 📛 ${meta.subject}\n` : ''}${rows.join('\n')}\n┣━━━━━━━━━━━━━\n┃ 🛡️ *Penjaga* (${on.length}/${all.length} aktif)\n┃ 🟢 ${on.join(', ') || '-'}\n┃ 🔴 ${off.join(', ') || '-'}\n┣━━━━━━━━━━━━━\n${extra.join('\n')}\n╰─────────────➤\n\n_Ubah: ${p}enable / ${p}disable <fitur>, ${p}preset ketat|sedang|longgar, ${p}jadwalgc, ${p}slowmode_`
}

// ───────── bantuan & status fitur baru (dipakai guard.js) ─────────
export const PLUS_HELP = {
    antivirtex: (p) => `${p}antivirtex on|off\n${p}antivirtex set <karakter>  (batas panjang pesan, bawaan 4000)\n${p}antivirtex kick|warn\n_Pesan terlalu panjang, penuh karakter melayang / tak terlihat dihapus. Admin dikecualikan._`,
    antiforward: (p) => `${p}antiforward on|off\n${p}antiforward many  (hanya yang diteruskan berkali-kali, bisa di-toggle)\n${p}antiforward kick|warn\n_Pesan "diteruskan" dihapus. Admin dikecualikan._`,
    antitag: (p) => `${p}antitag on|off\n${p}antitag set <jumlah>  (bawaan 5)\n${p}antitag kick|warn\n_Pesan yang me-mention banyak orang sekaligus dihapus._`,
    antipromo: (p) => `${p}antipromo on|off\n${p}antipromo add <kata/frasa>\n${p}antipromo del <kata/frasa>\n${p}antipromo list | reset\n${p}antipromo kick|warn`,
    antimedia: (p) => `${p}antimedia on|off\n${p}antimedia add <jenis...>\n${p}antimedia del <jenis...>\n${p}antimedia list\nJenis: ${MEDIA_KINDS.join(', ')}\n${p}antimedia kick|warn\n_Contoh: ${p}antimedia add video dokumen_`,
    antibot: (p) => `${p}antibot on|off\n${p}antibot kick|warn\n_Menghapus pesan bot lain (tombol/list/interactive dan ID khas library bot). Bot yang dipercaya: ${p}trusted add @bot._`,
    antiphishing: (p) => `${p}antiphishing on|off\n${p}antiphishing add <domain>\n${p}antiphishing del <domain>\n${p}antiphishing list\n${p}antiphishing kick|warn\n_Memblokir link pendek (bit.ly dst), link IP, domain punycode / TLD berisiko, dan domain buatanmu._`,
    slowmode: (p) => `${p}slowmode <detik>  (1-300)\n${p}slowmode on|off\n_Member hanya boleh kirim 1 pesan per N detik. Admin dikecualikan._`,
    antiraid: (p) => `${p}antiraid on|off\n${p}antiraid set <jumlah> <menit>  (bawaan 8 join / 2 menit)\n${p}antiraid kunci <menit>  (lama grup dikunci, bawaan 30)\n${p}antiraid kick  (keluarkan juga yang baru masuk, bisa di-toggle)\n${p}antiraid buka  (buka grup lebih awal)`,
    antiasing: (p) => `${p}antiasing on|off\n${p}antiasing kode <kode...>  (contoh: ${p}antiasing kode 62 60)\n${p}antiasing add <kode> | del <kode>\n_Member baru dengan kode negara di luar daftar dikeluarkan. Daftar kosong = tidak melakukan apa-apa._`,
    antipromote: (p) => `${p}antipromote on|off\n${p}antipromote allow @user  (admin yang boleh promote/demote)\n${p}antipromote deny @user\n${p}antipromote list\n_Promote/demote oleh selain pembuat grup, owner bot, dan yang diizinkan akan dibatalkan (bot harus admin)._`
}

export function plusStatusExtra(type, cfg) {
    const L = (k, v) => `\n┃ ✦ ${k} : ${v}`
    const kick = L('Keluarkan', flag(cfg.kick))
    switch (type) {
        case 'antivirtex': return L('Batas karakter', cfg.max || 4000) + kick
        case 'antiforward': return L('Mode', cfg.many ? 'berkali-kali saja' : 'semua forward') + kick
        case 'antitag': return L('Batas mention', cfg.max || 5) + kick
        case 'antipromo': return L('Daftar kata', `${(cfg.words || DEFAULT_PROMO).length}${cfg.words ? ' (custom)' : ' (bawaan)'}`) + kick
        case 'antimedia': return L('Dilarang', (cfg.kinds || []).join(', ') || 'belum ada (tidak aktif)') + kick
        case 'antibot': return kick
        case 'antiphishing': return L('Domain tambahan', (cfg.domains || []).length) + kick
        case 'slowmode': return L('Jeda', cfg.sec ? `${cfg.sec} detik` : 'belum diatur (tidak aktif)')
        case 'antiraid': return L('Pemicu', `${cfg.max || 8} join / ${cfg.minutes || 2} menit`) + L('Kunci', `${cfg.lock || 30} menit`) + L('Keluarkan', flag(cfg.kick))
        case 'antiasing': return L('Kode negara', (cfg.codes || []).join(', ') || 'belum diatur (tidak aktif)')
        case 'antipromote': return L('Admin diizinkan', Object.keys(cfg.allow || {}).length)
        default: return ''
    }
}

const intIn = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= lo && n <= hi ? n : null }

// Subperintah khusus fitur baru. Mengembalikan undefined kalau bukan miliknya (guard.js lanjut ke tampilan status).
export async function plusHandle(command, sub, value, { cfg, set, reply, p, jid, sock, m, text }) {
    const isPlus = PLUS_FEATURES.includes(command)
    if (command === 'antispam' && sub === 'set') {
        const [a, b] = value.split(/\s+/)
        const max = intIn(a, 2, 30), sec = intIn(b, 2, 60)
        if (!max || !sec) return reply(`Format: ${p}antispam set <jumlah pesan 2-30> <detik 2-60>\nContoh: ${p}antispam set 8 5`)
        set({ on: true, max, sec })
        return reply(`Antispam: lebih dari *${max} pesan* dalam *${sec} detik* dianggap spam.`)
    }
    if (!isPlus) return undefined

    if (PLUS_WARNABLE.includes(command) && sub === 'kick') {
        set({ on: true, kick: !cfg.kick })
        return reply(`${PLUS_TITLE[command]} ${!cfg.kick ? 'akan menghapus pesan dan mengeluarkan pengirim' : 'hanya menghapus pesan'}.`)
    }

    switch (command) {
        case 'antivirtex': {
            if (sub !== 'set') break
            const n = intIn(value, 500, 20000)
            if (!n) return reply(`Format: ${p}antivirtex set <500-20000>`)
            set({ on: true, max: n }); return reply(`Batas panjang pesan: *${n}* karakter.`)
        }
        case 'antitag': {
            if (sub !== 'set') break
            const n = intIn(value, 2, 50)
            if (!n) return reply(`Format: ${p}antitag set <2-50>`)
            set({ on: true, max: n }); return reply(`Pesan dengan *${n}+ mention* akan dihapus.`)
        }
        case 'antiforward': {
            if (sub !== 'many') break
            set({ on: true, many: !cfg.many })
            return reply(`Antiforward sekarang memblokir ${!cfg.many ? 'pesan yang diteruskan berkali-kali saja' : 'semua pesan forward'}.`)
        }
        case 'antipromo':
        case 'antiphishing': {
            const field = command === 'antipromo' ? 'words' : 'domains'
            const cur = new Set(cfg[field] || (command === 'antipromo' ? DEFAULT_PROMO : []))
            const item = value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim()
            const keep = command === 'antipromo' ? value.toLowerCase().trim() : item
            if (sub === 'add' && keep) { cur.add(keep); set({ [field]: [...cur] }); return reply(`*${keep}* ditambahkan (${cur.size}).`) }
            if (sub === 'del' && keep) {
                if (!cur.delete(keep)) return reply(`*${keep}* tidak ada di daftar.`)
                set({ [field]: [...cur] }); return reply(`*${keep}* dihapus (${cur.size}).`)
            }
            if (sub === 'list') return reply(`*▢ DAFTAR ${command === 'antipromo' ? 'KATA PROMOSI' : 'DOMAIN TERLARANG'}* (${cur.size})\n${[...cur].join(', ') || '-'}`)
            if (sub === 'reset' && command === 'antipromo') { set({ words: undefined }); return reply('Daftar kata dikembalikan ke bawaan.') }
            break
        }
        case 'antimedia': {
            const kinds = new Set(cfg.kinds || [])
            const given = value.toLowerCase().split(/[\s,]+/).filter(Boolean)
            const valid = given.filter(k => MEDIA_KINDS.includes(k))
            if ((sub === 'add' || sub === 'del') && !valid.length) return reply(`Jenis tidak dikenal. Pilih: ${MEDIA_KINDS.join(', ')}`)
            if (sub === 'add') { valid.forEach(k => kinds.add(k)); set({ kinds: [...kinds] }); return reply(`Dilarang: *${[...kinds].join(', ')}*${cfg.on ? '' : `\nAktifkan dengan ${p}antimedia on`}`) }
            if (sub === 'del') { valid.forEach(k => kinds.delete(k)); set({ kinds: [...kinds] }); return reply(`Dilarang: *${[...kinds].join(', ') || '-'}*`) }
            if (sub === 'list') return reply(`*▢ MEDIA DILARANG*\n${[...kinds].join(', ') || '-'}\n\nJenis tersedia: ${MEDIA_KINDS.join(', ')}`)
            break
        }
        case 'slowmode': {
            const n = intIn(sub, 0, 300)
            if (n === null) break
            if (n === 0) { set({ on: false }); return reply('Slowmode dimatikan.') }
            set({ on: true, sec: n }); return reply(`🐢 Slowmode aktif: 1 pesan per *${n} detik* untuk member. Admin dikecualikan.`)
        }
        case 'antiraid': {
            if (sub === 'set') {
                const [a, b] = value.split(/\s+/)
                const max = intIn(a, 3, 100), minutes = intIn(b, 1, 30)
                if (!max || !minutes) return reply(`Format: ${p}antiraid set <jumlah join 3-100> <menit 1-30>\nContoh: ${p}antiraid set 8 2`)
                set({ on: true, max, minutes }); return reply(`Anti-raid aktif: *${max} join* dalam *${minutes} menit* mengunci grup.`)
            }
            if (sub === 'kunci') {
                const n = intIn(value, 1, 1440)
                if (!n) return reply(`Format: ${p}antiraid kunci <1-1440 menit>`)
                set({ lock: n }); return reply(`Saat raid, grup dikunci *${n} menit*.`)
            }
            if (sub === 'kick') { set({ on: true, kick: !cfg.kick }); return reply(`Antiraid ${!cfg.kick ? 'juga mengeluarkan member yang baru masuk' : 'hanya mengunci grup'}.`) }
            if (sub === 'buka') { await raidUnlock(sock, jid); return true }
            break
        }
        case 'antiasing': {
            const codes = new Set(cfg.codes || [])
            const given = value.split(/[\s,+]+/).map(x => x.replace(/\D/g, '')).filter(x => x && x.length <= 4)
            if (sub === 'kode') { if (!given.length) return reply(`Format: ${p}antiasing kode 62 60`); set({ codes: uniq(given) }); return reply(`Kode negara diizinkan: *${uniq(given).join(', ')}*`) }
            if (sub === 'add' && given.length) { given.forEach(c => codes.add(c)); set({ codes: [...codes] }); return reply(`Kode diizinkan: *${[...codes].join(', ')}*`) }
            if (sub === 'del' && given.length) { given.forEach(c => codes.delete(c)); set({ codes: [...codes] }); return reply(`Kode diizinkan: *${[...codes].join(', ') || '-'}*`) }
            if (sub === 'list') return reply(`Kode negara diizinkan: *${[...codes].join(', ') || 'belum diatur'}*`)
            break
        }
        case 'antipromote': {
            if (sub === 'list') {
                const rows = Object.values(cfg.allow || {})
                return reply(rows.length ? `*▢ ADMIN DIIZINKAN*\n${rows.map(e => `-▢ @${num(e.jid || e.ids[0])}`).join('\n')}` : 'Belum ada admin tambahan yang diizinkan.', { mentions: rows.map(e => e.jid).filter(Boolean) })
            }
            if (sub === 'allow' || sub === 'deny') {
                const meta = await getMeta(sock, jid, true)
                const found = resolveTargets(m, text, meta)
                if (!found.length) return reply(`Format: ${p}antipromote ${sub} @user  (atau reply pesannya)`)
                const done = []
                for (const t of found) {
                    if (sub === 'allow') { const map = (cfg.allow ||= {}); const ids = memberIds(t); const key = entryKey(map, ids) || ids[0]; map[key] = { ids, jid: t.id, at: Date.now() } ; done.push(t.id) }
                    else if (cfg.allow) { const key = entryKey(cfg.allow, memberIds(t)); if (key) { delete cfg.allow[key]; done.push(t.id) } }
                }
                set({ allow: cfg.allow })
                return reply(done.length ? done.map(j => `-▢ @${num(j)} ${sub === 'allow' ? 'diizinkan' : 'tidak diizinkan lagi'}`).join('\n') : 'Tidak ada perubahan.', { mentions: done })
            }
            break
        }
    }
    return undefined
}

// ───────── pasang hook global ─────────
export function installGuardPlus() {
    global.guardPlusMessage = plusMessage
    global.onGuardPlusJoin = (sock, update) => plusJoin(sock, update).catch(e => console.error('[GUARDPLUS join]', e?.message || e))
    global.onGuardPlusAdmin = (sock, update) => plusAdmin(sock, update).catch(e => console.error('[GUARDPLUS admin]', e?.message || e))
    global.gpAutoClear = autoClear
    if (!global.__guardPlusSweeper) {
        global.__guardPlusSweeper = setInterval(() => sweep().catch(e => console.error('[GUARDPLUS sweep]', e?.message || e)), 30_000)
        global.__guardPlusSweeper.unref?.()
    }
}
installGuardPlus()
