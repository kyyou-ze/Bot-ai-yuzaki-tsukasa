import { dioRegister, dioRun, ffmpegBin } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
// KARTU LIVE: Kaguya Musik — pemutar musik di dalam kartu (lagu dari Google Drive, scroll ▲▼, seek, volume)
//   .musikbot                 -> kartu pemutar, playlist mulai dari lagu 1
//   .musikbot <no|judul>      -> kartu pemutar, playlist mulai dari lagu itu
//   .musikbot list [hal]     -> daftar teks (cadangan bila kartu tidak tampil)
//   .musikbot refresh         -> (owner) scan ulang folder Drive
//   .musikbot add <link drive> | <Artis - Judul>   -> (owner) tambah lagu manual
//   .musikbot del <no>        -> (owner) hapus lagu manual
//   .musikbot cari <kata>     -> cari lagu (hasil teks)
//   .musikbot acak            -> kartu + lagu acak
//   .musikbot info <no>       -> detail lagu (durasi, jumlah putar, status favorit)
//   .musikbot fav [no]        -> tanpa nomor: kartu berisi favoritmu; dengan nomor: tambah/hapus favorit
//   .musikbot top             -> 10 lagu paling sering diputar
//   .musikbot lanjut          -> lanjut dari lagu terakhir yang kamu putar
const M = require('../../lib/musik')
const ST = require('../../lib/style')
const { buildMusikHtml } = require('../../lib/cards/musik')
const { sendHtmlCard } = require('../../lib/htmlcard')

// ── teks "bot mengetik sendiri" di bawah kartu: makin tinggi volume, makin asik musiknya ──
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const LINES = [
  (n) => `@${n} semakin tinggi volumenya, semakin asik musiknya. Jangan biarkan semangatmu berhenti, naikkan volumenya sekarang! 🔊`,
  (n) => `Gas @${n}! Putar kencang-kencang, makin keras makin hidup. Jangan biarkan semangatmu padam! 🎶`,
  (n) => `@${n}, naikkan volumenya sampai mentok. Musiknya makin asik kalau makin kencang, semangatmu jangan berhenti! 🔥`,
  (n) => `Malam ini milik @${n}. Volume tinggi, hati tenang, semangat jangan pernah berhenti! 🎧`,
]
const MAX_HTML = Math.max(200, Number(process.env.MUSIK_MAX_HTML_KB) || 700) * 1024   // batas aman ukuran HTML kartu
async function sendAudio(sock, m, t, reply) {
  try {
    const f = await M.ensureHq(t)
    await sock.sendMessage(m.chat, { audio: require('fs').readFileSync(f), mimetype: 'audio/mpeg', ptt: false, fileName: `${t.artist} - ${t.title}.mp3` }, { quoted: m })
    return true
  } catch (e) { console.log('[musikbot audio]', e.message); if (reply) reply('Audio gagal dikirim: ' + e.message); return false }
}
const busy = new Set() // chat yang kartunya sedang disiapkan (cegah perintah ganda saat lagu masih diunduh)
const turns = new Map() // chat -> antrean, supaya tiap user yang memakai perintah mendapat giliran sendiri
async function typeText(sock, m, name) {
  const prev = turns.get(m.chat) || Promise.resolve()
  const run = prev.then(async () => {
    const full = LINES[Math.floor(Math.random() * LINES.length)](name)
    const words = full.split(' '), steps = Math.min(8, words.length), per = Math.ceil(words.length / steps)
    const part = (i) => words.slice(0, Math.min(words.length, per * i)).join(' ')
    const mentions = [m.sender]
    try { await sock.sendPresenceUpdate('composing', m.chat) } catch {}
    await sleep(900)
    let sent = await sock.sendMessage(m.chat, { text: part(1) + ' ▍', mentions }, { quoted: m })
    for (let i = 2; i <= steps; i++) {
      await sleep(650)
      const t = part(i) + (i < steps ? ' ▍' : '')
      try { await sock.sendMessage(m.chat, { text: t, edit: sent.key, mentions }) } catch { break }
    }
    try { await sock.sendPresenceUpdate('paused', m.chat) } catch {}
  }).catch(e => console.log('[musikbot typing]', e.message))
  turns.set(m.chat, run)
  await run
  if (turns.get(m.chat) === run) turns.delete(m.chat)
}

