import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "googleimage": async ({ rbLib }) => {
      const axios = (__m => __m.default ?? __m)((await import('axios')))
      const cheerio = (await import('cheerio'))

      async function googleImageSearch(query) {
        try {
          const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`
          const { data } = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
          })
          const results = []
          const regex = /\["(https:\/\/[^"]+)",\d+,\d+\]/g
          let match
          while ((match = regex.exec(data)) !== null) {
            const imgUrl = match[1]
            if (imgUrl.endsWith('.jpg') || imgUrl.endsWith('.png') || imgUrl.endsWith('.jpeg')) {
              results.push({ url: imgUrl, title: query })
            }
          }
          if (results.length === 0) {
            const $ = cheerio.load(data)
            $('img').each((i, el) => {
              const src = $(el).attr('src')
              if (src && src.startsWith('http')) {
                results.push({ url: src, title: query })
              }
            })
          }
          return results
        } catch {
          return []
        }
      }

      const __default = { googleImageSearch }
      return { googleImageSearch, default: __default }
    }
}

const feature = async ({ rbG, rbLib }) => {
  const { prepareWAMessageMedia } = (await import('@whiskeysockets/baileys'))
  const { googleImageSearch } = (await rbLib('googleimage'))
  const { Carousel } = (await rbLib('helperbails'))

  const handler = async (m, { conn, sock, text, usedPrefix, command, reply }) => {
      const client = conn || sock || rbG.mainSock || rbG.conn;

      if (!text) {
          return reply(
              `🔍 *Google Image Search*\n\n` +
              `Ketik kata kunci gambar yang ingin dicari, sayang~\n\n` +
              `*Contoh:* \`${usedPrefix + command} kucing persia\`\n` +
              `*Contoh:* \`${usedPrefix + command} cyber city wallpaper\``
          );
      }

      await client.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

      try {
          const results = await googleImageSearch(text.trim());

          if (!results || results.length === 0) {
              await client.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
              return reply(`❌ Gambar tidak ditemukan untuk pencarian *"${text}"*, coba kata kunci lain ya sayang~`);
          }

          // Batasi maksimal 7 kartu untuk carousel agar ringan & responsif
          const displayItems = results.slice(0, 7);

          const cardPromises = displayItems.map(async (item, index) => {
              try {
                  const media = await prepareWAMessageMedia(
                      { image: { url: item.url } },
                      { upload: client.waUploadToServer }
                  );

                  const cardTitle = item.title && item.title.trim() ? item.title.trim() : text;
                  const cleanTitle = cardTitle.length > 50 ? cardTitle.substring(0, 47) + '...' : cardTitle;

                  return {
                      body: {
                          text: `🔍 *Query:* ${text}\n` +
                              `🖼️ *Judul:* ${cleanTitle}\n` +
                              `🌐 *Sumber:* ${item.source ? new URL(item.source).hostname : 'Google'}`
                      },
                      footer: {
                          text: `© ${rbG.namaBot || `${global.namebot}`} • Google Image`
                      },
                      header: {
                          title: `📸 Gambar ${index + 1}/${displayItems.length}`,
                          hasMediaAttachment: true,
                          imageMessage: media.imageMessage
                      },
                      nativeFlowMessage: {
                          buttons: [{
                              name: 'cta_url',
                              buttonParamsJson: JSON.stringify({
                                  display_text: '🌐 Buka Sumber Gambar',
                                  url: item.source || item.url
                              })
                          }]
                      }
                  };
              } catch (e) {
                  return null;
              }
          });

          const cards = (await Promise.all(cardPromises)).filter(Boolean);

          if (false) {
              const carousel = new Carousel(client)
                  .setBody(`*HASIL GOOGLE IMAGE SEARCH*\n\nDitemukan *${cards.length}* gambar untuk *"${text}"*.\nGeser ke samping untuk melihat pilihan lainnya ya sayang~ ⏩`)
                  .setFooter(`© ${rbG.namaBot || `${global.namebot}`} • Google Image Search`);

              for (const card of cards) {
                  carousel.addCard(card);
              }

              await carousel.send(m.chat, { quoted: m });
              await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
          } else {
              // Fallback bila media prepare carousel gagal, kirim langsung 1 gambar utama
              const firstItem = displayItems[0];
              await client.sendMessage(m.chat, {
                  image: { url: firstItem.url },
                  caption: `*Google Image Search*\n\n🔍 *Query:* ${text}\n🖼️ *Judul:* ${firstItem.title}\n🌐 *Sumber:* ${firstItem.source}`
              }, { quoted: m });
              await client.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
          }
      } catch (err) {
          console.error('[GOOGLE IMAGE SEARCH ERROR]:', err);
          await client.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
          return reply(`❌ Terjadi kesalahan saat mencari gambar: ${err.message}`);
      }
  };

  handler.help = ['gimage <query>']
  handler.tags = ['search']
  handler.command = ['gimage']
  handler.limit = true;
  handler.register = true;
  return handler
}

rbRegister("search/gimage", feature, libs)

let handler = (m, ctx) => rbRun("search/gimage", m, ctx)

handler.command = ['gimage']
handler.help = ["gimage <query>", "googleimage <query>"]
handler.tags = ['search']

export default handler
