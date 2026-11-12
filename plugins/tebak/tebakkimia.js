import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakkimia', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakkimia']
export default handler