module.exports = {
  M,
  name: 'musikbot',
  sendAudio,
  alias: [],
  category: 'rich',
  desc: 'Pemutar musik: kartu playlist, cari, acak, favorit, top, lanjut + kirim audio',
  run: async ({ sock, m, reply, args, text, prefix, pushname, isOwner }) => {
    const sub = (args[0] || '').toLowerCase()

    // ── owner: refresh / add / del ──
    if (['refresh', 'scan', 'update'].includes(sub)) {
      if (!isOwner) return reply(((global.mess && global.mess.owner) || 'Fitur ini khusus owner.'))
      const list = await M.getTracks(true)
      return reply(list.length ? `Daftar musik diperbarui: ${list.length} lagu.` : 'Tidak ada lagu terbaca. Pastikan folder Drive dibagikan ke "Siapa saja yang memiliki link".')
    }
    if (sub === 'add') {
      if (!isOwner) return reply(((global.mess && global.mess.owner) || 'Fitur ini khusus owner.'))
      const [link, ...nm] = text.replace(/^add\s+/i, '').split('|')
      const t = M.addManual(link, nm.join('|').trim())
      return reply(t ? `Ditambahkan: ${t.artist} - ${t.title}` : `Format: ${prefix}musikbot add <link file drive> | Artis - Judul`)
    }
    if (sub === 'del') {
      if (!isOwner) return reply(((global.mess && global.mess.owner) || 'Fitur ini khusus owner.'))
      const list = await M.getTracks(), t = M.find(list, args[1])
      return reply(t && M.removeManual(t.id) ? `Dihapus: ${t.title}` : 'Hanya lagu tambahan manual yang bisa dihapus (cek nomornya).')
    }

    const tracks = await M.getTracks()
    if (!tracks.length) return reply('Belum ada lagu terbaca dari Google Drive.\nPastikan folder dibagikan ke "Siapa saja yang memiliki link", lalu ketik ' + prefix + 'musikbot refresh (owner).')

    // ── daftar teks (cadangan bila kartu tidak tampil): .musikbot list [halaman] ──
    if (['list', 'daftar', 'teks'].includes(sub)) {
      const per = 25, pages = Math.max(1, Math.ceil(tracks.length / per)), pg = Math.min(pages, Math.max(1, parseInt(args[1], 10) || 1))
      const rows = tracks.slice((pg - 1) * per, pg * per).map((t, i) => `${(pg - 1) * per + i + 1}. ${ST.cut(t.artist + ' - ' + t.title, 60)}`).join('\n')
      return reply(`${ST.B(String(global.namebot || 'Kaguya').toUpperCase() + ' MUSIK')} (${tracks.length} lagu)\n━━━━━━━━━━━━━━━━━━━━\n${rows}\n\n_Halaman ${pg}/${pages} • ${prefix}musikbot list <hal>_\n_Kirim lagu: ${prefix}dmp3 <no|judul>_`)
    }

    const short = (t) => ST.cut(t.artist + ' - ' + t.title, 60)
    const withDur = (list) => list.map(t => ({ ...t, dur: M.fmtDur(M.durOf(t.id)) === '-' ? '' : M.fmtDur(M.durOf(t.id)) }))
    const me = m.sender

    // ── cari ──
    if (['cari', 'search', 'find'].includes(sub)) {
      const q = text.replace(/^\S+\s*/, '').trim()
      if (!q) return reply(`Format: ${prefix}musikbot cari <kata>`)
      const hit = M.search(tracks, q)
      if (!hit.length) return reply(`Tidak ada lagu dengan kata \"${ST.cut(q, 40)}\".`)
      const rows = hit.slice(0, 20).map(({ t, i }) => `${i + 1}. ${short(t)}`).join('\n')
      return reply(`${ST.B('HASIL CARI')} (${hit.length})\n━━━━━━━━━━━━━━━━━━━━\n${rows}${hit.length > 20 ? `\n… dan ${hit.length - 20} lainnya` : ''}\n\n_Putar: ${prefix}musikbot <no> • Kirim audio: ${prefix}dmp3 <no>_`)
    }
    // ── info ──
    if (sub === 'info') {
      const t = M.find(tracks, text.replace(/^\S+\s*/, ''))
      if (!t) return reply(`Format: ${prefix}musikbot info <no|judul>`)
      const plays = (M.topPlays(9999).find(([id]) => id === t.id) || [0, 0])[1], fv = M.favs(me).includes(t.id)
      return reply(`${ST.B(t.title)}\nArtis   : ${t.artist}\nNomor   : ${tracks.indexOf(t) + 1} dari ${tracks.length}\nDurasi  : ${M.fmtDur(M.durOf(t.id))}\nDiputar : ${plays}x\nFavorit : ${fv ? 'ya' : 'belum'}\nBerkas  : ${ST.cut(t.file, 60)}\n\n_${prefix}dmp3 ${tracks.indexOf(t) + 1} untuk menerima audionya_`)
    }
    // ── top ──
    if (['top', 'populer', 'terpopuler'].includes(sub)) {
      const top = M.topPlays(10).map(([id, n]) => [tracks.find(t => t.id === id), n]).filter(([t]) => t)
      if (!top.length) return reply('Belum ada statistik putar. Putar beberapa lagu dulu.')
      return reply(`${ST.B('TOP LAGU')}\n━━━━━━━━━━━━━━━━━━━━\n` + top.map(([t, n], i) => `${i + 1}. ${short(t)} — ${n}x`).join('\n'))
    }
    // ── fav ──
    let prefer = [], favMode = false
    if (['fav', 'favorit', 'suka'].includes(sub)) {
      const arg = text.replace(/^\S+\s*/, '').trim()
      if (arg) {
        const t = M.find(tracks, arg); if (!t) return reply(`Lagu \"${ST.cut(arg, 40)}\" tidak ditemukan.`)
        const on = M.toggleFav(me, t.id)
        return reply(on ? `Ditambahkan ke favorit: ${short(t)}` : `Dihapus dari favorit: ${short(t)}`)
      }
      prefer = M.favs(me).map(id => tracks.findIndex(t => t.id === id)).filter(k => k >= 0)
      if (!prefer.length) return reply(`Favoritmu masih kosong.\nTambah: ${prefix}musikbot fav <no|judul>`)
      favMode = true
    }
    // ── lanjut / acak: tentukan lagu awal ──
    let forced = null
    if (['lanjut', 'resume', 'terakhir'].includes(sub)) {
      const id = M.lastPlayed(me); forced = tracks.find(t => t.id === id)
      if (!forced) return reply(`Belum ada riwayat putar. Mulai dengan ${prefix}musikbot <no>.`)
    }
    if (['acak', 'random', 'shuffle'].includes(sub)) forced = tracks[Math.floor(Math.random() * tracks.length)]

    let start = 0, picked = null
    if (forced) { picked = forced; start = tracks.indexOf(forced) }
    else if (favMode) start = prefer[0]
    else if (text.trim()) {
      picked = M.find(tracks, text)
      if (!picked) return reply(`Lagu "${ST.cut(text, 40)}" tidak ditemukan.\nKetik ${prefix}musikbot untuk melihat daftar.`)
      start = tracks.indexOf(picked)
    }
    if (busy.has(m.chat)) return reply('Kartu musik masih disiapkan, tunggu sebentar ya.')
    busy.add(m.chat)
    let wait = null
    try {
      try { await sock.sendPresenceUpdate('composing', m.chat) } catch {}
      try { wait = await sock.sendMessage(m.chat, { text: 'Menyiapkan ' + (global.namebot || 'Kaguya') + ' Musik... (pertama kali agak lama karena lagu diunduh dulu)' }, { quoted: m }) } catch {}
      const [thumb, bg, pl] = await Promise.all([M.getImage('thumb'), M.getImage('bg'), M.buildPlaylist(tracks, start, prefer)])
      M.warm(tracks)   // siapkan sisa lagu di belakang layar

      // 1) kartu HTML. Pesan kartu WA punya batas ukuran: kalau terlalu besar kartu tidak dirender sama sekali,
      //    jadi audio preview dibuang otomatis bila HTML melebihi MAX_HTML.
      const mk = (audio) => buildMusikHtml({ playerName: pushname || String(m.sender).split('@')[0], tracks: withDur(tracks), favIds: M.favs(me), prefix, thumbUri: thumb && thumb.uri, bgUri: bg && bg.uri, audio, start })
      let html = mk(pl.audio)
      if (Buffer.byteLength(html) > MAX_HTML) html = mk(new Map())
      const ok = await sendHtmlCard(sock, m, html, (global.namebot || 'Kaguya') + ' Musik', '🎵')
      if (wait) { try { await sock.sendMessage(m.chat, { delete: wait.key }) } catch {} wait = null }

      // 2) lagu pilihan dikirim sebagai pesan audio asli (pasti bisa diputar di WhatsApp)
      if (picked) { M.countPlay(me, picked.id); await sendAudio(sock, m, picked, reply) }
      if (ok) await typeText(sock, m, String(m.sender).split('@')[0])
    } catch (e) {
      console.log('[musikbot]', e.message)
      reply('Gagal menyiapkan kartu musik: ' + e.message)
    } finally {
      busy.delete(m.chat)
      if (wait) { try { await sock.sendMessage(m.chat, { delete: wait.key }) } catch {} }
    }
  },
}
    }

