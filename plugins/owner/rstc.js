/**
 * Kaguya Multi Device — WhatsApp Bot
 * Plugin  : Tools — react sticker (tembak stiker ke pesan target)
 * Khusus  : owner
 *
 * Satu nama = satu paket stiker. Satu paket boleh berisi banyak stiker
 * (gambar maupun gerak); saat menembak, stikernya diacak dari isi paket itu.
 *
 * Ada dua cara menembak:
 *   1. Command   : reply pesan lalu ketik .rstc [nama] [jumlah]
 *   2. Reaction  : beri reaction emoji (yang sudah diset) ke pesan apa saja,
 *                  stiker langsung ditembakkan ke pesan itu.
 *
 * Paket:
 *   .rstc [nama] [jumlah]   (reply pesan apa saja) tembak stiker acak dari paket "nama"
 *                           (default: paket default, 10x). Contoh: .rstc ara 20 / .rstc win 1
 *   .rstc add [nama]        (reply stiker) tambah stiker ke paket "nama"
 *   .rstc del <nama>        hapus seluruh paket
 *   .rstc del <nama> <no>   hapus stiker nomor <no> dari paket
 *   .rstc del <nama>        (sambil reply stiker) hapus stiker itu saja dari paket
 *   .rstc list              lihat semua paket + jumlah stikernya
 *
 * Emoji reaction:
 *   .rstc emoji                          lihat emoji yang sudah diset + status
 *   .rstc emoji <emoji> [nama] [jumlah]  set emoji -> paket & jumlah (contoh: .rstc emoji 🔥 ara 20)
 *   .rstc emoji del <emoji>              hapus emoji
 *   .rstc emoji on | off                 aktif / matikan tembak lewat reaction
 *
 * Data (database/): global.db.rstc (paket stiker) dan global.db.rstcReact (emoji reaction).
 * Data lama di database/rstc.json atau data/rstc.json otomatis dibaca sekali lalu dipindah.
 */

import fs from 'fs'
import path from 'path'
import { isOwnerNumber } from '../../lib/core/system.js'

const SPAM_COUNT = 10 // jumlah default kalau tidak diisi
const MAX_COUNT = 50 // batas maksimal per tembakan (hindari spam berlebihan / limit WhatsApp)
const SPAM_DELAY_MS = 700
const MAX_PER_PACK = 50 // batas stiker dalam satu paket
const MAX_NAME = 30
const DEFAULT_NAME = 'default'
const REACT_MAX_AGE_MS = 60 * 1000 // reaction lama (mis. terkirim saat bot offline) diabaikan

const KEY_PACKS = 'rstc' // { nama: [stiker, ...] }
const KEY_REACT = 'rstcReact' // { on: true, map: { '🔥': { pack, count } } }
const LEGACY_FILES = ['./database/rstc.json', './data/rstc.json']

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ───────── penyimpanan (global.db -> otomatis tersimpan lewat proxy) ─────────

// data lama bisa berupa { nama: stiker } (satu stiker) -> jadikan paket
const normalize = (raw) => {
    const out = {}
    for (const [k, v] of Object.entries(raw || {})) out[k] = Array.isArray(v) ? v : (v ? [v] : [])
    return out
}

function packsDb() {
    if (global.db[KEY_PACKS] === undefined) {
        let raw = null
        for (const f of LEGACY_FILES) {
            try {
                if (!fs.existsSync(f)) continue
                raw = JSON.parse(fs.readFileSync(f, 'utf8'))
                try {
                    fs.mkdirSync('./database/backup-lama', { recursive: true })
                    fs.renameSync(f, path.join('./database/backup-lama', 'rstc.json'))
                } catch {}
                break
            } catch {}
        }
        global.db[KEY_PACKS] = normalize(raw)
    }
    return global.db[KEY_PACKS]
}

function reactDb() {
    const d = (global.db[KEY_REACT] ||= {})
    if (typeof d.on !== 'boolean') d.on = true
    d.map ||= {}
    return d
}

