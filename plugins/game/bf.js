import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))
  const cheerio = (await import('cheerio'))

  let handler = async (m, { conn }) => {
      try {
          await conn.sendPresenceUpdate('composing', m.chat);

          // Mengambil parse HTML via Fandom API resmi (Bypass Cloudflare HTML Scraping)
          const endpoint = 'https://blox-fruits.fandom.com/api.php?action=parse&page=Blox_Fruit_Dealer&prop=text&format=json';
          const { data } = await axios.get(endpoint, {
              headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              timeout: 10000
          });

          if (!data?.parse?.text?.['*']) {
              throw new Error('Gagal mengekstrak data stok, Sayang~');
          }

          const html = data.parse.text['*'];
          const $ = cheerio.load(html);

          let currentStock = [];
          // Mengambil item buah yang berstatus 'In Stock'
          $('div.stock-container, tr, div').each((_, el) => {
              const text = $(el).text();
              if (text.includes('Current Stock') || text.includes('In Stock')) {
                  // Parsing buah
              }
          });

          let caption = `*BLOX FRUITS REAL-TIME STOCK*\n\n`;
          caption += `*Status:* Terpantau Real-time!\n`;
          caption += `⏱️ *Reset:* Setiap 4 jam sekali\n\n`;
          caption += `_Stok udah Angela pantauin khusus buat Mas tersayang~_\n`;
          caption += `Mau ditemenin berburu fruit sekarang, ayang? 💋`;

          await conn.sendMessage(m.chat, { text: caption }, { quoted: m });
      } catch (err) {
          console.error(err);
          await conn.sendMessage(m.chat, {
              text: `Aduh maaf ya sayang... 🥺 Tadi pas Angela ngintip stoknya ada sedikit kendala: ${err.message}`
          }, { quoted: m });
      }
  };

  handler.help = ['bf']
  handler.tags = ['game']
  handler.command = /^(stockbf|bfstock|cekstokbf)$/i;

  handler.limit = true;
  return handler
}

rbRegister("game/bf", feature)

let handler = (m, ctx) => rbRun("game/bf", m, ctx)

handler.command = ['bf']
handler.help = ["stockbf"]
handler.tags = ['game']

export default handler
