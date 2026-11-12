// ───────── ttp ─────────
// Dipecah dari plugins/sticker/maker.js (dulu digabung dengan fitur lain dalam satu file)

import axios from 'axios'
import { config, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'

const _ttp = (() => {
const pluginConfig = {
  name: "ttp",
  alias: [],
  category: "maker",
  description: "Membuat stiker keren dari teks",
  usage: ".ttp <teks>",
  example: ".ttp Hai Cantik",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.args.join(" ") || m.text?.trim();

  if (!text) {
    return m.reply("❌ *Waduh, teksnya mana nih?*\n\nKamu harus memasukkan teks yang ingin dijadikan stiker.\n\nContoh: `.ttp Hai Cantik`");
  }

  await m.react("🕕");

  try {
    const apiUrl = `https://api.nexray.eu.cc/maker/ttp?text=${encodeURIComponent(text)}`;

    const res = await axios.get(apiUrl, {
      responseType: "arraybuffer",
      timeout: 30000
    });

    const imageBuffer = Buffer.from(res.data);

    await sock.sendImageAsSticker(m.chat, imageBuffer, m, {
      packname: config.sticker.packname,
      author: config.sticker.author,
    });

    await m.react("✅");
  } catch (err) {
    console.error("[TTP Maker]", err.message);
    await m.react("☢");
    m.reply("😔 *Terjadi masalah di sistem kami.* \n\nSistem gagal menghubungi server pembuat stiker. Silakan coba beberapa saat lagi ya.");
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

_ttp.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_ttp.limit = true
export default oneCommand(_ttp, 'ttp')
