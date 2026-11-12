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

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdPatroli = rpgCmd(["patroli"], async (A) => {
    const { m, XRG, isBan, XRB, XReaction, Bot, reply } = A
    switch (0) {
        default:
            {
            if (!m.isGroup) return XRG()
            if (isBan) return XRB()
            await XReaction()
              const participants = (await Bot.groupMetadata(m.chat)).participants
              if (participants.length < 4) return reply('Minimal 4 member di grup untuk menjalankan game ini!')
              const memberIDs = participants
                .map(p => p.id)
                .filter(id => id !== Bot.user.jid)
              const shuffled = memberIDs.sort(() => Math.random() - 0.5)
              const polisi = shuffled[0]
              const pencuri = shuffled[1]
              const tahun = Math.floor(Math.random() * 3) + 1;
              const hasil = `🚨 *Patroli Berhasil, Maling Telah Ditemukan!!*\n\n` +
                `👮 Polisi: @${polisi.split('@')[0]}\n` +
                `🕵 Pencuri: @${pencuri.split('@')[0]}\n\n` +
                `!!Pencuri Ditangkap! Dan Dipenjara Selama ${tahun} tahun`

              Bot.sendMessage(m.chat, {
                text: hasil,
                mentions: [polisi, pencuri]
              }, { quoted: m })
            }
            break
    }
}, { tags: 'game' })

const __plugin = cmdPatroli

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'patroli', { subs: false })
