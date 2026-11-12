import { runSambungKata } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runSambungKata(m, ctx)

handler.tags = ['game']
handler.command = ['sambungkata']
handler.group = true

export default handler
