import { adapt, getCouple, rpgUser, say, tag, fmt, GIFTS } from '../../lib/engine/plugins.js'

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu belum punya pasangan.\nCari dulu dengan ' + usedPrefix + 'tembak @tag')

  const key = String(args[0] || '').toLowerCase()
  const gift = GIFTS[key]

  if (!gift) {
    const list = Object.entries(GIFTS)
      .map(([k, g]) => `${g.icon} *${k}* — ${fmt(g.price)} 💰 (+${g.love} LP)`)
      .join('\n')
    return m.reply(`🎁 *TOKO HADIAH PASANGAN*\n\n${list}\n\nContoh: ${usedPrefix + command} bunga\nJumlah: ${usedPrefix + command} coklat 3 (maks 10)`)
  }

  const qty = Math.min(10, Math.max(1, parseInt(args[1]) || 1))
  const cost = gift.price * qty
  const user = rpgUser(m.sender)

  if (user.money < cost)
    return m.reply(`❌ Uangmu kurang.\nButuh ${fmt(cost)} 💰, kamu punya ${fmt(user.money)} 💰`)

  user.money -= cost
  const gain = gift.love * qty
  c.rec.love += gain

  say(conn, m,
`🎁 *HADIAH TERKIRIM*

${tag(m.sender)} memberi ${tag(c.partner)}
${gift.icon} ${gift.name} x${qty}

Love Point +${fmt(gain)} (total ${fmt(c.rec.love)})
💸 Biaya ${fmt(cost)} 💰`,
    [m.sender, c.partner])
}

handler.help = ['couple-kasih']
handler.tags = ['relationship']
handler.command = ['couple-kasih']
handler.group = true

export default adapt(handler, { category: 'relationship' })
