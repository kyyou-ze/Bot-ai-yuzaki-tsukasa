import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakbendera', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakbendera']
export default handler
