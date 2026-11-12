import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakgame', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakgame']
export default handler
