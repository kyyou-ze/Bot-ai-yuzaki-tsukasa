import { adapt, funStore, say, tag, fmt, formatDuration, LEVELS } from '../../lib/engine/plugins.js'
import { jidNumber } from '../../lib/core/system.js'

let handler = async (m, { conn }) => {
  const fun = funStore()
  const seen = new Set()
  const list = []

  for (const [numA, e] of Object.entries(fun.pacar)) {
    const numB = jidNumber(e.with)
    const back = fun.pacar[numB]
    if (!back || jidNumber(back.with) !== numA) continue
    const key = [numA, numB].sort().join('_')
    if (seen.has(key)) continue
    seen.add(key)

    const rec = fun.couple[key]
    const ok = rec && rec.since === e.since
    list.push({
      a: back.with, b: e.with, since: e.since,
      love: ok ? rec.love : 0,
      status: ok ? rec.status : 'pacaran'
    })
  }

  if (!list.length) return m.reply('💔 Belum ada pasangan sama sekali.')

  list.sort((x, y) => y.love - x.love || x.since - y.since)
  const top = list.slice(0, 10)
  const medal = ['🥇', '🥈', '🥉']
  const now = Date.now()

  const rows = top.map((c, i) =>
    `${medal[i] || `${i + 1}.`} ${tag(c.a)} ${LEVELS[c.status].icon} ${tag(c.b)}\n ${fmt(c.love)} LP • ⏳ ${formatDuration(now - c.since)}`
  ).join('\n\n')

  say(conn, m,
`🏆 *TOP COUPLE*

${rows}

Total pasangan: ${list.length}`,
    top.flatMap(c => [c.a, c.b]))
}

handler.help = ['couple-top']
handler.tags = ['relationship']
handler.command = ['couple-top']
handler.group = true
handler.exp = 0

export default adapt(handler, { category: 'relationship' })
