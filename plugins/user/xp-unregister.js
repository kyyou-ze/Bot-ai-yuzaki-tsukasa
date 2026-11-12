import { adapt } from '../../lib/engine/plugins.js'
import { buttonsToText } from '../../lib/platform/wa.js'
import { sukses, gagal } from '../../lib/core/data.js'

const quick = (text, id) => ({ type: 'reply', text, id })

let handler = async (m, { args, usedPrefix, conn }) => {
  const users = global.db.data.users
  const user = users[m.sender]

  if (!user.registered) return m.reply(gagal('Kamu belum terdaftar.'))

  const sendBtn = async (body, buttons) => {
    try {
      return await conn.sendButtons(m.chat, { text: body, footer: global.namebot || 'Kaguya', buttons }, { quoted: m })
    } catch {
      const extra = buttonsToText(buttons)
      return m.reply(extra ? `${body}\n\n${extra}` : body)
    }
  }

  // minta konfirmasi dulu
  if (!args[0]) {
    return sendBtn(
      `⚠️ *Konfirmasi Unregister*\n\n` +
      `Semua datamu (level, money, item, dll) akan *dihapus dari database* dan tidak bisa dikembalikan. ` +
      `Kamu bisa daftar lagi kapan saja, tapi mulai dari awal.\n\nLanjutkan?`,
      [quick('✅ Ya, Hapus Data', `${usedPrefix}unreg yes`), quick('❌ Batal', `${usedPrefix}daftar`)]
    )
  }
  if (args[0].toLowerCase() !== 'yes') return m.reply(gagal('Unregister dibatalkan.'))

  // user yang tidak terdaftar tidak disimpan di database, jadi datanya dihapus sekarang juga
  delete users[m.sender]

  return sendBtn(sukses('Unregister berhasil, datamu sudah dihapus.'), [quick('📝 Daftar Lagi', `${usedPrefix}daftar`)])
}

handler.help = ['xp-unregister']
handler.tags = ['user']
handler.command = ['xp-unregister', 'unreg']
handler.register = true

export default adapt(handler, { category: 'user' })
