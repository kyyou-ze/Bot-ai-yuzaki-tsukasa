import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { conn, text, usedPrefix, command }) => {
    let dapat = (Math.floor(Math.random() * 100000))
    let healtu = (Math.floor(Math.random() * 100))
    let nomors = m.sender
    let who
    if (m.isGroup) who = m.mentionedJid[0]
    else who = m.chat
    if (!who) return m.reply('Tag salah satu lah')

    // Inisialisasi user DB kalau belum ada
    global.db.data.users[m.sender] = global.db.data.users[m.sender] || {
        money: 0,
        health: 100,
        lastkerja: 0,
        lastsda: 0,
        exp: 0
    }
    global.db.data.users[who] = global.db.data.users[who] || {
        money: 0,
        health: 100,
        lastkerja: 0,
        lastsda: 0,
        exp: 0
    }

    if (typeof global.db.data.users[who] == 'undefined') return m.reply('Pengguna tidak ada didalam data base')

    let __timers = (new Date - global.db.data.users[m.sender].lastsda)
    let _timers = (3600000 - __timers)
    let timers = clockString(_timers)
    let users = global.db.data.users

    if (new Date - users[m.sender].lastsda > 3600000) {
        if (10 > users[who].health) return m.reply('ᴛᴀʀɢᴇᴛ ꜱᴜᴅᴀʜ ᴛɪᴅᴀᴋ ᴍᴇᴍɪʟɪᴋɪ ʜᴇᴀʟᴛʜ💉')
        if (100 > users[who].money) return m.reply('💠ᴛᴀʀɢᴇᴛ ᴛɪᴅᴀᴋ ᴍᴇᴍɪʟɪᴋɪ ᴀᴘᴀᴘᴜɴ :(💠')
        users[who].health -= healtu * 1
        users[who].money -= dapat * 1
        users[m.sender].money += dapat * 1
        users[m.sender].lastsda = new Date * 1
        conn.reply(m.chat, `ᴛᴀʀɢᴇᴛ ʙᴇʀʜᴀꜱɪʟ ᴅɪ ʙᴜɴᴜʜ ᴅᴀɴ ᴋᴀᴍᴜ ᴍᴇɴɢᴀᴍʙɪʟ ᴍᴏɴᴇʏ ᴛᴀʀɢᴇᴛ ꜱᴇʙᴇꜱᴀʀ\n💰${dapat} ᴍᴏɴᴇʏ\nᴅᴀʀᴀʜ ᴛᴀʀɢᴇᴛ ʙᴇʀᴋᴜʀᴀɴɢ -${healtu} ʜᴇᴀʟᴛʜ❤`, m)
    } else conn.reply(m.chat, `Anda Sudah Membunuh Dan Berhasil Sembunyi, tunggu ${timers} untuk membunuh lagi`, m)
}
handler.help = ['membunuh *@tag*']
handler.tags = ['rpg']
handler.command = /^membunuh$/
handler.register = true
handler.group = true
handler.rpg = true
export default adapt(handler, { category: 'rpg' })
function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)]
}
function clockString(ms) {
    let h = Math.floor(ms / 3600000)
    let m = Math.floor(ms / 60000) % 60
    let s = Math.floor(ms / 1000) % 60
    return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}