// assign ke proxy -> database ikut tersimpan
const save = () => {
    try {
        global.db[KEY_PACKS] = packsDb()
        global.db[KEY_REACT] = reactDb()
    } catch (e) { console.error('[RSTC]', e.message) }
}

const cleanName = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || DEFAULT_NAME

const packs = {
    names: () => Object.keys(packsDb()).filter(k => packsDb()[k]?.length),
    get: (name) => packsDb()[cleanName(name)] || null,
    add(name, entry) {
        const key = cleanName(name)
        const pack = (packsDb()[key] ||= [])
        if (pack.some(s => s.fileSha256 && s.fileSha256 === entry.fileSha256)) return { ok: false, key, msg: `Stiker itu sudah ada di paket *${key}*.` }
        if (pack.length >= MAX_PER_PACK) return { ok: false, key, msg: `Paket *${key}* sudah penuh (maks ${MAX_PER_PACK} stiker).` }
        pack.push(entry)
        save()
        return { ok: true, key, msg: `Stiker ke-${pack.length} berhasil ditambahkan ke *${key}*` }
    },
    removePack(name) {
        const key = cleanName(name)
        const db = packsDb()
        if (!db[key]) return `Paket *${key}* tidak ditemukan.`
        const n = db[key].length
        delete db[key]
        save()
        return `Paket *${key}* (${n} stiker) dihapus.`
    },
    removeAt(name, no) {
        const key = cleanName(name)
        const pack = packsDb()[key]
        if (!pack || no < 1 || no > pack.length) return null
        pack.splice(no - 1, 1)
        if (!pack.length) delete packsDb()[key]
        save()
        return `Stiker nomor ${no} dihapus dari *${key}*${pack.length ? ` (sisa ${pack.length})` : ' (paket kosong, ikut dihapus)'}.`
    },
    removeSticker(name, sha) {
        const key = cleanName(name)
        const pack = packsDb()[key]
        if (!pack) return `Paket *${key}* tidak ditemukan.`
        const i = pack.findIndex(s => s.fileSha256 === sha)
        if (i < 0) return `Stiker itu tidak ada di paket *${key}*.`
        pack.splice(i, 1)
        if (!pack.length) delete packsDb()[key]
        save()
        return `Stiker dihapus dari *${key}*${pack.length ? ` (sisa ${pack.length})` : ' (paket kosong, ikut dihapus)'}.`
    }
}

// ───────── emoji ─────────

