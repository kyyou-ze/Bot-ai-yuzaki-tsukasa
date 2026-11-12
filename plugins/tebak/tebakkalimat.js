import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakkalimat', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakkalimat']
export default handler
