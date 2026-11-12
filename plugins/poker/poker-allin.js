// ───────── poker-allin ─────────
// .poker-allin — pasang semua chip
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'allin')

handler.command = ['poker-allin']
handler.help = ['poker-allin']
handler.tags = ['poker']
handler.group = true

export default handler
