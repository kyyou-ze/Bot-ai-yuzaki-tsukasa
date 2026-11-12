import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakbenda', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakbenda']
export default handler
