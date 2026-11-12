// Fake Spotify — mockup tampilan "Now Playing" Spotify (1080x2344)
//   .fakespotify judul|artis|playlist|durasi|waktu|jam|baterai   (kirim / balas gambar sebagai cover)
//   tambahkan kata "play" di akhir untuk tampilan sedang diputar
import fs from 'fs'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'

// ───────── font ─────────
const FONT_FILES = {
    SpotifyBold: ['Poppins-Bold.ttf', 'DejaVuSans-Bold.ttf'],
    SpotifyMedium: ['Poppins-Medium.ttf', 'DejaVuSans.ttf'],
    SpotifyRegular: ['Poppins-Regular.ttf', 'DejaVuSans.ttf']
}
const FONT_DIRS = ['./assets/fonts', './lib/fonts', '/usr/share/fonts/truetype/google-fonts', '/usr/share/fonts/truetype/poppins', '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu']
let fontsReady = false
function ensureFonts() {
    if (fontsReady) return
    fontsReady = true
    for (const [alias, files] of Object.entries(FONT_FILES)) {
        outer: for (const file of files) {
            for (const dir of FONT_DIRS) {
                const p = `${dir}/${file}`
                if (fs.existsSync(p)) {
                    try { GlobalFonts.registerFromPath(p, alias) } catch {}
                    break outer
                }
            }
        }
    }
}
const F = (size, alias) => `${size}px "${alias}", Poppins, "DejaVu Sans", Arial, sans-serif`

const toSec = (s) => {
    const parts = String(s || '').split(':').map(Number)
    if (parts.some(Number.isNaN)) return 0
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return Number(s) || 0
}

function dominantColor(img) {
    try {
        const c = createCanvas(1, 1)
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0, 1, 1)
        const d = x.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2]]
    } catch {
        return [118, 48, 28]
    }
}

function fit(ctx, text, maxW) {
    let s = String(text)
    if (ctx.measureText(s).width <= maxW) return s
    while (s.length > 1 && ctx.measureText(s + '...').width > maxW) s = s.slice(0, -1)
    return s + '...'
}

