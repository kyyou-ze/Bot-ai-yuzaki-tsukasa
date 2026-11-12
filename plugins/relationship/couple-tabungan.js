import { adapt, getCouple, rpgUser, partnerJid, say, tag, fmt, parseAmount, formatRemaining, PENDING_TTL } from '../../lib/engine/plugins.js'

let handler = async (m, { conn, args, usedPrefix, command }) => {
  const c = getCouple(m)
  if (!c) return m.reply('💔 Kamu belum punya pasangan.')
  const { rec } = c
  const cmd = String(command).toLowerCase()
  const mentions = [m.sender, c.partner]

  // ── lihat saldo ──
  if (cmd === 'tabungan') {
    const mine = rec.kontribusi[c.meNum] || 0
    const theirs = rec.kontribusi[c.pNum] || 0
    return say(conn, m,
`🐷 *TABUNGAN BERSAMA*

Saldo: *${fmt(rec.tabungan)}* 💰
Setoranmu: ${fmt(mine)}
Setoran ${tag(c.partner)}: ${fmt(theirs)}

${usedPrefix}nabung <jumlah>
${usedPrefix}tariktabungan <jumlah>`, mentions)
  }

  // ── setor ──
  if (cmd === 'nabung') {
    const user = rpgUser(m.sender)
    const amount = parseAmount(args[0], user.money)
    if (!amount) return m.reply(`Contoh: ${usedPrefix}nabung 5000\n(bisa 5k, 2jt, atau all)`)
    if (user.money < amount) return m.reply(`❌ Uangmu kurang. Kamu punya ${fmt(user.money)} 💰`)

    user.money -= amount
    rec.tabungan += amount
    rec.kontribusi[c.meNum] = (rec.kontribusi[c.meNum] || 0) + amount
    return say(conn, m,
`🐷 *MENABUNG*

${tag(m.sender)} menyetor ${fmt(amount)} 💰
Saldo bersama: *${fmt(rec.tabungan)}* 💰`, mentions)
  }

  // ── ajukan tarik ──
  if (cmd === 'tariktabungan') {
    const amount = parseAmount(args[0], rec.tabungan)
    if (!amount) return m.reply(`Contoh: ${usedPrefix}tariktabungan 5000\n(bisa 5k, atau all)`)
    if (amount > rec.tabungan) return m.reply(`❌ Saldo tabungan hanya ${fmt(rec.tabungan)} 💰`)

    rec.tarik = { by: c.meNum, amount, at: Date.now() }
    return say(conn, m,
`🏧 *PERMINTAAN TARIK TABUNGAN*

${tag(m.sender)} ingin menarik ${fmt(amount)} 💰
${tag(c.partner)}, setuju?

${usedPrefix}setujutarik  /  ${usedPrefix}tolaktarik
⏱️ Berlaku 1 jam`, mentions)
  }

  // ── setuju / tolak ──
  const req = rec.tarik
  if (!req || Date.now() - req.at > PENDING_TTL) {
    rec.tarik = null
    return m.reply('Tidak ada permintaan tarik tabungan yang menunggu.')
  }
  if (req.by === c.meNum) {
    return m.reply(`❌ Permintaan ini harus disetujui pasanganmu.\nSisa waktu: ${formatRemaining(PENDING_TTL - (Date.now() - req.at))}`)
  }

  if (cmd === 'tolaktarik') {
    rec.tarik = null
    return say(conn, m, `❌ ${tag(m.sender)} menolak penarikan tabungan.`, mentions)
  }

  // setujutarik
  const amount = Math.min(req.amount, rec.tabungan)
  const requesterJid = rec.acct[req.by] || (await partnerJid(conn, c))
  rec.tarik = null
  if (amount <= 0) return m.reply('❌ Saldo tabungan sudah kosong.')

  rec.tabungan -= amount
  rpgUser(requesterJid).money += amount
  return say(conn, m,
`✅ *PENARIKAN DISETUJUI*

${tag(requesterJid)} menerima ${fmt(amount)} 💰
Sisa tabungan: ${fmt(rec.tabungan)} 💰`, [m.sender, c.partner, requesterJid])
}

handler.help = ['couple-tabungan nabung', 'couple-tabungan tabungan', 'couple-tabungan tariktabungan']
handler.tags = ['relationship']
handler.command = ['couple-tabungan', 'nabung', 'tabungan', 'tariktabungan', 'setujutarik', 'tolaktarik']
handler.as = 'nabung'
handler.group = true
handler.exp = 0

export default adapt(handler, { category: 'relationship' })
