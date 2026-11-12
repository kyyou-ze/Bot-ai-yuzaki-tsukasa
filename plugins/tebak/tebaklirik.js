import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebaklirik', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebaklirik']
export default handler
