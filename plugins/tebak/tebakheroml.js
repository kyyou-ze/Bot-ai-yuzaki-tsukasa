import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakheroml', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakheroml']
export default handler
