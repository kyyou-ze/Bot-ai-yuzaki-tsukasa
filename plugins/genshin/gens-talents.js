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

// ───────── gens-talents ─────────
// Dipecah dari plugins/game/genshin.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGensTalents = rpgCmd(["gens-talents"], async (A) => {
    const { isBan, XRB, XReaction, text, reply, kaguya } = A
    const genshindb = await A.loadGenshin().catch(() => null)
    if (!genshindb) return A.reply('Modul *genshin-db* belum terpasang. Jalankan: npm i genshin-db')
    switch (0) {
        default:
            {
            if (isBan) return XRB()
            await XReaction()
              if (!text) return reply(`Contoh: *${kaguya} diluc*\nHarap berikan nama karakter untuk mencari bakatnya.`);
              try {
                let result = await genshindb.talents(text);
                if (result && result.length > 0) {
                  let response = `*Bakat ditemukan untuk karakter ${text}:*\n\n`;
                  result.forEach((talent, index) => {
                    response += `*${index + 1}. ${talent.name}*\n`;
                    response += `_${talent.description || "Deskripsi tidak tersedia"}_\n\n`;
                    response += `*Jenis:* ${talent.type || "Data tidak tersedia"}\n`;
                    response += `*Element:* ${talent.element || "Data tidak tersedia"}\n\n`;
                  });
                  reply(response);
                } else {
                 reply(`Bakat untuk karakter '${text}' tidak ditemukan.`);
                }
              } catch (error) {
                console.error(error);
                reply(`*Tidak Ditemukan*\n\n*Bakat untuk karakter '${text}' tidak ditemukan.`);
              }
            };
            break
    }
}, { tags: 'genshin' })

// satu command = nama file
export default oneCommand(cmdGensTalents, 'gens-talents')
