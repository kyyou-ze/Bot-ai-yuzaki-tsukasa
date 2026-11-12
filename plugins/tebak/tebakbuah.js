import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakbuah', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakbuah']
export default handler
