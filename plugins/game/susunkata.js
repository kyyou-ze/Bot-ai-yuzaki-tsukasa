import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('susunkata', m, ctx)

handler.tags = ['game']
handler.command = ['susunkata']
export default handler
