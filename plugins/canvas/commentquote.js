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
import axios from 'axios'
import { fileURLToPath } from 'node:url'
import { reactTo } from '../../lib/core/file.js'

const FONT_REG = fileURLToPath(new URL('../../lib/store/fonts/Inter-Regular.ttf', import.meta.url))
const FONT_BOLD = fileURLToPath(new URL('../../lib/store/fonts/Inter-Bold.ttf', import.meta.url))

const FF = 'QuoteFont, Roboto, Arial, sans-serif'
const f4 = `400 24px ${FF}`, f2 = `400 20.4px ${FF}`, fb = `700 20.4px ${FF}`, f1 = `400 19.2px ${FF}`
const K = { st: '#000090', bg: '#000066', bd: '#4169e1', bb: '#2640cf' }

// bendera yang digambar manual (selain itu diambil dari flagcdn.com)
const NF = {
  PL: 'h,#fff,#dc143c',
  RU: 'h,#fff,#0039a6,#d52b1e',
  NL: 'h,#ae1c28,#fff,#21468b',
  DE: 'h,#000,#dd0000,#ffce00',
  AT: 'h,#ed2939,#fff,#ed2939',
  HU: 'h,#cd2a3e,#fff,#436f4d',
  UA: 'h,#0057b8,#ffd700',
  FR: 'v,#0055a4,#fff,#ef4135',
  IT: 'v,#009246,#fff,#ce2b37',
  IE: 'v,#169b62,#fff,#ff883e',
  BE: 'v,#000,#fae042,#ed2939',
  RO: 'v,#002b7f,#fcd116,#ce1126'
}
const DRAWN = new Set(['ID', ...Object.keys(NF)])

const TP_PATH = 'M104 224H24c-13.255 0-24 10.745-24 24v240c0 13.255 10.745 24 24 24h80c13.255 0 24-10.745 24-24V248c0-13.255-10.745-24-24-24zM64 472c-13.255 0-24-10.745-24-24s10.745-24 24-24 24 10.745 24 24-10.745 24-24 24zM384 81.452c0 42.416-25.97 66.208-33.277 94.548h101.723c33.397 0 59.397 27.746 59.553 58.098.084 17.938-7.546 37.249-19.439 49.197l-.11.11c9.836 23.337 8.237 56.037-9.308 79.469 8.681 25.895-.069 57.704-16.382 74.757 4.298 17.598 2.244 32.575-6.148 44.632C440.202 511.587 389.616 512 346.839 512l-2.845-.001c-48.287-.017-87.806-17.598-119.56-31.725-15.957-7.099-36.821-15.887-52.651-16.178-6.54-.12-11.783-5.457-11.783-11.998v-213.77c0-3.2 1.282-6.271 3.558-8.521 39.614-39.144 56.648-80.587 89.117-113.111 14.804-14.832 20.188-37.236 25.393-58.902C282.515 39.293 291.817 0 312 0c24 0 72 8 72 81.452z'

let C = null     // { createCanvas, loadImage, GlobalFonts, Path2D }
let TP = null    // ikon jempol
let fontsReady = false

async function loadCanvas() {
  if (C) return C
  const lib = await import('@napi-rs/canvas')
  const L = lib.default ?? lib
  C = { createCanvas: L.createCanvas, loadImage: L.loadImage, GlobalFonts: L.GlobalFonts, Path2D: L.Path2D }
  TP = new C.Path2D(TP_PATH)
  if (!fontsReady) {
    try { C.GlobalFonts.registerFromPath(FONT_REG, 'QuoteFont') } catch {}
    try { C.GlobalFonts.registerFromPath(FONT_BOLD, 'QuoteFont') } catch {}
    fontsReady = true
  }
  return C
}

const flagCache = {}
async function getFlagImage(code) {
  const c = code.toUpperCase()
  if (flagCache[c] !== undefined) return flagCache[c]
  try {
    const res = await axios.get(`https://flagcdn.com/w160/${c.toLowerCase()}.png`, { responseType: 'arraybuffer', timeout: 5000 })
    flagCache[c] = await C.loadImage(Buffer.from(res.data))
  } catch {
    flagCache[c] = null
  }
  return flagCache[c]
}

const cn = (n) => Math.max(0, Math.floor(+n) || 0)
const fd = (v) => {
  let d = new Date(v)
  if (isNaN(d.getTime())) d = new Date()
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    .replace(/[\u202f\u00a0]/g, ' ')
}

