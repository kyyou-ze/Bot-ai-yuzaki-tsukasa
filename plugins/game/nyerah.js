import { runGameGiveUp } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGameGiveUp(m, ctx)

handler.tags = ['game']
handler.command = ['nyerah']
export default handler
