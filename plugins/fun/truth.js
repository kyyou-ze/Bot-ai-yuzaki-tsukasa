import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const truths = [
    'Kapan terakhir kali kamu menangis dan karena apa?',
    'Siapa orang di grup ini yang diam-diam kamu kagumi?',
    'Apa rahasia paling memalukan yang belum pernah kamu ceritakan ke siapapun?',
    'Kalau bisa memutar waktu, hal apa yang ingin kamu ubah?',
    'Berapa kali kamu stalking akun mantan dalam seminggu?'
  ]
  const handler = async (m) => {
    const t = truths[Math.floor(Math.random() * truths.length)]
    await m.reply(`╭─── ୨୧ TRUTH CHALLENGE ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა jujur yaa!\n╰─────────────────────────────╯\n\n୨ৎ Pertanyaan: *${t}*`)
  }
  handler.help = ['truth']
  handler.tags = ['fun']
  handler.command = ['truth']
  return handler
}

rbRegister("fun/truth", feature)

let handler = (m, ctx) => rbRun("fun/truth", m, ctx)

handler.command = ['truth']
handler.help = ["truth"]
handler.tags = ['fun']

export default handler
