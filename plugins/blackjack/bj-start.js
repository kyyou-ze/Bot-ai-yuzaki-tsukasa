// ───────── bj-start ─────────
// .bj-start — mulai ronde (pembuat meja / admin)
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'start')

handler.command = ['bj-start']
handler.help = ['bj-start']
handler.tags = ['blackjack']
handler.group = true

export default handler
