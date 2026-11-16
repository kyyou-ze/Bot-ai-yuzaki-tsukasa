// COUPLE (ALYA MD) — pasangan acak dari member grup.
// Command: couple / cp

let handler = async (m, { sock, jid, participants, groupMetadata }) => {
  const list = (participants && participants.length
    ? participants
    : groupMetadata?.participants || []
  )
    .map((p) => p.id || p.phoneNumber || p.jid)
    .filter(Boolean)

  // Buang duplikat & JID bot sendiri.
  const botIds = [sock?.user?.id, sock?.user?.lid].filter(Boolean).map(String)
  const unique = [...new Set(list.map(String))].filter((id) => !botIds.includes(id))

  if (unique.length < 2) {
    return m.reply('Butuh minimal 2 member di grup ini untuk mengacak pasangan.')
  }

  const shuffled = unique.sort(() => Math.random() - 0.5)
  const [a, b] = shuffled
  const text = `🎲 *Random Best Couple*: @${a.split('@')[0]} 💞 @${b.split('@')[0]}`

  await sock.sendMessage(jid, { text, mentions: [a, b] }, { quoted: m })
  return true
}

handler.command = ['couple', 'cp']
handler.help = ['couple']
handler.tags = ['group']
handler.group = true
handler.description = 'Pilih dua member grup secara acak sebagai pasangan'

export default handler
