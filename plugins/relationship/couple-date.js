import { adapt, getCouple, rpgUser, partnerJid, statusOf, say, tag, fmt, rand, formatRemaining, DATE_COOLDOWN, MS } from '../../lib/engine/plugins.js'

let handler = async (m, { conn }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu belum punya pasangan.')
  const { rec } = c
  const now = Date.now()

  const last = rec.date[c.meNum] || 0
  if (now - last < DATE_COOLDOWN)
    return m.reply(`⏳ Kamu sudah claim.\nCoba lagi dalam ${formatRemaining(DATE_COOLDOWN - (now - last))}`)

  const lv = statusOf(rec)
  const money = Math.round(rand(500, 1500) * lv.mult)
  const exp = Math.round(60 * lv.mult)
  const love = Math.round(20 * lv.mult)

  const user = rpgUser(m.sender)
  user.money += money
  user.exp = (Number(user.exp) || 0) + exp
  rec.love += love
  rec.date[c.meNum] = now

  let text =
`💑 *DATE CLAIM*

${tag(m.sender)} ✕ ${tag(c.partner)}
${lv.icon} ${lv.label} (x${lv.mult})

💰 +${fmt(money)} +${exp} EXP +${love} LP`

  // combo: pasangan claim dalam 24 jam terakhir (dan belum dipasangkan combo)
  const theirLast = rec.date[c.pNum] || 0
  if (theirLast && now - theirLast < MS.DAY && rec.comboAt !== theirLast) {
    rec.comboAt = theirLast
    const bonus = money
    const pJid = await partnerJid(conn, c)
    rpgUser(m.sender).money += bonus
    rpgUser(pJid).money += bonus
    rec.love += 30
    text += `\n\n🔥 *COMBO!* Kalian berdua claim hari ini\n💰 +${fmt(bonus)} untuk masing-masing & +30 LP`
  } else {
    text += `\n\n💡 Kalau ${tag(c.partner)} juga claim dalam 24 jam, kalian dapat *bonus combo*!`
  }

  say(conn, m, text, [m.sender, c.partner])
}

handler.help = ['couple-date']
handler.tags = ['relationship']
handler.command = ['couple-date']
handler.group = true
handler.exp = 0

export default adapt(handler, { category: 'relationship' })
