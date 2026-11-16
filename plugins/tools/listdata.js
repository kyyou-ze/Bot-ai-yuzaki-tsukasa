// LIST DATA (ALYA MD) — listbanned & listtoxic
// listbanned: user yang berstatus banned di database.
// listtoxic : daftar kata anti-toxic untuk grup ini (atau bawaan).

const DEFAULT_TOXIC = [
  'anjing', 'bangsat', 'bajingan', 'kontol', 'memek', 'ngentot', 'jancok',
  'tolol', 'goblok', 'babi', 'brengsek', 'kampret',
]

const userOf = (value) => String(value || '').split('@')[0].split(':')[0]

let handler = async (m, { command, reply }) => {
  if (command === 'listbanned') {
    const stores = [global.db?.users, global.db?.rpgData?.users].filter(Boolean)
    const seen = new Set()
    for (const store of stores) {
      for (const [jid, user] of Object.entries(store)) {
        if (user && user.banned) seen.add(jid)
      }
    }
    if (!seen.size) return reply('❌ Tidak ada user yang sedang dibanned.')

    const list = [...seen].slice(0, 100).map((jid) => `• @${userOf(jid)}`)
    const extra = seen.size > 100 ? `\n…dan ${seen.size - 100} lainnya.` : ''
    return m.reply
      ? m.reply(`🚫 *BANNED LIST* (${seen.size})\n\n${list.join('\n')}${extra}`, {
          mentions: [...seen].slice(0, 100),
        })
      : reply(`🚫 *BANNED LIST* (${seen.size})\n\n${list.join('\n')}${extra}`)
  }

  // listtoxic
  const words = global.db?.groups?.[m.chat]?.antitoxic?.words
  const list = Array.isArray(words) && words.length ? words : DEFAULT_TOXIC
  return reply(
    `🗣️ *TOXIC LIST* (${list.length})\n\n${list.map((w) => `• ${w}`).join('\n')}\n\n_Set kata: .antitoxic add/del <kata>_`
  )
}

handler.command = ['listbanned', 'listtoxic']
handler.help = handler.command.slice()
handler.tags = ['tools']
handler.description = 'Daftar user banned dan daftar kata anti-toxic'

export default handler
