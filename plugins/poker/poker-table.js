// ───────── poker-table ─────────
// .poker-table — lihat meja, pot, dan chip pemain
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'table')

handler.command = ['poker-table']
handler.help = ['poker-table']
handler.tags = ['poker']
handler.group = true

export default handler
