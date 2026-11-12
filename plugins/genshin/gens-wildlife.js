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

// ───────── gens-wildlife ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensWildlife = rpgCmd(["gens-wildlife"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply(`Contoh: *${kaguya} snowboar*\nHarap berikan nama binatang liar.`);
              try {
                let result = await genshindb.wildlife(text);
                if (result) {
                  let response = `*Binatang Liar Ditemukan: ${result.name}*\n\n` + `_${result.description || "Data tidak tersedia"}_\n\n` + `*Rarity:* ${result.rarity || "Data tidak tersedia"}\n` + `*Habitat:* ${result.habitat || "Data tidak tersedia"}`;
                  reply(response);
                } else {
                  reply("Binatang liar tidak ditemukan.");
                }
              } catch (error) {
                console.error(error);
                let available = await genshindb.wildlife("names", {
                  matchCategories: true
                });
                reply(`*Tidak Ditemukan*\n\n*Binatang liar yang tersedia:* ${available.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensWildlife, 'gens-wildlife')
