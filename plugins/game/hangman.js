import { runHangman } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runHangman(m, ctx)

handler.tags = ['game']
handler.command = ['hangman']
handler.group = true

export default handler
