import { adapt, clockString } from '../../lib/engine/plugins.js'
let handler = async (m, { conn, args }) => {
let user = global.db.data.users[m.sender]
let target = m.mentionedJid[0]

if (!target) return conn.reply(m.chat, `Tag target yang ingin dirampok

Contoh:
.merampok @user`, global.fstatus)

if (target == m.sender) return conn.reply(m.chat, `Tidak bisa merampok diri sendiri`, global.fstatus)

let targetUser = global.db.data.users[target]
if (!targetUser) return conn.reply(m.chat, `Target belum pernah memakai bot, suruh dia kirim command apa saja dulu`, global.fstatus)

let __timers = (new Date - user.lastrampok)
let _timers = (3600000 - __timers)
let timers = clockString(_timers)

if (new Date - user.lastrampok < 3600000) {
return conn.reply(m.chat, `${(global.namebot || 'BOT').toUpperCase()} RAMPOK ❀

Kamu sudah merampok sebelumnya

Coba lagi dalam
${timers}`, global.fstatus)
}

if (targetUser.money < 1000) {
return conn.reply(m.chat, `Target terlalu miskin untuk dirampok`, global.fstatus)
}

let berhasil = Math.random() > 0.4

if (!berhasil) {
let denda = Math.floor(Math.random() * 5000) + 1000

user.money -= denda
user.lastrampok = new Date * 1

return conn.reply(m.chat, `❀ RAMPOK GAGAL ❀

🚓 Kamu tertangkap polisi!

💸 Denda : ${denda} Money`, global.fstatus)
}

let hasil = Math.floor(Math.random() * targetUser.money / 2) + 1000

user.money += hasil
targetUser.money -= hasil
user.lastrampok = new Date * 1

let teks = `❀ RAMPOK BERHASIL ❀

🕵️ @${m.sender.split('@')[0]} berhasil merampok

💰 @${target.split('@')[0]}

🎁 Hasil Rampok : ${hasil} Money
`

conn.reply(m.chat, teks, global.fstatus, {
mentions: [m.sender, target]
})
}

handler.help = ['rpg-merampok']
handler.tags = ['rpg']
handler.command = ['rpg-merampok']
handler.group = true
handler.limit = true

export default adapt(handler, { category: 'rpg' })
