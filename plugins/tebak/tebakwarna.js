import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakwarna', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakwarna']
export default handler
