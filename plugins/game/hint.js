import { runGameHint } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGameHint(m, ctx)

handler.tags = ['game']
handler.command = ['hint']
export default handler
