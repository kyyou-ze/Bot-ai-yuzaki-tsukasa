import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { text, usedPrefix, command }) => {
      if (!text) return m.reply(`🌸 *ʙᴀsᴇ64 ᴇɴᴄᴏᴅᴇʀ & ᴅᴇᴄᴏᴅᴇʀ* 🌸\n\n✨ *ᴄᴏɴᴛᴏʜ:*\n• ${usedPrefix + command} enc halo\n• ${usedPrefix + command} dec aGFsbw==`);

      const args = text.trim().split(/\s+/);
      const type = args[0]?.toLowerCase();
      const input = args.slice(1).join(' ');

      if (!['enc', 'dec', 'encode', 'decode'].includes(type) || !input) {
          return m.reply(`*ғᴏʀᴍᴀᴛ ᴘᴇɴɢɢᴜɴᴀᴀɴ:*\n• ${usedPrefix + command} enc <teks>\n• ${usedPrefix + command} dec <base64>`);
      }

      try {
          if (type === 'enc' || type === 'encode') {
              const encoded = Buffer.from(input, 'utf-8').toString('base64');
              await m.reply(`*ʜᴀsɪʟ ʙᴀsᴇ64 ᴇɴᴄᴏᴅᴇ*\n\n` + '```' + encoded + '```');
          } else {
              const decoded = Buffer.from(input, 'base64').toString('utf-8');
              await m.reply(`*ʜᴀsɪʟ ʙᴀsᴇ64 ᴅᴇᴄᴏᴅᴇ*\n\n` + '```' + decoded + '```');
          }
      } catch (e) {
          m.reply(`❌ *ᴀᴅᴀ ʏᴀɴɢ ᴇʀʀᴏʀ ɴɪʜ 🥺:* ${e.message}`);
      }
  };

  handler.help = ['base64 enc/dec <teks>'];
  handler.tags = ['tools']
  handler.command = ['base64']

  handler.limit = true;
  return handler
}

rbRegister("tools/base64", feature)

let handler = (m, ctx) => rbRun("tools/base64", m, ctx)

handler.command = ['base64']
handler.help = ["base64 enc/dec <teks>"]
handler.tags = ['tools']

export default handler
