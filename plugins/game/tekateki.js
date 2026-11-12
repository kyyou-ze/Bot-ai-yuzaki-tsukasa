import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tekateki', m, ctx)

handler.tags = ['game']
handler.command = ['tekateki']
export default handler
