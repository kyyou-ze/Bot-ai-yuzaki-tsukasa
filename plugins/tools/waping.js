import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const net = (__m => __m.default ?? __m)((await import('net')))
  const dns = (__m => __m.default ?? __m)((await import('dns/promises')))
  const { performance } = (await import('perf_hooks'))

  // Ukur waktu koneksi TCP saja (DNS di-resolve dulu supaya tidak ikut dihitung sebagai latency)
  const pingHost = async (host, port = 443, timeout = 4000) => {
      let address
      try {
          address = (await dns.lookup(host)).address
      } catch {
          return null
      }

      return new Promise((resolve) => {
          let done = false
          const finish = (value) => {
              if (done) return
              done = true
              socket.destroy()
              resolve(value)
          }

          const socket = new net.Socket()
          const start = performance.now()

          socket.setTimeout(timeout)
          socket.once('error', () => finish(null))
          socket.once('timeout', () => finish(null))
          socket.connect(port, address, () => {
              finish(parseFloat((performance.now() - start).toFixed(1)))
          })
      })
  }

  const getStatusBadge = (ms) => {
      if (ms === null) return '❌ *TIMEOUT*'
      if (ms < 40) return `⚡ *${ms} ms* (Kilat)`
      if (ms < 100) return `🟢 *${ms} ms* (Stabil)`
      if (ms < 200) return `🟡 *${ms} ms* (Sedang)`
      return `🔴 *${ms} ms* (Lambat)`
  }

  const getQuality = (avg, active, total) => {
      if (active === 0) return '❌ *Tidak Terhubung*'
      if (active < total) return `⚠️ *Sebagian Server Gagal* (${total - active} timeout)`
      if (avg < 60) return '🚀 *Sangat Kilat*'
      if (avg < 120) return '🟢 *Stabil & Optimal*'
      if (avg < 200) return '🟡 *Sedang*'
      return '🔴 *Lambat*'
  }

  let handler = async (m, { sock }) => {
      try {
          await sock.sendMessage(m.chat, { react: { text: '📡', key: m.key } })

          const serverList = [
              {
                  category: '💬 PROTOCOL & SOCKET ROUTER',
                  servers: [
                      { host: 'web.whatsapp.com', name: 'WhatsApp Web / Socket API' },
                      { host: 'g.whatsapp.net', name: 'Group & Chat Protocol Router' },
                      { host: 'api.whatsapp.com', name: 'WhatsApp Universal Web API' },
                      { host: 'www.whatsapp.com', name: 'WhatsApp Main Portal' }
                  ]
              },
              {
                  category: '🖼️ MEDIA & CDN GATEWAY',
                  servers: [
                      { host: 'mmg.whatsapp.net', name: 'Media Gateway (Upload/Send)' },
                      { host: 'pps.whatsapp.net', name: 'Profile Picture CDN Server' },
                      { host: 'static.whatsapp.net', name: 'Sticker & Static Assets' },
                      { host: 'v.whatsapp.net', name: 'VN & Audio Streaming CDN' }
                  ]
              },
              {
                  category: '⚙️ TELEMETRY & META CLOUD',
                  servers: [
                      { host: 'dit.whatsapp.net', name: 'Multi-Device Sync & Telemetry' },
                      { host: 'crashlogs.whatsapp.net', name: 'Crash & Error Monitoring' },
                      { host: 'graph.facebook.com', name: 'Meta Graph Backbone API' }
                  ]
              }
          ]

          let dnsText
          try {
              const dStart = performance.now()
              await dns.lookup('web.whatsapp.com')
              dnsText = `${(performance.now() - dStart).toFixed(1)} ms`
          } catch {
              dnsText = '❌ Gagal'
          }

          const allServers = serverList.flatMap(c => c.servers)
          const pingResults = await Promise.all(
              allServers.map(async (s) => ({ ...s, latency: await pingHost(s.host, 443) }))
          )

          const resultMap = new Map(pingResults.map(r => [r.host, r.latency]))

          let totalLatency = 0
          let activeCount = 0

          const waktu = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })

          let caption = `╭─── 🌐 *WHATSAPP NETWORK BENCHMARK* ───╮\n`
          caption += `│ 📡 *DNS Lookup :* \`${dnsText}\`\n`
          caption += `│ 🕒 *Waktu Uji  :* \`${waktu} WIB\`\n`
          caption += `╰────────────────────────────────────────╯\n\n`

          for (const group of serverList) {
              caption += `┌───  *${group.category}*\n`
              for (const s of group.servers) {
                  const ms = resultMap.get(s.host)
                  if (ms !== null) {
                      totalLatency += ms
                      activeCount++
                  }
                  caption += `│ ▢ *${s.name}*\n`
                  caption += `│   └─ \`${s.host}\` : ${getStatusBadge(ms)}\n`
              }
              caption += `└───────────────────────────────\n\n`
          }

          const avg = activeCount > 0 ? totalLatency / activeCount : 0

          caption += `╭─── 📊 *STATUS KONEKSI SERVER* ───╮\n`
          caption += `│ • Server Aktif : *${activeCount}/${allServers.length} Server*\n`
          caption += `│ • Rata-rata    : *${activeCount > 0 ? `${avg.toFixed(1)} ms` : '-'}*\n`
          caption += `│ • Kualitas     : ${getQuality(avg, activeCount, allServers.length)}\n`
          caption += `╰──────────────────────────────────╯\n`
          caption += `\n_꒰ © ${global.namebot} • Network Diagnostics ꒱_`

          await sock.sendMessage(m.chat, { text: caption.trim() }, { quoted: m })
          await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
      } catch (e) {
          console.error('[waping]', e)
          await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => null)
          await sock.sendMessage(m.chat, { text: `Gagal menguji jaringan: ${e.message}` }, { quoted: m }).catch(() => null)
      }
  }

  handler.help = ['waping', 'pingwa', 'cekjaringan']
  handler.tags = ['tools']
  handler.command = ['waping']

  handler.limit = true
  return handler
}

rbRegister("tools/waping", feature)

let handler = (m, ctx) => rbRun("tools/waping", m, ctx)

handler.command = ['waping']
handler.help = ["waping", "pingwa", "cekjaringan"]
handler.tags = ['tools']

export default handler
