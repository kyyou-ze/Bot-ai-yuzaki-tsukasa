import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const pantuns = [
    'Masak aer biar mateng,\nKamu manis aku ganteng! (˶ᵔ ᵕ ᵔ˶)',
    'Beli paku di pasar baru,\nCintaku padamu selalu nomor satu! ♡',
    'Jalan-jalan ke Cikini,\nSinggah sebentar beli celana.\nSenyum manismu seindah pelangi,\nBikin hatiku terpesona.',
    'Buah manggis buah pepaya,\nJangan menangis aku kan setia!'
  ]
  const handler = async (m) => {
    const p = pantuns[Math.floor(Math.random() * pantuns.length)]
    await m.reply(`╭─── ୨୧ PANTUN CUTE ୨୧ ───╮\n│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა pantun manis!\n╰─────────────────────────╯\n\n${p}`)
  }
  handler.help = ['pantun']
  handler.tags = ['fun']
  handler.command = ['pantun']
  return handler
}

rbRegister("fun/pantun", feature)

let handler = (m, ctx) => rbRun("fun/pantun", m, ctx)

handler.command = ['pantun']
handler.help = ["pantun"]
handler.tags = ['fun']

export default handler
