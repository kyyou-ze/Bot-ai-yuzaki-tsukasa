import { runGameHint } from '../../lib/engine/plugins.js'
import { quizHint } from '../quiz/_engine.js'

// Cek kuis ALYA dulu; kalau tidak ada kuis berjalan, pakai hint game biasa.
const handler = async (m, ctx) => {
  if (quizHint(m, ctx)) return true
  return runGameHint(m, ctx)
}

handler.tags = ['game']
handler.command = ['hint']
export default handler
