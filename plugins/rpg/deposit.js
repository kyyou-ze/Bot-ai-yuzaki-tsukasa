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

// ───────── deposit ─────────
// Dipasang dari menu RPG Kaguya (.deposit). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["deposit"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, fmt, hms, saveRpg, bankCfg, ensureBankFields, pushLog, prefix } = A
    initRpgUser(sender, pushname)
    const me = rpgDb[sender]
    ensureBankFields(me)

    const args = String(text || '').trim().split(/\s+/)
    const aksi = (args[0] || '').toLowerCase()
    const jumlah = parseInt(args[1], 10)
    const durasiJam = parseInt(args[2], 10)

    if (!aksi) {
        return reply(
`⏳ *DEPOSIT BERJANGKA*
${prefix}deposit buat <jumlah> <jam> → lock coin dari tabungan, bunga 10% saat cair
${prefix}deposit cek                  → cek status
${prefix}deposit cair                 → cairkan jika jatuh tempo
${prefix}deposit batal                → batalkan sebelum jatuh tempo (kena penalti 5%)`)
    }

    if (aksi === 'buat') {
        if (me.deposit.amount > 0) return reply('❌ Kamu sudah punya deposito aktif.')
        if (!Number.isInteger(jumlah) || jumlah < bankCfg.minAmount) return reply(`⚠️ Minimal deposit ${fmt(bankCfg.minAmount)}.`)
        if (!Number.isInteger(durasiJam) || durasiJam < 1) return reply('⚠️ Durasi minimal 1 jam.')
        if (me.bank < jumlah) return reply('❌ Tabungan tidak cukup. Setor dulu dengan *' + prefix + 'bank simpan <jumlah>*.')

        me.bank -= jumlah
        me.deposit = { amount: jumlah, until: Date.now() + durasiJam * 3600000 }
        pushLog(me, `DEPOSIT BUAT -${fmt(jumlah)} (${durasiJam} jam)`)
        saveRpg()
        return reply(`✅ Deposit ${fmt(jumlah)} coin dibuat untuk ${durasiJam} jam.`)
    }

    if (aksi === 'cek') {
        if (me.deposit.amount <= 0) return reply('❌ Tidak ada deposito.')
        const sisa = me.deposit.until - Date.now()
        return reply(`💰 Deposito: ${fmt(me.deposit.amount)} coin\n⏳ Sisa waktu: ${sisa > 0 ? hms(sisa) : 'sudah jatuh tempo, cairkan dengan *' + prefix + 'deposit cair*'}`)
    }

    if (aksi === 'cair') {
        if (me.deposit.amount <= 0) return reply('❌ Tidak ada deposito.')
        if (Date.now() < me.deposit.until) return reply('⏳ Belum jatuh tempo.')
        const bunga = Math.floor(me.deposit.amount * 0.10)
        const total = me.deposit.amount + bunga
        me.bank += total
        pushLog(me, `DEPOSIT CAIR +${fmt(total)} (termasuk bunga 10%)`)
        me.deposit = { amount: 0, until: 0 }
        saveRpg()
        return reply(`✅ Deposito cair! Kamu dapat ${fmt(total)} coin (bunga 10%).`)
    }

    if (aksi === 'batal') {
        if (me.deposit.amount <= 0) return reply('❌ Tidak ada deposito.')
        // penalti 5% jika batal sebelum jatuh tempo
        const penalti = Math.floor(me.deposit.amount * 0.05)
        const kembali = me.deposit.amount - penalti
        me.bank += Math.max(0, kembali)
        global.bankCentral += penalti // penalti masuk bank pusat
        pushLog(me, `DEPOSIT BATAL +${fmt(kembali)} (penalti ${fmt(penalti)})`)
        me.deposit = { amount: 0, until: 0 }
        saveRpg()
        return reply(`⚠️ Deposit dibatalkan. Kembali ${fmt(kembali)} coin (penalti ${fmt(penalti)}).`)
    }

    return reply('❓ Perintah deposit tidak dikenali.')
}, { tags: 'rpg', desc: 'Deposit berjangka (buat, cek, cair, batal)' })

// satu command = nama file
export default oneCommand(cmd, 'deposit')
