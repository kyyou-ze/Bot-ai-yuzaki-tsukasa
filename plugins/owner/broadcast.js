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

import { sleep } from '../../lib/core/system.js'
import { isChatBanned } from '../../lib/core/data.js'
import { rpgStore } from '../../lib/engine/plugins.js'
import { waError } from '../../lib/platform/wa.js'

const PER_PAGE = 15
const GROUP_LINK = /chat\.whatsapp\.com\/([0-9A-Za-z]+)/i
let running = false
let stopFlag = false

async function allGroups(sock) {
    const data = await sock.groupFetchAllParticipating()
    return Object.values(data).sort((a, b) => (b.participants?.length || 0) - (a.participants?.length || 0))
}

async function broadcast(sock, reply, targets, label, text) {
    if (running) return reply('Masih ada broadcast yang berjalan. Tunggu selesai atau ketik .bc stop')
    if (!targets.length) return reply(`Tidak ada ${label} yang bisa dituju.`)

    const menit = Math.ceil((targets.length * 4) / 60)
    await reply(`📢 Broadcast ke *${targets.length} ${label}* dimulai (perkiraan ±${menit} menit).\nHentikan dengan *.bc stop*`)

    running = true
    stopFlag = false
    let ok = 0
    let fail = 0
    try {
        for (const jid of targets) {
            if (stopFlag) break
            try {
                await sock.sendMessage(jid, { text: `📢 *BROADCAST*\n\n${text}` })
                ok++
            } catch {
                fail++
            }
            await sleep(3000 + Math.random() * 2000)
        }
    } finally {
        running = false
    }
    return reply(`${stopFlag ? '⏹️ Broadcast dihentikan' : '✅ Broadcast selesai'}.\n\nTerkirim : ${ok}\nGagal    : ${fail}\nSisa     : ${Math.max(0, targets.length - ok - fail)}`)
}

let handler = async (m, { sock, text, command, prefix, jid, reply, example }) => {
    if (typeof sock.groupFetchAllParticipating !== 'function') return reply('Fitur ini hanya untuk WhatsApp.')
    const input = String(text || '').trim()

    try {
        if (command === 'bc' || command === 'bcgc' || command === 'bcpc') {
            if (/^stop$/i.test(input)) {
                if (!running) return reply('Tidak ada broadcast yang berjalan.')
                stopFlag = true
                return reply('Menghentikan broadcast setelah pesan yang sedang dikirim...')
            }
            const body = input || m.quoted?.text || ''
            if (!body) return example('Halo semua, ada info baru!  (atau reply teks yang mau di-broadcast)')

            if (command === 'bcpc') {
                const me = String(sock.user?.id || '').split(':')[0].split('@')[0]
                const users = Object.keys(rpgStore().users).filter(j => j.endsWith('@s.whatsapp.net') && !j.startsWith(me))
                return broadcast(sock, reply, users, 'user', body)
            }
            const groups = (await allGroups(sock)).map(g => g.id).filter(id => !isChatBanned(id))
            return broadcast(sock, reply, groups, 'grup', body)
        }

        if (command === 'listgc') {
            const groups = await allGroups(sock)
            if (!groups.length) return reply('Bot belum bergabung di grup mana pun.')
            const pages = Math.ceil(groups.length / PER_PAGE)
            const page = Math.min(Math.max(parseInt(input) || 1, 1), pages)
            const start = (page - 1) * PER_PAGE
            const rows = groups.slice(start, start + PER_PAGE).map((g, i) =>
                `${start + i + 1}. *${g.subject}*\n   👥 ${g.participants?.length || 0} member${isChatBanned(g.id) ? ' • 🚫 banned' : ''}\n   ${g.id}`)
            return reply(`*▢ DAFTAR GRUP* (${groups.length})\nHalaman ${page}/${pages}\n\n${rows.join('\n')}${page < pages ? `\n\nHalaman berikutnya: ${prefix}listgc ${page + 1}` : ''}`)
        }

        if (command === 'joingc') {
            const code = input.match(GROUP_LINK)?.[1]
            if (!code) return example('https://chat.whatsapp.com/xxxxxxxx')
            const id = await sock.groupAcceptInvite(code)
            return reply(`✅ Berhasil bergabung ke grup.\n${id || ''}`.trim())
        }

        if (command === 'leavegc') {
            const tokens = input.split(/\s+/).filter(Boolean)
            const target = tokens.find(t => /@g\.us$/.test(t)) || (m.isGroup ? jid : null)
            if (!target) return reply(`Pakai di dalam grup, atau sertakan id grup.\nContoh: ${prefix}leavegc 1203xxxxxxxx@g.us ya`)
            if (!tokens.some(t => /^(ya|yes|y)$/i.test(t))) {
                return reply(`⚠️ Bot akan keluar dari grup ini:\n${target}\n\nKetik: *${prefix}leavegc${target === jid ? '' : ` ${target}`} ya*`)
            }
            await reply('👋 Bot keluar dari grup.').catch(() => {})
            await sock.groupLeave(target)
            if (target !== jid) return reply(`✅ Bot keluar dari ${target}`)
        }
    } catch (e) {
        return reply(`[ ! ] ${waError(e)}`)
    }
}

handler.command = ['broadcast', 'bc', 'bcgc', 'bcpc', 'joingc', 'leavegc', 'listgc']
handler.as = 'bc'
handler.help = ['broadcast bc <teks>', 'broadcast bcpc <teks>', 'broadcast listgc', 'broadcast joingc <link>', 'broadcast leavegc']
handler.tags = ['owner']
handler.owner = true

export default handler
