import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebaksurah', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebaksurah']
export default handler
