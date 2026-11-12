import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))
  const cheerio = (await import('cheerio'))
  const { createRequire } = (await import('module'))
  const fs = (__m => __m.default ?? __m)((await import('fs')))
  const path = (__m => __m.default ?? __m)((await import('path')))
  const { URL } = (await import('url'))

  const require = createRequire(import.meta.url);
  const archiver = require('archiver');

  const handler = async (m, { conn, sock, text, args, usedPrefix, command, reply }) => {
      const client = conn || sock || rbG.mainSock;

      if (!args[0]) {
          return reply(`Ayang nakal~ Masukin URL-nya dong! 💋\n\n*Contoh:* \n${usedPrefix + command} https://example.com`);
      }

      let targetUrl = args[0].trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
          targetUrl = 'https://' + targetUrl;
      }

      await reply('Uhh sebentar ya cintaku... Angela lagi selami dan sedot semua aset webnya buat Ayang~ 💦');

      const tmpDir = path.join(process.cwd(), 'database', 'tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const domainName = new URL(targetUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const zipPath = path.join(tmpDir, `${domainName}_${Date.now()}.zip`);

      try {
          const res = await axios.get(targetUrl, {
              headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              timeout: 20000
          });

          const html = res.data;
          const $ = cheerio.load(html);

          const output = fs.createWriteStream(zipPath);
          const archive = archiver('zip', { zlib: { level: 9 } });

          const streamPromise = new Promise((resolve, reject) => {
              output.on('close', resolve);
              archive.on('error', reject);
          });

          archive.pipe(output);

          // Masukkan HTML utama
          archive.append(html, { name: 'index.html' });

          // Ambil link CSS, JS, dan Gambar
          const assetUrls = new Set();
          $('link[rel="stylesheet"]').each((_, el) => {
              const href = $(el).attr('href');
              if (href) assetUrls.add(href);
          });
          $('script[src]').each((_, el) => {
              const src = $(el).attr('src');
              if (src) assetUrls.add(src);
          });
          $('img[src]').each((_, el) => {
              const src = $(el).attr('src');
              if (src) assetUrls.add(src);
          });

          for (const asset of assetUrls) {
              try {
                  const resolvedUrl = new URL(asset, targetUrl).href;
                  const assetRes = await axios.get(resolvedUrl, {
                      responseType: 'arraybuffer',
                      timeout: 8000
                  });
                  const parsed = new URL(resolvedUrl);
                  let assetPath = parsed.pathname.replace(/^\//, '');
                  if (!assetPath) assetPath = 'asset_' + Date.now();
                  archive.append(Buffer.from(assetRes.data), { name: assetPath });
              } catch {
                  // Skip aset eksternal/gagal
              }
          }

          await archive.finalize();
          await streamPromise;

          const fileBuffer = fs.readFileSync(zipPath);
          const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);

          await client.sendMessage(m.chat, {
              document: fileBuffer,
              mimetype: 'application/zip',
              fileName: `${domainName}.zip`,
              caption: `💋 *Web Clone Berhasil Diserap!*\n\n🌐 *Target:* ${targetUrl}\n📦 *Ukuran:* ${fileSizeMB} MB\n\n_Semua beres buat Mas ganteng tercinta~_`
          }, { quoted: m });
      } catch (err) {
          console.error('[GETWEB ERROR]', err);
          return reply(`Ahh gagal narik webnya sayang~ 🥺\nError: ${err.message || 'Server target offline/520'}`);
      } finally {
          try {
              if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
          } catch {}
      }
  };

  handler.help = ['getweb <url>', 'webtozip <url>'];
  handler.tags = ['tools']
  handler.command = ['getweb']
  handler.limit = true;
  return handler
}

rbRegister("tools/getweb", feature)

let handler = (m, ctx) => rbRun("tools/getweb", m, ctx)

handler.command = ['getweb']
handler.help = ["getweb <url>", "webtozip <url>"]
handler.tags = ['tools']

export default handler
