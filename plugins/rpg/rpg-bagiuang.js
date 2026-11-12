import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { conn, args }) => {
let user = global.db.data.users[m.sender]
let target = m.mentionedJid[0]

if (!target) return conn.reply(m.chat, `Tag orang yang ingin kamu beri uang

Contoh:
.bagiuang @user 5000`, global.fstatus)

if (!args[1]) return conn.reply(m.chat, `Masukkan jumlah uang yang ingin diberikan`, global.fstatus)

let jumlah = parseInt(args[1])

if (!Number.isFinite(jumlah) || jumlah < 1) return conn.reply(m.chat, `Jumlah tidak valid`, global.fstatus)

if (user.money < jumlah) return conn.reply(m.chat, `Uang kamu tidak cukup`, global.fstatus)

if (target === m.sender) return conn.reply(m.chat, `Tidak bisa memberi uang ke diri sendiri`, global.fstatus)

let targetUser = global.db.data.users[target]
if (!targetUser) return conn.reply(m.chat, `Target belum pernah memakai bot, suruh dia kirim command apa saja dulu`, global.fstatus)

user.money -= jumlah
targetUser.money += jumlah

let teks = `${(global.namebot || 'BOT').toUpperCase()} BERBAGI ❀

💸 @${m.sender.split('@')[0]} memberikan uang kepada
🎁 @${target.split('@')[0]}

💰 Jumlah : ${jumlah} Money

Baik sekali kamu hari ini`

conn.reply(m.chat, teks, global.fstatus, {
mentions: [m.sender, target]
})
}

handler.help = ['rpg-bagiuang']
handler.tags = ['rpg']
handler.command = ['rpg-bagiuang']
handler.group = true

export default adapt(handler, { category: 'rpg' })