// VS16 dan skin tone dibuang supaya "❤" = "❤️" dan "👍🏽" = "👍"
const normEmoji = (t) => String(t || '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
    .trim()

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\u20E3/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// untuk tampilan: simbol teks (mis. ❤) diberi VS16 supaya muncul sebagai emoji berwarna
const showEmoji = (e) => (e.length === 1 && /[\u00A9\u00AE\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF]/.test(e)) ? `${e}\uFE0F` : e

// satu emoji saja (satu grapheme), selain itu null
function parseEmoji(token) {
    const t = normEmoji(token)
    if (!t || !EMOJI_RE.test(t)) return null
    return [...segmenter.segment(t)].length === 1 ? t : null
}

// ───────── konversi field mentah stickerMessage ↔ JSON ─────────
const toBase64 = (v) => {
    if (!v) return undefined
    return Buffer.isBuffer(v) ? v.toString('base64') : Buffer.from(v).toString('base64')
}
const toStrNum = (v) => {
    if (v === undefined || v === null) return undefined
    return typeof v?.toString === 'function' ? v.toString() : String(v)
}
// kebalikan toBase64, dipakai saat menembak stiker
const fromB64 = (v) => (Buffer.isBuffer(v) || v instanceof Uint8Array) ? v : Buffer.from(v, 'base64')

const toEntry = (q) => ({
    url: q.url,
    fileSha256: toBase64(q.fileSha256),
    fileEncSha256: toBase64(q.fileEncSha256),
    mediaKey: toBase64(q.mediaKey),
    mimetype: q.mimetype,
    height: q.height,
    width: q.width,
    directPath: q.directPath,
    fileLength: toStrNum(q.fileLength),
    mediaKeyTimestamp: toStrNum(q.mediaKeyTimestamp),
    isAnimated: !!q.isAnimated,
    isAvatar: !!q.isAvatar,
    isAiSticker: !!q.isAiSticker,
    isLottie: !!q.isLottie,
    // tambahan untuk stiker gerak (preview frame pertama)
    firstFrameLength: q.firstFrameLength || undefined,
    firstFrameSidecar: toBase64(q.firstFrameSidecar),
    pngThumbnail: toBase64(q.pngThumbnail),
    stickerSentTs: toStrNum(q.stickerSentTs)
})

const toContent = (s) => ({
    url: s.url,
    fileSha256: fromB64(s.fileSha256),
    fileEncSha256: fromB64(s.fileEncSha256),
    mediaKey: fromB64(s.mediaKey),
    mimetype: s.mimetype,
    height: s.height,
    width: s.width,
    directPath: s.directPath,
    fileLength: s.fileLength,
    mediaKeyTimestamp: s.mediaKeyTimestamp,
    isAnimated: s.isAnimated,
    isAvatar: s.isAvatar,
    isAiSticker: s.isAiSticker,
    isLottie: s.isLottie,
    ...(s.firstFrameLength ? { firstFrameLength: s.firstFrameLength } : {}),
    ...(s.firstFrameSidecar ? { firstFrameSidecar: fromB64(s.firstFrameSidecar) } : {}),
    ...(s.pngThumbnail ? { pngThumbnail: fromB64(s.pngThumbnail) } : {}),
    ...(s.stickerSentTs ? { stickerSentTs: s.stickerSentTs } : {})
})

// urutan acak tanpa pengulangan sampai semua stiker keluar, lalu diacak ulang
// (stiker yang sama tidak muncul dua kali berturut-turut)
function* shuffled(list) {
    let last = -1
    while (true) {
        const order = list.map((_, i) => i)
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]]
        }
        if (order.length > 1 && order[0] === last) order.push(order.shift())
        for (const i of order) { last = i; yield list[i] }
    }
}

// ───────── menembak (dipakai command dan reaction) ─────────

// chat yang sedang ditembak, supaya tidak tumpang tindih
const running = new Set()

const clampCount = (n) => Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(n)) || SPAM_COUNT))

async function fire(sock, chat, target, pack, count) {
    const picker = shuffled(pack)
    running.add(chat)
    try {
        for (let i = 0; i < count; i++) {
            const sticker = picker.next().value
            await sock.relayMessage(chat, {
                messageContextInfo: { messageAssociation: { associationType: 11, parentMessageKey: target } },
                stickerMessage: toContent(sticker)
            }, {})
            if (i < count - 1) await sleep(SPAM_DELAY_MS)
        }
    } finally {
        running.delete(chat)
    }
}

// "ara 20" -> { name: 'ara', count: 20 }; token terakhir berupa angka = jumlah
function parsePackArgs(tokens) {
    const parts = [...tokens]
    let count = SPAM_COUNT
    let capped = false
    if (parts.length && /^\d+$/.test(parts[parts.length - 1])) count = parseInt(parts.pop(), 10)
    if (count > MAX_COUNT) { count = MAX_COUNT; capped = true }
    return { name: parts.join(' ') || DEFAULT_NAME, count, capped }
}

// ───────── tembak lewat reaction emoji ─────────

const numOf = (j) => String(j || '').split('@')[0].split(':')[0]

const isBotJid = (sock, j) => {
    const n = numOf(j)
    return !!n && [sock.user?.id, sock.user?.lid].filter(Boolean).map(numOf).includes(n)
}

