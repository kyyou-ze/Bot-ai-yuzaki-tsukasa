import { adapt, getCouple, statusOf, formatDuration, loveBar, say, tag, fmt, LAMAR_RULES, LEVELS } from '../../lib/engine/plugins.js'

let handler = async (m, { conn, usedPrefix }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu belum mempunyai pasangan.\nCari dulu dengan ' + usedPrefix + 'tembak @tag')

  const { rec } = c
  const lv = statusOf(rec)
  const nextKey = Object.keys(LAMAR_RULES).find(k => LAMAR_RULES[k].from === rec.status)
  const next = nextKey
    ? `${LEVELS[nextKey].icon} ${LEVELS[nextKey].label}: butuh ${fmt(LAMAR_RULES[nextKey].love)} LP + ${fmt(LAMAR_RULES[nextKey].cost)} 💰 (${usedPrefix}lamar)`
    : '👑 Level maksimal'

  say(conn, m,
`╭──〔 PASANGANKU 〕
│
├ 👤 Kamu
│ ${tag(m.sender)}
│
├ ❤️ Pasangan
│ ${tag(c.partner)}
│
├ ${lv.icon} Status
│ ${lv.label} (bonus x${lv.mult})
│
├ ⏳ Durasi
│ ${formatDuration(Date.now() - c.since)}
│
├ Love Point
│ ${fmt(rec.love)}  ${loveBar(rec.love)}
│
├ 🐷 Tabungan Bersama
│ ${fmt(rec.tabungan)} 💰
│
├ 🎯 Level berikutnya
│ ${next}
│
╰────────────`,
    [m.sender, c.partner])
}

handler.help = ['pasanganku']
handler.tags = ['relationship']
handler.command = ['pasanganku']
handler.group = true
handler.exp = 0

export default adapt(handler, { category: 'relationship' })
