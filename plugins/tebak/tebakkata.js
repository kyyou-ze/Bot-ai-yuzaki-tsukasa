import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakkata', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakkata']
export default handler
