import { adapt } from '../../lib/engine/plugins.js'
import { kartu, gagal, contoh } from '../../lib/core/data.js'

let handler = async (m, { args, usedPrefix, command }) => {
  const user = global.db.data.users[m.sender]
  const jumlah = Math.floor(Number(args[0]))

  if (!user.atm) return m.reply(gagal('Kamu belum punya ATM 💳'))
  if (!jumlah || jumlah < 1) return m.reply(contoh(`${usedPrefix + command} 5000`))
  if (user.bank < jumlah) return m.reply(gagal('Saldo bank tidak cukup 🏦'))

  user.bank -= jumlah
  user.money += jumlah

  m.reply(kartu('Penarikan berhasil', [
    ['Ditarik', jumlah],
    ['Sisa saldo bank', user.bank],
    ['Uang di dompet', user.money],
  ], 'Jangan boros ya~'))
}

handler.help = ['withdraw <jumlah>']
handler.tags = ['economy']
handler.command = /^withdraw$/i

export default adapt(handler, { category: 'economy' })