const mw = (g, t, f) => { g.font = f; return g.measureText(t).width }

function T(g, t, x, y, f, a) {
  g.font = f
  g.textAlign = a || 'left'
  g.fillStyle = '#fff'
  g.fillText(t, x, y)
}

function icon(g, x, y, dn) {
  g.save()
  g.translate(x, dn ? y + 28 : y)
  g.scale(28 / 512, dn ? -28 / 512 : 28 / 512)
  g.fillStyle = '#fff'
  g.fill(TP)
  g.restore()
}

function drawFlag(g, c, x, hb, flagImg) {
  const y = hb - 15.3, w = 24, h = 19.3, n = NF[c]
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  if (c === 'ID') {
    g.fillStyle = '#f40439'
    g.fillRect(x, y, w, h)
    g.fillStyle = '#fff'
    g.fillRect(x, hb - 4.5, w, h)
  } else if (n) {
    const [d, ...k] = n.split(',')
    k.forEach((o, i) => {
      g.fillStyle = o
      if (d === 'h') g.fillRect(x, y + (h * i) / k.length, w, h / k.length + 1)
      else g.fillRect(x + (w * i) / k.length, y, w / k.length + 1, h)
    })
  } else if (flagImg) {
    g.drawImage(flagImg, x, y, w, h)
  } else {
    g.fillStyle = '#555'
    g.fillRect(x, y, w, h)
  }
  g.restore()
}

function wrap(g, t, mx) {
  g.font = f4
  const m = (s) => g.measureText(s).width, o = []
  for (const p of String(t).split('\n')) {
    let l = ''
    for (let w of p.split(' ')) {
      const c = l ? l + ' ' + w : w
      if (m(c) <= mx) { l = c; continue }
      if (l) { o.push(l); l = '' }
      while (m(w) > mx && w.length > 1) {
        let k = w.length - 1
        while (k > 1 && m(w.slice(0, k)) > mx) k--
        o.push(w.slice(0, k))
        w = w.slice(k)
      }
      l = w
    }
    o.push(l)
  }
  return o
}

function blk(g, d, x0, xr, hb, lk, dr, flagImg) {
  if (dr) {
    drawFlag(g, d.c, x0 + 1.5, hb, flagImg)
    T(g, d.n, x0 + 32, hb, fb)
    T(g, fd(d.d), xr, hb, f2, 'right')
  }
  const q = wrap(g, d.t, xr - x0)
  const ab = hb + 46 + (q.length - 1) * 28.1 + 45
  if (dr) {
    q.forEach((s, i) => T(g, s, x0, hb + 46 + i * 28.1, f4))
    const a = cn(d.l), b = cn(d.u)
    let x = x0 + 17.5
    icon(g, x, ab - 20.5, 0)
    T(g, a ? '' + a : '', x + 36, ab, fb)
    x += 36 + mw(g, a ? '' + a : '0', fb) + 40.4
    icon(g, x, ab - 18.5, 1)
    T(g, b ? '' + b : '', x + 35, ab, fb)
    x += 35 + mw(g, b ? '' + b : '0', fb) + 31
    lk.forEach((k) => { T(g, k, x, ab, f2); x += mw(g, k, f2) + 31 })
  }
  return ab
}

