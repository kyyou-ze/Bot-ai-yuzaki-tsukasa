import { adapt, funStore, endCouple, numsForJid, say, tag, fmt } from '../../lib/engine/plugins.js'

let handler = async (m, { conn, text, usedPrefix, command }) => {
  let target = null

  if (m.mentionedJid.length) target = m.mentionedJid[0]
  else if (m.quoted) target = m.quoted.sender
  else if (text) {
    const nomor = text.replace(/[^0-9]/g, '')
    if (nomor) target = nomor + '@s.whatsapp.net'
  }

  if (!target) {
    return m.reply(
`Contoh penggunaan:

${usedPrefix + command} @user

${usedPrefix + command} 6281234567890

Atau reply target:

${usedPrefix + command}`
    )
  }

  const fun = funStore()
  const num = numsForJid(fun, target).find(n => fun.pacar[n])
  if (!num) return m.reply('❌ User tersebut tidak memiliki pasangan.')

  const res = endCouple(fun, num)
  global.db.fun = fun

  say(conn, m,
`💔 *PASANGAN BERHASIL DIPUTUSKAN*

${tag(target)} 💔 ${tag(res.entry.with)}

Hubungan mereka telah diputuskan oleh Owner.${res.refund ? `\n💰 Tabungan bersama ${fmt(res.refund)} dibagi dua.` : ''}`,
    [target, res.entry.with])
}

handler.help = ['putuspasangan']
handler.tags = ['owner']
handler.command = ['putuspasangan']
handler.owner = true

export default adapt(handler, { category: 'relationship' })
