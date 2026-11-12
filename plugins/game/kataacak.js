import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('kataacak', m, ctx)

handler.tags = ['game']
handler.command = ['kataacak']
export default handler
