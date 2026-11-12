import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const handler = async (m, { sock, conn, text, usedPrefix, command }) => {
      const client = sock || conn;
      let number = '';

      if (m.quoted) {
          const quotedSender = m.quoted.sender || m.quoted.key?.participant || m.quoted.key?.remoteJid || '';
          number = quotedSender.replace(/[^0-9]/g, '');
      } else if (m.mentionedJid && m.mentionedJid.length > 0) {
          number = m.mentionedJid[0].replace(/[^0-9]/g, '');
      } else if (text) {
          number = text.replace(/[^0-9]/g, '');
      } else {
          number = m.sender.replace(/[^0-9]/g, '');
      }

      if (!number) return m.reply(`*ᴄᴏɴᴛᴏʜ:* \`${usedPrefix + command} @tag/reply\``);

      if (rbG.Button) {
          try {
              const btn = new rbG.Button(client);
              btn.setBody(`📋 *NOMOR:* \`${number}\``);
              btn.setFooter(`꒰ © ${global.namebot} ꒱• Tekan tombol di bawah untuk menyalin`);
              btn.addCopy("📋 SALIN NOMOR", number);
              return await btn.send(m.chat, { quoted: m });
          } catch (e) {}
      }

      return m.reply(`📋 *Nomor:* \`${number}\``);
  };

  handler.help = ['getnumber', 'getnomor', 'copynumber'];
  handler.tags = ['tools']
  handler.command = ['getnumber']

  handler.limit = true;
  return handler
}

rbRegister("tools/getnumber", feature)

let handler = (m, ctx) => rbRun("tools/getnumber", m, ctx)

handler.command = ['getnumber']
handler.help = ["getnumber", "getnomor", "copynumber"]
handler.tags = ['tools']

export default handler
