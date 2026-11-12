// ───────── bj-hand ─────────
// .bj-hand — lihat meja
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'hand')

handler.command = ['bj-hand']
handler.help = ['bj-hand']
handler.tags = ['blackjack']
handler.group = true

export default handler
