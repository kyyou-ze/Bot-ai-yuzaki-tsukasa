import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('asahotak', m, ctx)

handler.tags = ['game']
handler.command = ['asahotak']
export default handler
