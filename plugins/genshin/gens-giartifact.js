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

// ───────── gens-giartifact ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensGiartifact = rpgCmd(["gens-giartifact"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply( `Contoh: *${kaguya} berserker*\nHarap berikan nama artefak.`);
              try {
                let result = await genshindb.artifacts(text);
                if (result) {
                  let response = `*Artefak Ditemukan: ${result.name}*\n\n`;
                  response += `_${result.description}_\n\n`;
                  response += `*Set:* ${result.set || "Data tidak tersedia"}\n`;
                  response += `*Rarity:* ${result.rarity || "Data tidak tersedia"}\n`;
                  response += `*Slot:* ${result.slot || "Data tidak tersedia"}`;
                  reply(response);
                } else {
                  reply("Artefak tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                let available = await genshindb.artifacts("names", {
                  matchCategories: true
                });
                reply(`*Tidak Ditemukan*\n\n*Artefak yang tersedia:* ${available.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensGiartifact, 'gens-giartifact')