// yang bereaksi harus owner: akun bot sendiri, atau nomor yang terdaftar sebagai owner
async function reactorIsOwner(sock, key) {
    if (key.fromMe) return true
    const candidates = [key.participant, key.participantAlt, key.participantPn, key.remoteJid]
        .filter(j => j && !/@g\.us$/.test(j))
    for (const j of candidates) {
        const n = numOf(j)
        if (n && await isOwnerNumber(sock, n).catch(() => false)) return true
    }
    return false
}

// Key pesan target pada event reaction dihitung dari sudut pandang yang bereaksi.
// relayMessage butuh sudut pandang akun bot, jadi dikonversi kalau yang bereaksi bukan akun bot.
function targetFor(sock, rkey, tgt, chat) {
    const isGroup = /@g\.us$/.test(chat)

    if (rkey.fromMe) {
        return { remoteJid: chat, fromMe: !!tgt.fromMe, id: tgt.id, participant: isGroup ? tgt.participant : undefined }
    }

    const reactor = rkey.participant || rkey.remoteJid
    if (tgt.fromMe) {
        // pesan milik yang bereaksi (owner), bukan milik bot
        return { remoteJid: chat, fromMe: false, id: tgt.id, participant: isGroup ? reactor : undefined }
    }

    // pesan milik orang lain: di chat pribadi berarti milik bot
    const author = isGroup ? tgt.participant : undefined
    return { remoteJid: chat, fromMe: isGroup ? isBotJid(sock, author) : true, id: tgt.id, participant: author }
}

const seenReactions = new Map()

async function onReaction(sock, ev) {
    const r = ev?.reaction
    const tgt = ev?.key
    if (!sock || !r?.key || !tgt?.id) return

    const emoji = normEmoji(r.text)
    if (!emoji) return // reaction dihapus

    const cfg = reactDb()
    if (cfg.on === false) return
    const rule = cfg.map[emoji]
    if (!rule) return

    // abaikan reaction lama (terkirim saat bot offline / sinkronisasi ulang)
    const ts = Number(String(r.senderTimestampMs ?? ''))
    if (ts && Date.now() - ts > REACT_MAX_AGE_MS) return

    // satu reaction jangan diproses dua kali
    const dedupe = `${r.key.id}|${emoji}`
    if (seenReactions.has(dedupe)) return
    seenReactions.set(dedupe, Date.now())
    if (seenReactions.size > 200) seenReactions.delete(seenReactions.keys().next().value)

    if (!(await reactorIsOwner(sock, r.key))) return

    const chat = r.key.remoteJid || tgt.remoteJid
    if (!chat || chat === 'status@broadcast' || running.has(chat)) return

    const pack = packs.get(rule.pack)
    if (!pack?.length) return

    await fire(sock, chat, targetFor(sock, r.key, tgt, chat), pack, clampCount(rule.count))
}

// Plugin tidak menerima event reaction dari handler, jadi pasang pendengar sendiri di socket aktif.
// global.sock diganti tiap bot tersambung ulang, jadi dicek berkala dan dipasang ulang.
// Kalau plugin di-reload, pendengar lama dibuang dulu supaya tidak dobel.
const WATCHER = '__rstcReactWatcher'

function installWatcher() {
    const old = global[WATCHER]
    if (old) {
        clearInterval(old.timer)
        try { old.sock?.ev.off('messages.reaction', old.fn) } catch {}
    }

    const state = { sock: null, fn: null, timer: null }

    state.fn = (events) => {
        for (const ev of events || []) {
            onReaction(state.sock, ev).catch(e => console.error('[RSTC] reaction:', e?.message || e))
        }
    }

    const attach = () => {
        const sock = global.sock
        if (!sock?.ev || typeof sock.relayMessage !== 'function' || sock === state.sock) return
        try { state.sock?.ev.off('messages.reaction', state.fn) } catch {}
        sock.ev.on('messages.reaction', state.fn)
        state.sock = sock
    }

    attach()
    state.timer = setInterval(attach, 5000)
    state.timer.unref?.()
    global[WATCHER] = state
}