export async function renderSpotify(o = {}) {
    ensureFonts()
    const {
        cover, title = 'Bersenja Gurau', artist = 'Raim Laode', playlistTitle = 'Radio Bersenja Gurau',
        playlistDesc = 'Memainkan dari Playlist', duration = '3:14', currentTime = '0:00',
        clock = '18.21', battery = '18', isPlaying = false, shuffle = true, lyricsTitle = 'Pratinjau lirik'
    } = o

    const W = 1080, H = 2344
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    let img = null
    if (cover) { try { img = await loadImage(cover) } catch {} }
    const [dr, dg, db] = img ? dominantColor(img) : [118, 48, 28]

    // background ambient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, `rgb(${dr},${dg},${db})`)
    bg.addColorStop(0.35, `rgb(${dr * 0.7 | 0},${dg * 0.7 | 0},${db * 0.7 | 0})`)
    bg.addColorStop(0.65, `rgb(${dr * 0.25 | 0},${dg * 0.25 | 0},${db * 0.25 | 0})`)
    bg.addColorStop(0.85, '#121212')
    bg.addColorStop(1, '#121212')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // status bar
    ctx.fillStyle = '#fff'
    ctx.font = F(28, 'SpotifyBold')
    ctx.textAlign = 'left'
    ctx.fillText(String(clock), 60, 78)
    ;['#00bcd4', '#26a69a', '#4285f4', '#5c6bc0'].forEach((c, i) => {
        ctx.beginPath(); ctx.arc(195 + i * 26, 70, 7.5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill()
    })
    ctx.beginPath(); ctx.arc(309, 70, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = F(22, 'SpotifyBold')
    ctx.textAlign = 'right'
    ctx.fillText('Vo LTE', 740, 78)
    ctx.fillText('4G+', 785, 70)
    for (let b = 0; b < 4; b++) { const bh = 10 + b * 5; ctx.fillRect(810 + b * 9, 80 - bh, 6, bh) }

    const bx = 875, by = 52, bw = 68, bh2 = 34
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh2, 8); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(bx + bw, by + 10, 4, 14)
    const batVal = parseInt(battery, 10)
    ctx.fillStyle = batVal <= 20 ? '#ffb703' : '#fff'
    ctx.font = F(20, 'SpotifyBold')
    ctx.textAlign = 'center'
    ctx.fillText(String(battery).replace('%', ''), bx + bw / 2, by + 25)

    // header
    ctx.beginPath(); ctx.moveTo(70, 185); ctx.lineTo(88, 203); ctx.lineTo(106, 185)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = F(28, 'SpotifyRegular')
    ctx.fillText(fit(ctx, playlistDesc, 700), 540, 182)
    ctx.fillStyle = '#fff'
    ctx.font = F(34, 'SpotifyBold')
    ctx.fillText(fit(ctx, playlistTitle, 700), 540, 230)
    ;[186, 203, 220].forEach(dy => { ctx.beginPath(); ctx.arc(980, dy, 4.5, 0, Math.PI * 2); ctx.fill() })

    // cover
    const cx0 = 72, cy0 = 368, cs0 = 936
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 45; ctx.shadowOffsetY = 22
    ctx.fillStyle = `rgb(${dr},${dg},${db})`
    ctx.beginPath(); ctx.roundRect(cx0, cy0, cs0, cs0, 24); ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.beginPath(); ctx.roundRect(cx0, cy0, cs0, cs0, 24); ctx.clip()
    if (img) {
        // crop tengah supaya persegi
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx0, cy0, cs0, cs0)
    }
    ctx.restore()

    // judul & artis
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = F(56, 'SpotifyBold')
    ctx.fillText(fit(ctx, title, 580), 72, 1485)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = F(38, 'SpotifyMedium')
    ctx.fillText(fit(ctx, artist, 580), 72, 1545)

    // tombol ✕ dan ⊕
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(708, 1483); ctx.lineTo(752, 1527); ctx.moveTo(752, 1483); ctx.lineTo(708, 1527); ctx.stroke()
    ctx.lineWidth = 5
    ctx.beginPath(); ctx.arc(890, 1505, 40, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(872, 1505); ctx.lineTo(908, 1505); ctx.moveTo(890, 1487); ctx.lineTo(890, 1523); ctx.stroke()

    // seekbar
    const barX = 72, barY = 1640, barW = 936, barH = 6
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill()
    let ratio = toSec(currentTime) / Math.max(1, toSec(duration))
    if (!Number.isFinite(ratio) || ratio < 0.01) ratio = 0.01
    if (ratio > 1) ratio = 1
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(6, barW * ratio), barH, 3); ctx.fill()
    ctx.beginPath(); ctx.arc(barX + barW * ratio, barY + barH / 2, 11, 0, Math.PI * 2); ctx.fill()
    ctx.font = F(26, 'SpotifyMedium')
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textAlign = 'left'; ctx.fillText(String(currentTime), 72, 1690)
    ctx.textAlign = 'right'; ctx.fillText(String(duration), 1008, 1690)

    // kontrol utama
    const sx = 100, sy = 1840
    ctx.strokeStyle = shuffle ? '#1ed760' : 'rgba(255,255,255,0.65)'
    ctx.lineWidth = 4.5
    ctx.beginPath(); ctx.moveTo(sx - 24, sy - 14); ctx.lineTo(sx - 8, sy - 14); ctx.lineTo(sx + 8, sy + 14); ctx.lineTo(sx + 24, sy + 14); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sx - 24, sy + 14); ctx.lineTo(sx - 8, sy + 14); ctx.lineTo(sx - 2, sy + 5); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(sx + 2, sy - 5); ctx.lineTo(sx + 8, sy - 14); ctx.lineTo(sx + 24, sy - 14); ctx.stroke()
    if (shuffle) { ctx.beginPath(); ctx.arc(sx, sy + 30, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#1ed760'; ctx.fill() }

    ctx.fillStyle = '#fff'
    ctx.fillRect(264, 1816, 6, 48)
    ctx.beginPath(); ctx.moveTo(310, 1815); ctx.lineTo(274, 1840); ctx.lineTo(310, 1865); ctx.closePath(); ctx.fill()

    ctx.beginPath(); ctx.arc(540, 1840, 90, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.fillStyle = '#000'
    if (isPlaying) {
        ctx.fillRect(518, 1815, 14, 50); ctx.fillRect(548, 1815, 14, 50)
    } else {
        ctx.beginPath(); ctx.moveTo(526, 1814); ctx.lineTo(566, 1840); ctx.lineTo(526, 1866); ctx.closePath(); ctx.fill()
    }

    ctx.fillStyle = '#fff'
    ctx.fillRect(810, 1816, 6, 48)
    ctx.beginPath(); ctx.moveTo(770, 1815); ctx.lineTo(806, 1840); ctx.lineTo(770, 1865); ctx.closePath(); ctx.fill()

    // sleep timer
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.5
    ctx.beginPath(); ctx.arc(975, 1840, 26, 0, Math.PI * 2); ctx.stroke()
    ctx.fillRect(971, 1806, 8, 7)
    ctx.lineWidth = 3.5
    ctx.beginPath(); ctx.moveTo(975, 1840); ctx.lineTo(975, 1826); ctx.moveTo(975, 1840); ctx.lineTo(985, 1846); ctx.stroke()

    // baris ikon bawah
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.roundRect(63, 2052, 44, 36, 6); ctx.stroke()
    ctx.beginPath(); ctx.arc(85, 2070, 7, 0, Math.PI * 2); ctx.fill()

    const pts = [[751, 2070], [779, 2056], [779, 2084]]
    ctx.lineWidth = 3.5
    ctx.beginPath(); ctx.moveTo(...pts[1]); ctx.lineTo(...pts[0]); ctx.lineTo(...pts[2]); ctx.stroke()
    pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill() })

    ;[2056, 2068, 2080].forEach(y => { ctx.beginPath(); ctx.roundRect(888, y, 44, 5, 2.5); ctx.fill() })

    // banner lirik
    ctx.fillStyle = `rgb(${Math.min(255, (dr * 1.15 | 0) + 20)},${dg * 0.45 | 0},${db * 0.45 | 0})`
    ctx.beginPath(); ctx.roundRect(40, 2170, 1000, 130, 32); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = F(40, 'SpotifyBold')
    ctx.textAlign = 'left'
    ctx.fillText(fit(ctx, lyricsTitle, 880), 95, 2250)

    // home bar
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.roundRect(380, 2320, 320, 8, 4); ctx.fill()

    return { buffer: canvas.toBuffer('image/png'), width: W, height: H }
}

