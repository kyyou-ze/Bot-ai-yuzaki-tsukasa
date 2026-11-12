import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text, usedPrefix, command, reply }) => {
    if (!text) return reply(`*ᴄᴏɴᴛᴏʜ:* ${usedPrefix}${command} teks awal|teks selengkapnya`)

    let [left, ...right] = text.split('|')
    if (!right.length) return reply(`❌ Gunakan pemisah tanda *|*\n*ᴄᴏɴᴛᴏʜ:* ${usedPrefix}${command} Halo|Ini teks sembunyi`)

    const readmore = '\u200e'.repeat(4001)
    reply(`${left.trim()}${readmore}\n${right.join('|').trim()}`)
  }

  handler.help = ['readmore <teks|teks>']
  handler.tags = ['tools']
  handler.command = ['readmore']

  handler.limit = true;
  return handler
}

rbRegister("tools/readmore", feature)

let handler = (m, ctx) => rbRun("tools/readmore", m, ctx)

handler.command = ['readmore']
handler.help = ["readmore <teks|teks>"]
handler.tags = ['tools']

export default handler
