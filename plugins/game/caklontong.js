import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('caklontong', m, ctx)

handler.tags = ['game']
handler.command = ['caklontong']
export default handler
