// .levelcard [@user]  -> kartu level / profil berbentuk gambar (canvas) bertema cute
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { adapt, rpgStore, xpRange, canvasGetAvatarBuffer, canvasRoundedRectPath, canvasDrawAvatar } from '../../lib/engine/plugins.js'
import { fiturFmt as fmt } from '../../lib/engine/features.js'

const W = 1000
const H = 420
const FONT = "'Poppins', 'Inter', 'Segoe UI', 'DejaVu Sans', sans-serif"
const angka = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

function heart(ctx, x, y, s, color) {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, 6)
    ctx.bezierCurveTo(-14, -6, -6, -16, 0, -8)
    ctx.bezierCurveTo(6, -16, 14, -6, 0, 6)
    ctx.fill()
    ctx.restore()
}

function star(ctx, x, y, r, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2
        const rad = i % 2 ? r * 0.45 : r
        ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function cloud(ctx, x, y, s, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, 18 * s, 0, Math.PI * 2)
    ctx.arc(x + 22 * s, y - 10 * s, 24 * s, 0, Math.PI * 2)
    ctx.arc(x + 48 * s, y, 18 * s, 0, Math.PI * 2)
    ctx.fill()
}

function pill(ctx, x, y, w, h, fill) {
    canvasRoundedRectPath(ctx, x, y, w, h, h / 2)
    ctx.fillStyle = fill
    ctx.fill()
}

const potong = (ctx, text, max) => {
    let t = String(text)
    if (ctx.measureText(t).width <= max) return t
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
    return t + '…'
}

export async function gambarKartu({ nama, role, level, exp, min, need, rank, total, money, limit, streak, avatar, bot }) {
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')

    // latar pastel
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#ffc9de')
    bg.addColorStop(0.55, '#ffe6d5')
    bg.addColorStop(1, '#dcd3ff')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // hiasan
    ctx.globalAlpha = 0.5
    cloud(ctx, 70, 380, 1.4, '#ffffff')
    cloud(ctx, 780, 60, 1.2, '#ffffff')
    cloud(ctx, 900, 380, 1.0, '#ffffff')
    ctx.globalAlpha = 1
    const stars = [[40, 50, 12], [960, 150, 10], [520, 30, 9], [250, 395, 8], [980, 300, 11]]
    for (const [x, y, r] of stars) star(ctx, x, y, r, '#fff4b0')
    heart(ctx, 930, 40, 1.6, '#ff8fb8')
    heart(ctx, 30, 340, 1.2, '#ff8fb8')
    heart(ctx, 610, 400, 1.0, '#ffb3cf')

    // panel putih
    ctx.save()
    ctx.shadowColor = 'rgba(214, 120, 160, 0.35)'
    ctx.shadowBlur = 28
    ctx.shadowOffsetY = 8
    canvasRoundedRectPath(ctx, 32, 32, W - 64, H - 64, 36)
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    ctx.fill()
    ctx.restore()

    // avatar
    const ax = 70, ay = 78, size = 200
    ctx.beginPath()
    ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 10, 0, Math.PI * 2)
    const ring = ctx.createLinearGradient(ax, ay, ax + size, ay + size)
    ring.addColorStop(0, '#ff8fb8')
    ring.addColorStop(1, '#ffc27a')
    ctx.fillStyle = ring
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 3, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    try {
        canvasDrawAvatar(ctx, await loadImage(avatar), ax, ay, size)
    } catch {
        ctx.fillStyle = '#ffd9e8'
        ctx.beginPath()
        ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2)
        ctx.fill()
    }
    heart(ctx, ax + size - 10, ay + size - 6, 2.2, '#ff5c93')

    // nama & role
    const tx = 310
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#5a3550'
    ctx.font = `bold 44px ${FONT}`
    ctx.fillText(potong(ctx, nama, 440), tx, 130)

    ctx.font = `600 22px ${FONT}`
    const rw = ctx.measureText(role).width + 40
    pill(ctx, tx, 148, rw, 40, '#ffd5e5')
    ctx.fillStyle = '#c2457d'
    ctx.fillText(role, tx + 20, 177)

    // level besar di kanan
    ctx.textAlign = 'right'
    ctx.fillStyle = '#c2457d'
    ctx.font = `600 22px ${FONT}`
    ctx.fillText('LEVEL', W - 80, 90)
    ctx.fillStyle = '#ff5c93'
    ctx.font = `bold 78px ${FONT}`
    ctx.fillText(String(level), W - 80, 160)
    ctx.textAlign = 'left'

    // bar exp
    const bx = tx, by = 218, bw = W - tx - 80, bh = 34
    canvasRoundedRectPath(ctx, bx, by, bw, bh, bh / 2)
    ctx.fillStyle = '#ffe3ee'
    ctx.fill()
    const frac = need > 0 ? Math.max(0, Math.min(1, (exp - min) / need)) : 0
    if (frac > 0) {
        const fw = Math.max(bh, bw * frac)
        canvasRoundedRectPath(ctx, bx, by, fw, bh, bh / 2)
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0)
        g.addColorStop(0, '#ff8fb8')
        g.addColorStop(1, '#ffb36b')
        ctx.fillStyle = g
        ctx.fill()
    }
    ctx.fillStyle = '#5a3550'
    ctx.font = `600 20px ${FONT}`
    ctx.fillText(`EXP ${fmt(Math.max(0, exp - min))} / ${fmt(need)}`, bx + 4, by + bh + 28)
    ctx.textAlign = 'right'
    ctx.fillText(`${Math.round(frac * 100)}%`, bx + bw, by + bh + 28)
    ctx.textAlign = 'left'

    // statistik
    const stats = [
        ['PERINGKAT', `#${fmt(rank)}`, `dari ${fmt(total)}`, '#ff8fb8'],
        ['MONEY', fmt(money), '', '#ffb36b'],
        ['LIMIT', limit, '', '#b69cff'],
        ['STREAK', `${fmt(streak)}`, 'hari', '#ff7aa8']
    ]
    const cw = (W - tx - 80 - 3 * 14) / 4
    stats.forEach(([label, val, sub, color], i) => {
        const x = tx + i * (cw + 14), y = 290
        canvasRoundedRectPath(ctx, x, y, cw, 74, 20)
        ctx.fillStyle = color + '33'
        ctx.fill()
        ctx.fillStyle = '#8a5a7c'
        ctx.font = `600 14px ${FONT}`
        ctx.fillText(label, x + 14, y + 24)
        ctx.fillStyle = '#5a3550'
        ctx.font = `bold 24px ${FONT}`
        ctx.fillText(potong(ctx, val, cw - 24), x + 14, y + 54)
        if (sub) {
            ctx.fillStyle = '#8a5a7c'
            ctx.font = `500 13px ${FONT}`
            ctx.textAlign = 'right'
            ctx.fillText(sub, x + cw - 12, y + 54)
            ctx.textAlign = 'left'
        }
    })

    ctx.fillStyle = '#c2457d'
    ctx.font = `600 16px ${FONT}`
    ctx.fillText(`${bot}`, 70, H - 52)

    return canvas.toBuffer('image/png')
}

