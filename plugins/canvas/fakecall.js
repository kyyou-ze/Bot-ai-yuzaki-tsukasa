/**

* YannRzy Multi Device — WhatsApp & Tele Bot
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

// ───────── fakecall ─────────
// Plugin canvas: fakecall (satu command)
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import FormData from 'form-data'
import * as _canvas from '@napi-rs/canvas'
import { te, wrapPlugin, mergePlugins, defaultAvatar } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'
// ── fakecall ──
const _fakecall = (() => {
const pluginConfig = {
    name: 'fakecall',
    alias: [],
    category: 'canvas',
    description: 'Membuat gambar fake call WhatsApp (Tersedia versi Android dan iOS)',
    usage: '.fakecall [ios] nama | durasi',
    example: '.fakecall Zann | 19:00',
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 10,
    energi: 1,
    isEnabled: true
}

async function handler(m, { sock }) {
    const iosMatch = /^ios\s+/i.exec(String(m.text || ''))
    const isIos = !!iosMatch
    const text = iosMatch ? String(m.text).slice(iosMatch[0].length) : m.text

    if (!text || !text.includes('|')) {
        let helpText = `Halo! Sepertinya format yang kamu masukkan kurang tepat.\n\n`
        helpText += `Fitur ini digunakan untuk membuat gambar panggilan palsu (Fake Call) seolah-olah seseorang sedang meneleponmu secara langsung.\n\n`
        helpText += `*Versi yang Tersedia:*\n`
        helpText += `- *${m.prefix}fakecall* (Untuk tampilan panggilan Android)\n`
        helpText += `- *${m.prefix}fakecall ios* (Untuk tampilan panggilan iPhone atau iOS)\n\n`
        helpText += `*Cara Penggunaan:*\n`
        helpText += `Ketik perintah diikuti dengan *Nama* dan *Durasi* yang dipisahkan oleh tanda pipa (|).\n\n`
        helpText += `*Contoh Penggunaan:*\n`
        helpText += `- *${m.prefix}fakecall Zann | 03:33:33*\n`
        helpText += `- *${m.prefix}fakecall ios Sayangku | 12:00:00*\n\n`
        helpText += `*Tips Tambahan:*\n`
        helpText += `Kamu bisa me-reply (membalas) sebuah gambar jika ingin menggunakan foto tersebut sebagai avatar profil sang penelepon!`

        return m.reply(helpText)
    }

    const [nama, durasi] = text.split('|').map(s => s.trim())

    if (!nama) {
        return m.reply(`Maaf, nama penelepon tidak boleh dikosongkan. Silakan isi namanya terlebih dahulu!`)
    }

    if (!durasi) {
        return m.reply(`Maaf, durasi panggilan tidak boleh dikosongkan. Silakan isi durasinya terlebih dahulu!`)
    }

    await m.react('🕕')

    try {
        let bufferBase

        if (m.isImage) {
            try {
                bufferBase = await m.download()
            } catch (err) {}
        } else if (m.quoted?.isImage) {
            try {
                bufferBase = await m.quoted.download()
            } catch (err) {}
        }

        if (!bufferBase) {
            try {
                const ppUrl = await sock.profilePictureUrl(m.sender, 'image')
                const res = await axios.get(ppUrl, { responseType: 'arraybuffer' })
                bufferBase = Buffer.from(res.data)
            } catch (err) {
                const res = await axios.get('https://files.catbox.moe/nwvkbt.png', { responseType: 'arraybuffer' })
                bufferBase = Buffer.from(res.data)
            }
        }

        const form = new FormData()
        form.append('avatarUrl', bufferBase, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
        form.append('name', nama)
        form.append('duration', durasi)

        let endpoint = 'fakecall-android'
        if (isIos) {
            endpoint = 'fakecall-ios'
        }

        const apiUrl = `https://my.izuka-api.xyz/api/canvas/${endpoint}`

        const response = await axios.post(apiUrl, form, {
            headers: form.getHeaders(),
            responseType: 'arraybuffer'
        })

        await sock.sendMessage(m.chat, { image: Buffer.from(response.data) }, { quoted: m })

        await m.react('📞')
    } catch (err) {
        await m.react('☢')
        return m.reply(te(m.prefix, m.command, m.pushName))
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _fakecall
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'fakecall')
