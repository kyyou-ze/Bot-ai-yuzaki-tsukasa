import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// ───────── iqcwin ─────────
// Meme "Windows Media Player" (XP Luna): teks tebal di kiri + tokoh 3D yang pusing di kanan.
//   .iqcwin <teks>                  -> teks jadi huruf besar di jendela WMP
//   kirim/reply foto + .iqcwin <teks> -> foto menggantikan tokoh 3D di kanan
//   reply pesan + .iqcwin           -> teks diambil dari pesan yang di-reply
// Semua digambar lokal pakai canvas (tanpa API luar).

const FONT_DIR = fileURLToPath(new URL('../../lib/store/fonts/', import.meta.url))
const FIGURE_B64 = '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'

const W = 1080, H = 1177
const TITLE_H = 106, MENU_Y = 106, MENU_H = 76, BAND_Y = 183, BAND_H = 40
const CONT_Y = 224, CONT_B = 952, STATUS_B = 1006, CTRL_B = 1150
const SIDE = 8

const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
const vg = (ctx, y0, y1, stops) => {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  for (const [o, c] of stops) g.addColorStop(o, c)
  return g
}

let figurePromise = null

let handler = async (m, { sock, text, reply, prefix, usedPrefix }) => {
  const p = usedPrefix ?? prefix ?? '.'
  const raw = String(text || '').trim()
  const message = (raw || m.quoted?.text || m.quoted?.caption || '').replace(/\s+/g, ' ').trim()

  if (!message) {
    return reply(
      `🪟 *IQC WINDOWS (Media Player)*\n\n` +
      `Meme jendela Windows Media Player XP.\n\n` +
      `• ${p}iqcwin <teks>\n` +
      `• kirim/reply foto + ${p}iqcwin <teks> → foto ganti tokoh 3D\n` +
      `• reply pesan + ${p}iqcwin → teks dari pesan itu\n\n` +
      `Contoh: ${p}iqcwin padahal cuma std kirian`
    )
  }
  if (message.length > 120) return reply('❌ Teks terlalu panjang (maksimal 120 huruf).')

  let canvasLib
  try { canvasLib = await import('@napi-rs/canvas') } catch {
    return reply('❌ Fitur ini butuh @napi-rs/canvas, belum terpasang di server.')
  }
  const { createCanvas, loadImage, GlobalFonts } = canvasLib.default ?? canvasLib

  try {
    for (const f of ['Inter-Medium', 'Inter-SemiBold', 'Inter-Bold']) {
      try { if (fs.existsSync(`${FONT_DIR}${f}.ttf`)) GlobalFonts.registerFromPath(`${FONT_DIR}${f}.ttf`, 'IqcWin') } catch {}
    }
    const UI = '"Tahoma", "Segoe UI", "IqcWin", sans-serif'
    const TITLE = '"Trebuchet MS", "Tahoma", "IqcWin", sans-serif'
    const BIG = '"IqcWin", "Montserrat", "Poppins", "Arial Black", sans-serif'

    // gambar kanan: foto user (kalau ada) atau tokoh 3D bawaan
    let userImg = null
    try {
      let buf = null
      if (m.quoted && /image/i.test(String(m.quoted.mtype || '')) && typeof m.quoted.download === 'function') buf = await m.quoted.download()
      else if (/image/i.test(String(m.mtype || '')) && typeof m.download === 'function') buf = await m.download()
      if (buf?.length) userImg = await loadImage(buf)
    } catch {}
    if (!userImg) {
      figurePromise ||= loadImage(Buffer.from(FIGURE_B64, 'base64')).catch(() => null)
    }
    const figure = userImg || await figurePromise

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // ═════════ frame jendela (biru Luna) ═════════
    ctx.fillStyle = vg(ctx, 0, H, [[0, '#0a5be8'], [0.1, '#0654e0'], [0.9, '#0a3cc4'], [1, '#0830a8']])
    rr(ctx, 0, 0, W, H, 26); ctx.fill()

    // title bar
    ctx.save(); rr(ctx, 0, 0, W, H, 26); ctx.clip()
    ctx.fillStyle = vg(ctx, 0, TITLE_H, [[0, '#3a8cf0'], [0.06, '#1d6bf0'], [0.2, '#0a5ce8'], [0.6, '#0652e0'], [0.9, '#0a4ad4'], [1, '#0a46cc']])
    ctx.fillRect(0, 0, W, TITLE_H)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(0, 2, W, 3)
    ctx.restore()

    // ikon WMP
    const ic = { x: 40, y: 56 }
    const og = ctx.createRadialGradient(ic.x - 6, ic.y - 8, 2, ic.x, ic.y, 26)
    og.addColorStop(0, '#ffd27a'); og.addColorStop(0.55, '#f08a1c'); og.addColorStop(1, '#b35400')
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(ic.x, ic.y, 25, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ic.x, ic.y, 22, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#1b2a6b'; ctx.beginPath(); ctx.moveTo(ic.x - 7, ic.y - 11); ctx.lineTo(ic.x + 13, ic.y); ctx.lineTo(ic.x - 7, ic.y + 11); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#e8fff0'; ctx.beginPath(); ctx.moveTo(ic.x - 3, ic.y - 6); ctx.lineTo(ic.x + 7, ic.y); ctx.lineTo(ic.x - 3, ic.y + 6); ctx.closePath(); ctx.fill()

    // judul
    ctx.font = `700 46px ${TITLE}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,20,100,0.65)'; ctx.fillText('Windows Media Player', 80 + 3, 62 + 3)
    ctx.fillStyle = '#ffffff'; ctx.fillText('Windows Media Player', 80, 62)

    // tombol min / max / close
    const winBtn = (x, kind) => {
      const y = 26, w = 72, h = 68
      ctx.save()
      ctx.shadowColor = 'rgba(0,20,120,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2
      ctx.fillStyle = kind === 'x'
        ? vg(ctx, y, y + h, [[0, '#f2a58a'], [0.5, '#d9573a'], [1, '#c23c20']])
        : vg(ctx, y, y + h, [[0, '#7fb2ff'], [0.5, '#2e6fe6'], [1, '#1a56cf']])
      rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.restore()
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; rr(ctx, x + 2, y + 2, w - 4, h - 4, 9); ctx.stroke()
      ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineCap = 'butt'
      if (kind === 'min') ctx.fillRect(x + 17, y + h - 25, 22, 11)
      if (kind === 'max') { ctx.lineWidth = 4; ctx.strokeRect(x + 17, y + 17, w - 34, h - 36); ctx.fillRect(x + 17, y + 17, w - 34, 10) }
      if (kind === 'x') { ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 22, y + 20); ctx.lineTo(x + w - 22, y + h - 20); ctx.moveTo(x + w - 22, y + 20); ctx.lineTo(x + 22, y + h - 20); ctx.stroke() }
    }
    winBtn(836, 'min'); winBtn(920, 'max'); winBtn(996, 'x')

    // ═════════ menu bar ═════════
    ctx.fillStyle = vg(ctx, MENU_Y, MENU_Y + MENU_H, [[0, '#f3f2ee'], [1, '#e9e8e2']])
    ctx.fillRect(SIDE, MENU_Y, W - SIDE * 2, MENU_H)
    ctx.font = `400 36px ${UI}`; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111111'
    for (const [label, x] of [['File', 22], ['View', 120], ['Play', 240], ['Tools', 356], ['Help', 486]]) {
      ctx.fillText(label, x, MENU_Y + 36)
      const fw = ctx.measureText(label[0]).width
      ctx.fillRect(x, MENU_Y + 58, fw, 3) // garis bawah huruf pertama
    }

    // ═════════ band seek ═════════
    ctx.fillStyle = vg(ctx, BAND_Y, BAND_Y + BAND_H, [[0, '#f4f4f6'], [0.35, '#c4c5d8'], [1, '#8c8aa8']])
    ctx.fillRect(SIDE, BAND_Y, 710, BAND_H)
    ctx.fillStyle = vg(ctx, BAND_Y, BAND_Y + BAND_H, [[0, '#7d92d2'], [1, '#5f78c2']])
    ctx.fillRect(718, BAND_Y, W - SIDE - 718, BAND_H)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillRect(822, BAND_Y + 10, 20, 14); ctx.fillRect(906, BAND_Y + 16, 14, 10); ctx.fillRect(990, BAND_Y + 10, 22, 16)

    // ═════════ area konten putih ═════════
    ctx.fillStyle = '#ffffff'; ctx.fillRect(SIDE, CONT_Y, W - SIDE * 2, CONT_B - CONT_Y)
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(SIDE, CONT_B - 2, W - SIDE * 2, 3)
    ctx.fillStyle = '#9a9bc3'; ctx.fillRect(SIDE - 1, CONT_Y, 2, CONT_B - CONT_Y); ctx.fillRect(W - SIDE - 1, CONT_Y, 2, CONT_B - CONT_Y)

    // gambar kanan
    const BOX = { x: 700, y: 330, w: 340, h: 600 }
    if (figure) {
      const sc = Math.min(BOX.w / figure.width, BOX.h / figure.height)
      const dw = Math.round(figure.width * sc), dh = Math.round(figure.height * sc)
      const dx = BOX.x + Math.round((BOX.w - dw) / 2), dy = BOX.y + (BOX.h - dh)
      ctx.save()
      if (userImg) { rr(ctx, dx, dy, dw, dh, 14); ctx.clip() }
      ctx.drawImage(figure, dx, dy, dw, dh)
      ctx.restore()
      if (!userImg) { // lunturkan pinggir crop supaya menyatu dengan latar putih
        for (const [x0, y0, x1, y1] of [[dx, 0, dx + 40, 0], [dx + dw, 0, dx + dw - 40, 0]]) {
          const g = ctx.createLinearGradient(x0, y0, x1, y1)
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), dy, 40, dh)
        }
        let g = ctx.createLinearGradient(0, dy, 0, dy + 40); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g; ctx.fillRect(dx, dy, dw, 40)
        g = ctx.createLinearGradient(0, dy + dh, 0, dy + dh - 40); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g; ctx.fillRect(dx, dy + dh - 40, dw, 40)
      }
    }

    // teks utama: huruf besar tebal, rata kiri, rata tengah vertikal
    const TX = 70, TW = 600, TH = CONT_B - CONT_Y - 140
    const up = message.toUpperCase()
    let size = 72, lines = []
    const wrapAt = (sz) => {
      ctx.font = `700 ${sz}px ${BIG}`
      const out = []; let line = ''
      for (const w of up.split(' ')) {
        let word = w
        while (ctx.measureText(word).width > TW) { // kata kepanjangan dipotong
          let i = word.length - 1
          while (i > 1 && ctx.measureText(word.slice(0, i)).width > TW) i--
          if (line) { out.push(line); line = '' }
          out.push(word.slice(0, i)); word = word.slice(i)
        }
        const t = line ? `${line} ${word}` : word
        if (ctx.measureText(t).width <= TW || !line) line = t
        else { out.push(line); line = word }
      }
      if (line) out.push(line)
      return out
    }
    for (; size >= 26; size -= 2) { lines = wrapAt(size); if (lines.length * size * 1.28 <= TH) break }
    const LH = size * 1.28
    ctx.font = `700 ${size}px ${BIG}`; ctx.fillStyle = '#0b0b25'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    const cy = (CONT_Y + CONT_B) / 2 + 2
    const y0 = cy - ((lines.length - 1) * LH) / 2
    ctx.strokeStyle = '#0b0b25'; ctx.lineWidth = Math.max(1.5, size * 0.035); ctx.lineJoin = 'round'
    lines.forEach((l, i) => { ctx.strokeText(l, TX, y0 + i * LH); ctx.fillText(l, TX, y0 + i * LH) })

    // ═════════ status "Ready" ═════════
    ctx.fillStyle = '#ffffff'; ctx.fillRect(SIDE, CONT_B + 1, W - SIDE * 2, STATUS_B - CONT_B)
    ctx.fillStyle = '#4a4a5a'; ctx.font = `500 38px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('Ready', 208, 984)

    // ═════════ panel kontrol ═════════
    ctx.fillStyle = vg(ctx, STATUS_B, CTRL_B, [[0, '#a4c2f8'], [0.12, '#7c9ee0'], [0.45, '#6685c8'], [0.75, '#5c6dba'], [1, '#4a53a2']])
    ctx.fillRect(SIDE, STATUS_B, W - SIDE * 2, CTRL_B - STATUS_B)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(SIDE, STATUS_B, W - SIDE * 2, 3)

    // track seek + jempol hijau
    ctx.fillStyle = '#7e9fd8'; rr(ctx, 190, 1042, 850, 8, 4); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(190, 1050, 850, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    for (const [tip, base] of [[190, 202], [1032, 1020]]) { ctx.beginPath(); ctx.moveTo(tip, 1046); ctx.lineTo(base, 1040); ctx.lineTo(base, 1052); ctx.closePath(); ctx.fill() }
    const thumb = (x, y, w, h) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,40,0.35)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2
      ctx.fillStyle = vg(ctx, y, y + h, [[0, '#f4f8fa'], [0.6, '#dfe9ee'], [1, '#5fd37e']])
      rr(ctx, x, y, w, h, 7); ctx.fill(); ctx.restore()
      ctx.strokeStyle = '#9bb0c8'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 7); ctx.stroke()
    }
    thumb(238, 1022, 28, 48)

    // tombol putar besar
    const pg = ctx.createRadialGradient(62, 1066, 4, 70, 1085, 56)
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.7, '#e4e8f6'); pg.addColorStop(1, '#9fa9d0')
    ctx.save(); ctx.shadowColor = 'rgba(0,0,60,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(70, 1085, 48, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(70, 1085, 45, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = '#1c2f88'; ctx.beginPath(); ctx.moveTo(58, 1066); ctx.lineTo(90, 1085); ctx.lineTo(58, 1104); ctx.closePath(); ctx.fill()

    // tombol stop kecil (oval)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,60,0.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2
    ctx.fillStyle = vg(ctx, 1068, 1128, [[0, '#ffffff'], [1, '#aeb6d8']])
    ctx.beginPath(); ctx.ellipse(160, 1098, 25, 33, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    ctx.fillStyle = '#7f89b4'; ctx.fillRect(151, 1090, 18, 18)

    // pill prev / next / mute
    const pill = (cx, cy, w, h, draw) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,60,0.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3
      ctx.fillStyle = vg(ctx, cy - h / 2, cy + h / 2, [[0, '#ffffff'], [0.55, '#dfe4f4'], [1, '#9aa5cf']])
      rr(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fill(); ctx.restore()
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; rr(ctx, cx - w / 2 + 1, cy - h / 2 + 1, w - 2, h - 2, h / 2); ctx.stroke()
      ctx.fillStyle = '#6a76a8'; draw(cx, cy)
    }
    pill(240, 1114, 66, 40, (cx, cy) => { ctx.fillRect(cx - 14, cy - 8, 3, 16); ctx.beginPath(); ctx.moveTo(cx + 10, cy - 9); ctx.lineTo(cx - 8, cy); ctx.lineTo(cx + 10, cy + 9); ctx.closePath(); ctx.fill() })
    pill(318, 1114, 66, 40, (cx, cy) => { ctx.fillRect(cx + 11, cy - 8, 3, 16); ctx.beginPath(); ctx.moveTo(cx - 10, cy - 9); ctx.lineTo(cx + 8, cy); ctx.lineTo(cx - 10, cy + 9); ctx.closePath(); ctx.fill() })
    pill(437, 1113, 66, 44, (cx, cy) => {
      ctx.fillStyle = '#25306e'; ctx.beginPath(); ctx.moveTo(cx - 18, cy - 5); ctx.lineTo(cx - 11, cy - 5); ctx.lineTo(cx - 3, cy - 11); ctx.lineTo(cx - 3, cy + 11); ctx.lineTo(cx - 11, cy + 5); ctx.lineTo(cx - 18, cy + 5); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#25306e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 5, cy - 8); ctx.lineTo(cx + 14, cy - 8); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 14, cy); ctx.moveTo(cx + 5, cy + 8); ctx.lineTo(cx + 14, cy + 8); ctx.stroke()
    })

    // slider volume hijau
    const vg2 = vg(ctx, 1112, 1132, [[0, '#a8f0b8'], [1, '#3fbf62']])
    ctx.fillStyle = vg2; ctx.beginPath(); ctx.moveTo(502, 1130); ctx.lineTo(612, 1118); ctx.lineTo(612, 1134); ctx.lineTo(502, 1136); ctx.closePath(); ctx.fill()
    thumb(604, 1094, 26, 46)

    // frame bawah
    ctx.fillStyle = vg(ctx, CTRL_B, H, [[0, '#2a4fc8'], [0.4, '#1a3cc0'], [1, '#0f2aa0']])
    ctx.fillRect(0, CTRL_B, W, H - CTRL_B)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(SIDE, CTRL_B, W - SIDE * 2, 2)

    // rapikan sudut jendela (transparan di luar radius)
    const out = createCanvas(W, H)
    const octx = out.getContext('2d')
    octx.save(); rr(octx, 0, 0, W, H, 26); octx.clip(); octx.drawImage(canvas, 0, 0); octx.restore()

    await sock.sendMessage(m.chat, { image: out.toBuffer('image/png'), caption: '🪟 Nih hasilnya' }, { quoted: m })
  } catch (e) {
    console.error('[iqcwin]', e?.stack || e)
    return reply('❌ Gagal membuat gambar. Coba lagi beberapa saat.')
  }
}

handler.command = ['iqcwin', 'iqcwindow']
handler.help = ['iqcwin <teks>']
handler.tags = ['canvas']
handler.limit = true

export default handler
