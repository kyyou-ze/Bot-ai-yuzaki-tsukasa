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

// ───────── topixel ─────────
// Plugin canvas: topixel (satu command)
// Port dari RIMURU-MD. Pesan keluar memakai sock.sendMessage / m.reply bawaan WhatsApp (tanpa tombol / kartu custom).

import axios from 'axios'
import sharp from 'sharp'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { config, te, wrapPlugin, mergePlugins, uploadToTmpFilesOrg as uploadToTmpFiles, uploadToCatboxFile as uploadToCatbox } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'
// ── topixel ──
const _topixel = (() => {
const pluginConfig = {
  name: "topixel",
  alias: [],
  category: "canvas",
  description: "Ubah foto kamu jadi gambar pixel art yang keren",
  usage: ".topixel [level] (reply/kirim foto)",
  example: ".topixel 30",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 2,
  isEnabled: true,
};

function getBlock(level) {
  const value = Math.min(Math.max(Number(level) || 12, 1), 40);
  return 41 - value;
}

async function pixelArt(inputBuffer, level) {
  const image = sharp(inputBuffer, { limitInputPixels: false }).rotate().ensureAlpha();
  const meta = await image.metadata();

  const width = meta.width;
  const height = meta.height;
  const block = getBlock(level);

  const input = await image.raw().toBuffer();
  const output = Buffer.alloc(input.length);

  for (let y = 0; y < height; y += block) {
    for (let x = 0; x < width; x += block) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      const maxY = Math.min(y + block, height);
      const maxX = Math.min(x + block, width);

      for (let yy = y; yy < maxY; yy++) {
        for (let xx = x; xx < maxX; xx++) {
          const i = (yy * width + xx) * 4;
          r += input[i];
          g += input[i + 1];
          b += input[i + 2];
          a += input[i + 3];
          count++;
        }
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      a = Math.round(a / count);

      for (let yy = y; yy < maxY; yy++) {
        for (let xx = x; xx < maxX; xx++) {
          const i = (yy * width + xx) * 4;
          output[i] = r;
          output[i + 1] = g;
          output[i + 2] = b;
          output[i + 3] = a;
        }
      }
    }
  }

  return await sharp(output, {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
}

async function handler(m, { sock }) {
  let media = null;
  const level = m.args[0] || "12";

  if (m.quoted?.message) {
    const type = m.quoted.mtype;
    if (!type || type !== "imageMessage") {
      return m.reply("⚠️ Kak, tolong reply ke pesan gambar ya!");
    }
    media = await m.quoted.download();
  } else if (m.message) {
    const type = m.mtype;
    if (!type || type !== "imageMessage") {
      return m.reply(`👾 *PIXEL ART MAKER*\n\nKirim atau reply foto dengan perintah \`${m.prefix}topixel [level]\` untuk mengubah fotomu menjadi gaya retro pixel art!\n\n_Catatan: Level opsional antara 1-40 (semakin besar semakin kotak-kotak)._`);
    }
    media = await m.download();
  }

  if (!media) return m.reply("❌ Gagal membaca media gambar, coba lagi!");

  await m.react("🕕");

  try {
    const pixelatedBuffer = await pixelArt(media, level);

    await sock.sendMessage(
      m.chat,
      {
        image: pixelatedBuffer,
        caption: `👾 *PIXEL ART BERHASIL!*\n\nIni dia fotomu dalam gaya pixel art retro 8-bit. Keren kan?`
      },
      { quoted: m }
    );

    await m.react("✅");
  } catch (err) {
    await m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

  return wrapPlugin(pluginConfig, handler)
})()

const __plugin = mergePlugins(
    'canvas',
    _topixel
)

// satu command = nama file; command lama jadi sub-command
__plugin.limit = true
export default oneCommand(__plugin, 'topixel')
