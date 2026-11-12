import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakepep', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakepep']
export default handler
