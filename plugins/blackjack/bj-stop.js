// ───────── bj-stop ─────────
// .bj-stop — batalkan meja (pembuat / admin)
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'stop')

handler.command = ['bj-stop']
handler.help = ['bj-stop']
handler.tags = ['blackjack']
handler.group = true

export default handler
