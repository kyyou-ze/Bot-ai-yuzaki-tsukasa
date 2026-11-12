import { adapt, getCouple, rpgUser, partnerJid, say, tag, fmt, formatRemaining, LEVELS, LAMAR_RULES, PENDING_TTL } from '../../lib/engine/plugins.js'

const NEXT = { pacaran: 'tunangan', tunangan: 'menikah' }

let handler = async (m, { conn, usedPrefix, command }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu belum punya pasangan.')
  const { rec } = c
  const cmd = String(command).toLowerCase()
  const mentions = [m.sender, c.partner]

  // ── ajukan ──
  if (cmd === 'lamar') {
    const target = NEXT[rec.status]
    if (!target) return m.reply('👑 Kalian sudah menikah, level maksimal!')
    const rule = LAMAR_RULES[target]

    if (rec.love < rule.love)
      return m.reply(`❌ Love Point belum cukup untuk ${LEVELS[target].label.toLowerCase()}.\nButuh ${fmt(rule.love)} LP, sekarang ${fmt(rec.love)} LP.\nTambah lewat ${usedPrefix}dateclaim atau ${usedPrefix}kasih`)

    const user = rpgUser(m.sender)
    if (user.money < rule.cost)
      return m.reply(`❌ Biaya ${LEVELS[target].label.toLowerCase()} ${fmt(rule.cost)} 💰, uangmu ${fmt(user.money)} 💰`)

    rec.lamar = { by: c.meNum, target, at: Date.now() }
    return say(conn, m,
`${LEVELS[target].icon} *LAMARAN ${LEVELS[target].label.toUpperCase()}*

${tag(m.sender)} melamar ${tag(c.partner)}!
Biaya ${fmt(rule.cost)} 💰 ditanggung pengaju saat diterima.

${usedPrefix}terimalamar  /  ${usedPrefix}tolaklamar
⏱️ Berlaku 1 jam`, mentions)
  }

  // ── terima / tolak ──
  const req = rec.lamar
  if (!req || Date.now() - req.at > PENDING_TTL) {
    rec.lamar = null
    return m.reply('Tidak ada lamaran yang menunggu jawabanmu.')
  }
  if (req.by === c.meNum)
    return m.reply(`❌ Lamaran harus dijawab pasanganmu.\nSisa waktu: ${formatRemaining(PENDING_TTL - (Date.now() - req.at))}`)

  if (cmd === 'tolaklamar') {
    rec.lamar = null
    return say(conn, m, `💔 ${tag(m.sender)} menolak lamaran. Sabar ya, coba lagi nanti.`, mentions)
  }

  // terimalamar
  const target = req.target
  const rule = LAMAR_RULES[target]
  if (rec.status !== rule.from) { rec.lamar = null; return m.reply('Status hubungan sudah berubah, lamaran dibatalkan.') }
  if (rec.love < rule.love) { rec.lamar = null; return m.reply('Love Point sudah tidak cukup, lamaran dibatalkan.') }

  const proposerJid = rec.acct[req.by] || (await partnerJid(conn, c))
  const proposer = rpgUser(proposerJid)
  if (proposer.money < rule.cost) {
    rec.lamar = null
    return say(conn, m, `❌ Uang ${tag(proposerJid)} tidak cukup untuk biaya ${fmt(rule.cost)} 💰. Lamaran batal.`, [...mentions, proposerJid])
  }

  proposer.money -= rule.cost
  rec.status = target
  rec.lamar = null
  rpgUser(m.sender).money += rule.bonus
  proposer.money += rule.bonus
  rec.love += 50

  say(conn, m,
`${LEVELS[target].icon} *RESMI ${LEVELS[target].label.toUpperCase()}!*

${tag(m.sender)} ${LEVELS[target].icon} ${tag(proposerJid)}

🎁 Hadiah +${fmt(rule.bonus)} 💰 untuk masing-masing & +50 LP
Bonus harian kini x${LEVELS[target].mult}`,
    [m.sender, proposerJid, c.partner])
}

handler.help = ['couple-level lamar', 'couple-level terimalamar', 'couple-level tolaklamar']
handler.tags = ['relationship']
handler.command = ['couple-level', 'lamar', 'terimalamar', 'tolaklamar']
handler.as = 'lamar'
handler.group = true
handler.exp = 0

export default adapt(handler, { category: 'relationship' })
