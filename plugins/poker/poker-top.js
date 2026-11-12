// ───────── poker-top ─────────
// .poker-top — peringkat untung terbesar di grup
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'top')

handler.command = ['poker-top']
handler.help = ['poker-top']
handler.tags = ['poker']
handler.group = true

export default handler
