import { adapt, funStore, linkCouple, say, tag } from '../../lib/engine/plugins.js'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  let user1 = null
  let user2 = null

  // Mention 2 orang
  if (m.mentionedJid.length >= 2) {
    user1 = m.mentionedJid[0]
    user2 = m.mentionedJid[1]
  }

  // Reply + nomor
  else if (m.quoted && text) {
    const nomor = text.replace(/[^0-9]/g, '')
    if (!nomor)
      return m.reply(`Contoh:\n${usedPrefix + command} @user1 @user2\n${usedPrefix + command} 628xxxx 628xxxx`)
    user1 = m.quoted.sender
    user2 = nomor + '@s.whatsapp.net'
  }

  // Dua nomor
  else if (text) {
    const nomor = text.split(/\s+/).map(v => v.replace(/[^0-9]/g, '')).filter(Boolean)
    if (nomor.length >= 2) {
      user1 = nomor[0] + '@s.whatsapp.net'
      user2 = nomor[1] + '@s.whatsapp.net'
    }
  }

  if (!user1 || !user2) {
    return m.reply(
`Contoh penggunaan:

${usedPrefix + command} @user1 @user2

${usedPrefix + command} 6281234567890 6289876543210

Atau reply salah satu user:

${usedPrefix + command} 628xxxxxxxxxx`
    )
  }

  if (user1 === user2) return m.reply('❌ Tidak bisa memasangkan user yang sama.')
  if (user1 === conn.user.jid || user2 === conn.user.jid)
    return m.reply('❌ Bot tidak bisa dijadikan pasangan.')

  // Sistem terpadu: sama dengan .tembak/.terima, hubungan lama (beserta tabungan) otomatis diselesaikan
  const fun = funStore()
  linkCouple(fun, user1, user2)
  global.db.fun = fun

  say(conn, m,
`*BERHASIL DIPASANGKAN*

${tag(user1)} ❤️ ${tag(user2)}

Mereka kini resmi menjadi pasangan.`,
    [user1, user2])
}

handler.help = ['addpasangan']
handler.tags = ['relationship']
handler.command = /^addpasangan$/i
handler.owner = true

export default adapt(handler, { category: 'relationship' })