const libs = {
    "musik": (module, exports, require) => {
// Mesin Kaguya MUSIK: daftar lagu dari folder Google Drive, gambar thumbnail (di-embed base64), dan unduh lagu.
// Folder Drive HARUS dibagikan "Siapa saja yang memiliki link" (Anyone with the link).
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const FOLDER_ID = '124tvFzGBgAmcZ0KxVyl2-T_2As3WRQ4X'
const IMG = {
  thumb: 'https://i.ibb.co.com/k6rtzVL9/Proyek-Baru-65-F00-DEE2.png', // thumbnail musik + thumbnail fitur
  bg: 'https://i.ibb.co.com/whrprzJQ/Proyek-Baru-66-F2-FA53-D.png',   // background kartu
}
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const MEDIA = path.join(process.cwd(), 'database', 'tmp', 'musik-media')
const TTL = 10 * 60 * 1000
const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|opus|aac|flac|wma)$/i

// disimpan di global.db.musik (database/tools.json): { tracks:[...cache scan], manual:[...tambahan owner] }
const readDb = () => { const d = (global.db.musik ||= { tracks: [], manual: [] }); d.tracks ||= []; d.manual ||= []; return d }
const writeDb = (d) => { global.db.musik = d }

const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim()

// buang watermark situs unduhan & sampah penamaan: "spotdown.org", "(Official Video)", "[320kbps]", dst.
const JUNK = [
  /\b[\w-]+\.(?:org|com|net|co|id|io|me|cc|xyz|app|to|ru)\b/gi,            // spotdown.org, y2mate.com, dst.
  /[\(\[\{]\s*(?:official|lyrics?|lirik|video|audio|music|mv|hd|hq|4k|remix video|visuali[sz]er|download|free)[^\)\]\}]*[\)\]\}]/gi,
  /[\(\[]\s*\d{2,3}\s*kbps\s*[\)\]]/gi,
  /\b(?:official\s+(?:music\s+)?(?:video|audio)|lyric\s+video|free\s+download|full\s+song)\b/gi,
]
const cleanName = (x) => {
  let t = String(x || '')
  for (const re of JUNK) t = t.replace(re, ' ')
  return t.replace(/[_]+/g, ' ').replace(/\s*[-–—|•·]\s*$/g, '').replace(/^\s*[-–—|•·]\s*/g, '').replace(/\s{2,}/g, ' ').trim()
}
// "Artis - Judul.mp3" -> { title, artist }
function parseName(file) {
  const base = cleanName(decode(file).replace(AUDIO_EXT, '')) || 'Tanpa judul'
  const i = base.indexOf(' - ')
  if (i > 0) return { artist: base.slice(0, i).trim(), title: base.slice(i + 3).trim() || base }
  return { artist: (global.namebot || 'Kaguya') + ' Musik', title: base || 'Tanpa judul' }
}
const mk = (id, file) => ({ id, file: decode(file), ...parseName(file) })

// id Drive dari tautan/ID mentah
function driveId(s) {
  const t = String(s || '')
  return (t.match(/\/d\/([\w-]{15,})/) || t.match(/[?&]id=([\w-]{15,})/) || t.match(/^([\w-]{25,})$/) || [])[1] || null
}

