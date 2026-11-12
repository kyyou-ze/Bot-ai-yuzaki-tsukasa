import { adapt } from '../../lib/engine/plugins.js'
import { activeEvents } from '../../lib/engine/features.js'
let handler = async (m, { conn }) => {
  let e = global.rpg.emoticon
  let text = `
*${(global.namebot || 'BOT').toUpperCase()} RPG SHOP* ❀

━━━━━━━━━━━━━━
🛒 *ITEM SHOP*

${e('potion')} Potion : 5000
${e('sword')} Sword : 15000
${e('pickaxe')} Pickaxe : 10000
${e('fishingrod')} Fishing Rod : 12000
${e('armor')} Armor : 20000

🪱 Bait : 1000
🌱 Fertilizer : 2500

━━━━━━━━━━━━━━
🎁 *CRATE SHOP*

📦 Common Crate : 10000
📦 Uncommon Crate : 25000
🎁 Mythic Crate : 75000
🗃️ Legendary Crate : 200000

━━━━━━━━━━━━━━
📌 *Cara Membeli*

.buy nama_item jumlah

Contoh:
.buy potion
.buy potion 5
.buy sword
.buy common 3
.buy mythic 2

━━━━━━━━━━━━━━
💡 *Daftar Nama Item*

• potion
• sword
• pickaxe
• fishingrod
• armor
• bait
• fertilizer
• common
• uncommon
• mythic
• legendary

━━━━━━━━━━━━━━
✦ ${global.namebot || 'Bot'} RPG System
`.trim()

  let promo = activeEvents()
  if (promo.length) text += '\n\n🎉 *EVENT AKTIF*\n' + promo.map(ev => `• ${ev.nama}${ev.diskon ? ` — diskon ${ev.diskon}%` : ''}${ev.barang ? ' (+ barang spesial)' : ''}`).join('\n') + '\nLihat: .eventshop'

  await conn.sendMessage(m.chat, {
    text
  }, { quoted: m })
}

handler.help = ['rpg-shop']
handler.tags = ['rpg']
handler.command = ['rpg-shop']
handler.group = true

export default adapt(handler, { category: 'rpg' })
