// Kartu welcome/goodbye berbentuk gambar (canvas): foto profil, teks, nama user, member ke-@count di @group
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)

let canvasLib = null
try { canvasLib = _require('@napi-rs/canvas') } catch {}

const DEFAULT_PP = 'https://cdn.zass.in/CqUv646PhH.jpg' // ganti kalau mau pp default sendiri

function cut(str, max) {
    str = String(str || '')
    return str.length > max ? str.slice(0, max - 1) + '…' : str
}

async function loadPP(url) {
    for (const u of [url, DEFAULT_PP]) {
        if (!u) continue
        try {
            const res = await fetch(u)
            if (!res.ok) continue
            return await canvasLib.loadImage(Buffer.from(await res.arrayBuffer()))
        } catch {}
    }
    return null
}

const bgCache = new Map()
async function loadBg() {
    const src = 'https://cdn.zass.in/ssmcLHh9Jx.jpg'
    if (!src) return null
    if (bgCache.has(src)) return bgCache.get(src)
    try {
        let buf
        if (/^https?:\/\//i.test(src)) {
            const res = await fetch(src)
            if (!res.ok) return null
            buf = Buffer.from(await res.arrayBuffer())
        } else {
            buf = _require('fs').readFileSync(src)
        }
        const img = await canvasLib.loadImage(buf)
        bgCache.set(src, img)
        return img
    } catch {
        return null
    }
}

// type: 'welcome' | 'goodbye'
export async function buildWelcomeCard({ ppUrl, name, count, group, type = 'welcome' }) {
    if (!canvasLib) return null
    const { createCanvas } = canvasLib
    const W = 1000, H = 400
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    const isWelcome = type === 'welcome'
    const bg = await loadBg()
    if (bg) {
        // foto menutup seluruh kartu (cover), lalu diberi lapisan gelap supaya teks tetap terbaca
        const scale = Math.max(W / bg.width, H / bg.height)
        const bw = bg.width * scale, bh = bg.height * scale
        ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh)
        const o = ctx.createLinearGradient(0, 0, W, 0)
        o.addColorStop(0, isWelcome ? 'rgba(20,10,50,0.85)' : 'rgba(50,10,10,0.85)')
        o.addColorStop(1, isWelcome ? 'rgba(20,10,50,0.35)' : 'rgba(50,10,10,0.35)')
        ctx.fillStyle = o
        ctx.fillRect(0, 0, W, H)
    } else {
        const g = ctx.createLinearGradient(0, 0, W, H)
        g.addColorStop(0, isWelcome ? '#1e1b4b' : '#3b0d0d')
        g.addColorStop(1, isWelcome ? '#6d28d9' : '#b91c1c')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
    }

    // dekor lingkaran tipis
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath(); ctx.arc(W - 80, 60, 150, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(W - 220, H + 20, 120, 0, Math.PI * 2); ctx.fill()

    // foto profil bulat
    const img = await loadPP(ppUrl)
    const cx = 170, cy = H / 2, r = 110
    ctx.save()
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
    if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
    else { ctx.fillStyle = '#555'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2) }
    ctx.restore()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#fff'
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()

    // teks (diberi bayangan supaya jelas di atas foto)
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 8
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 60px sans-serif'
    ctx.fillText(isWelcome ? 'WELCOME' : 'GOODBYE', 340, 140)

    ctx.font = 'bold 44px sans-serif'
    ctx.fillText(cut(name, 18), 340, 215)

    ctx.font = '30px sans-serif'
    ctx.fillStyle = isWelcome ? '#e9d5ff' : '#fecaca'
    if (isWelcome) {
        ctx.fillText(`Member ke-${count}`, 340, 270)
        ctx.fillText(`di ${cut(group, 26)}`, 340, 315)
    } else {
        ctx.fillText('Telah meninggalkan grup', 340, 270)
        ctx.fillText(cut(group, 30), 340, 315)
    }

    return canvas.toBuffer('image/png')
}
