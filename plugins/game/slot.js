import { runSlot } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runSlot(m, ctx)

handler.tags = ['game']
handler.command = ['slot']
export default handler
