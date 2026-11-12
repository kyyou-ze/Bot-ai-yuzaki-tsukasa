import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text, usedPrefix, command }) => {
      if (!text) return m.reply(`🚩 *TEXT TO BINARY*\n\nMasukkan teks yang ingin diubah!\n\n*ᴄᴏɴᴛᴏʜ:* \`${usedPrefix + command} Halo\``);

      try {
          const binary = text.split('').map(char => {
              return char.charCodeAt(0).toString(2).padStart(8, '0');
          }).join(' ');

          await m.reply(`* *ʜᴀsɪʟ:**\n\n\`\`\`${binary}\`\`\``);
      } catch (e) {
          m.reply(`❌ *Error:* ${e.message}`);
      }
  };

  handler.help = ['text2biner <teks>'];
  handler.tags = ['tools']
  handler.command = ['text2biner']

  handler.limit = true;
  return handler
}

rbRegister("tools/text2biner", feature)

let handler = (m, ctx) => rbRun("tools/text2biner", m, ctx)

handler.command = ['text2biner']
handler.help = ["text2biner <teks>"]
handler.tags = ['tools']

export default handler
