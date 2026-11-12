import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('siapakahaku', m, ctx)

handler.tags = ['game']
handler.command = ['siapakahaku']
export default handler
