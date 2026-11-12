import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakjkt', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakjkt']
export default handler
