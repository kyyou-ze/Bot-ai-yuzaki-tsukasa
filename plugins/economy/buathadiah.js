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

// ───────── buathadiah ─────────
// Dipecah dari plugins/economy/hadiah.js (dulu digabung dengan fitur lain dalam satu file)
// Code hadiah (redeem) untuk limit:
//   .buathadiah <jumlah>  owner membuat code acak
//   .listhadiah           owner melihat code yang belum dipakai
//   .redeemcode <code>    user menukar code jadi 10-20 limit
// Data tersimpan di pengaturan RPG bot (settings.hadiah & settings.hadiahkadaluwarsa).

import crypto from 'crypto'
import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const MAX_BUAT = 100

function codes(A) {
    const settings = A.botStore().settings
    if (!Array.isArray(settings.hadiah)) settings.hadiah = []
    if (!Array.isArray(settings.hadiahkadaluwarsa)) settings.hadiahkadaluwarsa = []
    return settings
}

const buathadiah = rpgCmd(['buathadiah'], async (A) => {
    const { reply, args } = A
    const jumlah = Number(args[0])
    if (!Number.isInteger(jumlah) || jumlah < 1) return reply('Jumlah Kode Hadiah')
    if (jumlah > MAX_BUAT) return reply(`Maksimal ${MAX_BUAT} code sekali buat.`)

    const { hadiah } = codes(A)
    const baru = []
    for (let i = 0; i < jumlah; i++) {
        const code = crypto.randomBytes(4).toString('hex')
        hadiah.push(code)
        baru.push(code)
    }
    A.saveBot()

    let teks = '\n'
    for (const e of baru) teks += `◦ ${e}\n`
    return reply(teks)
}, { tags: 'economy', desc: 'Buat code hadiah (owner)', owner: true })

// satu command = nama file
export default oneCommand(buathadiah, 'buathadiah')
