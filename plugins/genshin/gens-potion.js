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

// ───────── gens-potion ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensPotion = rpgCmd(["gens-potion"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply(`Contoh: *${kaguya} squirrel fish*\nHarap berikan nama ramuan atau makanan.`)
              try {
                let result = await genshindb.foods(text);
                if (result) {
                  let response = `*Ramuan atau Makanan Ditemukan: ${result.name}*\n\n`;
                  response += `_${result.description || "Deskripsi tidak tersedia"}_\n\n`;
                  response += `*Rarity:* ${result.rarity || "Data tidak tersedia"}\n`;
                  response += `*Efek:* ${result.effect || "Data tidak tersedia"}`;
                  reply(response);
                } else {
                  reply(`Ramuan atau makanan '${text}' tidak ditemukan.`);
                }
              } catch (error) {
                console.error(error);
                try {
                  let availableFoods = await genshindb.foods("names", {
                    matchCategories: true
                  });
                  reply(`*List ${text} foods :*\n\n- ${availableFoods.join("\n- ")}`);
                } catch (error) {
                  console.error(error);
                  let availableFoods = await genshindb.foods("names", {
                    matchCategories: true
                  });
                  reply(`*Not Found*\n\n*Available foods is :*\n${availableFoods.join(", ")}`);
                }
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensPotion, 'gens-potion')
