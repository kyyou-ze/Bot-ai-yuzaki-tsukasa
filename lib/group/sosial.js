/**
 * Kaguya Multi Device — WhatsApp & Tele Bot
 *
 * Library      : whiskeysockets baileys
 * Type         : Plugins | ESM Modules
 * Creator      : YannRzy Tech
 * Recode       : (Your Name)
 *
 * Developer Channels:
 * • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
 *
 * Info Update Kaguya Channels:
 * • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
 *
 * Copyright © YannRzy Tech 2026
 * All Rights Reserved.
 */

// Helper fitur grup: poll, giveaway, XP chat, absen, dan captcha.

import fs from 'fs'
import path from 'path'
import { saveDB, sleep } from '../core/system.js'
import { isChatBanned } from '../core/data.js'
import { memberId } from '../platform/wa.js'
import { toPN, ensureUser, persist, matchPlugin, matchSub } from '../engine/plugins.js'

export const store = () => {
    if (!global.db.sosial) global.db.sosial = {}
    return global.db.sosial
}
export const save = () => { try { saveDB(global.db) } catch {} }

// ───────── data fitur grup: tersimpan PER GRUP di global.db.groups[jid] ─────────
//   groups[jid].poll      polling aktif / terakhir grup ini
//   groups[jid].giveaway  giveaway aktif / terakhir grup ini
//   groups[jid].xp        { on, users }                      XP chat grup ini
//   groups[jid].absen     { [nomor]: { streak, total, ... } } absen grup ini
//   groups[jid].captcha   { on, mode, timeout, pending }      captcha grup ini
// Data lama (global.db.sosial.poll / giveaway / xp / absen / captcha) dipindahkan otomatis ke grupnya masing-masing.
const LEGACY_GROUP_KEYS = ['poll', 'giveaway', 'xp', 'absen', 'captcha']
const migratedDbs = new WeakSet()

function migrateLegacyGroupData() {
    const s = global.db.sosial
    if (!s) return false
    const groups = (global.db.groups ||= {})
    let changed = false
    for (const k of LEGACY_GROUP_KEYS) {
        const tbl = s[k]
        if (!tbl) continue
        for (const [jid, v] of Object.entries(tbl)) {
            if (!v) continue
            if (k === 'captcha' && jid === '__pending') {
                // antrean verifikasi captcha dulu satu daftar bersama -> dipecah ke grup asalnya
                for (const p of Object.values(v)) {
                    if (!p?.group || !p?.key) continue
                    const c = ((groups[p.group] ||= {}).captcha ||= {})
                    ;(c.pending ||= {})[p.key] = p
                }
                continue
            }
            const g = (groups[jid] ||= {})
            if (k === 'captcha') g.captcha = { ...v, ...(g.captcha || {}) }
            else if (!(k in g)) g[k] = v
        }
        delete s[k]
        changed = true
    }
    return changed
}

const readyGroups = () => {
    const db = global.db
    if (db && !migratedDbs.has(db)) {
        migratedDbs.add(db)
        if (migrateLegacyGroupData()) save()
    }
}

/** Blok data satu grup (dibuat kalau belum ada). */
export const groupData = (jid) => {
    readyGroups()
    const groups = (global.db.groups ||= {})
    return (groups[jid] ||= {})
}

/** Blok data satu grup TANPA membuatnya (untuk jalur pasif yang jalan di setiap pesan). */
export const peekGroup = (jid) => {
    readyGroups()
    return global.db.groups?.[jid] || null
}

/** Semua grup yang punya data `key`: [[jid, blokGrup], ...] (untuk pemeriksa waktu / sweeper). */
export const groupsWith = (key) => {
    readyGroups()
    return Object.entries(global.db.groups || {}).filter(([, g]) => g && g[key])
}

export const num = (jid) => String(jid || '').split('@')[0].split(':')[0]
export const rupiah = (n) => Number(n || 0).toLocaleString('id-ID')

// "30s" "10m" "2h" "1d" -> ms (null kalau tidak valid)
export function parseDuration(str) {
    const m = String(str || '').trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|detik|menit|jam|hari)$/)
    if (!m) return null
    const n = Number(m[1])
    const unit = { s: 1e3, detik: 1e3, m: 6e4, menit: 6e4, h: 36e5, jam: 36e5, d: 864e5, hari: 864e5 }[m[2]]
    return n * unit
}
export function formatDuration(ms) {
    ms = Math.max(0, ms)
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, mi = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60
    return [d && `${d}hr`, h && `${h}j`, mi && `${mi}m`, (!d && !h && s) && `${s}dtk`].filter(Boolean).join(' ') || '0d'
}

// tanggal WIB (UTC+7) sebagai 'YYYY-MM-DD'
export const wibDate = (t = Date.now()) => new Date(t + 7 * 36e5).toISOString().slice(0, 10)
export const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

// kunci user konsisten (nomor telepon kalau bisa)
export async function userKey(sock, m) { return toPN(sock, m.sender) }

// tambah uang RPG ke user
export async function addMoney(sock, jid, pushName, amount) {
    const pn = await toPN(sock, jid)
    const u = ensureUser({ sender: pn, pushName: pushName || num(pn) })
    u.money = (Number(u.money) || 0) + amount
    persist()
    return u.money
}

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// simpan sock terakhir supaya timer / sweeper bisa mengirim pesan
export const rememberSock = (sock) => { if (sock) global.__sosialSock = sock }
export const getSock = () => global.__sosialSock

// ───────── Tahap 2: RPG ─────────
// data game (tower, peta, saham) di global.db.sosial.game
export const gameStore = () => {
    const s = store()
    if (!s.game) s.game = {}
    for (const k of ['tower', 'map', 'stock']) if (!s.game[k]) s.game[k] = {}
    return s.game
}

// user RPG (sama dengan yang dipakai .me / .inventory)
export async function rpgUser(sock, m) {
    const pn = await toPN(sock, m.sender)
    return { pn, user: ensureUser({ sender: pn, pushName: m.pushName || num(pn) }) }
}
export { persist }

// kekuatan tempur dari data RPG yang sudah ada (level, pedang, armor)
export function combatStats(u) {
    const lvl = Math.max(1, Number(u.level) || 1)
    const sword = Math.min(Number(u.sword) || 0, 1) * 15 + Math.min(Number(u.goldsword) || 0, 1) * 30
    const armor = Math.min(Number(u.armor) || 0, 1) * 8
    return { atk: 10 + lvl * 2 + sword, def: 2 + Math.floor(lvl / 2) + armor }
}

// simulasi duel otomatis. Mengembalikan { win, hpLeft, rounds }
export function simulateFight(playerHp, p, monster) {
    let hp = playerHp, mhp = monster.hp, rounds = 0
    const hit = (atk, def) => Math.max(1, Math.round((atk - def * 0.5) * (0.8 + Math.random() * 0.4)))
    while (hp > 0 && mhp > 0 && rounds < 60) {
        rounds++
        mhp -= hit(p.atk, monster.def || 0)
        if (mhp <= 0) break
        hp -= hit(monster.atk, p.def)
    }
    return { win: mhp <= 0 && hp > 0, hpLeft: Math.max(0, hp), rounds }
}

// minggu ISO sebagai kunci, mis. '2026-W43' (zona WIB)
export function weekKey(t = Date.now()) {
    const d = new Date(t + 7 * 36e5)
    const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const day = dt.getUTCDay() || 7
    dt.setUTCDate(dt.getUTCDate() + 4 - day)
    const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
    return `${dt.getUTCFullYear()}-W${String(Math.ceil(((dt - y0) / 864e5 + 1) / 7)).padStart(2, '0')}`
}

// ───────── JPM: broadcast grup, auto broadcast, status grup, push kontak ─────────
// Dipakai plugins/jpm/* dan plugins/pushkontak/*. Pengaturan delay disimpan di global.db.sosial.jpm,
// job berulang (auto JPM / auto SWGC) disimpan di global.__jpmJobs supaya tetap utuh saat plugin di-reload.
export const JPM_DEFAULTS = { delayJpm: 3000, delayJpmTag: 3000, delayAutoSwgc: 60000, delayPushKontak: 2000 }
export const JPM_MIN_INTERVAL = 5000

export const jpmCfg = () => ({ ...JPM_DEFAULTS, ...(store().jpm || {}) })
export const jpmSetCfg = (key, value) => {
    const s = store()
    if (!s.jpm) s.jpm = {}
    s.jpm[key] = value
    save()
}

export const jpmJobs = () => (global.__jpmJobs ||= { autoJpm: null, autoJpmTag: null, autoSwgc: null, pushRunning: false })

