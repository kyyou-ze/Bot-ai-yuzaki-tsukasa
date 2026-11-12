// ───────── bratgreen ─────────
// Dipecah dari plugins/sticker/brat.js (dulu digabung dengan fitur lain dalam satu file)

import { config, te, wrapPlugin, oneCommand } from '../../lib/engine/plugins.js'
import { drawBrat } from '../../lib/engine/plugins.js'

const _bratgreen = (() => {
const pluginConfig = {
  name: "bratgreen",
  alias: [],
  category: "sticker",
  description: "Membuat sticker brat ijo",
  usage: ".bratgreen <text>",
  example: ".bratgreen Hai semua",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 10,
  energi: 1,
  isEnabled: true,
};

async function handler(m, { sock }) {
  const text = m.args.join(" ").trim();
  if (!text) {
    return m.reply(`🖼️ *BRAT GREEN*\n\n> Masukkan teks\n\n\`Contoh: ${m.prefix}bratgreen Hai semua\``);
  }

  m.react("🕕");

  try {
    const buffer = await drawBrat({
      text,
      bgColor: "#8ACE00",
      width: 512,
      height: 512,
      maxWidth: 450,
      maxHeight: 450,
      centerX: 256,
      centerY: 256,
      maxFontSize: 130,
      fontDecrement: 5,
      lineHeightMult: 1.1,
      textColor: "#000000"
    });

    await sock.sendImageAsSticker(m.chat, buffer, m, {
      packname: config.sticker.packname,
      author: config.sticker.author,
    });
    m.react("✅");
  } catch (error) {
    m.react("☢");
    m.reply(te(m.prefix, m.command, m.pushName));
  }
}

const __plugin = wrapPlugin(pluginConfig, handler)

  return __plugin
})()

_bratgreen.tags = ['sticker']   // kategori menu (dulu dari mergePlugins)

// satu command = nama file
_bratgreen.limit = true
export default oneCommand(_bratgreen, 'bratgreen')
