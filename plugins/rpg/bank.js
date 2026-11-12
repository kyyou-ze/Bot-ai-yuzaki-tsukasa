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

// ───────── bank ─────────
// Dipasang dari menu RPG Kaguya (.bank). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["bank"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, text, reply, fmt, hms, saveRpg, bankCfg, ensureBankFields, pushLog, todayKey, prefix, m } = A
    initRpgUser(sender, pushname)
    const me = rpgDb[sender]
    ensureBankFields(me)

    const args = String(text || '').trim().split(/\s+/)
    const aksi = (args[0] || '').toLowerCase()
    const jumlah = parseInt(args[1], 10)
    // target: mention, atau balasan pesan
    const tagJid = (m.mentionedJid && m.mentionedJid[0]) || m.quoted?.sender || null
    const who = (jid) => String(jid).split('@')[0]

    if (!aksi) {
        return reply(
`🏦 *BANK MENU*

${prefix}bank cek                    → saldo dompet/tabungan/hutang, status polis
${prefix}bank simpan <jumlah>        → setor ke tabungan
${prefix}bank tarik <jumlah>         → tarik ke dompet (fee ${Math.round(bankCfg.feeRate * 100)}%)
${prefix}bank transfer <jumlah> @u   → kirim (fee ${Math.round(bankCfg.feeRate * 100)}%, limit ${fmt(bankCfg.dailyTransferCap)}/hari)
${prefix}bank pinjam <jumlah>        → pinjam (bunga ${Math.round(bankCfg.loanInterest * 100)}% flat)
${prefix}bank bayar <jumlah>         → bayar hutang
${prefix}bank bunga                  → klaim bunga harian (${Math.round(bankCfg.interestRate * 100)}%)
${prefix}bank rampok @user           → heist tabungan (berisiko, cd 1 jam)
${prefix}bank polis beli|hapus       → asuransi (kurangi ${Math.round(bankCfg.insuranceCoverage * 100)}% kerugian saat kena heist)
${prefix}bank log                    → riwayat transaksi`
        )
    }

    // CEK
    if (aksi === 'cek') {
        return reply(
`💳 *SALDO KAMU*
👜 Dompet   : ${fmt(me.coin)}
🏦 Tabungan : ${fmt(me.bank)}
📉 Hutang   : ${fmt(me.loan)}
🛡️ Asuransi : ${me.insurance ? 'AKTIF' : 'Tidak ada'}

Transfer hari ini: ${fmt(me.transferDay === todayKey() ? me.transferUsed : 0)} / ${fmt(bankCfg.dailyTransferCap)}`
        )
    }

    // SIMPAN
    if (aksi === 'simpan') {
        if (!Number.isInteger(jumlah) || jumlah < bankCfg.minAmount) return reply(`⚠️ Minimal simpan ${fmt(bankCfg.minAmount)}.`)
        if (me.coin < jumlah) return reply('❌ Coin di dompet tidak cukup.')
        me.coin -= jumlah
        me.bank += jumlah
        pushLog(me, `SIMPAN +${fmt(jumlah)} → bank`)
        saveRpg()
        return reply(`✅ Simpan ${fmt(jumlah)} coin ke bank.\n🏦 ${fmt(me.bank)} | 👜 ${fmt(me.coin)}`)
    }

    // TARIK (fee)
    if (aksi === 'tarik') {
        if (!Number.isInteger(jumlah) || jumlah < bankCfg.minAmount) return reply(`⚠️ Minimal tarik ${fmt(bankCfg.minAmount)}.`)
        if (me.bank < jumlah) return reply('❌ Tabungan tidak cukup.')

        const fee = Math.ceil(jumlah * bankCfg.feeRate)
        const bersih = jumlah - fee
        if (bersih <= 0) return reply('⚠️ Jumlah terlalu kecil setelah dipotong fee.')

        me.bank -= jumlah
        me.coin += bersih
        global.bankCentral += fee

        pushLog(me, `TARIK -${fmt(bersih)} (fee ${fmt(fee)})`)
        saveRpg()
        return reply(`✅ Tarik ${fmt(bersih)} coin (fee ${fmt(fee)}).\n🏦 ${fmt(me.bank)} | 👜 ${fmt(me.coin)}`)
    }

    // TRANSFER (fee + limit harian)
    if (aksi === 'transfer') {
        if (!Number.isInteger(jumlah) || jumlah < bankCfg.minAmount) return reply(`⚠️ Minimal transfer ${fmt(bankCfg.minAmount)}.`)
        if (!tagJid) return reply(`⚠️ Tag penerima: *${prefix}bank transfer <jumlah> @user*`)
        if (tagJid === sender) return reply('😆 Tidak bisa transfer ke diri sendiri.')
        if (me.bank < jumlah) return reply('❌ Tabungan tidak cukup.')

        const key = todayKey()
        if (me.transferDay !== key) { me.transferDay = key; me.transferUsed = 0 }
        if (me.transferUsed + jumlah > bankCfg.dailyTransferCap) {
            return reply(`⛔ Limit transfer harian tercapai. Sisa: ${fmt(bankCfg.dailyTransferCap - me.transferUsed)}.`)
        }

        const you = initRpgUser(tagJid, 'Player')
        ensureBankFields(you)

        const fee = Math.ceil(jumlah * bankCfg.feeRate)
        const kirim = jumlah - fee
        if (kirim <= 0) return reply('⚠️ Jumlah terlalu kecil setelah dipotong fee.')

        me.bank -= jumlah
        me.transferUsed += jumlah
        you.bank += kirim
        global.bankCentral += fee

        pushLog(me, `TRANSFER -${fmt(kirim)} (fee ${fmt(fee)}) → @${who(tagJid)}`)
        pushLog(you, `TRANSFER +${fmt(kirim)} dari @${who(sender)}`)
        saveRpg()
        return reply(`✅ Transfer ${fmt(kirim)} coin ke @${who(tagJid)} (fee ${fmt(fee)}).`, { mentions: [tagJid] })
    }

    // PINJAM
    if (aksi === 'pinjam') {
        if (!Number.isInteger(jumlah) || jumlah < bankCfg.minAmount) return reply(`⚠️ Minimal pinjam ${fmt(bankCfg.minAmount)}.`)
        if (me.loan > 0) return reply('❌ Bayar hutang yang ada dulu.')
        me.coin += jumlah
        me.loan = jumlah + Math.floor(jumlah * bankCfg.loanInterest)
        pushLog(me, `PINJAM +${fmt(jumlah)} (hutang total ${fmt(me.loan)})`)
        saveRpg()
        return reply(`💳 Pinjam ${fmt(jumlah)} coin.\nTotal harus dibayar: ${fmt(me.loan)}`)
    }

    // BAYAR
    if (aksi === 'bayar') {
        if (!Number.isInteger(jumlah) || jumlah <= 0) return reply('⚠️ Masukkan jumlah yang valid.')
        if (me.loan <= 0) return reply('✅ Kamu tidak punya hutang.')
        if (me.coin + me.bank < jumlah) return reply('❌ Coin tidak cukup (gabungan dompet+bank).')

        const bayar = Math.min(jumlah, me.loan)
        const ambilDompet = Math.min(me.coin, bayar)
        me.coin -= ambilDompet
        const sisa = bayar - ambilDompet
        if (sisa > 0) me.bank -= sisa

        me.loan -= bayar
        pushLog(me, `BAYAR HUTANG -${fmt(bayar)} (sisa: ${fmt(me.loan)})`)
        saveRpg()
        return reply(`✅ Bayar ${fmt(bayar)} coin. Sisa hutang: ${fmt(me.loan)}.`)
    }

    // BUNGA HARIAN
    if (aksi === 'bunga') {
        const key = todayKey()
        if (me.lastInterest === key) return reply('⏳ Bunga sudah diklaim hari ini.')
        const bunga = Math.floor((me.bank || 0) * bankCfg.interestRate)
        if (bunga <= 0) return reply('😅 Tabungan terlalu kecil untuk bunga.')
        me.bank += bunga
        me.lastInterest = key
        pushLog(me, `BUNGA +${fmt(bunga)} (tabungan: ${fmt(me.bank)})`)
        saveRpg()
        return reply(`🏦 Bunga harian +${fmt(bunga)} coin ditambahkan. Tabungan: ${fmt(me.bank)}.`)
    }

    // RAMPOK (HEIST)
    if (aksi === 'rampok') {
        if (!tagJid) return reply(`⚠️ Tag korban: *${prefix}bank rampok @user*`)
        if (tagJid === sender) return reply('😆 Merampok diri sendiri?')

        const korban = initRpgUser(tagJid, 'Player')
        ensureBankFields(korban)

        const now = Date.now()
        if (me.lastHeist && now - me.lastHeist < bankCfg.heistCooldownMs)
            return reply(`⏳ Cooldown heist. Tunggu ${hms(bankCfg.heistCooldownMs - (now - me.lastHeist))}.`)

        me.lastHeist = now

        if ((korban.bank || 0) <= 0) return reply('😅 Tabungan korban kosong.')

        const sukses = Math.random() < bankCfg.heistSuccess
        if (sukses) {
            let hasil = Math.max(1, Math.floor(korban.bank * bankCfg.heistCut))
            if (korban.insurance) {
                const lindung = Math.floor(hasil * bankCfg.insuranceCoverage)
                hasil -= lindung
            }
            hasil = Math.min(hasil, korban.bank)
            korban.bank -= hasil
            me.bank += hasil

            pushLog(me, `HEIST BERHASIL +${fmt(hasil)} dari @${who(tagJid)}`)
            pushLog(korban, `KENA HEIST -${fmt(hasil)} oleh @${who(sender)}${korban.insurance ? ' (asuransi aktif)' : ''}`)
            saveRpg()
            return reply(`💥 Heist berhasil! Dapat ${fmt(hasil)} coin dari @${who(tagJid)}.`, { mentions: [tagJid] })
        } else {
            const denda = Math.max(10, Math.floor((me.coin || 0) * 0.10))
            me.coin = Math.max(0, me.coin - denda)
            global.bankCentral += denda
            pushLog(me, `HEIST GAGAL denda -${fmt(denda)} (dompet: ${fmt(me.coin)})`)
            saveRpg()
            return reply(`🚨 Heist gagal! Denda ${fmt(denda)} coin.`)
        }
    }

    // POLIS
    if (aksi === 'polis') {
        const sub = (args[1] || '').toLowerCase()
        if (!sub) {
            return reply(`🛡️ *ASURANSI BANK*
• ${prefix}bank polis beli  → biaya ${fmt(bankCfg.insurancePremium)}
• ${prefix}bank polis hapus → nonaktifkan polis
Status: ${me.insurance ? 'AKTIF' : 'Tidak ada'}`)
        }
        if (sub === 'beli') {
            if (me.insurance) return reply('✅ Polis sudah aktif.')
            if (me.coin < bankCfg.insurancePremium) return reply('❌ Coin tidak cukup untuk premi.')
            me.coin -= bankCfg.insurancePremium
            me.insurance = true
            pushLog(me, `BELI POLIS -${fmt(bankCfg.insurancePremium)} (aktif)`)
            saveRpg()
            return reply(`🛡️ Polis aktif. Kerugian heist dikurangi ${Math.round(bankCfg.insuranceCoverage * 100)}%.`)
        }
        if (sub === 'hapus') {
            if (!me.insurance) return reply('⚠️ Tidak punya polis.')
            me.insurance = false
            pushLog(me, `POLIS DINONAKTIFKAN`)
            saveRpg()
            return reply('🛡️ Polis dimatikan.')
        }
        return reply(`Pilih: *${prefix}bank polis beli* atau *${prefix}bank polis hapus*`)
    }

    // LOG
    if (aksi === 'log') {
        const list = (me.bankLog || []).slice(0, 10)
        return reply(`🧾 *RIWAYAT TRANSAKSI*\n${list.length ? list.map((x, i) => `${i + 1}. ${x}`).join('\n') : 'Belum ada transaksi.'}`)
    }

    return reply('❓ Perintah bank tidak dikenali.')
}, { tags: 'rpg', desc: 'Menu bank (cek, simpan, tarik, transfer, pinjam, bayar, bunga, rampok, polis, log)' })

// satu command = nama file
export default oneCommand(cmd, 'bank')
