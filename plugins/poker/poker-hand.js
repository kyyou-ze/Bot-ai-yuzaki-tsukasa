// ───────── poker-hand ─────────
// .poker-hand — kirim ulang kartu pribadi (boleh dipakai di chat pribadi bot)
// Mesin game ada di lib/group/sosial.js.
import { pokerRun } from '../../lib/group/sosial.js'

let handler = (m, ctx) => pokerRun(m, ctx, 'hand')

handler.command = ['poker-hand']
handler.help = ['poker-hand']
handler.tags = ['poker']
handler.group = false

export default handler
