import { adapt } from '../../lib/engine/plugins.js'
import { sukses, gagal, contoh } from '../../lib/core/data.js'

let handler = async (m, { args, usedPrefix, command }) => {
  const target = m.mentionedJid?.[0] || m.quoted?.sender
  const jumlah = parseInt(args[0])

  if (!target) return m.reply(contoh(`${usedPrefix + command} @tag 500`))
  if (!jumlah || isNaN(jumlah)) return m.reply(gagal('Masukkan jumlah EXP yang valid!'))

  // bikin data user kalau belum ada
  const users = (global.db.data.users ||= {})
  users[target] ||= { money: 0, exp: 0 }
  users[target].exp = (users[target].exp || 0) + jumlah

  m.reply(sukses(`Berhasil menambah *${jumlah} EXP* ✨\nke @${target.split('@')[0]}`), { mentions: [target] })
}

handler.help = ['addexp @user jumlah']
handler.tags = ['owner']
handler.command = /^addexp$/i
handler.owner = true

export default adapt(handler, { category: 'owner' })