// "60000" (ms) / "30s" / "5m" / "1h" -> ms (null kalau bukan interval)
export function parseInterval(raw) {
    const mt = String(raw || '').toLowerCase().match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/)
    if (!mt) return null
    return Math.round(parseFloat(mt[1]) * { ms: 1, s: 1e3, m: 6e4, h: 36e5 }[mt[2] || 'ms'])
}

// pisahkan interval (kata pertama) dari isi pesan: "5m halo" -> { interval: 300000, teks: 'halo' }
export function splitInterval(text, fallbackMs = 60000) {
    const t = String(text || '').trim()
    const first = t.split(/\s+/)[0] || ''
    const ms = parseInterval(first)
    return ms === null ? { interval: fallbackMs, teks: t } : { interval: ms, teks: t.slice(first.length).trim() }
}

// semua grup tempat bot berada, kecuali grup yang di-banchat
// blacklist JPM (blacklistjpm) dan blacklist khusus auto JPM (blautojpm) disimpan di global.db.sosial.jpm
export const jpmBlacklist = (auto = false) => [...(store().jpm?.[auto ? 'blAuto' : 'blacklist'] || [])]
export const jpmSetBlacklist = (auto, list) => jpmSetCfg(auto ? 'blAuto' : 'blacklist', [...new Set(list)])

// opsi { auto: true } -> grup di blacklist auto JPM juga dilewati
export async function jpmGroups(sock, { auto = false } = {}) {
    const all = await sock.groupFetchAllParticipating()
    const skip = new Set([...jpmBlacklist(false), ...(auto ? jpmBlacklist(true) : [])])
    return Object.values(all).filter(g => !isChatBanned(g.id) && !skip.has(g.id))
}

// daftar mention + teks @nomor untuk semua member grup
export function tagList(meta) {
    const mentions = (meta.participants || []).map(p => p.id)
    return { mentions, text: mentions.map(id => `@${memberId(id)}`).join(' ') }
}

// media dari pesan yang di-reply (atau dari pesan perintah sendiri). kinds: jenis yang diterima.
const MEDIA_KIND = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', documentMessage: 'document', documentWithCaptionMessage: 'document' }
export async function getMedia(m, kinds = ['image', 'video']) {
    const node = m.quoted?.isMedia ? m.quoted : (m.isMedia ? m : null)
    if (!node || typeof node.download !== 'function') return null
    const kind = MEDIA_KIND[node.mtype]
    if (!kind || !kinds.includes(kind)) return null
    const info = node === m ? (m.msg || {}) : node
    const buffer = await node.download()
    if (!buffer) return null
    return { kind, buffer, mime: info.mimetype || '', fileName: info.fileName || 'file', ptt: !!info.ptt, caption: info.caption || '' }
}

// isi sendMessage dari media + caption (+ mentions)
export function mediaContent(media, caption = '', mentions) {
    const c = { [media.kind]: media.buffer }
    if (caption && media.kind !== 'audio') c.caption = caption
    if (media.kind !== 'image') c.mimetype = media.mime
    if (media.kind === 'audio') c.ptt = media.ptt
    if (media.kind === 'document') c.fileName = media.fileName
    if (mentions) c.mentions = mentions
    return c
}

// kirim ke tiap target berurutan dengan jeda. send(target) harus melempar error kalau gagal.
// flag global.__jpmRunning / __jpmStop dipakai plugin stopjpm untuk menghentikan JPM yang sedang jalan
export async function jpmLoop(targets, delay, send, isStopped = () => false) {
    let ok = 0
    let fail = 0
    global.__jpmRunning = true
    try {
        for (const t of targets) {
            if (isStopped() || global.__jpmStop) break
            try { await send(t); ok++ } catch (e) { fail++; console.error('[JPM]', e?.message || e) }
            await sleep(delay)
        }
    } finally {
        global.__jpmRunning = false
        global.__jpmStop = false
    }
    return { ok, fail }
}

// job berulang bernama `name`. tick(isStopped) tidak akan menumpuk kalau putaran sebelumnya belum selesai.
export function jpmStartJob(name, ms, tick) {
    const jobs = jpmJobs()
    jpmStopJob(name)
    let busy = false
    const job = { ms, startedAt: Date.now(), timer: null }
    job.timer = setInterval(async () => {
        if (busy) return
        busy = true
        try { await tick(() => jobs[name] !== job) } catch (e) { console.error(`[JPM:${name}]`, e?.message || e) } finally { busy = false }
    }, ms)
    jobs[name] = job
    return job
}
export function jpmStopJob(name) {
    const jobs = jpmJobs()
    const job = jobs[name]
    if (!job) return false
    clearInterval(job.timer)
    jobs[name] = null
    return true
}

// status grup WhatsApp (sama seperti plugins/group/swgc.js): teks berwarna, gambar, video, atau voice note
const STATUS_COLORS = [0x1E88E5, 0x25D366, 0xFFD600, 0xFF9800, 0xE53935, 0x8E24AA, 0x9E9E9E, 0x000000, 0x00BCD4]
export async function sendGroupStatus(sock, jid, { text = '', media = null, name, emoji = '✨' } = {}) {
    const { randomBytes } = await import('crypto')
    const contextInfo = {
        expiration: 86400,
        disappearingMode: { initiator: 0 },
        featureEligibilities: { cannotBeRanked: false, canBeReshared: true, canReceiveMultiReact: true },
        statusSourceType: 4,
        statusAttributions: [{ type: 10 }],
        isGroupStatus: true,
        statusAudienceMetadata: { audienceType: 2, listName: name || global.namebot || 'Bot', listEmoji: emoji }
    }
    const opts = { messageId: randomBytes(16).toString('hex').toUpperCase(), additionalNodes: [{ tag: 'meta', attrs: { is_group_status: 'true' } }] }
    const messageContextInfo = { messageSecret: randomBytes(32) }

    if (media) {
        const { generateWAMessageContent } = await import('@whiskeysockets/baileys')
        let payload, key
        if (media.kind === 'image') { payload = { image: media.buffer, caption: text }; key = 'imageMessage' }
        else if (media.kind === 'video') { payload = { video: media.buffer, caption: text }; key = 'videoMessage' }
        else if (media.kind === 'audio') { payload = { audio: await toVoiceNote(media.buffer), ptt: true, mimetype: 'audio/ogg; codecs=opus' }; key = 'audioMessage' }
        else throw new Error('Jenis media tidak didukung untuk status grup')
        const content = await generateWAMessageContent(payload, { upload: sock.waUploadToServer })
        const node = content[key]
        node.contextInfo = { ...(node.contextInfo || {}), ...contextInfo }
        return sock.relayMessage(jid, { [key]: node, messageContextInfo }, opts)
    }

    const color = STATUS_COLORS[Math.floor(Math.random() * STATUS_COLORS.length)]
    return sock.relayMessage(jid, {
        extendedTextMessage: {
            text,
            textArgb: 0xFFFFFFFF,
            backgroundArgb: (0xFF000000 | color) >>> 0,
            font: 7,
            contextInfo
        },
        messageContextInfo
    }, opts)
}

async function toVoiceNote(buffer) {
    const { PassThrough } = await import('stream')
    const ffmpeg = (mod => mod.default ?? mod)(await import('fluent-ffmpeg'))
    return new Promise((resolve, reject) => {
        const input = new PassThrough()
        const output = new PassThrough()
        const chunks = []
        input.end(buffer)
        ffmpeg(input).noVideo().audioCodec('libopus').format('ogg')
            .outputOptions(['-hide_banner', '-loglevel error'])
            .on('error', reject)
            .on('end', () => resolve(Buffer.concat(chunks)))
            .pipe(output)
        output.on('data', c => chunks.push(c))
    })
}

// nomor PN (@s.whatsapp.net) semua member grup, tanpa akun bot sendiri
export async function memberJids(sock, meta) {
    const me = memberId(sock.user?.id)
    const out = []
    for (const p of meta.participants || []) {
        const jid = await toPN(sock, p.phoneNumber || p.id)
        if (jid && jid.endsWith('@s.whatsapp.net') && memberId(jid) !== me && !out.includes(jid)) out.push(jid)
    }
    return out
}