let handler = async (m, { conn }) => {
    const who = m.mentionedJid?.[0] || m.quoted?.sender || m.sender
    const users = rpgStore().users
    const user = users[who]
    if (!user) return m.reply('User itu belum ada di database. Suruh dia pakai bot dulu ya~')

    const level = Math.max(0, Math.floor(angka(user.level)))
    const { min, xp } = xpRange(level, global.multiplier)
    const nama = (user.registered && user.name ? user.name : null) || conn.getName(who)

    const urut = Object.entries(users).filter(([, u]) => u && !u.banned).map(([j, u]) => [j, angka(u.level), angka(u.exp)])
        .sort((a, b) => b[1] - a[1] || b[2] - a[2])
    const rank = Math.max(1, urut.findIndex(([j]) => j === who) + 1)

    const premium = angka(user.premiumTime) > 0
    const avatar = await canvasGetAvatarBuffer(conn, who)
    const buf = await gambarKartu({
        nama, role: user.role || 'Newbie', level, exp: angka(user.exp), min, need: xp,
        rank, total: urut.length, money: angka(user.money), limit: premium ? '∞' : fmt(angka(user.limit)),
        streak: angka(user.streakDaily), avatar, bot: global.namebot || 'Bot'
    })

    await conn.sendMessage(m.chat, {
        image: buf,
        caption: `*Kartu Level ${nama}*\n Level ${level} • Peringkat #${rank}\n Kurang ${fmt(Math.max(0, xp - (angka(user.exp) - min)))} EXP lagi ke level berikutnya`
    }, { quoted: m })
}

handler.help = ['levelcard [@user]']
handler.tags = ['canvas']
handler.command = /^levelcard$/i
handler.limit = false
handler.exp = 0

export default adapt(handler, { category: 'economy' })
