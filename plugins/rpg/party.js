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

// ───────── party ─────────
// Dipecah dari plugins/rpg/petualangan.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdParty = rpgCmd(["party"], async (A) => {
    const { initRpgUser, sender, pushname, text, rpgDb, reply, m } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, pushname)
              global.partyList = global.partyList || {}

              if (!text) {
                let party = global.partyList[sender] || []
                let daftar = party.map((id, i) => `${i + 1}. ${rpgDb[id]?.name || 'Tidak dikenal'}`).join('\n') || 'Belum ada anggota.'
                reply(`👥 *PARTY-MU:*\n${daftar}`)
                break
              }

              if (m.quoted) {
                let target = m.quoted.sender
                initRpgUser(target)
                global.partyList[sender] ||= []
                if (!global.partyList[sender].includes(target)) {
                  global.partyList[sender].push(target)
                  reply(`✅ ${rpgDb[target].name} telah ditambahkan ke party-mu.`)
                } else {
                  reply(`⚠️ Player sudah ada di party.`)
                }
                break
              }

              reply(`reply ke player yang ingin kamu ajak ke party.`)
              break
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdParty, 'party')