// ───────── Push kontak: kode unik & file VCF (dipakai plugins/pushkontak/*) ─────────
// kode acak (A-Z, 0-9) untuk ditempel di akhir pesan push supaya tiap pesan berbeda
export const pushKode = (n = 6) => Array.from({ length: n }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('')

// daftar JID -> isi file .vcf. nameOf(jid, index) opsional; default nama "WA[XX] nomor"
export function buildVcf(jids, nameOf) {
    return jids.map((jid, i) => {
        const nomor = String(jid).split('@')[0].split(':')[0]
        const nama = nameOf ? nameOf(jid, i) : `WA[${pushKode(2)}] ${nomor}`
        return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${nama}`, `TEL;type=CELL;type=VOICE;waid=${nomor}:+${nomor}`, 'END:VCARD', ''].join('\n')
    }).join('')
}

// kirim file .vcf (dokumen) ke `to`. Mengembalikan true kalau terkirim.
export async function sendVcf(sock, to, jids, { fileName, caption = '', nameOf, quoted } = {}) {
    if (!jids.length) return false
    const safe = String(fileName || `kontak_${jids.length}`).replace(/[\\/:*?"<>|]+/g, '_')
    await sock.sendMessage(to, {
        document: Buffer.from(buildVcf(jids, nameOf), 'utf8'),
        fileName: safe.endsWith('.vcf') ? safe : `${safe}.vcf`,
        mimetype: 'text/vcard',
        caption
    }, quoted ? { quoted } : undefined)
    return true
}

// ═══════════════════════ GAME KARTU: BLACKJACK & POKER ═══════════════════════

// ───────── BLACKJACK (mesin game) ─────────
// Dipakai oleh plugins/blackjack/*.js. Satu meja per grup, disimpan di memori.
// Uang RPG baru berpindah saat ronde selesai (bot restart di tengah ronde = tidak ada uang hilang).
// Aturan: dealer ambil kartu sampai 17 (berhenti di 17 lunak), blackjack bayar 1,5x, dealer cek blackjack lebih dulu.
// (digabung ke file ini; semua nama di bawah bersifat lokal, hanya `blackjackRun` yang diekspor)
const { blackjackRun } = (() => {

  const MIN_BET = 100
  const MAX_BET = 500_000
  const MAX_PLAYERS = 6
  const TURN_MS = 60_000
  const LOBBY_MS = 5 * 60_000
  const SUBS = ['join', 'start', 'hit', 'stand', 'double', 'hand', 'info', 'stop', 'top', 'help']

  const games = new Map() // jid grup -> meja

  // ───────── kartu ─────────
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const SUITS = ['♠', '♥', '♦', '♣']
  const newShoe = () => shuffle(Array.from({ length: 4 }, () => RANKS.flatMap(r => SUITS.map(s => ({ r, s })))).flat())
  const label = (c) => `${c.r}${c.s}`

  function handValue(cards) {
      let total = 0, aces = 0
      for (const c of cards) {
          if (c.r === 'A') { aces++; total += 11 }
          else if (['J', 'Q', 'K'].includes(c.r)) total += 10
          else total += Number(c.r)
      }
      while (total > 21 && aces) { total -= 10; aces-- }
      return total
  }
  const isNatural = (cards) => cards.length === 2 && handValue(cards) === 21

  // ───────── tampilan ─────────
  const say = (game, text, mentions = []) =>
      game.sock.sendMessage(game.jid, { text, mentions }).catch(() => null)

  function playerRow(p, now) {
      const v = handValue(p.cards)
      const tag = p.state === 'bust' ? ' 💥 BUST' : p.state === 'bj' ? ' 🌟 BLACKJACK' : p.state === 'stand' ? ' ✋' : ''
      return `${now ? '▸' : '•'} @${num(p.jid)} : ${p.cards.map(label).join(' ')} = ${v}${tag}${p.doubled ? ' (x2)' : ''}`
  }

  function tableText(game, revealDealer = false) {
      const d = game.dealer
      const dealerLine = revealDealer
          ? `${d.map(label).join(' ')} = ${handValue(d)}`
          : `${label(d[0])} 🂠`
      const cur = game.players[game.turn]
      return [
          `╭─「 ♠ *BLACKJACK* ♥ 」`,
          `│ Taruhan : Rp ${rupiah(game.bet)} / orang`,
          `│ Dealer  : ${dealerLine}`,
          `│`,
          ...game.players.map(p => `│ ${playerRow(p, !revealDealer && p === cur && p.state === 'play')}`),
          `╰──────────────`
      ].join('\n')
  }

  const mentionsOf = (game) => game.players.map(p => p.jid)

  const HELP = [
      '♠ *BLACKJACK* ♥',
      '',
      'Kalahkan dealer (bot): total kartumu mendekati 21 tanpa lewat.',
      'A = 1 atau 11, J/Q/K = 10.',
      '',
      '*Perintah*',
      '.bj <taruhan>  buat meja (maks 6 pemain)',
      '.bj-join       ikut meja',
      '.bj-start      mulai ronde',
      '.bj-hit        ambil kartu',
      '.bj-stand      berhenti',
      '.bj-double     taruhan x2 + 1 kartu terakhir',
      '.bj-hand       lihat meja',
      '.bj-stop       batalkan meja',
      '.bj-top        peringkat untung',
      '',
      `Taruhan ${rupiah(MIN_BET)} - ${rupiah(MAX_BET)}. Blackjack bayar 1,5x. Dealer berhenti di 17.`,
      `Tiap giliran ${TURN_MS / 1000} detik, lewat itu otomatis stand.`
  ].join('\n')

  // ───────── alur permainan ─────────
  const drop = (game) => {
      clearTimeout(game.timer)
      clearTimeout(game.lobbyTimer)
      if (games.get(game.jid) === game) games.delete(game.jid)
  }

  const canDouble = (game, p) => p.cards.length === 2 && !p.doubled && p.state === 'play'

  async function next(game) {
      clearTimeout(game.timer)
      const idx = game.players.findIndex(p => p.state === 'play')
      if (idx === -1) return finish(game)

      game.turn = idx
      const p = game.players[idx]
      const opts = canDouble(game, p) ? '*.bj-hit*, *.bj-stand*, *.bj-double*' : '*.bj-hit*, *.bj-stand*'
      await say(game, `${tableText(game)}\n\n👉 Giliran @${num(p.jid)} — ${opts} (${TURN_MS / 1000} dtk)`, mentionsOf(game))

      game.timer = setTimeout(async () => {
          if (games.get(game.jid) !== game || game.turn !== idx || p.state !== 'play') return
          p.state = 'stand'
          await say(game, `⏰ @${num(p.jid)} kehabisan waktu, otomatis *stand*.`, [p.jid])
          next(game).catch(() => null)
      }, TURN_MS)
      game.timer.unref?.()
  }

  async function finish(game) {
      clearTimeout(game.timer)
      // dealer ambil kartu sampai 17
      if (game.players.some(p => p.state !== 'bust') && !isNatural(game.dealer)) {
          while (handValue(game.dealer) < 17) game.dealer.push(game.shoe.pop())
      }
      const dv = handValue(game.dealer)
      const dNat = isNatural(game.dealer)
      const dBust = dv > 21

      const stats = (groupData(game.jid).blackjack ||= { users: {} })
      const lines = []

      for (const p of game.players) {
          const pv = handValue(p.cards)
          let result // 'bj' | 'win' | 'push' | 'lose'
          if (p.state === 'bust') result = 'lose'
          else if (p.state === 'bj') result = dNat ? 'push' : 'bj'
          else if (dNat) result = 'lose'
          else if (dBust || pv > dv) result = 'win'
          else if (pv === dv) result = 'push'
          else result = 'lose'

          const { user } = await rpgUser(game.sock, { sender: p.jid, pushName: p.name })
          let delta = 0
          if (result === 'bj') delta = Math.floor(p.bet * 1.5)
          else if (result === 'win') delta = p.bet
          else if (result === 'lose') delta = -Math.min(p.bet, Number(user.money) || 0) // tidak boleh minus
          user.money = (Number(user.money) || 0) + delta

          const s = (stats.users[p.pn] ||= { name: p.name, win: 0, lose: 0, push: 0, net: 0 })
          s.name = p.name
          s.net += delta
          if (result === 'lose') s.lose++
          else if (result === 'push') s.push++
          else s.win++

          const txt = { bj: '🌟 Blackjack!', win: '✅ Menang', push: '🤝 Seri', lose: p.state === 'bust' ? '💥 Bust' : '❌ Kalah' }[result]
          lines.push(`${txt} @${num(p.jid)} : ${delta > 0 ? '+' : ''}${rupiah(delta)}`)
      }

      persist()
      save()
      const text = [
          tableText(game, true),
          '',
          dNat ? '🃏 Dealer blackjack!' : dBust ? '🃏 Dealer bust!' : `🃏 Dealer berhenti di ${dv}`,
          ...lines,
          '',
          '_Main lagi: .bj <taruhan>_'
      ].join('\n')
      drop(game)
      return say(game, text, game.players.map(p => p.jid))
  }

  async function startRound(game) {
      // pastikan semua pemain masih mampu membayar taruhan
      const keep = []
      for (const p of game.players) {
          const { user } = await rpgUser(game.sock, { sender: p.jid, pushName: p.name })
          if ((Number(user.money) || 0) >= game.bet) keep.push(p)
          else await say(game, `@${num(p.jid)} uangnya kurang, dikeluarkan dari meja.`, [p.jid])
      }
      if (!keep.length) {
          drop(game)
          return say(game, 'Semua pemain kehabisan uang, meja dibatalkan.')
      }
      game.players = keep
      clearTimeout(game.lobbyTimer)
      game.status = 'play'
      game.shoe = newShoe()
      game.dealer = [game.shoe.pop(), game.shoe.pop()]
      for (const p of game.players) {
          p.cards = [game.shoe.pop(), game.shoe.pop()]
          p.state = isNatural(p.cards) ? 'bj' : 'play'
      }

      // dealer cek blackjack lebih dulu
      if (isNatural(game.dealer)) {
          for (const p of game.players) if (p.state === 'play') p.state = 'stand'
          return finish(game)
      }
      return next(game)
  }

  // ───────── perintah ─────────
  /**
   * Jalankan satu aksi blackjack.
   * @param cmd create | join | start | hit | stand | double | hand | info | stop | top | help
   */
  async function blackjackRun(m, { sock, text, jid, reply, isAdmin, isOwner }, cmd = 'create') {
      rememberSock(sock)
      let arg = String(text || '').trim()
      if (cmd === 'create') {
          const first = arg.split(/\s+/)[0]?.toLowerCase()
          if (SUBS.includes(first)) { cmd = first; arg = arg.slice(first.length).trim() }
      }

      const game = games.get(jid)
      const canManage = (g) => isAdmin || isOwner || g.host === m.sender

      if (cmd === 'help') return reply(HELP)

      if (cmd === 'top') {
          const users = Object.values(groupData(jid).blackjack?.users || {})
              .sort((a, b) => b.net - a.net).slice(0, 10)
          if (!users.length) return reply('Belum ada yang main blackjack di grup ini. Mulai dengan .bj <taruhan>')
          return reply(`♠ *TOP BLACKJACK*\n\n${users.map((u, i) =>
              `${i + 1}. ${u.name} — ${u.net >= 0 ? '+' : ''}${rupiah(u.net)} (${u.win}M ${u.lose}K ${u.push}S)`).join('\n')}`)
      }

      // ── buat meja ──
      if (cmd === 'create') {
          if (game) return reply(`Sudah ada meja di grup ini (${game.status === 'lobby' ? 'menunggu pemain, ketik .bj-join' : 'sedang main'}).`)
          const bet = parseInt(arg.replace(/[^\d]/g, ''), 10)
          if (!bet || bet < MIN_BET || bet > MAX_BET) {
              return reply(`Format: .bj <taruhan>\nContoh: .bj 5000\nTaruhan ${rupiah(MIN_BET)} - ${rupiah(MAX_BET)}. Aturan: .bj-help`)
          }
          const { pn, user } = await rpgUser(sock, m)
          if ((Number(user.money) || 0) < bet) return reply(`Uang kamu kurang. Saldo: Rp ${rupiah(user.money)}`)
          if (games.has(jid)) return reply('Sudah ada meja di grup ini.')

          const g = {
              jid, sock, bet, host: m.sender, status: 'lobby', turn: 0, dealer: [], shoe: [],
              players: [{ pn, jid: m.sender, name: m.pushName || num(m.sender), cards: [], bet, state: 'play', doubled: false }]
          }
          g.lobbyTimer = setTimeout(() => {
              if (games.get(jid) !== g || g.status !== 'lobby') return
              drop(g)
              say(g, 'Meja blackjack ditutup karena tidak dimulai dalam 5 menit.')
          }, LOBBY_MS)
          g.lobbyTimer.unref?.()
          games.set(jid, g)
          return sock.sendMessage(jid, {
              text: `♠ *MEJA BLACKJACK DIBUKA* ♥\n\n👤 @${num(m.sender)} (host)\n💰 Taruhan: Rp ${rupiah(bet)} / orang\n\nIkut: *.bj-join*  (maks ${MAX_PLAYERS} pemain)\nMulai: *.bj-start*`,
              mentions: [m.sender]
          }, { quoted: m })
      }

      if (!game) return reply('Belum ada meja blackjack di grup ini. Buat dengan .bj <taruhan>')

      if (cmd === 'info' || cmd === 'hand') {
          if (game.status === 'lobby') {
              return sock.sendMessage(jid, {
                  text: `♠ *MEJA BLACKJACK* (menunggu)\n💰 Taruhan: Rp ${rupiah(game.bet)}\n\n${game.players.map((p, i) => `${i + 1}. @${num(p.jid)}`).join('\n')}\n\nIkut: .bj-join | Mulai: .bj-start`,
                  mentions: mentionsOf(game)
              }, { quoted: m })
          }
          return sock.sendMessage(jid, { text: tableText(game), mentions: mentionsOf(game) }, { quoted: m })
      }

      if (cmd === 'stop') {
          if (!canManage(game)) return reply('Hanya pembuat meja atau admin yang bisa membatalkan.')
          drop(game)
          return reply('Meja blackjack dibatalkan. Tidak ada uang yang berpindah.')
      }

      if (cmd === 'join') {
          if (game.status !== 'lobby') return reply('Ronde sudah berjalan, tunggu ronde berikutnya.')
          if (game.players.some(p => p.jid === m.sender)) return reply('Kamu sudah ikut meja ini.')
          if (game.players.length >= MAX_PLAYERS) return reply(`Meja penuh (maks ${MAX_PLAYERS} pemain).`)
          const { pn, user } = await rpgUser(sock, m)
          if ((Number(user.money) || 0) < game.bet) return reply(`Uang kamu kurang untuk taruhan Rp ${rupiah(game.bet)}. Saldo: Rp ${rupiah(user.money)}`)
          if (game.status !== 'lobby' || game.players.some(p => p.pn === pn)) return
          game.players.push({ pn, jid: m.sender, name: m.pushName || num(m.sender), cards: [], bet: game.bet, state: 'play', doubled: false })
          return sock.sendMessage(jid, {
              text: `✅ @${num(m.sender)} ikut meja. Pemain: ${game.players.length}/${MAX_PLAYERS}`,
              mentions: [m.sender]
          }, { quoted: m })
      }

      if (cmd === 'start') {
          if (game.status !== 'lobby') return reply('Ronde sudah berjalan.')
          if (!canManage(game)) return reply('Hanya pembuat meja atau admin yang bisa memulai.')
          game.status = 'starting' // cegah start ganda saat menunggu pengecekan saldo
          try { return await startRound(game) } catch (e) { drop(game); return reply(`[ ! ] ${e.message}`) }
      }

      // ── aksi pemain ──
      if (['hit', 'stand', 'double'].includes(cmd)) {
          if (game.status !== 'play') return reply('Ronde belum dimulai.')
          const p = game.players[game.turn]
          if (!p || p.jid !== m.sender) {
              const mine = game.players.find(x => x.jid === m.sender)
              return reply(mine ? 'Belum giliranmu.' : 'Kamu tidak ikut meja ini.')
          }
          if (p.state !== 'play') return reply('Kamu sudah selesai di ronde ini.')

          if (cmd === 'double') {
              if (!canDouble(game, p)) return reply('Double hanya bisa di 2 kartu pertama.')
              const { user } = await rpgUser(sock, m)
              if ((Number(user.money) || 0) < p.bet * 2) return reply('Uangmu kurang untuk double.')
              if (p.state !== 'play' || game.players[game.turn] !== p) return
              p.bet *= 2
              p.doubled = true
          }

          if (cmd === 'hit' || cmd === 'double') {
              p.cards.push(game.shoe.pop())
              const v = handValue(p.cards)
              if (v > 21) p.state = 'bust'
              else if (v === 21 || cmd === 'double') p.state = 'stand'
          } else {
              p.state = 'stand'
          }

          if (p.state === 'play') {
              clearTimeout(game.timer)
              return next(game)
          }
          return next(game)
      }
  }

  return { blackjackRun }
})()
export { blackjackRun }

// ───────── POKER Texas Hold'em (mesin game) ─────────
// Dipakai oleh plugins/poker/*.js. Satu meja per grup, disimpan di memori.
// Tiap pemain "beli" chip sebesar buy-in; uang RPG baru berpindah saat pemain cash out
// (keluar / tersingkir / permainan selesai), jadi restart bot tidak menghilangkan uang.
// Kartu pribadi dikirim lewat chat pribadi ke bot. Blind naik 2x tiap 6 hand supaya permainan selesai.
// (digabung ke file ini; semua nama di bawah bersifat lokal, hanya `pokerRun` yang diekspor)
const { pokerRun } = (() => {

  const MIN_BUYIN = 1_000
  const MAX_BUYIN = 1_000_000
  const MAX_PLAYERS = 8
  const TURN_MS = 60_000
  const NEXT_MS = 7_000
  const LOBBY_MS = 10 * 60_000
  const BLIND_UP_EVERY = 6
  const SUBS = ['join', 'start', 'check', 'call', 'raise', 'fold', 'allin', 'hand', 'table', 'info', 'leave', 'stop', 'top', 'help']

  const games = new Map() // jid grup -> meja

  // ───────── kartu & penilaian tangan ─────────
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const SUITS = ['♠', '♥', '♦', '♣']
  const newDeck = () => shuffle(SUITS.flatMap(s => RANKS.map((r, i) => ({ r, s, v: i + 2 }))))
  const label = (c) => `${c.r}${c.s}`
  const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']

  function eval5(cs) {
      const v = cs.map(c => c.v).sort((a, b) => b - a)
      const flush = cs.every(c => c.s === cs[0].s)
      let straight = 0
      if (new Set(v).size === 5) {
          if (v[0] - v[4] === 4) straight = v[0]
          else if (v[0] === 14 && v[1] === 5 && v[2] === 4 && v[3] === 3 && v[4] === 2) straight = 5 // A-2-3-4-5
      }
      const cnt = {}
      for (const x of v) cnt[x] = (cnt[x] || 0) + 1
      const g = Object.entries(cnt).map(([k, c]) => [c, Number(k)]).sort((a, b) => b[0] - a[0] || b[1] - a[1])
      if (straight && flush) return [8, straight]
      if (g[0][0] === 4) return [7, g[0][1], g[1][1]]
      if (g[0][0] === 3 && g[1][0] === 2) return [6, g[0][1], g[1][1]]
      if (flush) return [5, ...v]
      if (straight) return [4, straight]
      if (g[0][0] === 3) return [3, g[0][1], g[1][1], g[2][1]]
      if (g[0][0] === 2 && g[1][0] === 2) return [2, g[0][1], g[1][1], g[2][1]]
      if (g[0][0] === 2) return [1, g[0][1], g[1][1], g[2][1], g[3][1]]
      return [0, ...v]
  }

  const cmpScore = (a, b) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
          const d = (a[i] || 0) - (b[i] || 0)
          if (d) return d
      }
      return 0
  }

  function combos(arr, k, start = 0, cur = [], out = []) {
      if (cur.length === k) { out.push([...cur]); return out }
      for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop() }
      return out
  }

  function bestHand(cards) {
      let best = null
      for (const c of combos(cards, 5)) {
          const s = eval5(c)
          if (!best || cmpScore(s, best) > 0) best = s
      }
      return best
  }

  const handName = (s) => (s[0] === 8 && s[1] === 14 ? 'Royal Flush' : HAND_NAMES[s[0]])

  // pot utama + side pot dari total kontribusi tiap pemain di hand ini
  function buildPots(players) {
      const levels = [...new Set(players.map(p => p.total).filter(t => t > 0))].sort((a, b) => a - b)
      const pots = []
      let prev = 0
      for (const lv of levels) {
          const amount = players.reduce((n, p) => n + Math.max(0, Math.min(p.total, lv) - prev), 0)
          const eligible = players.filter(p => !p.folded && p.total >= lv)
          prev = lv
          if (amount <= 0) continue
          if (eligible.length) pots.push({ amount, eligible })
          else if (pots.length) pots[pots.length - 1].amount += amount
          else pots.push({ amount, eligible: players.filter(p => !p.folded) })
      }
      return pots
  }

  // ───────── tampilan ─────────
  const say = (game, text, mentions = []) => game.sock.sendMessage(game.jid, { text, mentions }).catch(() => null)
  const mentionsOf = (game) => game.players.map(p => p.jid)
  const STREET = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River' }

  const potOf = (game) => game.players.reduce((n, p) => n + p.total, 0)

  function tableText(game, cur) {
      const n = game.players.length
      const sbI = n === 2 ? game.btn : (game.btn + 1) % n
      const bbI = n === 2 ? (game.btn + 1) % n : (game.btn + 2) % n
      const rows = game.players.map((p, i) => {
          const pos = [i === game.btn && 'D', i === sbI && 'SB', i === bbI && 'BB'].filter(Boolean).join('/')
          const state = p.folded ? ' ❌ fold' : p.allin ? ' 🔥 ALL-IN' : ''
          const bet = p.bet && !p.folded ? ` | bet ${rupiah(p.bet)}` : ''
          return `│ ${cur === p ? '▸' : '•'} @${num(p.jid)}${pos ? ` (${pos})` : ''} — ${rupiah(p.chips)}${bet}${state}`
      })
      return [
          `╭─「 ♣ *POKER* · Hand #${game.handNo} 」`,
          `│ Blind  : ${rupiah(game.sb)} / ${rupiah(game.bb)}`,
          `│ Board  : ${game.board.length ? game.board.map(label).join(' ') : '—'}  (${STREET[game.street] || ''})`,
          `│ Pot    : ${rupiah(potOf(game))}${game.currentBet ? `  | taruhan sekarang ${rupiah(game.currentBet)}` : ''}`,
          '│',
          ...rows,
          '╰──────────────'
      ].join('\n')
  }

  const HELP = [
      '♣ *POKER (Texas Hold\'em)* ♠',
      '',
      'Tiap pemain dapat 2 kartu pribadi (dikirim lewat chat pribadi bot), ada 5 kartu bersama di meja.',
      'Bentuk tangan terbaik dari 7 kartu menang. Main sampai tinggal satu pemain.',
      '',
      '*Perintah*',
      '.poker <buy-in>   buat meja (contoh: .poker 10000)',
      '.poker-join       ikut meja',
      '.poker-start      mulai (pembuat meja / admin, min 2 pemain)',
      '.poker-check      lewat tanpa taruhan',
      '.poker-call       samakan taruhan',
      '.poker-raise <x>  naikkan taruhan MENJADI x (contoh: .poker-raise 400)',
      '.poker-allin      semua chip',
      '.poker-fold       menyerah di hand ini',
      '.poker-hand       kirim ulang kartumu (boleh dipakai di chat pribadi bot)',
      '.poker-table      lihat meja',
      '.poker-leave      keluar & cash out',
      '.poker-stop       bubarkan meja (pembuat / admin)',
      '.poker-top        peringkat untung di grup ini',
      '',
      `Buy-in ${rupiah(MIN_BUYIN)} - ${rupiah(MAX_BUYIN)}, maks ${MAX_PLAYERS} pemain.`,
      'Blind awal = 1% / 2% dari buy-in, naik 2x tiap 6 hand.',
      `Tiap giliran ${TURN_MS / 1000} detik: lewat itu otomatis check (atau fold kalau harus bayar).`,
      'Uang RPG baru berpindah saat cash out: untung/rugi = chip akhir - buy-in.'
  ].join('\n')

  // ───────── uang & statistik ─────────
  async function cashout(game, p) {
      const { user } = await rpgUser(game.sock, { sender: p.jid, pushName: p.name })
      let delta = p.chips - game.buyin
      if (delta < 0) delta = -Math.min(-delta, Number(user.money) || 0) // saldo tidak boleh minus
      user.money = (Number(user.money) || 0) + delta
      const s = ((groupData(game.jid).poker ||= { users: {} }).users[p.pn] ||= { name: p.name, net: 0, games: 0, hands: 0 })
      s.name = p.name
      s.net += delta
      s.games++
      persist()
      save()
      return delta
  }

  const fmtDelta = (d) => `${d > 0 ? '+' : ''}${rupiah(d)}`

  const drop = (game) => {
      clearTimeout(game.timer)
      clearTimeout(game.lobbyTimer)
      clearTimeout(game.nextTimer)
      if (games.get(game.jid) === game) games.delete(game.jid)
  }

  async function sendHole(game, p) {
      const text = `♠ *POKER* — kartumu: *${p.cards.map(label).join('  ')}*\nMeja: ${game.board.length ? game.board.map(label).join(' ') : 'belum ada kartu bersama'}`
      try {
          await game.sock.sendMessage(p.jid, { text })
          return true
      } catch { return false }
  }

  // ───────── alur hand ─────────
  async function endGame(game, title) {
      const lines = []
      for (const p of game.players) lines.push(`@${num(p.jid)} : ${rupiah(p.chips)} chip → ${fmtDelta(await cashout(game, p))}`)
      const mentions = mentionsOf(game)
      drop(game)
      return say(game, `🏁 *${title}*\n\n${lines.join('\n')}\n\n_Main lagi: .poker <buy-in>_`, mentions)
  }

  async function startHand(game) {
      if (games.get(game.jid) !== game) return
      // cash out pemain yang keluar / kehabisan chip
      const out = game.players.filter(p => p.leaving || p.chips <= 0)
      if (out.length) {
          const lines = []
          for (const p of out) lines.push(`${p.chips <= 0 ? '💀' : '👋'} @${num(p.jid)} ${p.chips <= 0 ? 'tersingkir' : 'keluar'}: ${fmtDelta(await cashout(game, p))}`)
          game.players = game.players.filter(p => !out.includes(p))
          await say(game, lines.join('\n'), out.map(p => p.jid))
          if (games.get(game.jid) !== game) return
      }
      if (game.players.length < 2) return endGame(game, game.players.length ? `PEMENANG: @${num(game.players[0].jid)}` : 'Meja ditutup')

      game.handNo++
      if (game.handNo > 1 && (game.handNo - 1) % BLIND_UP_EVERY === 0) {
          game.sb *= 2; game.bb *= 2
          await say(game, `📈 Blind naik: ${rupiah(game.sb)} / ${rupiah(game.bb)}`)
      }
      game.status = 'hand'
      game.street = 'preflop'
      game.board = []
      game.deck = newDeck()
      game.btn = game.btn == null ? 0 : (game.btn + 1) % game.players.length
      const n = game.players.length
      for (const p of game.players) Object.assign(p, { cards: [], bet: 0, total: 0, folded: false, allin: false, acted: false })

      const sbI = n === 2 ? game.btn : (game.btn + 1) % n
      const bbI = n === 2 ? (game.btn + 1) % n : (game.btn + 2) % n
      const post = (p, amt) => {
          const pay = Math.min(amt, p.chips)
          p.chips -= pay; p.bet += pay; p.total += pay
          if (p.chips === 0) p.allin = true
      }
      post(game.players[sbI], game.sb)
      post(game.players[bbI], game.bb)
      game.currentBet = Math.max(...game.players.map(p => p.bet))
      game.minRaise = game.bb

      for (const p of game.players) p.cards = [game.deck.pop(), game.deck.pop()]
      const failed = []
      for (const p of game.players) if (!(await sendHole(game, p))) failed.push(p)

      await say(game, `🃏 *Hand #${game.handNo}* dimulai! Kartu pribadi dikirim lewat chat pribadi bot.` +
          (failed.length ? `\n⚠️ ${failed.map(p => '@' + num(p.jid)).join(', ')} belum bisa dikirimi — chat bot secara pribadi lalu ketik *.poker-hand*.` : ''),
          failed.map(p => p.jid))
      game.cur = bbI
      return advance(game)
  }

  const findNext = (game, from) => {
      const n = game.players.length
      for (let i = 1; i <= n; i++) {
          const idx = (from + i) % n
          const p = game.players[idx]
          if (!p.folded && !p.allin && (!p.acted || p.bet < game.currentBet)) return idx
      }
      return -1
  }

  async function advance(game) {
      game.waiting = false
      clearTimeout(game.timer)
      if (games.get(game.jid) !== game) return
      const live = game.players.filter(p => !p.folded)
      if (live.length <= 1) return endHand(game)
      const canAct = live.filter(p => !p.allin)
      const done = canAct.length === 0
          || (canAct.length === 1 && canAct[0].bet >= game.currentBet)
          || canAct.every(p => p.acted && p.bet === game.currentBet)
      if (done) return nextStreet(game)
      const idx = findNext(game, game.cur)
      if (idx === -1) return nextStreet(game)
      game.cur = idx
      return prompt(game)
  }

  async function prompt(game) {
      const p = game.players[game.cur]
      const toCall = game.currentBet - p.bet
      const minTo = game.currentBet + game.minRaise
      const opts = []
      opts.push(toCall === 0 ? '*.poker-check*' : p.chips > toCall ? `*.poker-call* (${rupiah(toCall)})` : null)
      if (p.chips > toCall + 0 && p.bet + p.chips > game.currentBet) opts.push(`*.poker-raise <total>* (min ${rupiah(Math.min(minTo, p.bet + p.chips))})`)
      opts.push(`*.poker-allin* (${rupiah(p.chips)})`, '*.poker-fold*')
      game.waiting = true
      const token = ++game.token
      await say(game, `${tableText(game, p)}\n\n👉 Giliran @${num(p.jid)} — ${opts.filter(Boolean).join(', ')} (${TURN_MS / 1000} dtk)`, mentionsOf(game))
      game.timer = setTimeout(async () => {
          if (games.get(game.jid) !== game || game.token !== token || !game.waiting) return
          game.waiting = false
          if (p.bet >= game.currentBet) { p.acted = true; await say(game, `⏰ @${num(p.jid)} kehabisan waktu → *check*.`, [p.jid]) }
          else { p.folded = true; await say(game, `⏰ @${num(p.jid)} kehabisan waktu → *fold*.`, [p.jid]) }
          advance(game).catch(() => null)
      }, TURN_MS)
      game.timer.unref?.()
  }

  async function nextStreet(game) {
      for (const p of game.players) { p.bet = 0; p.acted = false }
      game.currentBet = 0
      game.minRaise = game.bb
      if (game.street === 'river') return endHand(game)
      game.street = { preflop: 'flop', flop: 'turn', turn: 'river' }[game.street]
      game.board.push(...(game.street === 'flop' ? [game.deck.pop(), game.deck.pop(), game.deck.pop()] : [game.deck.pop()]))
      const canAct = game.players.filter(p => !p.folded && !p.allin)
      // kartu pribadi tetap sama; kabari board baru ke semua
      if (canAct.length < 2) {
          await say(game, `🃏 *${STREET[game.street]}*: ${game.board.map(label).join(' ')}`)
          return nextStreet(game) // semua all-in: buka sisa kartu
      }
      await say(game, `🃏 *${STREET[game.street]}*: ${game.board.map(label).join(' ')}`)
      game.cur = game.btn
      return advance(game)
  }

  async function endHand(game) {
      game.waiting = false
      game.status = 'between'
      clearTimeout(game.timer)
      const live = game.players.filter(p => !p.folded)
      const pots = buildPots(game.players)
      const scores = new Map()
      if (live.length > 1) for (const p of live) scores.set(p, bestHand([...p.cards, ...game.board]))

      const won = new Map()
      for (const pot of pots) {
          let winners
          if (live.length === 1) winners = [live[0]]
          else if (pot.eligible.length === 1) winners = pot.eligible
          else {
              let best = null
              winners = []
              for (const p of pot.eligible) {
                  const c = best ? cmpScore(scores.get(p), best) : 1
                  if (c > 0) { best = scores.get(p); winners = [p] } else if (c === 0) winners.push(p)
              }
          }
          const share = Math.floor(pot.amount / winners.length)
          let rest = pot.amount - share * winners.length
          for (const w of winners) {
              const a = share + (rest > 0 ? 1 : 0)
              if (rest > 0) rest--
              w.chips += a
              won.set(w, (won.get(w) || 0) + a)
          }
      }

      const lines = []
      if (live.length > 1) {
          lines.push(`🃏 Board: ${game.board.map(label).join(' ')}`)
          for (const p of live) lines.push(`• @${num(p.jid)} : ${p.cards.map(label).join(' ')} — ${handName(scores.get(p))}`)
          lines.push('')
      }
      for (const [p, a] of won) lines.push(`🏆 @${num(p.jid)} menang ${rupiah(a)}${live.length === 1 ? ' (lawan fold)' : ''}`)

      const stats = (groupData(game.jid).poker ||= { users: {} })
      for (const p of won.keys()) { const s = (stats.users[p.pn] ||= { name: p.name, net: 0, games: 0, hands: 0 }); s.hands++ }
      save()

      await say(game, `${lines.join('\n')}\n\n_Hand berikutnya sebentar lagi..._`, mentionsOf(game))
      game.nextTimer = setTimeout(() => startHand(game).catch(() => null), NEXT_MS)
      game.nextTimer.unref?.()
  }

  // ───────── aksi pemain ─────────
  function myTurn(game, m) {
      if (game.status !== 'hand') return { err: 'Belum ada hand yang berjalan.' }
      const p = game.players[game.cur]
      if (!game.waiting || !p || p.jid !== m.sender) {
          return { err: game.players.some(x => x.jid === m.sender) ? 'Belum giliranmu.' : 'Kamu tidak ikut meja ini.' }
      }
      return { p }
  }

  function raiseTo(game, p, to) {
      const maxTo = p.bet + p.chips
      to = Math.min(to, maxTo)
      const add = to - p.bet
      p.chips -= add; p.bet += add; p.total += add
      const inc = p.bet - game.currentBet
      if (inc >= game.minRaise) game.minRaise = inc
      game.currentBet = p.bet
      if (p.chips === 0) p.allin = true
      p.acted = true
      for (const q of game.players) if (q !== p && !q.folded && !q.allin) q.acted = false // buka kembali aksi
  }

  function callBet(game, p) {
      const pay = Math.min(game.currentBet - p.bet, p.chips)
      p.chips -= pay; p.bet += pay; p.total += pay
      if (p.chips === 0) p.allin = true
      p.acted = true
      return pay
  }

  async function findGameFor(m, jid, sock) {
      if (String(jid).endsWith('@g.us')) return games.get(jid) || null
      const { pn } = await rpgUser(sock, m)
      return [...games.values()].find(g => g.players.some(p => p.pn === pn)) || null
  }

  /**
   * Jalankan satu aksi poker.
   * @param cmd create | join | start | check | call | raise | fold | allin | hand | table | info | leave | stop | top | help
   */
  async function pokerRun(m, { sock, text, jid, reply, isAdmin, isOwner }, cmd = 'create') {
      rememberSock(sock)
      let arg = String(text || '').trim()
      if (cmd === 'create') {
          const first = arg.split(/\s+/)[0]?.toLowerCase()
          if (SUBS.includes(first)) { cmd = first; arg = arg.slice(first.length).trim() }
      }

      if (cmd === 'help') return reply(HELP)

      // .poker-hand boleh dipakai di chat pribadi
      if (cmd === 'hand') {
          const g = await findGameFor(m, jid, sock)
          if (!g) return reply('Kamu tidak sedang ikut meja poker.')
          const p = g.players.find(x => x.jid === m.sender) || (await (async () => { const { pn } = await rpgUser(sock, m); return g.players.find(x => x.pn === pn) })())
          if (!p) return reply('Kamu tidak ikut meja ini.')
          if (g.status === 'lobby' || !p.cards.length) return reply('Hand belum dimulai.')
          const text2 = `♠ *POKER* — kartumu: *${p.cards.map(label).join('  ')}*\nMeja: ${g.board.length ? g.board.map(label).join(' ') : 'belum ada kartu bersama'}`
          if (String(jid).endsWith('@g.us')) {
              const ok = await sendHole(g, p)
              return reply(ok ? 'Kartumu sudah dikirim ke chat pribadi.' : 'Gagal mengirim ke chat pribadi. Chat bot secara pribadi dulu, lalu ketik .poker-hand di sana.')
          }
          return reply(text2)
      }

      if (!String(jid).endsWith('@g.us')) return reply('Perintah ini hanya bisa dipakai di grup.')

      const game = games.get(jid)
      const canManage = (g) => isAdmin || isOwner || g.host === m.sender

      if (cmd === 'top') {
          const users = Object.values(groupData(jid).poker?.users || {}).sort((a, b) => b.net - a.net).slice(0, 10)
          if (!users.length) return reply('Belum ada yang main poker di grup ini. Mulai dengan .poker <buy-in>')
          return reply(`♣ *TOP POKER*\n\n${users.map((u, i) => `${i + 1}. ${u.name} — ${fmtDelta(u.net)} (${u.games} game, ${u.hands} hand menang)`).join('\n')}`)
      }

      // ── buat meja ──
      if (cmd === 'create') {
          if (game) return reply(`Sudah ada meja di grup ini (${game.status === 'lobby' ? 'menunggu pemain, ketik .poker-join' : 'sedang main'}).`)
          const mm = arg.toLowerCase().match(/^(\d+)\s*(k)?$/)
          const buyin = mm ? Number(mm[1]) * (mm[2] ? 1000 : 1) : 0
          if (!buyin || buyin < MIN_BUYIN || buyin > MAX_BUYIN) {
              return reply(`Format: .poker <buy-in>\nContoh: .poker 10000\nBuy-in ${rupiah(MIN_BUYIN)} - ${rupiah(MAX_BUYIN)}. Aturan: .poker-help`)
          }
          const { pn, user } = await rpgUser(sock, m)
          if ((Number(user.money) || 0) < buyin) return reply(`Uang kamu kurang untuk buy-in. Saldo: Rp ${rupiah(user.money)}`)
          if (games.has(jid)) return reply('Sudah ada meja di grup ini.')
          const sb = Math.max(1, Math.floor(buyin / 100))
          const g = {
              jid, sock, buyin, sb, bb: sb * 2, host: m.sender, status: 'lobby', handNo: 0, btn: null,
              street: 'preflop', board: [], deck: [], currentBet: 0, minRaise: sb * 2, cur: 0, token: 0, waiting: false,
              players: [{ pn, jid: m.sender, name: m.pushName || num(m.sender), chips: buyin, cards: [], bet: 0, total: 0, folded: false, allin: false, acted: false }]
          }
          g.lobbyTimer = setTimeout(() => {
              if (games.get(jid) !== g || g.status !== 'lobby') return
              drop(g)
              say(g, 'Meja poker ditutup karena tidak dimulai dalam 10 menit.')
          }, LOBBY_MS)
          g.lobbyTimer.unref?.()
          games.set(jid, g)
          return sock.sendMessage(jid, {
              text: `♣ *MEJA POKER DIBUKA* ♠\n\n👤 @${num(m.sender)} (host)\n💰 Buy-in: Rp ${rupiah(buyin)}\n🔹 Blind: ${rupiah(g.sb)} / ${rupiah(g.bb)}\n\nIkut: *.poker-join* (maks ${MAX_PLAYERS})\nMulai: *.poker-start* (min 2 pemain)`,
              mentions: [m.sender]
          }, { quoted: m })
      }

      if (!game) return reply('Belum ada meja poker di grup ini. Buat dengan .poker <buy-in>')

      if (cmd === 'table' || cmd === 'info') {
          if (game.status === 'lobby') {
              return sock.sendMessage(jid, {
                  text: `♣ *MEJA POKER* (menunggu)\n💰 Buy-in: Rp ${rupiah(game.buyin)}\n\n${game.players.map((p, i) => `${i + 1}. @${num(p.jid)}`).join('\n')}\n\nIkut: .poker-join | Mulai: .poker-start`,
                  mentions: mentionsOf(game)
              }, { quoted: m })
          }
          return sock.sendMessage(jid, { text: tableText(game, game.waiting ? game.players[game.cur] : null), mentions: mentionsOf(game) }, { quoted: m })
      }

      if (cmd === 'stop') {
          if (!canManage(game)) return reply('Hanya pembuat meja atau admin yang bisa membubarkan.')
          if (game.status === 'lobby') { drop(game); return reply('Meja poker dibatalkan.') }
          // kembalikan taruhan hand yang sedang berjalan, lalu cash out semua
          for (const p of game.players) { p.chips += p.total; p.total = 0 }
          clearTimeout(game.timer); clearTimeout(game.nextTimer)
          game.waiting = false
          return endGame(game, 'MEJA DIBUBARKAN')
      }

      if (cmd === 'join') {
          if (game.status !== 'lobby') return reply('Permainan sudah berjalan.')
          if (game.players.some(p => p.jid === m.sender)) return reply('Kamu sudah ikut meja ini.')
          if (game.players.length >= MAX_PLAYERS) return reply(`Meja penuh (maks ${MAX_PLAYERS} pemain).`)
          const { pn, user } = await rpgUser(sock, m)
          if ((Number(user.money) || 0) < game.buyin) return reply(`Uang kamu kurang untuk buy-in Rp ${rupiah(game.buyin)}. Saldo: Rp ${rupiah(user.money)}`)
          if (game.status !== 'lobby' || game.players.some(p => p.pn === pn)) return
          game.players.push({ pn, jid: m.sender, name: m.pushName || num(m.sender), chips: game.buyin, cards: [], bet: 0, total: 0, folded: false, allin: false, acted: false })
          return sock.sendMessage(jid, { text: `✅ @${num(m.sender)} ikut meja. Pemain: ${game.players.length}/${MAX_PLAYERS}`, mentions: [m.sender] }, { quoted: m })
      }

      if (cmd === 'start') {
          if (game.status !== 'lobby') return reply('Permainan sudah berjalan.')
          if (!canManage(game)) return reply('Hanya pembuat meja atau admin yang bisa memulai.')
          if (game.players.length < 2) return reply('Minimal 2 pemain.')
          game.status = 'starting' // cegah start ganda
          clearTimeout(game.lobbyTimer)
          // pastikan semua pemain masih mampu membayar buy-in
          const ok = []
          for (const p of game.players) {
              const { user } = await rpgUser(sock, { sender: p.jid, pushName: p.name })
              if ((Number(user.money) || 0) >= game.buyin) ok.push(p)
              else await say(game, `@${num(p.jid)} uangnya kurang, dikeluarkan dari meja.`, [p.jid])
          }
          game.players = ok
          if (ok.length < 2) { drop(game); return say(game, 'Pemain kurang, meja dibatalkan.') }
          try { return await startHand(game) } catch (e) { drop(game); return reply(`[ ! ] ${e.message}`) }
      }

      if (cmd === 'leave') {
          const p = game.players.find(x => x.jid === m.sender)
          if (!p) return reply('Kamu tidak ikut meja ini.')
          if (game.status === 'lobby') {
              game.players = game.players.filter(x => x !== p)
              if (!game.players.length) { drop(game); return reply('Meja poker dibatalkan (tidak ada pemain).') }
              if (game.host === p.jid) game.host = game.players[0].jid
              return reply('Kamu keluar dari meja.')
          }
          if (p.leaving) return reply('Kamu sudah keluar, tinggal menunggu hand ini selesai.')
          p.leaving = true
          await say(game, `👋 @${num(p.jid)} keluar dari meja (cash out setelah hand ini).`, [p.jid])
          if (game.status === 'hand' && !p.folded) {
              const isCur = game.waiting && game.players[game.cur] === p
              p.folded = true
              if (isCur || game.players.filter(x => !x.folded).length <= 1) return advance(game)
          }
          return
      }

      // ── aksi pemain ──
      if (['check', 'call', 'raise', 'fold', 'allin'].includes(cmd)) {
          const r = myTurn(game, m)
          if (r.err) return reply(r.err)
          const p = r.p
          game.waiting = false // kunci giliran selama aksi diproses

          if (cmd === 'check') {
              if (p.bet < game.currentBet) { game.waiting = true; return reply(`Tidak bisa check, ada taruhan ${rupiah(game.currentBet - p.bet)}. Pakai .poker-call atau .poker-fold.`) }
              p.acted = true
              await say(game, `✔️ @${num(p.jid)} check.`, [p.jid])
          } else if (cmd === 'call') {
              if (p.bet >= game.currentBet) { game.waiting = true; return reply('Tidak ada yang perlu di-call, pakai .poker-check.') }
              const pay = callBet(game, p)
              await say(game, `📞 @${num(p.jid)} call ${rupiah(pay)}${p.allin ? ' (ALL-IN)' : ''}.`, [p.jid])
          } else if (cmd === 'fold') {
              p.folded = true
              await say(game, `🏳️ @${num(p.jid)} fold.`, [p.jid])
          } else if (cmd === 'allin') {
              const to = p.bet + p.chips
              if (to > game.currentBet) raiseTo(game, p, to)
              else callBet(game, p)
              p.acted = true
              await say(game, `🔥 @${num(p.jid)} ALL-IN (${rupiah(p.bet)}).`, [p.jid])
          } else { // raise
              const mm = arg.toLowerCase().match(/^(\d+)\s*(k)?$/)
              const to = mm ? Number(mm[1]) * (mm[2] ? 1000 : 1) : 0
              const maxTo = p.bet + p.chips
              if (!to) { game.waiting = true; return reply(`Format: .poker-raise <total>\nContoh: .poker-raise ${rupiah(game.currentBet + game.minRaise)}`) }
              if (to <= game.currentBet) { game.waiting = true; return reply(`Raise harus lebih besar dari taruhan sekarang (${rupiah(game.currentBet)}).`) }
              if (to > maxTo) { game.waiting = true; return reply(`Chip kamu tidak cukup. Maksimal ${rupiah(maxTo)} (ALL-IN).`) }
              if (to < game.currentBet + game.minRaise && to < maxTo) { game.waiting = true; return reply(`Raise minimal sampai ${rupiah(game.currentBet + game.minRaise)}.`) }
              const had = game.currentBet
              raiseTo(game, p, to)
              await say(game, `⬆️ @${num(p.jid)} ${had ? 'raise' : 'bet'} jadi ${rupiah(p.bet)}${p.allin ? ' (ALL-IN)' : ''}.`, [p.jid])
          }
          return advance(game)
      }
  }

  return { pokerRun }
})()
export { pokerRun }

