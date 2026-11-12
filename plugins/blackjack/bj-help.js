// ───────── bj-help ─────────
// .bj-help — aturan main blackjack
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'help')

handler.command = ['bj-help']
handler.help = ['bj-help']
handler.tags = ['blackjack']
handler.group = true

export default handler
