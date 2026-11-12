import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))

  const handler = async (m, { text }) => {
    if (!text || !text.includes('|')) {
      return m.reply(
        `📍 *ESTIMASI JARAK KOTA*\n\n` +
        `Format penggunaan:\n` +
        `• *.jarak asal | tujuan*\n\n` +
        `Contoh:\n` +
        `• *.jarak Jakarta | Bandung*\n` +
        `• *.jarak Surabaya | Yogyakarta*`
      )
    }

    const [from, to] = text.split('|').map(s => s.trim())
    if (!from || !to) return m.reply('❌ Masukkan nama kota asal dan kota tujuan dengan benar!')

    await m.reply(`⏳ Menghitung estimasi rute dari *${from}* ke *${to}*...`)

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(from)}`
      const urlTo = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(to)}`

      const [res1, res2] = await Promise.all([
        axios.get(url, { headers: { 'User-Agent': `${global.namebot}Bot/1.0` }, timeout: 10000 }),
        axios.get(urlTo, { headers: { 'User-Agent': `${global.namebot}Bot/1.0` }, timeout: 10000 })
      ])

      if (!res1.data?.[0] || !res2.data?.[0]) {
        return m.reply('❌ Salah satu atau kedua kota tidak ditemukan di peta!')
      }

      const lat1 = parseFloat(res1.data[0].lat)
      const lon1 = parseFloat(res1.data[0].lon)
      const lat2 = parseFloat(res2.data[0].lat)
      const lon2 = parseFloat(res2.data[0].lon)

      // Haversine formula
      const R = 6371 // radius bumi dalam km
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLon = ((lon2 - lon1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const d = Math.round(R * c)
      const estHours = (d / 60).toFixed(1)

      await m.reply(
        `╭─── ୨୧ ESTIMASI JARAK ୨୧ ───╮\n` +
        `│ ૮₍˶ᵔ ᵕ ᵔ˶₎ა rute perjalanan!\n` +
        `╰────────────────────────────╯\n\n` +
        `🚩 Asal     : *${res1.data[0].display_name.split(',')[0]}*\n` +
        `🏁 Tujuan   : *${res2.data[0].display_name.split(',')[0]}*\n` +
        `📏 Jarak    : *± ${d.toLocaleString('id-ID')} km* (garis lurus)\n` +
        `🚗 Estimasi : *± ${estHours} jam perjalanan darat*\n\n` +
        `꒰ა ♡ ໒꒱ selamat bepergian dengan aman!`
      )
    } catch (e) {
      await m.reply(`❌ Terjadi kendala saat mengambil data jarak: ${e.message}`)
    }
  }

  handler.help = ['jarak <asal | tujuan>']
  handler.tags = ['tools']
  handler.command = ['jarak']
  return handler
}

rbRegister("tools/jarak", feature)

let handler = (m, ctx) => rbRun("tools/jarak", m, ctx)

handler.command = ['jarak']
handler.help = ["jarak <asal | tujuan>"]
handler.tags = ['tools']

export default handler
