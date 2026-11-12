// ───────── poker-raise ─────────
// .poker-raise <total> — naikkan taruhan menjadi total (contoh: .poker-raise 400)
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'raise')

handler.command = ['poker-raise']
handler.help = ['poker-raise']
handler.tags = ['poker']
handler.group = true

export default handler
