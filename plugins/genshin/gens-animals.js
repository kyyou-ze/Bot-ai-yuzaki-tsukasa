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

// ───────── gens-animals ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensAnimals = rpgCmd(["gens-animals"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply( `Contoh: *${kaguya} shiba*\nHarap berikan nama hewan.`);
              try {
                let animal = await genshindb.animals(text);
                if (animal) {
                  let response = `*Hewan Ditemukan: ${animal.name}*\n\n`;
                  response += `"${animal.description}"\n\n`;
                  response += `*Kategori:* ${animal.category || ""}\n`;
                  response += `*Jenis Hitungan:* ${animal.counttype || ""}\n`;
                  response += `_${animal.sortorder ? `Urutan Sortir: ${animal.sortorder}` : ""}_`;
                  reply(response);
                } else {
                  reply("Hewan tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                try {
                  let animalCategories = await genshindb.animals(text, {
                    matchCategories: true
                  });
                  reply(`*Kategori Hewan ${text} :*\n\n- ${animalCategories.join("\n- ")}`);
                } catch (error) {
                  console.error(error);
                  let allAnimalNames = await genshindb.animals("names", {
                    matchCategories: true
                  });
                  reply(`*Tidak Ditemukan*\n\n*Hewan yang tersedia:* ${allAnimalNames.join(", ")}`);
                }
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensAnimals, 'gens-animals')
