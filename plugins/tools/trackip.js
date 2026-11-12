import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  let handler = async (m, {
      conn,
      text,
      usedPrefix,
      command
  }) => {
      if (!text) return m.reply(`📌 Contoh penggunaan:\n${usedPrefix + command} 103.217.224.106`);

      const ipTarget = text.trim();
      const isIP = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ipTarget);
      if (!isIP) return m.reply('❌ Format IP tidak valid!');

      try {
          m.reply('⏳ Mengambil data dari 3 server...');

          const [ipwho, ipapi, ipapi2] = await Promise.allSettled([
              axios.get(`https://ipwho.is/${ipTarget}`, {
                  timeout: 8000
              }),
              axios.get(`https://ipapi.co/${ipTarget}/json`, {
                  timeout: 8000
              }),
              axios.get(`http://ip-api.com/json/${ipTarget}`, {
                  timeout: 8000
              })
          ]);

          const safe = v => v || '-';

          const d1 = ipwho.status === 'fulfilled' ? ipwho.value.data : {};
          const d2 = ipapi.status === 'fulfilled' ? ipapi.value.data : {};
          const d3 = ipapi2.status === 'fulfilled' ? ipapi2.value.data : {};

          const result = {
              ip: d1.ip || d2.ip || d3.query,
              type: d1.type || d2.version || 'ipv4',
              country: d1.country || d2.country_name || d3.country,
              country_code: d1.country_code || d2.country_code || d3.countryCode,
              city: d1.city || d2.city || d3.city,
              region: d1.region || d2.region || d3.regionName,
              latitude: d1.latitude || d2.latitude || d3.lat,
              longitude: d1.longitude || d2.longitude || d3.lon,
              isp: d1.connection?.isp || d2.org || d3.isp,
              org: d1.connection?.org || d2.org || d3.org,
              asn: d1.connection?.asn || d2.asn || '',
              timezone: d1.timezone?.id || d2.timezone || d3.timezone,
              postal: d1.postal || d2.postal || d3.zip,
              calling_code: d1.calling_code || d2.country_calling_code || '',
              currency: d2.currency || d1.currency?.code || '',
              currency_name: d2.currency_name || '',
              languages: d2.languages || d1.languages || '',
              borders: d1.borders || '-',
              capital: d1.capital || d2.country_capital || '-',
              flag: d1.flag?.img || (d2.country_code ? `https://flagcdn.com/w320/${d2.country_code.toLowerCase()}.png` : '') || (d3.countryCode ? `https://flagcdn.com/w320/${d3.countryCode.toLowerCase()}.png` : ''),
              emoji: d1.flag?.emoji || '-',
              emoji_unicode: d1.flag?.emoji_unicode || '-'
          };

          if (!result.ip) throw new Error('Gagal mengambil data dari semua server');

          let mapLink = `https://www.openstreetmap.org/?mlat=${result.latitude}&mlon=${result.longitude}&zoom=12`;
          let mapThumbnail = `https://static-maps.yandex.ru/1.x/?ll=${result.longitude},${result.latitude}&size=450,450&z=12&l=map&pt=${result.longitude},${result.latitude},pm2rdl`;

          let formattedData = `
  🔍 INFORMASI IP: ${ipTarget}

  📟 IP Address : ${safe(result.ip)}
  📡 Tipe IP : ${safe(result.type)}
  📖 Kontinen : ${safe(d1.continent || '')} ${safe(d1.continent_code || '')}
  📀 Negara : ${safe(result.country)} (${safe(result.country_code)}) 
  📂 Region : ${safe(result.region)}
  📌 Kota : ${safe(result.city)}
  📍 Koordinat
  • Latitude : ${safe(result.latitude)}
  • Longitude : ${safe(result.longitude)}
  📬 Bagian Uni Eropa : ${d1.is_eu ? 'Ya' : 'Tidak'}
  📎 Kode Pos : ${safe(result.postal)}
  ☎️ Kode Panggilan : +${safe(result.calling_code)}
  🏷️ Ibu Kota Negara : ${safe(result.capital)}
  🔗 Batas Negara : ${safe(result.borders)}

  🏳️ Bendera
  💾 Gambar : ${safe(result.flag)}
  🏮 Emoji : ${safe(result.emoji)}
  🔖 Unicode : ${safe(result.emoji_unicode)}

  🧮 Informasi Koneksi
  💡 ASN : ${safe(result.asn)}
  🖥️ Organisasi : ${safe(result.org)}
  📡 ISP : ${safe(result.isp)}

  ⏰ Zona Waktu : ${safe(result.timezone)}
  💰 Mata Uang : ${safe(result.currency)} (${safe(result.currency_name)})
  🗣️ Bahasa : ${safe(result.languages)}

  📖 Peta Lokasi : ${mapLink}
  `.trim();

          if (result.latitude && result.longitude) {
              await conn.sendMessage(m.chat, {
                  location: {
                      degreesLatitude: result.latitude,
                      degreesLongitude: result.longitude
                  }
              }).catch(() => {});
          }

          await conn.sendMessage(m.chat, {
              text: formattedData
          });

          if (result.flag) {
              await conn.sendMessage(m.chat, {
                  image: {
                      url: result.flag
                  },
                  caption: `🏳️ ${safe(result.country)}`
              }).catch(() => {});
          }
      } catch (err) {
          console.error(err);
          m.reply(`❌ Terjadi kesalahan: ${err.message}`);
      }
  };

  handler.help = ['trackip'];
  handler.tags = ['tools']
  handler.command = ['trackip']
  handler.premium = true;
  handler.limit = true;
  handler.register = true;
  return handler
}

rbRegister("tools/trackip", feature)

let handler = (m, ctx) => rbRun("tools/trackip", m, ctx)

handler.command = ['trackip']
handler.help = ["trackip"]
handler.tags = ['tools']
handler.premium = true

export default handler
