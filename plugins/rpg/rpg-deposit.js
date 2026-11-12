import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { conn, args }) => {
  let user = global.db.data.users[m.sender]

  if (!user.atm) {
    return conn.reply(m.chat, '💳 Kamu belum memiliki ATM.', m)
  }

  let count = Math.floor(Number(args[0]))

  if (!count || count < 1) {
    return conn.reply(
      m.chat,
      'Contoh:\n.deposit 5000',
      m
    )
  }

  if (user.money < count) {
    return conn.reply(
      m.chat,
      '💸 Uang kamu tidak cukup.',
      m
    )
  }

  if ((user.bank + count) > user.fullatm) {
    return conn.reply(
      m.chat,
      `🏦 Bank penuh!\n\nLimit ATM: ${user.fullatm}`,
      m
    )
  }

  user.money -= count
  user.bank += count

  conn.reply(
    m.chat,
    `
*${(global.namebot || 'BOT').toUpperCase()} DEPOSIT* ❀

╭──〔 DEPOSIT BERHASIL 〕──╮
│ 💰 Deposit : ${count}
│ 🏦 Saldo : ${user.bank}
╰──────────────────╯
`.trim(),
    m
  )
}

handler.help = ['rpg-deposit']
handler.tags = ['rpg']
handler.command = ['rpg-deposit']

export default adapt(handler, { category: 'rpg' })
