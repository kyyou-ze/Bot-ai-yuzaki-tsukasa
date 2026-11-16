import { runGameGiveUp } from '../../lib/engine/plugins.js'
import { quizSkip } from '../quiz/_engine.js'

// Cek kuis ALYA dulu; kalau tidak ada kuis berjalan, pakai nyerah game biasa.
const handler = async (m, ctx) => {
  if (quizSkip(m, ctx)) return true
  return runGameGiveUp(m, ctx)
}

handler.tags = ['game']
handler.command = ['nyerah']
export default handler
