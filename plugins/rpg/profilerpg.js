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

// ───────── profilerpg ─────────
// Dipecah dari plugins/rpg/ekonomi.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdProfilerpg = rpgCmd(["profilerpg"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, reply } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              let user = rpgDb[sender]
              
              let teks = `
            ╭───[ *🧍 PROFIL RPG* ]
            │ 🎖️ Nama     : ${pushname}
            │ 🆔 ID       : ${sender.split('@')[0]}
            │ 🧪 Level    : ${user.level || 1}
            │ ⚔️ Kelas    : ${user.class || 'Belum dipilih'}
            │ 🌀 Elemen   : ${user.element || 'Netral'}
            │ 🧠 Skill    : ${user.skill || 'Belum punya'}
            │ ✨ Talent   : ${user.talent || 'Belum aktif'}
            │ 📦 Pasif    : ${user.passive || 'Belum ada'}
            │ 💫 Buff     : ${user.buff || '-'}
            │ 🔥 Debuff   : ${user.debuff || '-'}

            │ 💰 Coin     : ${user.coin || 0}
            │ 🧾 EXP      : ${user.exp || 0}
            │ 🎁 Limit    : ${user.limit || 0}
            │ 🧤 Equip    : ${user.equip ? user.equip.join(', ') : 'Tidak ada'}
            │ 🎒 Barang   : ${user.inv.length > 0 ? user.inv.join(', ') : 'Kosong'}

            │ 📍 Lokasi   : ${user.location || 'Kota Awal'}
            │ 🐴 Mount    : ${user.mount || 'Tidak ada'}
            │ 🧿 Spirit   : ${user.spirit || 'Tidak aktif'}
            │ 🧬 Status   : ${user.death ? 'Mati' : 'Hidup'}

            │ 🏆 Medal    : ${user.medal || 0}
            │ 📜 Prestige : ${user.prestige || 0}
            ╰───────────────`
              
              reply(teks)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdProfilerpg, 'profilerpg')
