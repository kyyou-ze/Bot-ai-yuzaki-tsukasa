import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m,{conn})=>{
let user = global.db.data.users[m.sender]

if(user.guild)
return conn.reply(m.chat,'Kamu sudah menjadi Adventurer Guild',m)

user.guild = true
user.rank = 'F'

conn.reply(m.chat,`
*${(global.namebot || 'BOT').toUpperCase()} ADVENTURER GUILD* ❀

Selamat datang Adventurer!

Rank kamu sekarang : *F*

Gunakan:
.hunt → berburu monster
.rank → cek rank
`,m)
}

handler.help = ['rpg-guild']
handler.tags = ['rpg']
handler.command = ['rpg-guild']
handler.group = true

export default adapt(handler, { category: 'rpg' })
