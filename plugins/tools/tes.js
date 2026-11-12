import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  let handler = async (m, { sock, usedPrefix, command }) => {
    await m.reply(`${global.namebot} aktif! [${usedPrefix}${command}]`)
  }

  handler.command = ['tes']
  handler.owner = false
  handler.premium = false
  handler.group = false
  handler.private = false
  handler.admin = false
  handler.botadmin = false
  handler.noJadiBot = false
  return handler
}

rbRegister("tools/tes", feature)

let handler = (m, ctx) => rbRun("tools/tes", m, ctx)

handler.command = ['tes']
handler.tags = ['tools']

export default handler
