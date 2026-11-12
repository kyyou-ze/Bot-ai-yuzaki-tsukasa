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

// ───────── gens-area ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensArea = rpgCmd(["gens-area"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
            if (!text) return reply(`Contoh: *${kaguya} liyue*\nHarap berikan nama tempat.`);
              try {
                let result = await genshindb.geographies(text);
                if (result) {
                  let response = `*Info Geografi: ${result.name}*\n\n`;
                  response += `_${result.description}_\n\n`;
                  response += `*Area:* ${result.area || "Data tidak tersedia"}\n`;
                  response += `*Region:* ${result.region || "Data tidak tersedia"}\n`;
                  response += `*Urutan Sortir:* ${result.sortorder || "Data tidak tersedia"}`;
                  reply(response);
                } else {
                  reply("Geografi tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                let available = await genshindb.geographies("names", {
                  matchCategories: true
                });
                reply(`*Tidak Ditemukan*\n\n*Geografi yang tersedia:* ${available.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensArea, 'gens-area')
