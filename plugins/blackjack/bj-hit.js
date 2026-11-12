// ───────── bj-hit ─────────
// .bj-hit — ambil kartu
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'hit')

handler.command = ['bj-hit']
handler.help = ['bj-hit']
handler.tags = ['blackjack']
handler.group = true

export default handler
