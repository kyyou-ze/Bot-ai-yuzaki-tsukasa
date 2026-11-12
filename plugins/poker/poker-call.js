// ───────── poker-call ─────────
// .poker-call — samakan taruhan
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'call')

handler.command = ['poker-call']
handler.help = ['poker-call']
handler.tags = ['poker']
handler.group = true

export default handler
