import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m,{conn,args})=>{
let user = global.db.data.users[m.sender]

let type = (args[0]||'').toLowerCase()

if(type !== 'yannrzy')
return conn.reply(m.chat,'Gunakan:\n.setrpg yannrzy',m)

if(user.yannrzy)
return conn.reply(m.chat,`Kamu sudah menjadi Adventurer ${global.namebot || 'Bot'}`,m)

user.yannrzy = true

conn.reply(m.chat,`
*${(global.namebot || 'BOT').toUpperCase()} RPG* ❀

Selamat datang Adventurer!

Sekarang kamu bisa berburu monster dengan:
.huntanya
`,m)
}

handler.help = ['rpg-setrpg']
handler.tags = ['rpg']
handler.command = ['rpg-setrpg']
handler.group = true

export default adapt(handler, { category: 'rpg' })
