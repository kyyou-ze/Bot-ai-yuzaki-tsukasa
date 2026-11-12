import { adapt } from '../../lib/engine/plugins.js'
import { xpRange } from '../../lib/rpg/bridge.js'

let handler = async (m, { conn }) => {
  let user = global.db.data.users[m.sender]
  let { min, max } = xpRange(user.level)
  let next = max - user.exp

  m.reply(`
📊 Level Info
🆙 Level: *${user.level}*
XP: *${user.exp} / ${max}*
➡️ Menuju level ${user.level + 1}: *${next} XP lagi*
`.trim())
}

handler.help = ['ceklevel']
handler.tags = ['rpg']
handler.command = ['ceklevel']

export default adapt(handler, { category: 'rpg' })