function lay(g, dr, bot, data, flags) {
  const {
    mode = 'N', name = 'User', country = 'ID', text = '', like = 0, unlike = 0,
    date = new Date(), hideReplies = false, replyCount = 1, replies = []
  } = data
  const rs = mode === 'R' ? replies : []
  const t0 = 16, hb = t0 + 26

  if (dr) {
    const H = bot + 17
    g.fillStyle = K.st; g.fillRect(0, 0, 720, H)
    g.fillStyle = K.bg; g.fillRect(12, 0, 696, H)
    g.fillStyle = K.bd; g.fillRect(36, t0, 648, bot - t0 + 1)
    g.fillStyle = K.st; g.fillRect(37, t0 + 1, 646, bot - t0 - 1)
  }

  const m = { n: name, c: country.toUpperCase(), t: text, l: like, u: unlike, d: date }
  const ab = blk(g, m, 49, 671, hb, rs.length ? ['Report'] : ['Reply', 'Report'], dr, flags[m.c])

  if (!rs.length) {
    if (mode === 'N' && !hideReplies) {
      const n = Math.max(1, cn(replyCount))
      const sb = ab + 62
      if (dr) T(g, n === 1 ? 'Show 1 reply' : `Show ${n} replies`, 49, sb, f1)
      return Math.round(sb + 30)
    }
    return Math.round(ab + 17)
  }

  const hy = ab + 62
  if (dr) T(g, 'Hide replies', 49, hy, f1)
  let y = hy + 30, la = 0
  const y1 = Math.round(y)
  rs.forEach((r) => {
    const rc = (r.c || 'ID').toUpperCase()
    la = blk(g, { ...r, c: rc }, 96.5, 659, y + 25, ['Report'], dr, flags[rc])
    y = la + 29
  })
  const bt = Math.round(la + 41)
  if (dr) {
    g.fillStyle = K.bd; g.fillRect(83, y1, 1, Math.round(la + 17) - y1)
    g.fillStyle = K.bb; g.fillRect(49, bt, 79, 40)
    g.fillStyle = K.st; g.fillRect(50, bt + 1, 77, 38)
    T(g, 'Reply', 63.1, bt + 25, f2)
  }
  return bt + 50
}

async function renderCommentQuote(options = {}) {
  await loadCanvas()

  const countries = [options.country || 'ID']
  if (Array.isArray(options.replies)) options.replies.forEach((r) => { if (r.c) countries.push(r.c) })

  const flags = {}
  for (const c of countries) {
    const uc = c.toUpperCase()
    if (!DRAWN.has(uc)) flags[uc] = await getFlagImage(uc)
  }

  const s = options.scale || 1
  const tmp = C.createCanvas(720, 1000)
  const bot = lay(tmp.getContext('2d'), false, 0, options, flags)

  const canvas = C.createCanvas(Math.round(720 * s), Math.round((bot + 17) * s))
  const ctx = canvas.getContext('2d')
  ctx.setTransform(s, 0, 0, s, 0, 0)
  lay(ctx, true, bot, options, flags)

  return canvas.toBuffer('image/png')
}

let handler = async (m, { sock, text, reply, prefix, usedPrefix, command }) => {
  const p = usedPrefix ?? prefix ?? '.'
  const raw = String(text || '').trim()
  const parts = raw.split('|').map((s) => s.trim())

  // teks: argumen pertama, atau isi pesan yang di-reply
  let quote = parts[0] || ''
  if (!quote && m.quoted) quote = String(m.quoted.text || m.quoted.body || m.quoted.caption || '').trim()

  if (!quote) {
    return reply(
      `💬 *COMMENT QUOTE CARD*\n\n` +
      `${p}${command || 'commentquote'} teks | nama | negara | like | unlike\n\n` +
      `Contoh:\n${p}${command || 'commentquote'} Jangan takut gagal | Yann | ID | 999 | 0\n\n` +
      `Hanya teks yang wajib diisi. Negara = kode 2 huruf (ID, US, JP, ...). Bisa juga reply pesan teks.`
    )
  }
  if (quote.length > 500) return reply('❌ Teks terlalu panjang (maksimal 500 karakter).')

  const name = (parts[1] || m.pushName || 'User').slice(0, 30)
  const country = /^[a-z]{2}$/i.test(parts[2] || '') ? parts[2].toUpperCase() : 'ID'
  const like = Math.min(cn(parts[3]) || (parts[3] === '0' ? 0 : 999), 999999999)
  const unlike = Math.min(cn(parts[4]), 999999999)

  await reactTo(sock, m, '🕒')
  try {
    const png = await renderCommentQuote({ name, country, text: quote, like, unlike })
    await sock.sendMessage(m.chat, { image: png, caption: '💬 Comment Quote Card' }, { quoted: m })
    return reactTo(sock, m, '✅')
  } catch (e) {
    console.error('[commentquote]', e?.message || e)
    await reactTo(sock, m, '❌')
    if (/Cannot find (module|package)/i.test(e?.message || '')) return reply('❌ Fitur ini butuh @napi-rs/canvas, belum terpasang di server.')
    return reply(`❌ Gagal membuat gambar: ${e?.message || 'terjadi kesalahan'}`)
  }
}

handler.command = ['commentquote']
handler.subs = ['cquote']
handler.help = ['commentquote teks | nama | negara']
handler.tags = ['canvas']
handler.limit = true

export default handler
