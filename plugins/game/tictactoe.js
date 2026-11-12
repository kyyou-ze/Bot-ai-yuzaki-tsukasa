import { runTicTacToe } from '../../lib/engine/plugins.js'

const handler = (m, ctx) => runTicTacToe(m, ctx)

handler.tags = ['game']
handler.command = ['tictactoe']
export default handler
