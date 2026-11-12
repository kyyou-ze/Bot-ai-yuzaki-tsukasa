import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { conn, args }) => {
    let users = Object.entries(global.db.data.users).map(([jid, data]) => ({
        jid,
        ...data
    }))

    let fields = Object.keys(global.db.data.users[m.sender] || {})

    let type = args[0]?.toLowerCase()
    // ===== MENU =====

    if (!type) {
    let menu = fields
    .filter(v => typeof global.db.data.users[m.sender][v] === 'number')
    .slice(0,20)
    .map(v => `• .leaderboard ${v}`)
    .join('\n')

    let text = `
*${(global.namebot || 'BOT').toUpperCase()} RPG LEADERBOARD* ❀

Pilih kategori leaderboard:

${menu}

Contoh:
.leaderboard money
.leaderboard exp
.leaderboard level
`.trim()

    return conn.sendMessage(m.chat,{
        text
    },{quoted: m})
    }

    // ===== CEK FIELD =====

    if (!fields.includes(type)) {
        return conn.reply(m.chat,'Kategori tidak ditemukan.',m)
    }

    // ===== SORT =====

    let sorted = users
    .map(u => ({ jid:u.jid, value:u[type] || 0 }))
    .filter(u => u.value > 0)
    .sort((a,b)=> b.value - a.value)

    let len = 10

    let text = `
*${(global.namebot || 'BOT').toUpperCase()} RPG LEADERBOARD* ❀

📊 Kategori : *${type.toUpperCase()}*

${sorted.slice(0,len).map((u,i)=>
`${i+1}. @${u.jid.split('@')[0]} • ${u.value}`
).join('\n') || 'Belum ada data'}
`.trim()

    conn.sendMessage(m.chat,{
        text,
        mentions: sorted.slice(0,len).map(u=>u.jid)
    },{quoted: m})
}

handler.help = ['rpg-leaderboard']
handler.tags = ['rpg']
handler.command = ['rpg-leaderboard', 'leaderboard', 'lb']
handler.group = true

export default adapt(handler, { category: 'rpg' })