// ───────── perintah ─────────
let handler = async (m, { sock, text, reply, prefix, command }) => {
    const q = m.quoted ? m.quoted : m
    const mime = (q.msg || q).mimetype || q.mtype || ''
    let cover = null
    if (/image/.test(mime)) {
        try { cover = await q.download() } catch {}
    }

    let raw = String(text || '').trim()
    let isPlaying = false
    if (/\bplay$/i.test(raw)) { isPlaying = true; raw = raw.replace(/\s*\|?\s*play$/i, '') }

    if (!raw && !cover) {
        return reply(
            `🎧 *FAKE SPOTIFY*\n\n` +
            `Kirim atau balas *gambar* (jadi cover) dengan caption:\n` +
            `${prefix + command} judul|artis|playlist|durasi|waktu|jam|baterai\n\n` +
            `Contoh:\n${prefix + command} Sialan|Juicy Luicy|Radio Sialan|3:45|1:20|18.21|18\n\n` +
            `Semua bagian boleh dikosongkan. Tambahkan *play* di akhir untuk tampilan sedang diputar.`
        )
    }

    const [title, artist, playlistTitle, duration, currentTime, clock, battery] = raw.split('|').map(s => s.trim())
    const o = { cover, isPlaying }
    if (title) o.title = title
    if (artist) o.artist = artist
    if (playlistTitle) o.playlistTitle = playlistTitle
    if (duration) o.duration = duration
    if (currentTime) o.currentTime = currentTime
    if (clock) o.clock = clock
    if (battery) o.battery = battery

    try {
        const r = await renderSpotify(o)
        return sock.sendMessage(m.chat, { image: r.buffer, caption: `🎧 ${o.title || 'Bersenja Gurau'} — ${o.artist || 'Raim Laode'}` }, { quoted: m })
    } catch (e) {
        console.error('[fakespotify]', e)
        return reply(`❌ Gagal membuat gambar: ${e.message || e}`)
    }
}

handler.command = ['fakespotify']
handler.help = ['fakespotify judul|artis|...']
handler.tags = ['canvas']
handler.limit = true

export default handler
