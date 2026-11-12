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
      if (!text) {
          return m.reply(`📌 *Contoh penggunaan:*\n${usedPrefix + command} 103.217.224.106`);
      }

      const ipTarget = text.trim();
      const isIP = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ipTarget);
      if (!isIP) return m.reply('❌ *Format IP tidak valid!*');

      try {
          m.reply('⏳ *Sedang mengambil informasi...*');

          let ipData = await getIPData(ipTarget);

          const safe = (v) => v || '-';

          let mapLink = `https://www.openstreetmap.org/?mlat=${ipData.latitude}&mlon=${ipData.longitude}&zoom=12`;
          let mapThumbnail = `https://static-maps.yandex.ru/1.x/?ll=${ipData.longitude},${ipData.latitude}&size=450,450&z=12&l=map&pt=${ipData.longitude},${ipData.latitude},pm2rdl`;

          let formattedData = `
  🔍 *\`INFORMASI IP: ${ipTarget}\`*

  📟 *IP Address : ${safe(ipData.ip)}*
  📞 *Status : ${ipData.success ? 'Berhasil' : 'Gagal'}*
  📡 *Tipe IP : ${safe(ipData.type)}*
  📖 *Kontinen : ${safe(ipData.continent)} ${safe(ipData.continent_code)}*
  📀 *Negara : ${safe(ipData.country)} ${safe(ipData.country_code)}*
  📂 *Region : ${safe(ipData.region)} ${safe(ipData.region_code)}*
  📌 *Kota : ${safe(ipData.city)}*

  📍 *Koordinat*
  • Latitude : ${safe(ipData.latitude)}
  • Longitude : ${safe(ipData.longitude)}

  📬 *Uni Eropa : ${ipData.is_eu ? 'Ya' : 'Tidak'}*
  📎 *Kode Pos : ${safe(ipData.postal)}*
  ☎️ *Kode Panggilan : +${safe(ipData.calling_code)}*
  🏷️ *Ibu Kota : ${safe(ipData.capital)}*

  🧮 *\`Koneksi\`*
  💡 ASN : ${safe(ipData.connection?.asn)}
  🖥️ Org : ${safe(ipData.connection?.org)}
  📡 ISP : ${safe(ipData.connection?.isp)}
  💻 Domain : ${safe(ipData.connection?.domain)}

  ⏰ *\`Timezone\`*
  ⌨️ ID : ${safe(ipData.timezone?.id)}
  📅 Waktu : ${safe(ipData.timezone?.current_time)}

  📖 *Map :* ${mapLink}
  `.trim();

          if (ipData.latitude && ipData.longitude) {
              await conn.sendMessage(m.chat, {
                  location: {
                      degreesLatitude: ipData.latitude,
                      degreesLongitude: ipData.longitude
                  }
              }).catch(() => {});
          }

          await conn.sendMessage(m.chat, {
              text: formattedData
          });

          if (ipData.flag?.img) {
              await conn.sendMessage(m.chat, {
                  image: {
                      url: ipData.flag.img
                  },
                  caption: `🏳️ ${safe(ipData.country)}`
              }).catch(() => {});
          }
      } catch (err) {
          console.error(err);
          m.reply(`❌ *Error:* ${err.message}`);
      }
  };

  handler.help = ['trackipv2'];
  handler.tags = ['tools']
  handler.command = ['trackipv2']
  handler.premium = true;
  handler.limit = true;
  handler.register = true;

  async function getIPData(ip) {
      try {
          const res = await axios.get(`https://ipwho.is/${ip}`, {
              timeout: 8000
          });

          if (res.data.success) return res.data;
          throw new Error('ipwho gagal');
      } catch {
          const res2 = await axios.get(`http://ip-api.com/json/${ip}`, {
              timeout: 8000
          });

          if (res2.data.status !== 'success') {
              throw new Error('Semua API gagal');
          }

          return {
              ip: res2.data.query,
              success: true,
              type: 'ipv4',
              continent: res2.data.continent,
              continent_code: '',
              country: res2.data.country,
              country_code: res2.data.countryCode,
              flag: {
                  img: `https://flagcdn.com/w320/${res2.data.countryCode.toLowerCase()}.png`
              },
              region: res2.data.regionName,
              region_code: res2.data.region,
              city: res2.data.city,
              latitude: res2.data.lat,
              longitude: res2.data.lon,
              is_eu: false,
              postal: res2.data.zip,
              calling_code: '',
              capital: '',
              borders: '',
              connection: {
                  asn: '',
                  org: res2.data.org,
                  isp: res2.data.isp,
                  domain: ''
              },
              timezone: {
                  id: res2.data.timezone,
                  current_time: ''
              }
          };
      }
  }
  return handler
}

rbRegister("tools/trackipv2", feature)

let handler = (m, ctx) => rbRun("tools/trackipv2", m, ctx)

handler.command = ['trackipv2']
handler.help = ["trackipv2"]
handler.tags = ['tools']
handler.premium = true

export default handler
