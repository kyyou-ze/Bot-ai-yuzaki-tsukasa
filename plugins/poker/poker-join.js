// ───────── poker-join ─────────
// .poker-join — ikut meja poker
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'join')

handler.command = ['poker-join']
handler.help = ['poker-join']
handler.tags = ['poker']
handler.group = true

export default handler