installWatcher()

// ───────── teks ─────────

const listText = () => {
    const names = packs.names()
    return names.length ? `Stiker tersedia:\n${names.map(n => `• ${n} (${packsDb()[n].length})`).join('\n')}` : null
}

const emojiListText = (p) => {
    const cfg = reactDb()
    const rows = Object.entries(cfg.map)
    const head = `Tembak lewat reaction: *${cfg.on ? 'aktif' : 'mati'}*`
    if (!rows.length) return `${head}\n\nBelum ada emoji. Set dengan *${p}rstc emoji <emoji> [nama] [jumlah]*`
    return `${head}\n\n${rows.map(([e, r]) => `${showEmoji(e)}  →  ${r.pack} × ${r.count}${packs.get(r.pack)?.length ? '' : '  (paket belum ada)'}`).join('\n')}`
}

const helpText = (p) =>
    `*${p}rstc* [nama] [jumlah]  (reply pesan apa saja)\n` +
    `  → tembak stiker acak dari paket "nama" (default: *${DEFAULT_NAME}*) sebanyak "jumlah" (default ${SPAM_COUNT}, maks ${MAX_COUNT})\n` +
    `  → contoh: *${p}rstc ara 20*, *${p}rstc win 1*, *${p}rstc 5*\n\n` +
    `*${p}rstc add [nama]*  (reply stiker, gambar atau gerak)\n` +
    `  → tambah stiker ke paket "nama" (default: *${DEFAULT_NAME}*), satu paket boleh banyak stiker\n\n` +
    `*${p}rstc del <nama>*\n` +
    `  → hapus seluruh paket\n` +
    `*${p}rstc del <nama> <no>*\n` +
    `  → hapus stiker nomor <no> dari paket\n` +
    `*${p}rstc del <nama>*  (sambil reply stiker)\n` +
    `  → hapus stiker itu saja dari paket\n\n` +
    `*${p}rstc list*\n` +
    `  → lihat semua paket dan jumlah stikernya\n\n` +
    `*Tembak lewat reaction*\n` +
    `*${p}rstc emoji <emoji> [nama] [jumlah]*\n` +
    `  → set emoji. Setelah itu cukup beri reaction emoji tersebut ke pesan apa saja\n` +
    `*${p}rstc emoji del <emoji>*  → hapus emoji\n` +
    `*${p}rstc emoji on|off*  → aktif / matikan\n` +
    `*${p}rstc emoji*  → lihat emoji yang sudah diset`

// ───────── command ─────────

