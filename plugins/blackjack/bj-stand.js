// ───────── bj-stand ─────────
// .bj-stand — berhenti
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'stand')

handler.command = ['bj-stand']
handler.help = ['bj-stand']
handler.tags = ['blackjack']
handler.group = true

export default handler
