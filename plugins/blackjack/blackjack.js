// ───────── blackjack ─────────
// .bj <taruhan> — buat meja blackjack di grup (contoh: .bj 5000). Sub-perintah lain juga jalan: .bj join, .bj hit, dst.
// Mesin game ada di lib/group/sosial.js.
import { blackjackRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => blackjackRun(m, ctx, 'create')

handler.command = ['blackjack', 'bj']
handler.help = ['blackjack']
handler.tags = ['blackjack']
handler.group = true

export default handler
