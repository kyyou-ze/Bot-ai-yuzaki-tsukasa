// ───────── poker-check ─────────
// .poker-check — lewat tanpa menambah taruhan
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'check')

handler.command = ['poker-check']
handler.help = ['poker-check']
handler.tags = ['poker']
handler.group = true

export default handler
