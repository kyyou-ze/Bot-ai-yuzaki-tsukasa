import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const sharp = (__m => __m.default ?? __m)((await import('sharp')))

  const formatBytes = (bytes, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handler = async (m, { usedPrefix, command, reply }) => {
      const q = m.quoted ? m.quoted : m;
      const mime = (q.msg || q).mimetype || q.mtype || '';

      if (!/image/.test(mime)) {
          return reply(`Kirim atau reply gambar dengan caption *${usedPrefix + command}*`);
      }

      try {
          const media = await q.download();
          if (!media || !Buffer.isBuffer(media)) {
              return reply('❌ ɢᴀɢᴀʟ mendownload media gambar.');
          }

          const metadata = await sharp(media).metadata();

          const width = metadata.width || 0;
          const height = metadata.height || 0;
          const totalPixels = (width * height).toLocaleString('id-ID');
          const aspect = width && height ? (width / height).toFixed(2) : '-';
          const format = (metadata.format || 'unknown').toUpperCase();
          const size = media.length ? formatBytes(media.length) : '-';
          const space = metadata.space || 'sRGB';
          const channels = metadata.channels || 3;

          const teks = `🖼️ *IMAGE PIXEL IDENTIFIER*\n\n` +
              `• 📐 *Lebar (Width):* ${width} px\n` +
              `• 📏 *Tinggi (Height):* ${height} px\n` +
              `• 🔍 *Total Pixel:* ${totalPixels} Pixels\n` +
              `• 🖼️ *Aspect Ratio:* ${aspect} (${width}:${height})\n` +
              `• 📦 *Format Gambar:* ${format}\n` +
              `• 💾 *Ukuran File:* ${size}\n` +
              `• 🎨 *Color Space:* ${space} (${channels} Channels)\n\n` +
              `_Identifikasi resolusi gambar berhasil!_`;

          reply(teks);
      } catch (err) {
          console.error('[cekpixel error]:', err);
          reply(`❌ ɢᴀɢᴀʟ membaca metadata pixel gambar: ${err.message || err}`);
      }
  };

  handler.help = ['cekpixel'];
  handler.tags = ['tools']
  handler.command = ['cekpixel']
  handler.category = 'tools';
  handler.description = 'Cek resolusi pixel, dimensi, dan metadata foto/gambar';
  handler.limit = true;
  handler.register = true;
  return handler
}

rbRegister("tools/cekpixel", feature)

let handler = (m, ctx) => rbRun("tools/cekpixel", m, ctx)

handler.command = ['cekpixel']
handler.help = ["cekpixel"]
handler.tags = ['tools']

export default handler
