// ───────── bj-double ─────────
// .bj-double — taruhan x2, ambil 1 kartu lalu stand (hanya di 2 kartu pertama)
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'double')

handler.command = ['bj-double']
handler.help = ['bj-double']
handler.tags = ['blackjack']
handler.group = true

export default handler
