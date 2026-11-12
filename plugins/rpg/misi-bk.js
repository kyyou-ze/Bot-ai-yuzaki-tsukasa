import { adapt } from '../../lib/engine/plugins.js'
let handler = async (m, { conn, usedPrefix }) => {
    let caption = `
🚨 Silahkan Pilih Misi Kamu:

🛵 Ojek
🚀 Roket
👮 Polisi
🚶 Rob
☠️ Hitman
🚖 Taxy

Contoh:
${usedPrefix}ojek
`.trim()
    m.reply(caption)
}
handler.help = ['misi']
handler.tags = ['rpg']
handler.command = ['misi-bk']
handler.register = true
handler.group = true
handler.rpg = true
export default adapt(handler, { category: 'rpg' })
