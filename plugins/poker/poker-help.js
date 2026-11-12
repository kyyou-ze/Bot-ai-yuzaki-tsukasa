// ───────── poker-help ─────────
// .poker-help — aturan main poker
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'help')

handler.command = ['poker-help']
handler.help = ['poker-help']
handler.tags = ['poker']
handler.group = true

export default handler
