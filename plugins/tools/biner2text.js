import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text, usedPrefix, command }) => {
      if (!text) return m.reply(`🚩 *BINARY TO TEXT*\n\nMasukkan kode biner yang ingin diubah!\n\n*ᴄᴏɴᴛᴏʜ:* \`${usedPrefix + command} 01001000 01100001 01101100 01101111\``);

      try {
          const binary = text.replace(/\s+/g, '');
          if (binary.length % 8 !== 0) throw new Error("Format biner tidak valid (harus kelipatan 8 bit).");

          const result = binary.match(/.{1,8}/g).map(bin => {
              return String.fromCharCode(parseInt(bin, 2));
          }).join('');

          await m.reply(`* *ʜᴀsɪʟ:**\n\n\`\`\`${result}\`\`\``);
      } catch (e) {
          m.reply(`❌ *Error:* ${e.message}`);
      }
  };

  handler.help = ['biner2text <kode biner>'];
  handler.tags = ['tools']
  handler.command = ['biner2text']

  handler.limit = true;
  return handler
}

rbRegister("tools/biner2text", feature)

let handler = (m, ctx) => rbRun("tools/biner2text", m, ctx)

handler.command = ['biner2text']
handler.help = ["biner2text <kode biner>"]
handler.tags = ['tools']

export default handler
