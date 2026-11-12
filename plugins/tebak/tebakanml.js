import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebakanml', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebakanml']
export default handler
