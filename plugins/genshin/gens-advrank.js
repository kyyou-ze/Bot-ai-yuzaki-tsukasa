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

// ───────── gens-advrank ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensAdvrank = rpgCmd(["gens-advrank"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
                if (!text || isNaN(parseInt(text))) {
                  return reply(`Masukkan nomor peringkat petualang yang valid. Contoh: *${kaguya} 5*`);
                }
                try {
                let rankNumber = parseInt(text);
                let result = await genshindb.adventureranks(rankNumber);
                if (result) {
                  let response = `*Rank Petualang Ditemukan untuk Rank ${rankNumber}:*\n\n`;
                  response += `*Experience:* ${result.exp || "Data tidak tersedia"}\n`;
                  response += `*Reward:* ${result.reward || "Data tidak tersedia"}\n`;
                  response += `*Deskripsi:* ${result.description || "Data tidak tersedia"}`;
                  reply(response);
                } else {
                  reply(`Rank petualang untuk Rank ${rankNumber} tidak ditemukan.`);
                }
              } catch (error) {
                console.error(error);
                let availableRanks = await genshindb.adventureranks("names");
                reply(`*Tidak Ditemukan*\n\n*Rank petualang yang tersedia:* ${availableRanks.join(", ")}`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensAdvrank, 'gens-advrank')
