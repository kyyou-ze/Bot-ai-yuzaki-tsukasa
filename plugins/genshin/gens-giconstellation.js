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

// ───────── gens-giconstellation ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensGiconstellation = rpgCmd(["gens-giconstellation"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply(`Contoh: *${kaguya} diluc*\nHarap berikan nama karakter untuk mencari konstelasinya.`);
              try {
                let result = await genshindb.constellations(text);
                if (result && result.length > 0) {
                  let response = `*Konstelasi ditemukan untuk karakter ${text}:*\n\n`;
                  result.forEach((constellation, index) => {
                    response += `*${index + 1}. ${constellation.name}*\n`;
                    response += `_${constellation.effect}_\n\n`;
                    response += `*Unlock At:* C${constellation.unlock || "Data tidak tersedia"}`;
                    if (index < result.length - 1) response += "\n\n";
                  });
                  reply(response);
                } else {
                  reply(`Konstelasi untuk karakter '${text}' tidak ditemukan.`);
                }
              } catch (error) {
                console.error(error);
                reply(`*Tidak Ditemukan*\n\n*Konstelasi untuk karakter '${text}' tidak ditemukan.`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensGiconstellation, 'gens-giconstellation')
