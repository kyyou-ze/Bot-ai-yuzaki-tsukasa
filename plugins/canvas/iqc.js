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

// ───────── iqc ─────────
// Plugin canvas: iqc (satu command)
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import fs from 'fs'
import https from 'https'
import http from 'http'
import FormData from 'form-data'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { te, wrapPlugin, mergePlugins } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ── iqc ──
const _iqc = (() => {
const pluginConfig = {
    name: "iqc",
    alias: [],
    category: "canvas",
    description: "Membuat Fake Quote iOS style secara instan.",
    usage: ".iqc [text/reply]",
    isOwner: false,
    isPremium: false,
    isGroup: false,
    isPrivate: false,
    cooldown: 5,
    energi: 2,
    isEnabled: true,
};

async function handler(m, { sock, text }) {
    try {
        const targetText = text || (m.quoted && m.quoted.text ? m.quoted.text : "");

        if (!targetText) {
            let help = `💬 *FITUR FAKE QUOTE iOS*\n\n`
            help += `Fitur ini digunakan untuk membuat gambar quote elegan bergaya iOS dengan sangat cepat.\n\n`
            help += `*Cara Penggunaan:*\n`
            help += `- Ketik *${m.prefix}iqc <teks kamu>*\n`
            help += `- Atau kamu bisa membalas (reply) pesan teks orang lain dengan perintah *${m.prefix}iqc*\n\n`
            help += `_Pesan tersebut akan secara otomatis diubah menjadi quote keren!_`
            return m.reply(help)
        }

        await m.react('🕕');

        const apiUrl = `https://my.izuka-api.xyz/api/canvas/iqc?text=${encodeURIComponent(targetText)}`

        await sock.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });

        await m.react('✅');
    } catch (error) {
        console.error("[IQC Plugin Error]", error)
        await m.react('❌')
        m.reply(`Maaf, terjadi kesalahan saat mencoba membuat gambar quote. Silakan coba lagi beberapa saat.`)
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _iqc
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'iqc')
