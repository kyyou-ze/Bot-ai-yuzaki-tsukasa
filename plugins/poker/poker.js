// ───────── poker ─────────
// .poker <buy-in> — buat meja poker Texas Hold'em di grup (contoh: .poker 10000). Sub-perintah juga jalan: .poker join, .poker raise 400, dst.
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'create')

handler.command = ['poker']
handler.help = ['poker']
handler.tags = ['poker']
handler.group = true

export default handler
