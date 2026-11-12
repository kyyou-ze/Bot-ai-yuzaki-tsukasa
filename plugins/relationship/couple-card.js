import { adapt, getCouple, partnerJid, statusOf, formatDuration, fmt, tag, say, loveBar, LAMAR_RULES } from '../../lib/engine/plugins.js'
import axios from 'axios'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const W = 900, H = 500

async function avatar(sock, jid) {
  try {
    const url = await sock.profilePictureUrl(jid, 'image')
    const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 })
    return await loadImage(Buffer.from(data))
  } catch {
    return null
  }
}

function heart(ctx, x, y, s) {
  ctx.beginPath()
  ctx.moveTo(x, y + s * 0.3)
  ctx.bezierCurveTo(x, y - s * 0.2, x - s, y - s * 0.2, x - s, y + s * 0.35)
  ctx.bezierCurveTo(x - s, y + s * 0.8, x - s * 0.3, y + s * 1.05, x, y + s * 1.3)
  ctx.bezierCurveTo(x + s * 0.3, y + s * 1.05, x + s, y + s * 0.8, x + s, y + s * 0.35)
  ctx.bezierCurveTo(x + s, y - s * 0.2, x, y - s * 0.2, x, y + s * 0.3)
  ctx.closePath()
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawAvatar(ctx, img, cx, cy, r, label) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (img) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = '#ffd1e0'
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = '#c2185b'
    ctx.font = 'bold 70px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(label || '?').charAt(0).toUpperCase(), cx, cy + 24)
  }
  ctx.restore()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s))

async function render(sock, c, jidA, jidB, nameA, nameB) {
  const { rec } = c
  const lv = statusOf(rec)
  const [imgA, imgB] = await Promise.all([avatar(sock, jidA), avatar(sock, jidB)])

  const cv = createCanvas(W, H)
  const ctx = cv.getContext('2d')

  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#ff9a9e')
  g.addColorStop(0.5, '#fad0c4')
  g.addColorStop(1, '#a18cd1')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  round(ctx, 30, 30, W - 60, H - 60, 32)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 34px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('COUPLE CARD', W / 2, 82)

  drawAvatar(ctx, imgA, 230, 215, 85, nameA)
  drawAvatar(ctx, imgB, W - 230, 215, 85, nameB)

  ctx.fillStyle = '#e91e63'
  heart(ctx, W / 2, 175, 46)
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  ctx.fillStyle = '#4a148c'
  ctx.font = 'bold 28px sans-serif'
  ctx.fillText(clip(nameA, 14), 230, 340)
  ctx.fillText(clip(nameB, 14), W - 230, 340)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(lv.label.toUpperCase(), W / 2, 285)

  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#4a148c'
  ctx.fillText(formatDuration(Date.now() - c.since).replace(/ 💖/, ''), W / 2, 322)

  // love bar
  const steps = [0, LAMAR_RULES.tunangan.love, LAMAR_RULES.menikah.love, 1500, 4000]
  const next = steps.find(v => v > rec.love) ?? steps[steps.length - 1]
  const prev = [...steps].reverse().find(v => v <= rec.love) ?? 0
  const ratio = next === prev ? 1 : Math.min(1, (rec.love - prev) / (next - prev))
  const bx = 150, by = 395, bw = W - 300, bh = 26
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  round(ctx, bx, by, bw, bh, 13)
  ctx.fill()
  if (ratio > 0) {
    ctx.fillStyle = '#e91e63'
    round(ctx, bx, by, Math.max(26, bw * ratio), bh, 13)
    ctx.fill()
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.fillText(`Love Point ${fmt(rec.love)}`, W / 2, by + 62)

  return cv.toBuffer('image/png')
}

let handler = async (m, { conn, usedPrefix }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu belum punya pasangan.\nCari dulu dengan ' + usedPrefix + 'tembak @tag')

  const pJid = await partnerJid(conn, c)
  const nameA = conn.getName?.(m.sender) || String(m.sender).split('@')[0]
  const nameB = conn.getName?.(pJid) || String(pJid).split('@')[0]
  const lv = statusOf(c.rec)

  const caption =
`${lv.icon} *COUPLE CARD*
${tag(m.sender)} ❤️ ${tag(c.partner)}
${lv.label} • ${formatDuration(Date.now() - c.since)}
${fmt(c.rec.love)} LP ${loveBar(c.rec.love)}
🐷 Tabungan ${fmt(c.rec.tabungan)} 💰`

  try {
    const buffer = await render(conn, c, m.sender, pJid, nameA, nameB)
    await conn.sendMessage(m.chat, { image: buffer, caption, mentions: [m.sender, c.partner] }, { quoted: m })
  } catch (e) {
    // kalau canvas gagal, tetap kirim versi teks
    await say(conn, m, caption, [m.sender, c.partner])
  }
}

handler.help = ['couple-card']
handler.tags = ['relationship']
handler.command = ['couple-card']
handler.group = true
handler.exp = 0

export default adapt(handler, { category: 'relationship' })