// ───────── command custom per grup (.addlistgc / .dellistgc / .listgc) ─────────
// Admin grup bikin command sendiri, mis. .rules, berisi teks saja atau foto + teks.
// Data : global.db.groups[jid].listgc = { [nama]: { text, image, by, at } }   (database/bot.json)
// Foto : database/media/listgc/<file>   (path relatif disimpan di `image`)
export const MEDIA_DIR = path.resolve('database/media/listgc')
export const MAX_ENTRIES = 50      // jumlah command custom per grup
export const MAX_TEXT = 3000       // panjang teks
export const MAX_IMAGE = 5 * 1024 * 1024
export const NAME_RE = /^[a-z0-9_-]{1,30}$/

// nama command yang dipakai fitur ini sendiri, tidak boleh ditimpa
const SELF = new Set(['listgc', 'addlistgc', 'dellistgc'])

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
export const extOfMime = (mime) => MIME_EXT[String(mime || '').toLowerCase()] || 'jpg'

/** Rapikan nama: huruf kecil, buang prefix di depan (".rules" -> "rules"). */
export function normName(raw) {
    return String(raw || '').trim().toLowerCase().replace(/^[^a-z0-9_-]+/, '')
}

/** true kalau nama sudah dipakai command bawaan bot (plugin). */
export function isBuiltinCommand(name) {
    if (SELF.has(name)) return true
    return Object.values(global.plugins || {}).some(p => matchPlugin(p, name) || matchSub(p, name))
}

