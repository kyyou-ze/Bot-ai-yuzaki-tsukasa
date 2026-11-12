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

// ───────── redeemcode ─────────
// Dipecah dari plugins/economy/hadiah.js (dulu digabung dengan fitur lain dalam satu file)
// Code hadiah (redeem) untuk limit:
//   .buathadiah <jumlah>  owner membuat code acak
//   .listhadiah           owner melihat code yang belum dipakai
//   .redeemcode <code>    user menukar code jadi 10-20 limit
// Data tersimpan di pengaturan RPG bot (settings.hadiah & settings.hadiahkadaluwarsa).

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

function codes(A) {
    const settings = A.botStore().settings
    if (!Array.isArray(settings.hadiah)) settings.hadiah = []
    if (!Array.isArray(settings.hadiahkadaluwarsa)) settings.hadiahkadaluwarsa = []
    return settings
}

const redeemcode = rpgCmd(['redeemcode'], async (A) => {
    const { reply, args, sender, XReaction } = A
    await XReaction()

    const code = args[0]
    if (!code) return reply('Codenya')
    if (code !== code.toLowerCase()) return reply('*Code Redeem* wajib huruf kecil semua!')

    const settings = codes(A)
    if (settings.hadiahkadaluwarsa.includes(code)) return reply('*Code* tersebut sudah digunakan!')
    const index = settings.hadiah.indexOf(code)
    if (index < 0) return reply('*Code* tidak valid!')

    settings.hadiahkadaluwarsa.push(code)
    settings.hadiah.splice(index, 1)

    const bonus = A.randomNumber(10, 20)
    const user = A.botUser()
    user.limit = (Number(user.limit) || 0) + bonus
    A.saveBot()

    return reply(`Selamat kepada @${sender.split('@')[0]} 🎉\n\nkamu mendapatkan *${bonus} Limit* dari *Code Redeem "${code}"*`)
}, { tags: 'economy', desc: 'Tukar code hadiah jadi limit' })

// satu command = nama file
export default oneCommand(redeemcode, 'redeemcode')
