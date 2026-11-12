import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { text }) => {
  const db = global.db?.data?.users
  if (!db) return m.reply('❌ DB tidak ditemukan')

  if (!text) {
    return m.reply('❌ Contoh: setbirthday 25-12-2005')
  }

  const parts = text.split('-').map(Number)

  if (parts.length < 2) {
    return m.reply('❌ Format: DD-MM-YYYY')
  }

  const [d, mth, y] = parts

  if (!d || !mth || d > 31 || mth > 12) {
    return m.reply('❌ Format tidak valid')
  }

  if (!db[m.sender]) db[m.sender] = {}

  db[m.sender].birthday = y
    ? `${d}-${mth}-${y}`
    : `${d}-${mth}`

  m.reply(`🎉 Birthday tersimpan!\n📅 ${db[m.sender].birthday}`)
}

handler.help = ['setbirthday']
handler.tags = ['user']
handler.command = /^setbirthday$/i
export default adapt(handler, { category: 'user' })