// scan folder publik Drive tanpa API key
async function scanFolder() {
  const r = await axios.get(`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}`, { timeout: 30000, headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' } })
  const html = String(r.data || ''), out = [], seen = new Set()
  const re = /<div class="flip-entry"[^>]*id="entry-([\w-]+)"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g
  let x
  while ((x = re.exec(html))) { if (!seen.has(x[1])) { seen.add(x[1]); out.push(mk(x[1], x[2])) } }
  if (!out.length) { // cadangan: pola lain
    const re2 = /\/file\/d\/([\w-]{15,})\/view[^>]*>[\s\S]{0,400}?<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</g
    while ((x = re2.exec(html))) { if (!seen.has(x[1])) { seen.add(x[1]); out.push(mk(x[1], x[2])) } }
  }
  if (!out.length) { // cadangan 2: halaman folder biasa (data file ada di JSON tertanam)
    try {
      const r2 = await axios.get(`https://drive.google.com/drive/folders/${FOLDER_ID}?hl=id`, { timeout: 30000, headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' } })
      const h2 = String(r2.data || '').replace(/\\x22/g, '"').replace(/\\\//g, '/')
      const re3 = /\["([\w-]{25,})",\["[\w-]+"\],"([^"]+?)","(?:audio\/[^"]*|application\/octet-stream)"/g
      while ((x = re3.exec(h2))) { if (!seen.has(x[1])) { seen.add(x[1]); out.push(mk(x[1], x[2].replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))))) } }
    } catch (e) { console.log('[musik] scan cadangan gagal:', e.message) }
  }
  return out.filter(t => AUDIO_EXT.test(t.file) || !/\.[a-z0-9]{2,4}$/i.test(t.file)).sort((a, b) => a.file.localeCompare(b.file, 'id', { numeric: true }))
}

let memo = { at: 0, list: null }
async function getTracks(force) {
  if (!force && memo.list && Date.now() - memo.at < TTL) return memo.list
  const db = readDb()
  let scanned = db.tracks || []
  try { const s = await scanFolder(); if (s.length) { scanned = s; db.tracks = s; writeDb(db) } else console.log('[musik] scan folder kosong (pastikan folder publik)') }
  catch (e) { console.log('[musik] scan gagal, pakai cache:', e.message) }
  const ids = new Set(scanned.map(t => t.id))
  const list = scanned.concat((db.manual || []).filter(t => !ids.has(t.id)))
  memo = { at: Date.now(), list }
  return list
}

function addManual(link, nameRaw) {
  const id = driveId(link); if (!id) return null
  const db = readDb(); db.manual = db.manual || []
  const t = mk(id, nameRaw || 'Tanpa judul')
  db.manual = db.manual.filter(x => x.id !== id).concat(t); writeDb(db); memo.at = 0
  return t
}
function removeManual(id) { const db = readDb(), n = (db.manual || []).length; db.manual = (db.manual || []).filter(x => x.id !== id); writeDb(db); memo.at = 0; return n !== db.manual.length }

// cari lagu: nomor (1-based) atau potongan judul/artis
function find(list, q) {
  const s = String(q || '').trim().toLowerCase(); if (!s) return null
  if (/^\d+$/.test(s)) return list[+s - 1] || null
  return list.find(t => `${t.artist} ${t.title}`.toLowerCase().includes(s)) || null
}

// ── gambar: unduh sekali, kecilkan, simpan ke lib/media, lalu embed sebagai data URI (kartu WA tanpa jaringan) ──
// Anti gagal: coba beberapa host (i.ibb.co.com <-> i.ibb.co), lalu cadangan file lokal (lib/media/thumb.jpg),
// dan kalau tetap gagal jangan mencoba lagi selama 5 menit supaya perintah tidak menunggu timeout berulang.
const imgCache = {}, imgFail = {}
const IMG_RETRY = 5 * 60 * 1000
const urlVariants = (u) => {
  const out = [u]
  if (/\/\/i\.ibb\.co\.com\//.test(u)) out.push(u.replace('//i.ibb.co.com/', '//i.ibb.co/'))
  else if (/\/\/i\.ibb\.co\//.test(u)) out.push(u.replace('//i.ibb.co/', '//i.ibb.co.com/'))
  return out
}
async function fetchImage(url) {
  let last
  for (const u of urlVariants(url)) {
    try { return Buffer.from((await axios.get(u, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': UA } })).data) }
    catch (e) { last = e }
  }
  throw last
}
async function getImage(kind) {
  if (imgCache[kind]) return imgCache[kind]
  if (imgFail[kind] && Date.now() - imgFail[kind] < IMG_RETRY) return null
  let sharp; try { sharp = require('sharp') } catch (e) { console.log('[musik] sharp tidak tersedia:', e.message); imgFail[kind] = Date.now(); return null }
  const px = kind === 'thumb' ? 128 : 420
  const shrink = (b) => sharp(b).resize(px, px, { fit: kind === 'thumb' ? 'cover' : 'inside', withoutEnlargement: true }).jpeg({ quality: kind === 'thumb' ? 72 : 55 }).toBuffer()
  const file = path.join(MEDIA, `musik_${kind}.jpg`)
  let buf = null
  try { buf = fs.readFileSync(file) } catch {}
  if (!buf) {
    try {
      buf = await shrink(await fetchImage(IMG[kind]))
      fs.mkdirSync(MEDIA, { recursive: true }); fs.writeFileSync(file, buf)
    } catch (e) {
      console.log(`[musik] gambar ${kind} gagal: ${e.message}`)
      // cadangan lokal: thumb -> lib/media/thumb.jpg (bg tidak punya cadangan, kartu memakai gradasi bawaan)
      if (kind === 'thumb') { try { buf = await shrink(fs.readFileSync(path.join(MEDIA, 'thumb.jpg'))) } catch {} }
      if (!buf) { imgFail[kind] = Date.now(); return null }
    }
  }
  return (imgCache[kind] = { buf, uri: 'data:image/jpeg;base64,' + buf.toString('base64') })
}

// ── unduh lagu dari Drive ke file ──
// Drive kadang membalas halaman HTML "tidak bisa scan virus" untuk file besar: formnya berisi uuid/confirm yang harus dikirim ulang.
function confirmUrl(html, id) {
  const form = String(html).match(/<form[^>]+action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i)
  if (form) {
    const q = new URLSearchParams()
    for (const m of form[2].matchAll(/<input[^>]+name="([^"]+)"[^>]*value="([^"]*)"/gi)) q.set(m[1], decode(m[2]))
    if (q.has('id')) return decode(form[1]) + '?' + q.toString()
  }
  const uuid = (String(html).match(/uuid=([\w-]+)/) || [])[1]
  return uuid ? `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t&uuid=${uuid}` : null
}
async function openStream(u) {
  return axios.get(u, { responseType: 'stream', timeout: 120000, maxRedirects: 8, headers: { 'User-Agent': UA }, validateStatus: s => s < 500 })
}
async function download(id, dir, nameHint) {
  const urls = [`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, `https://drive.google.com/uc?export=download&confirm=t&id=${id}`]
  let last
  for (const u0 of urls) {
    try {
      let res = await openStream(u0)
      let type = String(res.headers['content-type'] || '')
      if (/text\/html/i.test(type)) {   // coba lewati halaman konfirmasi sekali
        const html = await new Promise((ok, no) => { let b = ''; res.data.on('data', c => { b += c; if (b.length > 300000) res.data.destroy() }); res.data.on('end', () => ok(b)); res.data.on('close', () => ok(b)); res.data.on('error', no) })
        const next = confirmUrl(html, id)
        if (!next) throw new Error('Drive menolak (file belum publik atau kuota unduh habis)')
        res = await openStream(next); type = String(res.headers['content-type'] || '')
        if (/text\/html/i.test(type)) { res.data.destroy(); throw new Error('Drive menolak (file belum publik atau kuota unduh habis)') }
      }
      if (res.status >= 400) { res.data.destroy(); throw new Error('Drive membalas ' + res.status) }
      const cd = String(res.headers['content-disposition'] || '')
      let ext = (cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i) || [])[1]; ext = ext ? path.extname(decodeURIComponent(ext)) : ''
      if (!ext) ext = /mpeg|mp3/.test(type) ? '.mp3' : /mp4|m4a|aac/.test(type) ? '.m4a' : /ogg/.test(type) ? '.ogg' : /wav/.test(type) ? '.wav' : '.mp3'
      const safe = String(nameHint || id).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80).trim() || id
      const dest = path.join(dir, safe + ext.toLowerCase())
      let got = 0
      await new Promise((ok, no) => {
        const w = fs.createWriteStream(dest)
        res.data.on('data', c => { got += c.length; if (got > 60 * 1048576) res.data.destroy(new Error('file lebih dari 60 MB')) })
        res.data.on('error', no); w.on('error', no); w.on('finish', ok); res.data.pipe(w)
      })
      if (got < 2048) throw new Error('berkas kosong')
      return dest
    } catch (e) { last = e }
  }
  throw last || new Error('gagal mengunduh dari Drive')
}

// ── audio untuk diputar LANGSUNG di dalam kartu: ubah ke mp3 mono kecil lalu embed sebagai data URI ──
// Kartu WA tidak punya akses jaringan, jadi lagu harus ditanam di HTML. Total ukuran dibatasi (BUDGET) agar pesan tetap terkirim.
const { execFile } = require('child_process')
const AUDIO_DIR = path.join(MEDIA, 'musik')
const BUDGET = Math.max(300, Number(process.env.MUSIK_BUDGET_KB) || 420) * 1024   // total audio per kartu (byte, sebelum base64)
const KBPS = Math.max(16, Number(process.env.MUSIK_KBPS) || 24)                      // bitrate mp3 mono
const CLIP = Math.max(8, Number(process.env.MUSIK_CLIP_SEC) || 20)                   // lama preview per lagu (detik); diambil dari bagian tengah lagu
const ffmpeg = () => { return ffmpegBin }
const safeId = (id) => String(id).replace(/[^\w-]/g, '')
const cachePath = (id) => path.join(AUDIO_DIR, 'v2_' + safeId(id) + '.mp3')   // v2 = klip preview (cache lama lagu penuh diabaikan)
const inflight = new Map()

const run = (bin, a, o) => new Promise((ok, no) => execFile(bin, a, { timeout: 240000, maxBuffer: 8 * 1048576, ...o }, (e, out, err) => e ? no(e) : ok(String(err || '') + String(out || ''))))
// durasi (detik) dari keluaran ffmpeg -i; 0 bila gagal
async function probe(src) {
  let out = ''; try { out = await run(ffmpeg(), ['-i', src]) } catch (e) { out = String(e.stderr || e.message || '') }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0
}
async function encode(src, dest) {
  const dur = await probe(src)
  const ss = dur > CLIP * 2 ? Math.max(0, Math.floor(dur * 0.35)) : 0   // lewati intro: mulai di ±35% lagu
  const args = ['-y', ...(ss ? ['-ss', String(ss)] : []), '-i', src, '-t', String(CLIP), '-vn', '-map_metadata', '-1', '-ac', '1', '-ar', '24000', '-af', 'afade=t=in:d=0.4,afade=t=out:st=' + Math.max(0, CLIP - 1.2) + ':d=1.2', '-c:a', 'libmp3lame', '-b:a', KBPS + 'k', dest]
  await run(ffmpeg(), args)
  try { fs.writeFileSync(dest + '.json', JSON.stringify({ dur: Math.round(dur) })) } catch {}
  return dest
}
const durOf = (id) => { try { return JSON.parse(fs.readFileSync(cachePath(id) + '.json', 'utf8')).dur || 0 } catch { return 0 } }
// ambil mp3 kecil (dari cache, atau unduh dari Drive lalu ubah). Mengembalikan Buffer.
function ensureAudio(t) {
  const f = cachePath(t.id)
  if (fs.existsSync(f) && fs.statSync(f).size > 2048) return Promise.resolve(fs.readFileSync(f))
  if (inflight.has(t.id)) return inflight.get(t.id)
  const job = (async () => {
    fs.mkdirSync(path.join(process.cwd(), 'database', 'tmp'), { recursive: true })
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'database', 'tmp', 'dmusik-'))
    try {
      fs.mkdirSync(AUDIO_DIR, { recursive: true })
      const raw = await download(t.id, tmp, 'src')
      await encode(raw, f)
      return fs.readFileSync(f)
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} inflight.delete(t.id) }
  })()
  inflight.set(t.id, job); return job
}
// mp3 kualitas bagus (128k stereo) untuk DIKIRIM sebagai pesan audio WhatsApp asli. Mengembalikan path file.
const HQ_DIR = path.join(AUDIO_DIR, 'hq')
const hqJobs = new Map()
function ensureHq(t) {
  const f = path.join(HQ_DIR, safeId(t.id) + '.mp3')
  if (fs.existsSync(f) && fs.statSync(f).size > 4096) return Promise.resolve(f)
  if (hqJobs.has(t.id)) return hqJobs.get(t.id)
  const job = (async () => {
    fs.mkdirSync(path.join(process.cwd(), 'database', 'tmp'), { recursive: true })
    const tmp = fs.mkdtempSync(path.join(process.cwd(), 'database', 'tmp', 'dmusikhq-'))
    try {
      fs.mkdirSync(HQ_DIR, { recursive: true })
      const raw = await download(t.id, tmp, 'src')
      await new Promise((ok, no) => execFile(ffmpeg(), ['-y', '-i', raw, '-vn', '-map_metadata', '-1', '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', f], { timeout: 300000 }, (e) => e ? no(e) : ok()))
      return f
    } finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} hqJobs.delete(t.id) }
  })()
  hqJobs.set(t.id, job); return job
}
// susun playlist mulai dari lagu ke-start (urutan berputar) sampai anggaran ukuran habis
async function buildPlaylist(tracks, start = 0, prefer = []) {
  const n = tracks.length, base = Array.from({ length: n }, (_, i) => (start + i) % n), pf = prefer.filter(k => k >= 0 && k < n)
  const order = pf.length ? [...new Set([...pf, ...base])] : base   // lagu pilihan (mis. favorit) didahulukan
  const got = new Map(); let used = 0
  for (let i = 0; i < n && used < BUDGET; i += 3) {
    const batch = order.slice(i, i + 3)
    const res = await Promise.all(batch.map(k => ensureAudio(tracks[k]).then(b => [k, b], e => { console.log('[musik] lagu gagal:', tracks[k].title, '-', e.message); return null })))
    for (const r of res) {
      if (!r) continue
      let [k, b] = r
      const left = BUDGET - used
      if (b.length > left) { if (got.size) continue; b = b.subarray(0, left) }   // lagu pertama terlalu besar -> dipotong (preview)
      got.set(k, b.toString('base64')); used += b.length
    }
  }
  return { audio: got, bytes: used }
}
// unduh & ubah semua lagu di belakang layar supaya kartu berikutnya cepat
let warming = false
async function warm(tracks) {
  if (warming) return; warming = true
  try { for (const t of tracks) { try { await ensureAudio(t) } catch (e) { console.log('[musik] warm gagal:', t.title, e.message) } } } finally { warming = false }
}

// ── favorit per user & statistik putar ──
// disimpan di global.db.musikuser (database/tools.json): { fav:{jid:[id]}, plays:{id:n}, last:{jid:id} }
const sRead = () => { const d = (global.db.musikuser ||= { fav: {}, plays: {}, last: {} }); d.fav ||= {}; d.plays ||= {}; d.last ||= {}; return d }
const sWrite = (d) => { global.db.musikuser = d }
const favs = (jid) => (sRead().fav || {})[jid] || []
function toggleFav(jid, id) {
  const d = sRead(); d.fav = d.fav || {}; const a = d.fav[jid] || []
  const has = a.includes(id); d.fav[jid] = has ? a.filter(x => x !== id) : a.concat(id).slice(-100); sWrite(d); return !has
}
function countPlay(jid, id) { const d = sRead(); d.plays = d.plays || {}; d.last = d.last || {}; d.plays[id] = (d.plays[id] || 0) + 1; d.last[jid] = id; sWrite(d) }
const topPlays = (n = 10) => Object.entries(sRead().plays || {}).sort((a, b) => b[1] - a[1]).slice(0, n)
const lastPlayed = (jid) => (sRead().last || {})[jid] || null
// cari beberapa lagu sekaligus (judul/artis mengandung semua kata)
function search(list, q) {
  const w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) return []
  return list.map((t, i) => ({ t, i })).filter(({ t }) => { const h = `${t.artist} ${t.title}`.toLowerCase(); return w.every(x => h.includes(x)) })
}
const fmtDur = (x) => x ? `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}` : '-'

module.exports = { search, favs, toggleFav, countPlay, topPlays, lastPlayed, durOf, fmtDur, cleanName, probe, FOLDER_ID, IMG, BUDGET, getTracks, addManual, removeManual, find, getImage, download, driveId, ensureAudio, ensureHq, buildPlaylist, warm }
    },
    "htmlcard": (module, exports, require) => {
// Pengirim kartu HTML (rich response) untuk Kaguya.
// Kartu statis: semua data ditanam di HTML, tanpa fetch (sandbox WA memblokir jaringan).
const DEFAULT_BOT_JID = "867051314767696@bot"
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]
const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("")
const randomResponseId = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`

function buildRichHtmlPayload(html, title = "Card", opts = {}) {
  // opts.quoted = objek pesan (m) yang mau di-reply: kutipannya tampil di dalam kartu, seperti balasan biasa
  const q = require('./dquote').quoteOf(opts.quoted), qCtx = q && q.message ? { stanzaId: q.key.id, participant: q.key.participant || q.sender, remoteJid: q.chat, quotedMessage: q.message } : {}
  return {
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { capabilityMetadata: { capabilities: KAPABILITAS } } },
    botForwardedMessage: { message: { richResponseMessage: {
      messageType: 1,
      submessages: [{ messageType: 2, messageText: title }],
      unifiedResponse: { data: Buffer.from(JSON.stringify({
        response_id: randomResponseId(),
        sections: [{ view_model: { primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", payload: html, trusted_sources: [] }, __typename: "GenAISingleLayoutViewModel" } }],
      })).toString("base64") },
      contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: DEFAULT_BOT_JID }, forwardOrigin: 4, ...qCtx },
    } } },
  }
}

async function sendHtmlCard(sock, m, html, title, emoji = "✨", opts = {}) {
  try {
    await sock.relayMessage(m.chat, buildRichHtmlPayload(html, title, opts), {})
    try { await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) } catch {}
    return true
  } catch (err) {
    console.error(`[HTMLCARD:${title}] gagal kirim:`, err.message)
    await sock.sendMessage(m.chat, { text: "❌ Kartu gagal dikirim. Fitur ini butuh WhatsApp versi terbaru." }, { quoted: m })
    return false
  }
}

const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028|\u2029/g, "")
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

const BASE_CSS = String.raw`
:root{--bg:#0f1115;--card:#181b22;--card2:#20242d;--ink:#fff;--soft:#a3aab8;--line:#2b303b;--acc:#22c55e;--acc2:#16a34a;--warn:#f59e0b;--red:#ef4444;--blue:#3b82f6;--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
.app{width:100%;max-width:380px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(180deg,#232733 0%,#171a21 30%,var(--bg) 70%);box-shadow:0 18px 40px rgba(0,0,0,.55);padding:14px 12px 16px;}
.top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.logo{width:30px;height:30px;border-radius:9px;background:var(--acc);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px;}
.meta{min-width:0;flex:1;}
.title{font-size:14px;font-weight:800;}
.sub{font-size:10.5px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{flex:none;border:1px solid var(--line);background:var(--card);color:var(--soft);border-radius:20px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;}
.chip.on{background:var(--acc);border-color:var(--acc);color:#04130a;}
.btn{border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;cursor:pointer;background:var(--acc);color:#04130a;}
.btn.alt{background:var(--card2);color:var(--ink);border:1px solid var(--line);}
.btn.red{background:var(--red);color:#fff;}
.inp{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);font-size:14px;outline:none;font-family:var(--sys);}
.inp:focus{border-color:var(--acc);}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;}
.row{display:flex;gap:8px;align-items:center;}
.muted{color:var(--soft);font-size:11px;}
.hide{display:none!important;}
`;

module.exports = { buildRichHtmlPayload, sendHtmlCard, safeJson, escapeHtml, BASE_CSS }
    },
    "dquote": (module, exports, require) => {
// kutipan untuk kartu HTML: pakai pesan user apa adanya (header palsu bisnis tidak dipakai)
const quoteOf = (q) => { try { return q && q.key && q.message && q.chat ? q : null } catch { return null } }
module.exports = { quoteOf, apply: (o) => o, enabled: () => false }
    },
    "cards/musik": (module, exports, require) => {
const NB = () => String(global.namebot || 'Kaguya').replace(/[<>&'"`$\\]/g, '')
// Kartu HTML statis: Kaguya MUSIK (daftar lagu bisa di-scroll pakai tombol ▲ ▼, cari, pilih lagu).
// Semua data & gambar ditanam di HTML (data URI), tanpa fetch/jaringan. By PIX.
const { BASE_CSS, safeJson, escapeHtml } = require("../htmlcard");

const BODY = String.raw`
<style>
__BASECSS__
.app{padding:0;background:#10121a}
.bgl{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.5;pointer-events:none}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,12,18,.35) 0%,rgba(10,12,18,.82) 45%,#0b0d13 100%);pointer-events:none}
.in{position:relative;padding:14px 12px 14px}
.th{background-color:#2a2f3c;background-size:cover;background-position:center;background-image:__THUMB__}
.hd{display:flex;gap:11px;align-items:center;margin-bottom:12px}
.hd .th{width:58px;height:58px;border-radius:14px;flex:none;box-shadow:0 6px 16px rgba(0,0,0,.5);border:1px solid #ffffff22}
.hd .t1{font-size:17px;font-weight:900;letter-spacing:.3px}
.hd .t2{font-size:11px;color:var(--soft);margin-top:3px}
.pill{display:inline-block;margin-top:5px;background:#ffffff14;border:1px solid #ffffff1f;border-radius:20px;padding:2px 9px;font-size:10px;font-weight:700;color:#e8d9a8}
.selx{display:flex;gap:10px;align-items:center;background:#ffffff10;border:1px solid #ffffff1c;border-radius:14px;padding:9px;margin-bottom:10px;backdrop-filter:blur(6px)}
.nm{font-size:13px;font-weight:800;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ar{font-size:11px;color:var(--soft);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmd{margin-top:5px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#04130a;background:var(--acc);display:inline-block;border-radius:6px;padding:2px 8px;font-weight:800;cursor:pointer}
.srch{margin-bottom:8px;font-size:13px;padding:8px 12px}
.lw{display:flex;gap:8px;align-items:stretch}
.list{flex:1;min-width:0;height:276px;overflow-y:auto;scroll-behavior:smooth;scrollbar-width:none;border-radius:12px;background:#0b0d1388;border:1px solid #ffffff14}
.list::-webkit-scrollbar{display:none}
.it{display:flex;gap:10px;align-items:center;height:62px;padding:7px 9px;border-bottom:1px solid #ffffff0d;cursor:pointer}
.it.on{background:linear-gradient(90deg,#22c55e33,#22c55e08);box-shadow:inset 3px 0 0 var(--acc)}
.it .no{width:22px;flex:none;text-align:center;font-size:11px;font-weight:800;color:var(--soft)}
.it .th{width:44px;height:44px;border-radius:9px;flex:none}
.it .tx{min-width:0;flex:1}
.it .a{font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.it .b{font-size:10.5px;color:var(--soft);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav{width:42px;flex:none;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:space-between}
.nb{width:42px;height:42px;border-radius:12px;border:1px solid #ffffff26;background:#ffffff14;color:#fff;font-size:17px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center}
.nb:active{background:var(--acc);color:#04130a}
.nb[disabled]{opacity:.28;pointer-events:none}
.pos{flex:1;width:6px;border-radius:6px;background:#ffffff18;position:relative;margin:2px 0}
.pos i{position:absolute;left:0;right:0;top:0;height:30%;background:var(--acc);border-radius:6px;transition:top .15s}
.cnt{font-size:10.5px;color:var(--soft);text-align:center;margin-top:8px}
.empty{padding:26px 14px;text-align:center;color:var(--soft);font-size:12px;line-height:1.5}
.pl{background:#ffffff10;border:1px solid #ffffff1c;border-radius:14px;padding:10px;margin-bottom:10px;backdrop-filter:blur(6px)}
.pl .top2{display:flex;gap:10px;align-items:center}
.pl .th{width:54px;height:54px;border-radius:11px;flex:none}
.pl.go .th{animation:sp 6s linear infinite;border-radius:50%}
@keyframes sp{to{transform:rotate(360deg)}}
.seek{width:100%;margin:9px 0 2px;accent-color:#22c55e;height:18px}
.tm{display:flex;justify-content:space-between;font-size:10px;color:var(--soft)}
.ctl2{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:6px}
.cb{width:40px;height:40px;border-radius:50%;border:1px solid #ffffff26;background:#ffffff14;color:#fff;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.cb.big{width:52px;height:52px;background:var(--acc);color:#04130a;font-size:20px;border-color:var(--acc)}
.cb:active{transform:scale(.92)}
.vol{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:11px;color:var(--soft)}
.vol input{flex:1;accent-color:#22c55e}
.vol b{width:34px;text-align:right;color:#fff}
.eq{display:inline-flex;gap:2px;align-items:flex-end;height:11px;width:14px;flex:none}
.eq i{width:3px;background:var(--acc);border-radius:1px;animation:eq .8s ease-in-out infinite}
.eq i:nth-child(2){animation-delay:.2s}.eq i:nth-child(3){animation-delay:.4s}
@keyframes eq{0%,100%{height:3px}50%{height:11px}}
.it.lock{opacity:.5}
.it.lock .no:after{content:'🔒';font-size:9px;display:block}
.mode{display:flex;justify-content:center;gap:8px;margin-top:8px}
.mb{border:1px solid #ffffff26;background:#ffffff10;color:#cfd5e2;border-radius:16px;padding:4px 10px;font-size:11px;font-weight:800;cursor:pointer}
.mb.on{background:var(--acc);color:#04130a;border-color:var(--acc)}
.st{min-height:14px;text-align:center;font-size:10.5px;color:#e8d9a8;margin-top:6px}
.st.err{color:#fca5a5}
.it .hot{color:#f87171;font-size:11px;flex:none}
.it .dur{font-size:10px;color:var(--soft);flex:none}
.toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
</style>
<div class="stage"><div class="app">
 <div class="bgl" style="background-image:__BG__"></div><div class="shade"></div>
 <div class="in">
  <div class="hd"><div class="th"></div><div class="meta"><div class="t1">${NB().toUpperCase()} MUSIK</div><div class="t2" id="who"></div><span class="pill" id="tot"></span></div></div>
  <div class="pl" id="pl"><div class="top2"><div class="th"></div><div style="min-width:0;flex:1"><div class="nm" id="snm">Pilih lagu lalu tekan ▶</div><div class="ar" id="sar">Preview di kartu • lagu penuh dikirim sebagai audio</div></div></div>
   <input class="seek" id="seek" type="range" min="0" max="1000" value="0"><div class="tm"><span id="t1">0:00</span><span id="t2">0:00</span></div>
   <div class="ctl2"><button class="cb" id="pv" aria-label="Sebelumnya">⏮</button><button class="cb big" id="pp" aria-label="Putar">▶</button><button class="cb" id="nx" aria-label="Berikutnya">⏭</button></div>
   <div class="st" id="st"></div>
   <div class="mode"><button class="mb" id="shf">🔀 Acak</button><button class="mb" id="rpt">🔁 Ulang: mati</button><button class="mb" id="spd">⚡ 1x</button><button class="mb" id="onl">🎧 Preview saja</button></div>
   <div class="vol"><span>🔈</span><input id="vol" type="range" min="0" max="100" value="100"><span>🔊</span><b id="vp">100%</b></div>
   <span class="cmd hide" id="scmd"></span></div>
  <input class="inp srch" id="q" placeholder="Cari judul / artis...">
  <div class="lw">
   <div class="list" id="list"></div>
   <div class="nav"><button class="nb" id="up" aria-label="Naik">▲</button><div class="pos"><i id="bar"></i></div><button class="nb" id="dn" aria-label="Turun">▼</button></div>
  </div>
  <div class="cnt" id="cnt"></div>
  <div class="muted" style="text-align:center;margin-top:6px">Tekan lagu untuk memutar • ▲ ▼ untuk menggulir • 🔒 = ketik .musikbot &lt;no&gt; • ♥ = favoritmu • .dmp3 &lt;no&gt; kirim audio penuh</div>
 </div>
</div><div class="toast" id="toast"></div></div>
<script>var AUD=__AUD__;</script>
<script>
(function(){
var CFG=__CFG__,AUD_=AUD;
var $=function(i){return document.getElementById(i)};
$('who').textContent='Untuk: '+CFG.nama;
var nPlay=CFG.tracks.filter(function(t){return t.p}).length;
$('tot').textContent='♫ '+CFG.tracks.length+' lagu • '+nPlay+' preview di kartu';
var all=CFG.tracks.map(function(t,i){return {n:i+1,a:t.a,b:t.b,p:t.p,f:t.f,d:t.d}});
var shuffle=false,repeat=0,speeds=[1,1.25,1.5,0.75],spi=0,only=false,blobUrl=null,wd=null,q0='';
var view=all.slice(),cur=-1,loaded=-1,H=62,au=new Audio();au.preload='auto';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fmt(x){if(!isFinite(x))return '0:00';x=Math.floor(x);return Math.floor(x/60)+':'+('0'+(x%60)).slice(-2)}
function toast(s){var t=$('toast');t.textContent=s;t.classList.add('on');setTimeout(function(){t.classList.remove('on');},2000);}
function render(){
 var L=$('list');
 if(!view.length){L.innerHTML='<div class="empty">'+(all.length?'Tidak ada lagu yang cocok.':'Belum ada lagu terbaca dari Google Drive.<br>Pastikan folder dibagikan ke "Siapa saja yang memiliki link", lalu ketik <b>.musikbot refresh</b>.')+'</div>';upd();return;}
 L.innerHTML=view.map(function(t){var on=t.n-1===cur;return '<div class="it'+(on?' on':'')+(t.p?'':' lock')+'" data-n="'+t.n+'"><div class="no">'+(on&&!au.paused?'<span class="eq"><i></i><i></i><i></i></span>':t.n)+'</div><div class="th"></div><div class="tx"><div class="a">'+esc(t.a)+'</div><div class="b">'+esc(t.b)+'</div></div>'+(t.f?'<span class="hot">♥</span>':'')+(t.d?'<span class="dur">'+esc(t.d)+'</span>':'')+'</div>';}).join('');
 upd();
}
function upd(){
 var L=$('list'),max=L.scrollHeight-L.clientHeight,p=max>0?L.scrollTop/max:0;
 $('up').disabled=L.scrollTop<=2;$('dn').disabled=max<=2||L.scrollTop>=max-2;
 var f=Math.max(1,Math.min(view.length,Math.floor(L.scrollTop/H)+1)),l=Math.min(view.length,Math.ceil((L.scrollTop+L.clientHeight)/H));
 $('cnt').textContent=view.length?('Menampilkan '+f+'–'+l+' dari '+view.length):'';
 var bar=$('bar'),h=view.length?Math.min(100,Math.max(12,L.clientHeight/(view.length*H)*100)):100;bar.style.height=h+'%';bar.style.top=(p*(100-h))+'%';
}
function step(d){var L=$('list');L.scrollTop=L.scrollTop+d*H*3;setTimeout(upd,350);}
$('up').onclick=function(){step(-1)};$('dn').onclick=function(){step(1)};
$('list').addEventListener('scroll',upd);
document.addEventListener('keydown',function(e){if(e.target&&e.target.id==='q')return;if(e.key==='ArrowDown'){e.preventDefault();step(1);}if(e.key==='ArrowUp'){e.preventDefault();step(-1);}if((e.key==='ArrowRight'||e.key==='ArrowLeft')&&au.duration){au.currentTime=Math.max(0,Math.min(au.duration,au.currentTime+(e.key==='ArrowRight'?5:-5)));}if(e.key===' '&&cur>=0){e.preventDefault();toggle();}});
function setUi(){var on=!au.paused&&!au.error;$('pp').textContent=on?'⏸':'▶';$('pl').classList.toggle('go',on);render();}
function stat(x,err){var e=$('st');e.textContent=x||'';e.classList.toggle('err',!!err);}
function srcOf(i){
 var d=AUD_[String(i)];
 try{var k=d.indexOf(','),bin=atob(d.slice(k+1)),u=new Uint8Array(bin.length);for(var j=0;j<bin.length;j++)u[j]=bin.charCodeAt(j);
  if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(new Blob([u],{type:'audio/mpeg'}));return blobUrl;}catch(x){return d;}
}
function play(i,tryData){
 var t=CFG.tracks[i];if(!t)return;
 if(!t.p){var c=$('scmd');c.textContent=CFG.prefix+'musikbot '+(i+1);c.classList.remove('hide');$('snm').textContent=t.a;$('sar').textContent=t.b;stat('Lagu ini belum punya preview di kartu',1);toast('Ketik '+c.textContent+' untuk menerima lagunya sebagai audio');return;}
 $('scmd').classList.add('hide');cur=i;$('snm').textContent=t.a;$('sar').textContent=t.b;
 clearTimeout(wd);stat('Memuat preview...');
 au.src=tryData?AUD_[String(i)]:srcOf(i);loaded=i;au.volume=$('vol').value/100;au.playbackRate=speeds[spi];
 // pengawal: bila 5 detik belum ada suara, coba cara lain (data URI), lalu beri tahu pemakai dengan jelas
 wd=setTimeout(function(){if(loaded!==i)return;if(!au.duration||au.currentTime===0&&au.paused===false&&au.readyState<3){
   if(!tryData){play(i,true);return;}
   try{au.pause();}catch(x){}setUi();stat('Pemutar kartu tidak didukung di perangkat ini. Ketik '+CFG.prefix+'dmp3 '+(i+1)+' untuk menerima audionya',1);}},5000);
 var pr=au.play();if(pr&&pr.catch)pr.catch(function(){if(!tryData){play(i,true);return;}stat('Audio tidak bisa diputar. Ketik '+CFG.prefix+'dmp3 '+(i+1)+' untuk audionya',1);setUi();});
 setUi();
}
function nextIdx(d){
 var n=CFG.tracks.length,ok=[],j;for(j=0;j<n;j++)if(CFG.tracks[j].p)ok.push(j);if(!ok.length)return -1;
 if(shuffle&&ok.length>1){var r;do{r=ok[Math.floor(Math.random()*ok.length)];}while(r===cur);return r;}
 var k=cur<0?(d>0?-1:0):cur;for(j=1;j<=n;j++){var x=((k+d*j)%n+n)%n;if(CFG.tracks[x].p)return x;}return -1;
}
function toggle(){if(cur<0||loaded!==cur){var f=(cur>=0&&CFG.tracks[cur].p)?cur:nextIdx(1);if(f>=0)play(f);else toast('Belum ada lagu siap putar');return;}if(au.paused){var pr=au.play();if(pr&&pr.catch)pr.catch(function(){});}else au.pause();}
$('pp').onclick=toggle;
$('nx').onclick=function(){var x=nextIdx(1);if(x>=0)play(x);};
$('pv').onclick=function(){if(au.currentTime>4){au.currentTime=0;return;}var x=nextIdx(-1);if(x>=0)play(x);};
au.addEventListener('play',setUi);au.addEventListener('pause',setUi);au.addEventListener('playing',function(){clearTimeout(wd);stat('');setUi();});au.addEventListener('waiting',function(){stat('Memuat...');});au.addEventListener('loadedmetadata',function(){$('t2').textContent=fmt(au.duration);});
au.addEventListener('ended',function(){if(repeat===2){au.currentTime=0;au.play();return;}var x=nextIdx(1);if(repeat===0&&!shuffle&&x<=cur&&x>=0){setUi();stat('Playlist selesai');return;}if(x>=0)play(x);});
au.addEventListener('error',function(){if(loaded>=0&&au.src.indexOf('blob:')===0){play(loaded,true);return;}clearTimeout(wd);stat('Audio gagal dimuat. Ketik '+CFG.prefix+'dmp3 '+(loaded+1)+' untuk menerima audionya',1);setUi();});
var seeking=false;
au.addEventListener('timeupdate',function(){if(!seeking&&au.duration)$('seek').value=Math.round(au.currentTime/au.duration*1000);$('t1').textContent=fmt(au.currentTime);$('t2').textContent=fmt(au.duration);});
$('seek').addEventListener('input',function(){seeking=true;if(au.duration)$('t1').textContent=fmt(this.value/1000*au.duration);});
$('seek').addEventListener('change',function(){if(au.duration)au.currentTime=this.value/1000*au.duration;seeking=false;});
$('vol').addEventListener('input',function(){au.volume=this.value/100;$('vp').textContent=this.value+'%';});
function applyView(){var s=q0;view=all.filter(function(t){return (!only||t.p)&&(!s||(t.a+' '+t.b).toLowerCase().indexOf(s)>=0);});$('list').scrollTop=0;render();}
$('shf').onclick=function(){shuffle=!shuffle;this.classList.toggle('on',shuffle);toast(shuffle?'Acak: nyala':'Acak: mati');};
$('rpt').onclick=function(){repeat=(repeat+1)%3;this.textContent=['🔁 Ulang: mati','🔁 Ulang: semua','🔂 Ulang: satu'][repeat];this.classList.toggle('on',repeat>0);};
$('spd').onclick=function(){spi=(spi+1)%speeds.length;au.playbackRate=speeds[spi];this.textContent='⚡ '+speeds[spi]+'x';this.classList.toggle('on',spi>0);};
$('onl').onclick=function(){only=!only;this.classList.toggle('on',only);applyView();};
$('scmd').onclick=function(){var s=this.textContent;try{navigator.clipboard.writeText(s).then(function(){toast('Disalin: '+s)},function(){toast('Ketik: '+s)});}catch(x){toast('Ketik: '+s);}};
$('list').addEventListener('click',function(e){var el=e.target;while(el&&el!==this&&!(el.dataset&&el.dataset.n))el=el.parentNode;if(!el||el===this)return;var i=+el.dataset.n-1;if(i===cur&&CFG.tracks[i].p){toggle();return;}play(i);});
$('q').addEventListener('input',function(){q0=this.value.trim().toLowerCase();applyView();});
var first=CFG.start>=0?CFG.start:-1;if(first>=0){cur=first;$('snm').textContent=CFG.tracks[first].a;$('sar').textContent=CFG.tracks[first].b;}
render();
})();
</script>
`;

function buildMusikHtml({ playerName = "Kamu", tracks = [], prefix = ".", thumbUri = null, bgUri = null, audio = new Map(), start = -1, favIds = [] } = {}) {
  const fav = new Set(favIds), data = tracks.map((t, i) => ({ a: t.title, b: t.artist, p: audio.has(i) ? 1 : 0, f: fav.has(t.id) ? 1 : 0, d: t.dur || "" }));
  const aud = {};
  for (const [i, b64] of audio) aud[i] = "data:audio/mpeg;base64," + b64;
  const css = (u) => (u ? `url('${u}')` : "linear-gradient(135deg,#3a3f52,#1b1e29)");
  return BODY
    .replace("__BASECSS__", () => BASE_CSS)
    .replace("__THUMB__", () => css(thumbUri))
    .replace("__BG__", () => css(bgUri))
    .replace("__AUD__", () => safeJson(aud))
    .replace("__CFG__", () => safeJson({ nama: String(playerName), prefix: String(prefix), start, tracks: data }));
}

module.exports = { buildMusikHtml, escapeHtml };
    },
    style: (module) => {
        const B = (t) => String(t ?? '').replace(/[A-Za-z0-9]/g, (c) => {
            const k = c.charCodeAt(0)
            return String.fromCodePoint(k >= 97 ? 0x1D41A + k - 97 : k >= 65 ? 0x1D400 + k - 65 : 0x1D7CE + k - 48)
        })
        const plain = (t) => String(t ?? '').normalize('NFKC').replace(/[\u{13000}-\u{1342F}]/gu, '').replace(/\s+/g, ' ').trim()
        const cut = (t, n) => { const a = Array.from(String(t ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('') }
        module.exports = { B, plain, cut, fx: (t) => t, ancientize: (t) => t, content: (c) => c, on: () => false }
    },
}

dioRegister("rich/musikbot", feature, libs)

let handler = (m, ctx) => dioRun("rich/musikbot", m, ctx)

handler.command = ['musikbot']
handler.help = ['musikbot']
handler.tags = ['rich']

export default handler
