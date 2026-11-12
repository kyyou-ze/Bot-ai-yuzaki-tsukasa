// ───────── poker-start ─────────
// .poker-start — mulai permainan (pembuat meja / admin, min 2 pemain)
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'start')

handler.command = ['poker-start']
handler.help = ['poker-start']
handler.tags = ['poker']
handler.group = true

export default handler
