import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const fs = (__m => __m.default ?? __m)((await import('node:fs')))
  const path = (__m => __m.default ?? __m)((await import('node:path')))

  const handler = async (m) => {
    const tmpDir = path.resolve(process.cwd(), 'database', 'tmp')
    let deleted = 0
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir)
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(tmpDir, f))
          deleted++
        } catch {}
      }
    }
    await m.reply(`✓ Berhasil membersihkan ${deleted} file sampah di folder tmp.`)
  }
  handler.help = ['cleartmp']
  handler.tags = ['owner']
  handler.command = ['cleartmp']
  handler.owner = true
  return handler
}

rbRegister("owner/cleartmp", feature)

let handler = (m, ctx) => rbRun("owner/cleartmp", m, ctx)

handler.command = ['cleartmp']
handler.help = ["cleartmp"]
handler.tags = ['owner']
handler.owner = true

export default handler
