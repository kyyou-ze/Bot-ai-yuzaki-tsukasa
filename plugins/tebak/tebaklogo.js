import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebaklogo', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebaklogo']
export default handler
