// ───────── poker-fold ─────────
// .poker-fold — menyerah di hand ini
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'fold')

handler.command = ['poker-fold']
handler.help = ['poker-fold']
handler.tags = ['poker']
handler.group = true

export default handler
