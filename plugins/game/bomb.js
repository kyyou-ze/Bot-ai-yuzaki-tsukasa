import { runBomb } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runBomb(m, ctx)

handler.tags = ['game']
handler.command = ['bomb']
export default handler
