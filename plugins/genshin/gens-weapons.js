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

// ───────── gens-weapons ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensWeapons = rpgCmd(["gens-weapons"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
            if (!text) return reply(`Contoh: *${kaguya} claymore*\nHarap berikan nama senjata.`);
              try {
                let result = await genshindb.weapons(text);
                if (result) {
                  let response = `*Senjata Ditemukan: ${result.name}*\n\n` + `_${result.description || "Data tidak tersedia"}_\n\n` + `*Rarity:* ${result.rarity || "Data tidak tersedia"}\n` + `*Type:* ${result.type || "Data tidak tersedia"}\n` + `*Base ATK:* ${result.baseAttack || "Data tidak tersedia"}\n` + `*Substat:* ${result.subStat || "Data tidak tersedia"}\n` + `*Passive Name:* ${result.passiveName || "Data tidak tersedia"}\n` + `*Passive Description:* ${result.passiveDescription || "Data tidak tersedia"}\n` + (result.refinement ? `\n*Refinement (${result.refinement.refine}):* ${result.refinement.description || "Data tidak tersedia"}\n` : "");
                  reply(response);
                } else {
                  reply("Senjata tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                let available = await genshindb.weapons("names", {
                  matchCategories: true
                });
                reply(`*Tidak Ditemukan*\n\n*Senjata yang tersedia:* ${available.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensWeapons, 'gens-weapons')
