import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const { exec } = (await import('child_process'))
  const util = (__m => __m.default ?? __m)((await import('util')))

  const execPromise = util.promisify(exec);

  let handler = async (m, { sock, reply }) => {
      await reply('⚡ Running speedtest, ᴍᴏʜᴏɴ ᴛᴜɴɢɢᴜ...');
      try {
          const { stdout, stderr } = await execPromise('speedtest-cli --simple');
          if (stdout) {
              await sock.sendMessage(m.chat, { text: `🚀 *🚀 *ʜᴀsɪʟ sᴘᴇᴇᴅᴛᴇsᴛ:**\n\n${stdout.trim()}` }, { quoted: m });
          } else if (stderr) {
              await sock.sendMessage(m.chat, { text: `⚠️ *Speedtest Error:*\n${stderr}` }, { quoted: m });
          }
      } catch (err) {
          await sock.sendMessage(m.chat, { text: `❌ *Error executing speedtest:*\n${err.message}` }, { quoted: m });
      }
  };

  handler.help = ['speedtest'];
  handler.tags = ['tools', 'owner']
  handler.command = ['speedtest']
  handler.limit = true;
  return handler
}

rbRegister("tools/speedtest", feature)

let handler = (m, ctx) => rbRun("tools/speedtest", m, ctx)

handler.command = ['speedtest']
handler.help = ["speedtest"]
handler.tags = ['tools']

export default handler
