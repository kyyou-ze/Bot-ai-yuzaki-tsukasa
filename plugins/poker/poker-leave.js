// ───────── poker-leave ─────────
// .poker-leave — keluar dari meja & cash out
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'leave')

handler.command = ['poker-leave']
handler.help = ['poker-leave']
handler.tags = ['poker']
handler.group = true

export default handler
