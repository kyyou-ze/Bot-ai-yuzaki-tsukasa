import { runDadu } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runDadu(m, ctx)

handler.tags = ['game']
handler.command = ['dadu']
export default handler
