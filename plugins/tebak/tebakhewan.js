import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakhewan', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakhewan']
export default handler
