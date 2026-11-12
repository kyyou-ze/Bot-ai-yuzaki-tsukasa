import { runGachaPet } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGachaPet(m, ctx)

handler.tags = ['game']
handler.command = ['gachapet']
export default handler
