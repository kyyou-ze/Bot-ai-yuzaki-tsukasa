import { adapt, getCouple, rpgUser, partnerJid, endCouple, say, tag, fmt, rand, formatRemaining, MS } from '../../lib/engine/plugins.js'
import { jidNumber } from '../../lib/core/system.js'

const COOLDOWN = MS.HOUR
const PENALTY_PCT = 0.2
const PENALTY_MIN = 500

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu kan jomblo, mau selingkuh sama siapa? 😅')

  const target = m.mentionedJid?.[0] || m.quoted?.sender
  if (!target) return m.reply(`Contoh: ${usedPrefix + command} @gebetan`)

  const tNum = jidNumber(target)
  if (tNum === c.meNum || tNum === jidNumber(m.sender)) return m.reply('Selingkuh sama diri sendiri? 🤨')
  if (tNum === c.pNum || tNum === jidNumber(c.partner)) return m.reply('Itu kan pasanganmu sendiri 😭')
  if (tNum === jidNumber(conn.user?.id)) return m.reply('Bot tidak bisa dijadikan selingkuhan!')

  const { rec } = c
  rec.cd.selingkuh ||= {}
  const now = Date.now()
  const last = rec.cd.selingkuh[c.meNum] || 0
  if (now - last < COOLDOWN)
    return m.reply(`🤫 Tenang dulu, nanti ketahuan.\nCoba lagi dalam ${formatRemaining(COOLDOWN - (now - last))}`)
  rec.cd.selingkuh[c.meNum] = now

  // peluang ketahuan: 40% + 10% tiap kali sebelumnya lolos (maks 85%); menikah lebih peka
  const prior = rec.cheat[c.meNum] || 0
  const chance = Math.min(0.85, 0.4 + prior * 0.1 + (rec.status === 'menikah' ? 0.1 : 0))
  const caught = Math.random() < chance

  if (!caught) {
    rec.cheat[c.meNum] = prior + 1
    const reward = rand(500, 2500)
    rpgUser(m.sender).money += reward
    return say(conn, m,
`😏 *AMAN TERKENDALI*

${tag(m.sender)} diam-diam jalan sama ${tag(target)}
Pasanganmu tidak tahu... untuk saat ini.

💰 Uang tutup mulut +${fmt(reward)}
⚠️ Peluang ketahuan berikutnya ${Math.round(Math.min(0.85, chance + 0.1) * 100)}%`,
      [m.sender, target])
  }

  // ketahuan: denda ke pasangan + putus (tabungan dibagi dua)
  const me = rpgUser(m.sender)
  const penalty = Math.min(me.money, Math.max(PENALTY_MIN, Math.floor(me.money * PENALTY_PCT)))
  const pJid = await partnerJid(conn, c)
  me.money -= penalty
  rpgUser(pJid).money += penalty

  const partner = c.partner
  const res = endCouple(c.fun, c.meNum)
  global.db.fun = c.fun

  say(conn, m,
`🚨 *KETAHUAN SELINGKUH!* 🚨

${tag(m.sender)} kepergok jalan sama ${tag(target)}
💔 ${tag(partner)} memutuskan hubungan!

💸 Denda ${fmt(penalty)} 💰 diberikan ke ${tag(partner)}${res?.refund ? `\n🐷 Tabungan bersama ${fmt(res.refund)} 💰 dibagi dua` : ''}`,
    [m.sender, target, partner])
}

handler.help = ['couple-selingkuh']
handler.tags = ['relationship']
handler.command = ['couple-selingkuh']
handler.group = true

export default adapt(handler, { category: 'relationship' })
