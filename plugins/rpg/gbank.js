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

// ───────── gbank ─────────
// Dipecah dari plugins/rpg/ekonomi.js (dulu digabung dengan fitur lain dalam satu file)

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmdGbank = rpgCmd(["gbank"], async (A) => {
    const { initRpgUser, sender, m, rpgDb, ensureBankFields, reply, rpgGuildDb, saveGuild, text, fmt, saveRpg, isGuildLeaderOrOfficer } = A
    switch (0) {
        default:
            {
              initRpgUser(sender, m.pushName)
              const me = rpgDb[sender]; ensureBankFields(me)

              if (!me.guild) return reply('⚠️ Kamu belum tergabung guild.')

              // auto-init struktur guild
              rpgGuildDb[me.guild] ??= { bank: 0, leader: null, officers: [], name: `Guild-${me.guild}` }
              const g = rpgGuildDb[me.guild]

              // fallback: kalau belum ada leader, tetapkan user pertama sebagai leader
              if (!g.leader) { g.leader = sender; saveGuild() }

              const args = (text||'').trim().split(/\s+/)
              const aksi = (args[0]||'').toLowerCase()
              const jumlah = parseInt(args[1],10)

              if (!aksi) {
                return reply(
            `🏰 *GUILD BANK*
            gbank saldo                → cek saldo guild
            gbank setor <jumlah>       → setor coin ke guild
            gbank tarik <jumlah>       → tarik (ketua/officer saja)`)
              }

              if (aksi === 'saldo') {
                return reply(`🏦 Saldo Guild *${g.name}*: ${fmt(g.bank)}`)
              }

              if (aksi === 'setor') {
                if (!Number.isInteger(jumlah) || jumlah <= 0) return reply('⚠️ Masukkan jumlah.')
                if (me.coin < jumlah) return reply('❌ Coin tidak cukup.')
                me.coin -= jumlah
                g.bank += jumlah
                saveRpg(); saveGuild()
                return reply(`✅ Setor ${fmt(jumlah)} coin ke bank guild.\nSaldo guild: ${fmt(g.bank)}`)
              }

              if (aksi === 'tarik') {
                const allowed = isGuildLeaderOrOfficer(sender)
                if (!allowed) return reply('❌ Hanya ketua/officer yang boleh tarik.')
                if (!Number.isInteger(jumlah) || jumlah <= 0) return reply('⚠️ Masukkan jumlah.')
                if (g.bank < jumlah) return reply('❌ Saldo guild tidak cukup.')
                g.bank -= jumlah
                me.coin += jumlah
                saveRpg(); saveGuild()
                return reply(`✅ Tarik ${fmt(jumlah)} coin dari bank guild.\nSaldo guild: ${fmt(g.bank)}`)
              }

              return reply('❓ Perintah gbank tidak dikenali.')
            }
    }
}, { tags: 'rpg' })

// satu command = nama file
export default oneCommand(cmdGbank, 'gbank')