/** Daftar command custom grup (TANPA membuat data baru). */
export const getList = (jid) => peekGroup(jid)?.listgc || {}

const fileOf = (entry) => (entry?.image ? path.resolve(entry.image) : null)

function removeImage(entry) {
    const f = fileOf(entry)
    if (!f) return
    // hanya hapus file di folder media listgc (jaga-jaga data diubah manual)
    if (!f.startsWith(MEDIA_DIR + path.sep)) return
    try { fs.unlinkSync(f) } catch {}
}

/** Simpan / perbarui satu command. Mengembalikan { created } supaya pesan bisa beda. */
export function setEntry(jid, name, { text = '', image = null, by = '' }) {
    const store = (groupData(jid).listgc ||= {})
    const old = store[name]
    const created = !old
    if (old) removeImage(old)
    store[name] = { text, image, by, at: Date.now() }
    save()
    return { created }
}

/** Hapus satu command (beserta fotonya). */
export function delEntry(jid, name) {
    const store = peekGroup(jid)?.listgc
    if (!store || !store[name]) return false
    removeImage(store[name])
    delete store[name]
    save()
    return true
}

/** Tulis foto ke disk dan kembalikan path relatif yang disimpan di database. */
export function writeImage(jid, name, buffer, mime) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true })
    const safeJid = String(jid).replace(/[^a-z0-9]/gi, '_')
    const file = path.join(MEDIA_DIR, `${safeJid}-${name}-${Date.now()}.${extOfMime(mime)}`)
    fs.writeFileSync(file, buffer)
    return path.relative(process.cwd(), file)
}

/** Kirim isi satu command: foto + teks (caption) atau teks saja. */
export async function sendEntry(sock, m, entry) {
    const text = entry.text || ''
    const file = fileOf(entry)
    if (file && fs.existsSync(file)) {
        const image = fs.readFileSync(file)
        try {
            return await sock.sendMessage(m.chat, { image, caption: text }, { quoted: m })
        } catch {
            // caption terlalu panjang (mis. batas Telegram 1024): kirim foto lalu teksnya terpisah
            await sock.sendMessage(m.chat, { image }, { quoted: m }).catch(() => null)
            if (text) return m.reply(text)
            return
        }
    }
    return m.reply(text || '(kosong)')
}

/**
 * Dipanggil handler.js saat command TIDAK cocok dengan plugin mana pun.
 * true = command custom ditemukan dan sudah dibalas.
 */
export async function runCustom(sock, m, ctx) {
    if (!m.isGroup || !ctx?.command) return false
    const entry = getList(ctx.jid || m.chat)[ctx.command]
    if (!entry) return false
    await sendEntry(sock, m, entry)
    return true
}
