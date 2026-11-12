import { runMinesweeper } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runMinesweeper(m, ctx)

handler.tags = ['game']
handler.command = ['minesweeper']
export default handler
