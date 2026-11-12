import { adapt } from '../../lib/engine/plugins.js'
import { kartu } from '../../lib/core/data.js'

// owner diambil dari global.owners (config.js)
const adalahOwner = (jid) => (global.owners || []).some((o) => jid.includes(Array.isArray(o) ? o[0] : o))

let handler = async (m, { conn }) => {
  const who = (m.isGroup && m.mentionedJid[0]) || m.sender
  const user = global.db.data.users[who]
  if (!user) throw 'User tidak ditemukan'

  const owner = adalahOwner(who)
  const premium = user.premiumTime >= 1

  const limit = owner || premium ? '∞ Unlimited' : user.limit
  const status = owner ? 'Developer' : premium ? 'Premium' : user.level >= 1000 ? 'Elite' : 'Free User'
  const nama = user.registered ? user.name : conn.getName(who)

  m.reply(kartu('Info User', [
    ['Nama', nama],
    ['Status', status],
    ['Limit', limit],
  ]))
}

handler.help = ['limit [@user]']
handler.tags = ['economy']
handler.command = /^limit$/i
handler.limit = false

export default adapt(handler, { category: 'economy' })
