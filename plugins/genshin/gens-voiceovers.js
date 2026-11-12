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

// ───────── gens-voiceovers ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensVoiceovers = rpgCmd(["gens-voiceovers"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply( `Contoh: *${kaguya} venti*\nHarap berikan nama voiceover.`);
              try {
                let result = await genshindb.voiceovers(text);
                if (result) {
                  let response = `*Voiceover Ditemukan: ${result.name}*\n\n`;
                  response += `_${result.description || "Deskripsi tidak tersedia"}_\n\n`;
                  response += `*Rarity:* ${result.rarity || "Data tidak tersedia"}`;
                  reply(response);
                } else {
                  reply("Voiceover tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                let available = await genshindb.voiceovers("names", {
                  matchCategories: true
                });
                reply(`*Tidak Ditemukan*\n\n*Voiceover yang tersedia:* ${available.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensVoiceovers, 'gens-voiceovers')
