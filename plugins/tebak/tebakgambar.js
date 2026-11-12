import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakgambar', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakgambar']
export default handler
