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

// ───────── iqc2 ─────────
// Plugin canvas: iqc2 (satu command)
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

// ── iqc2 ──
const _iqc2 = (() => {
const pluginConfig = {
    name: "iqc2",
    alias: [],
    category: "canvas",
    description: "Membuat Fake Quote iOS style dengan informasi baterai dan provider.",
    usage: ".iqc2 [text/reply]",
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
            return m.reply(
                `Halo *${m.pushName}*, sepertinya kamu belum memasukkan teksnya.\n\n` +
                `Silakan gunakan perintah dengan format:\n` +
                `- .iqc2 <teks kamu>\n` +
                `- Atau balas (reply) pesan orang lain dengan .iqc2`
            );
        }

        await m.react('🕕');

        const providers = ["INDOSAT", "TELKOMSEL", "XL", "TRI", "SMARTFREN", "WIFI"];
        const randomProvider = providers[Math.floor(Math.random() * providers.length)];

        const now = new Date();
        const jam = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).replace('.', ':');

        const randomBaterai = Math.floor(Math.random() * (100 - 10 + 1)) + 10; // 10-100

        const apiUrl = `https://api.nexray.eu.cc/maker/v1/iqc?text=${encodeURIComponent(targetText)}&provider=${encodeURIComponent(randomProvider)}&jam=${encodeURIComponent(jam)}&baterai=${randomBaterai}`;

        await sock.sendMessage(m.chat, { image: { url: apiUrl } }, { quoted: m });

        await m.react('✅');
    } catch (error) {
        console.error("[IQC2 Plugin Error]", error);
        await m.react('❌');
        m.reply(`Maaf *${m.pushName}*, terjadi kesalahan saat mencoba membuat gambar quote. Silakan coba lagi beberapa saat.`);
    }
}

  return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _iqc2
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'iqc2')
