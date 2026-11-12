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

// ───────── guild ─────────
// Dipasang dari menu RPG Kaguya (.guild). Memakai rpgDb yang tersambung ke akun user Kaguya
// (coin = money, bank = bank, exp = exp), jadi datanya sama dengan seluruh fitur RPG lain.

import { rpgCmd } from '../../lib/rpg/bridge.js'
import { oneCommand } from '../../lib/engine/plugins.js'

const cmd = rpgCmd(["guild"], async (A) => {
    const { initRpgUser, sender, pushname, rpgDb, rpgGuildDb, saveGuild, saveRpg, text, reply, fmt, botUser, prefix } = A
    initRpgUser(sender, pushname)
    const u = rpgDb[sender]
    const arg = String(text || '').trim()
    const aksi = (arg.split(/\s+/)[0] || '').toLowerCase()
    const name = arg.slice(aksi.length).trim()
    const findKey = (n) => Object.keys(rpgGuildDb).find(k => k.toLowerCase() === String(n).toLowerCase())
    // sambungkan ke status Adventurer Guild Kaguya (.rpg-guild / .rpg-hunt memakai user.guild)
    const markFlat = (on) => { try { const f = botUser(); f.guild = on; if (on && !f.rank) f.rank = 'F' } catch { } }
    const show = (key) => {
        const g = rpgGuildDb[key]
        return `🏰 *${g.name || key}*\n👑 Ketua: @${String(g.leader || '-').split('@')[0]}\n👥 Member: ${(g.members || []).length}\n🏦 Kas: ${fmt(g.bank || 0)}`
    }

    if (!arg) {
        if (!u.guild || !rpgGuildDb[u.guild]) return reply(`🏰 Guild: Tidak tergabung\nKetik *${prefix}guild buat <nama>* atau *${prefix}guild join <nama>*`)
        return reply(show(u.guild), { mentions: [rpgGuildDb[u.guild].leader].filter(Boolean) })
    }

    if (aksi === 'buat') {
        if (u.guild) return reply(`❌ Kamu sudah tergabung di guild *${u.guild}*. Keluar dulu: *${prefix}guild keluar*`)
        if (!/^[a-zA-Z0-9 _-]{3,20}$/.test(name)) return reply('❌ Nama guild 3-20 karakter (huruf, angka, spasi, _ dan -).')
        if (findKey(name)) return reply('❌ Nama guild itu sudah dipakai.')
        rpgGuildDb[name] = { name, leader: sender, officers: [], members: [sender], bank: 0, createdAt: Date.now() }
        u.guild = name
        markFlat(true)
        saveRpg(); saveGuild()
        return reply(`🏰 Kamu membuat guild *${name}*`)
    }

    if (aksi === 'join') {
        if (u.guild) return reply(`❌ Kamu sudah tergabung di guild *${u.guild}*.`)
        const key = findKey(name)
        if (!key) return reply('❌ Guild tidak ditemukan.')
        const g = rpgGuildDb[key]
        g.members = Array.isArray(g.members) ? g.members : []
        if (!g.members.includes(sender)) g.members.push(sender)
        u.guild = key
        markFlat(true)
        saveRpg(); saveGuild()
        return reply(`🤝 Kamu bergabung ke guild *${key}*`)
    }

    if (aksi === 'keluar') {
        if (!u.guild) return reply('❌ Kamu tidak tergabung di guild mana pun.')
        const key = u.guild
        const g = rpgGuildDb[key]
        if (g) {
            g.members = (g.members || []).filter(x => x !== sender)
            g.officers = (g.officers || []).filter(x => x !== sender)
            if (g.leader === sender) {
                if (g.members.length) g.leader = g.members[0]
                else delete rpgGuildDb[key]
            }
        }
        u.guild = null
        markFlat(false)
        saveRpg(); saveGuild()
        return reply(`👋 Kamu keluar dari guild *${key}*.`)
    }

    if (aksi === 'info') {
        const key = name ? findKey(name) : u.guild
        if (!key || !rpgGuildDb[key]) return reply('❌ Guild tidak ditemukan.')
        return reply(show(key), { mentions: [rpgGuildDb[key].leader].filter(Boolean) })
    }

    return reply(`Format salah. Ketik *${prefix}guild buat/join/keluar/info <nama>*`)
}, { tags: 'rpg', desc: 'Buat/join guild' })

// satu command = nama file
export default oneCommand(cmd, 'guild')
