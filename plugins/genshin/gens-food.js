/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

// ───────── gens-food ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensFood = rpgCmd(["gens-food"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply(`Contoh: *${kaguya} temptation*\nHarap berikan nama makanan.`);
              try {
                let result = await genshindb.foods(text);
                if (result) {
                  let response = `*Makanan Ditemukan: ${result.name}*\n\n`;
                  response += `_"${result.description}"_\n\n`;
                  response += `*Rarity:* ${result.rarity}\n`;
                  response += `*Type:* ${result.foodtype}\n`;
                  response += `*Category:* ${result.foodfilter} (${result.foodcategory})\n\n`;
                  if (result.effect) {
                    response += `*Effect:*\n${result.effect}\n\n`;
                  }
                  if (result.suspicious) {
                    response += `*Suspicious:*\n${result.suspicious.effect}\n_"${result.suspicious.description}"_\n\n`;
                  }
                  if (result.normal) {
                    response += `*Normal:*\n${result.normal.effect}\n_"${result.normal.description}"_\n\n`;
                  }
                  if (result.delicious) {
                    response += `*Delicious:*\n${result.delicious.effect}\n_"${result.delicious.description}"_\n\n`;
                  }
                  reply(response);
                } else {
                  reply("Makanan tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                let available = await genshindb.foods("names", {
                  matchCategories: true
                });
                reply(`*Tidak Ditemukan*\n\n*Makanan yang tersedia:* ${available.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensFood, 'gens-food')
