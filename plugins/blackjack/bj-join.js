// ───────── bj-join ─────────
// .bj-join — ikut meja blackjack
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'join')

handler.command = ['bj-join']
handler.help = ['bj-join']
handler.tags = ['blackjack']
handler.group = true

export default handler
