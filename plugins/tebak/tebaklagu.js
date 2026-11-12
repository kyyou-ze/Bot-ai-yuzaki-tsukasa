import { runGame } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runGame('tebaklagu', m, ctx)

handler.tags = ['tebak']
handler.command = ['tebaklagu']
export default handler
