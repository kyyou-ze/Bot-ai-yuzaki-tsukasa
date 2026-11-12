import { adapt, canLevelUp, xpRange } from '../../lib/engine/plugins.js'
import { sukses, info } from '../../lib/core/data.js'

let handler = async (m, { conn }) => {
  const nama = conn.getName(m.sender)
  const user = global.db.data.users[m.sender]
  const { min, xp, max } = xpRange(user.level, global.multiplier)

  // exp belum cukup
  if (!canLevelUp(user.level, user.exp, global.multiplier)) {
    return m.reply(info(`Level ${nama} : ${user.level}  (${user.exp - min}/${xp})\n Kurang *${max - user.exp} EXP* lagi!`))
  }

  const levelLama = user.level
  while (canLevelUp(user.level, user.exp, global.multiplier)) user.level++

  m.reply(sukses(`*${nama} Level Up!*\nLevel ${levelLama} ➜ ${user.level}`))
}

handler.help = ['xp-levelup']
handler.tags = ['user']
handler.command = ['xp-levelup']

export default adapt(handler, { category: 'user' })
