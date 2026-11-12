import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { conn }) => {
  let user = global.db.data.users[m.sender]
  let e = global.rpg.emoticon

  let who = m.mentionedJid[0] || m.quoted?.sender || m.sender
  let tag = '@' + who.split('@')[0]

  if (!user.atm) {
    return conn.reply(
      m.chat,
      `💳 Kamu belum memiliki ATM\nGunakan *.buyatm* untuk membeli ATM.`,
      global.fstatus
    )
  }

  let text = `
*${(global.namebot || 'BOT').toUpperCase()} ATM INFO* ❀

╭──〔 ATM STATUS 〕──╮
│ 👤 Nama : ${tag}
│
│ 💳 ATM   : ✔️ Aktif
│ ${e('bank')} Bank Limit : ${user.fullatm || 1000}
│ ${e('money')} Money : ${user.money}
│ ${e('bank')} Bank  : ${user.bank}
╰────────────────╯
`.trim()

  conn.sendMessage(
    m.chat,
    {
      text,
      mentions: [who]
    },
    { quoted: global.fstatus }
  )
}

handler.help = ['rpg-atm']
handler.tags = ['rpg']
handler.command = ['rpg-atm']
handler.group = true

export default adapt(handler, { category: 'rpg' })
