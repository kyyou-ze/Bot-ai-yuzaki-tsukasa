// ───────── poker-stop ─────────
// .poker-stop — bubarkan meja (pembuat / admin)
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'stop')

handler.command = ['poker-stop']
handler.help = ['poker-stop']
handler.tags = ['poker']
handler.group = true

export default handler
