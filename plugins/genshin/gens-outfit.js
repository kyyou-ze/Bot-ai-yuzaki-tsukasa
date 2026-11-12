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

// ───────── gens-outfit ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensOutfit = rpgCmd(["gens-outfit"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply(`Contoh: *${kaguya} outrider*\nHarap berikan nama kostum atau outfit.`);
              try {
                let result = await genshindb.outfits(text);
                if (result) {
                  let response = `*Kostum Ditemukan: ${result.name}*\n\n`;
                  response += `_${result.description || "Deskripsi tidak tersedia"}_\n\n`;
                  response += `*Karakter:* ${result.character || "Data tidak tersedia"}`;
                  if (result.url && result.url.modelviewer) {
                    response += `\n_${result.url.modelviewer}_`;
                  }
                  reply(response);
                } else {
                 reply(`Kostum '${text}' tidak ditemukan.`);
                }
              } catch (error) {
                console.error(error);
                try {
                  let availableOutfits = await genshindb.outfits(text, {
                    matchCategories: true
                  });
                  reply(`*List ${text} outfit :*\n\n- ${availableOutfits.join("\n- ")}`);
                } catch (error) {
                  console.error(error);
                  let availableOutfits = await genshindb.outfits("names", {
                    matchCategories: true
                  });
                  reply(`*Not Found*\n\n*Available outfits is:*\n${availableOutfits.join(", ")}`);
                }
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensOutfit, 'gens-outfit')
