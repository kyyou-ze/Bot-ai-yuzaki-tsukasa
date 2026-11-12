import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const facts = [
    'Madu murni adalah satu-satunya makanan yang tidak pernah basi, bahkan setelah ribuan tahun!',
    'Jantung paus biru berukuran sebesar mobil kecil dan detaknya terdengar hingga radius 3 kilometer. 🐋',
    'Kucing menghabiskan sekitar 70% dari hidupnya untuk tidur. ( ˘͈ ᵕ ˘͈ ) 🐱',
    'Semut tidak pernah tidur dan tidak memiliki paru-paru. 🐜',
    'Sidik jari koala sangat mirip dengan sidik jari manusia hingga sulit dibedakan di bawah mikroskop. 🐨',
    'Air panas akan membeku lebih cepat daripada air dingin (efek Mpemba). ❄️',
    'Gurita memiliki 3 jantung dan darah mereka berwarna biru. 🐙',
    'Satu sendok teh bintang neutron memiliki berat sekitar 6 miliar ton! 🌌',
    'Pisang secara botani tergolong sebagai buah beri, sedangkan stroberi bukan!',
    'Kupu-kupu merasakan makanan menggunakan kakinya. 🦋'
  ]

  const handler = async (m) => {
    const item = facts[Math.floor(Math.random() * facts.length)]
    await m.reply(
      `╭─── ୨୧ FAKTA UNIK ୨୧ ───╮\n` +
      `│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა tahukah kamu?\n` +
      `╰─────────────────────────╯\n\n` +
      `୨ৎ *Fakta Dunia:*\n${item}\n\n` +
      `꒰ა ♡ ໒꒱ wawasan baru bersama ${global.namebot}!`
    )
  }

  handler.help = ['faktaunik', 'fakta']
  handler.tags = ['tools']
  handler.command = ['faktaunik']
  return handler
}

rbRegister("tools/faktaunik", feature)

let handler = (m, ctx) => rbRun("tools/faktaunik", m, ctx)

handler.command = ['faktaunik']
handler.help = ["faktaunik", "fakta"]
handler.tags = ['tools']

export default handler