let handler = async (m, { sock, text, prefix, reply, isOwner }) => {
    if (!isOwner) return
    const p = prefix || '.'
    const q = m.quoted
    const trimmed = String(text || '').trim()
    const sub = trimmed.split(/\s+/)[0]?.toLowerCase() || ''
    const arg = trimmed.slice(sub.length).trim()

    // ───── .rstc add [nama] ─────
    if (sub === 'add') {
        if (!q || q.mtype !== 'stickerMessage') return reply('Reply ke stiker dulu untuk di-add.')
        const r = packs.add(arg, toEntry(q))
        return reply(`${r.msg}\n\n${listText() || ''}`.trim())
    }

    // ───── .rstc del <nama> [no]  (atau reply stiker) ─────
    if (['del', 'delete', 'remove'].includes(sub)) {
        if (!arg) return reply(`Kasih nama paketnya, contoh: *${p}rstc del nama*`)

        // reply stiker → hapus stiker itu saja
        if (q?.mtype === 'stickerMessage') return reply(packs.removeSticker(arg, toBase64(q.fileSha256)))

        // angka di akhir → hapus stiker nomor itu (kalau paketnya ada)
        const parts = arg.split(/\s+/)
        if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
            const no = parseInt(parts[parts.length - 1], 10)
            const res = packs.removeAt(parts.slice(0, -1).join(' '), no)
            if (res) return reply(res)
        }
        return reply(packs.removePack(arg))
    }

    // ───── .rstc list ─────
    if (sub === 'list') {
        return reply(listText() || `Belum ada stiker. Tambahkan dulu pakai *${p}rstc add [nama]* (reply stiker).`)
    }

    // ───── .rstc emoji ... ─────
    if (['emoji', 'react', 'reaksi'].includes(sub)) {
        const tokens = arg.split(/\s+/).filter(Boolean)
        const first = tokens[0]?.toLowerCase()
        const cfg = reactDb()

        if (!first || first === 'list') return reply(emojiListText(p))

        if (first === 'on' || first === 'off') {
            cfg.on = first === 'on'
            save()
            return reply(`Tembak lewat reaction sekarang *${cfg.on ? 'aktif' : 'mati'}*.`)
        }

        if (['del', 'delete', 'hapus', 'remove'].includes(first)) {
            const e = parseEmoji(tokens[1])
            if (!e) return reply(`Sebutkan emojinya, contoh: *${p}rstc emoji del 🔥*`)
            if (!cfg.map[e]) return reply(`Emoji ${showEmoji(e)} belum diset.`)
            delete cfg.map[e]
            save()
            return reply(`Emoji ${showEmoji(e)} dihapus.\n\n${emojiListText(p)}`)
        }

        const e = parseEmoji(tokens[0])
        if (!e) return reply(`Itu bukan emoji (cukup satu emoji).\nContoh: *${p}rstc emoji 🔥 ara 20*`)

        const { name, count, capped } = parsePackArgs(tokens.slice(1))
        if (count < 1) return reply('Jumlah minimal 1.')
        const key = cleanName(name)
        cfg.map[e] = { pack: key, count }
        save()

        const notes = []
        if (capped) notes.push(`Jumlah dibatasi maksimal ${MAX_COUNT}.`)
        if (!packs.get(key)?.length) notes.push(`Paket *${key}* belum ada, tambahkan pakai *${p}rstc add ${key}* (reply stiker).`)
        return reply([`Reaction ${showEmoji(e)} akan menembak *${key}* sebanyak ${count}x.`, ...notes, '', emojiListText(p)].join('\n'))
    }

    // ───── .rstc [nama] [jumlah] (reply pesan apa saja) → tembak stiker ─────
    if (!q) return reply(helpText(p))

    const { name, count, capped } = parsePackArgs(trimmed.split(/\s+/).filter(Boolean))
    if (count < 1) return reply('Jumlah minimal 1.')
    const pack = packs.get(name)
    if (!pack?.length) {
        return reply(
            `Stiker *${cleanName(name)}* belum ada di daftar.\n` +
            (listText() || `Belum ada stiker sama sekali, tambahkan dulu pakai *${p}rstc add [nama]* (reply stiker).`)
        )
    }

    if (typeof sock.relayMessage !== 'function') return reply('Fitur ini hanya tersedia di WhatsApp.')
    if (running.has(m.chat)) return reply('Masih menembak di chat ini, tunggu selesai dulu.')

    // key pesan yang ditembak
    const target = {
        remoteJid: q.chat || m.chat,
        fromMe: !!q.fromMe,
        id: q.id,
        participant: m.isGroup ? q.senderRaw : undefined
    }

    if (capped) await reply(`Jumlah dibatasi maksimal ${MAX_COUNT}.`)

    try {
        await fire(sock, m.chat, target, pack, count)
    } catch (e) {
        console.error('[RSTC]', e)
        return reply(`❌ Gagal menembak stiker: ${e.message}`)
    }
}

handler.command = ['rstc']
handler.help = ['rstc [nama] [jumlah]', 'rstc add [nama]', 'rstc del <nama> [no]', 'rstc list', 'rstc emoji <emoji> [nama] [jumlah]']
handler.tags = ['owner']
handler.owner = true

export default handler
