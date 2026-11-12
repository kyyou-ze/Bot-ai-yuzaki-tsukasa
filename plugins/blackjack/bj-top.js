// ───────── bj-top ─────────
// .bj-top — peringkat untung terbesar di grup
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'top')

handler.command = ['bj-top']
handler.help = ['bj-top']
handler.tags = ['blackjack']
handler.group = true

export default handler
