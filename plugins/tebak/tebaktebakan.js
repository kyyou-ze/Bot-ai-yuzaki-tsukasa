import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebaktebakan', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebaktebakan']
export default handler
