import { runAkinator } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runAkinator(m, ctx)

handler.tags = ['game']
handler.command = ['akinator']
export default handler
