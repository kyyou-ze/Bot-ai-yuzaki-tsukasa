import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = (module, exports, require) => {
        // .kripto [koin] — harga kripto (CoinGecko, gratis) dalam IDR & USD + perubahan 24 jam.  Tanpa argumen = 8 koin teratas
        const axios = require('axios'), { B } = require('../../lib/style')
        const LINE = '━━━━━━━━━━━━━━━━━━━━'
        const TOP = ['bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'ripple', 'dogecoin', 'cardano']
        const SYM = { btc: 'bitcoin', eth: 'ethereum', usdt: 'tether', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple', doge: 'dogecoin', ada: 'cardano', ton: 'the-open-network', trx: 'tron', dot: 'polkadot', matic: 'matic-network', ltc: 'litecoin', shib: 'shiba-inu', avax: 'avalanche-2', link: 'chainlink', pepe: 'pepe' }
        const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID')
        const usd = (n) => '$' + (n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n.toPrecision(3))
        const arrow = (c) => c == null ? '' : (c >= 0 ? '▲ +' : '▼ ') + c.toFixed(2) + '%'
        module.exports = {
          name: 'kripto', alias: ['crypto', 'hargakripto', 'coin'], category: 'search', cmds: ['kripto'], noLimit: false,
          desc: 'Harga kripto realtime (IDR & USD): .kripto, .kripto btc eth',
          run: async ({ text, prefix, reply }) => {
            const want = String(text || '').toLowerCase().split(/[\s,]+/).filter(Boolean).slice(0, 6).map(x => SYM[x] || x.replace(/[^a-z0-9-]/g, ''))
            const ids = want.length ? want : TOP
            try {
              const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', { timeout: 15000, params: { ids: ids.join(','), vs_currencies: 'idr,usd', include_24hr_change: true } })
              const rows = ids.filter(i => data[i]).map(i => `*${i.toUpperCase().replace(/-/g, ' ')}*\n   ${rp(data[i].idr)}  •  ${usd(data[i].usd)}  ${arrow(data[i].usd_24h_change)}`)
              if (!rows.length) return reply(`Koin tidak dikenal.\nContoh: ${prefix}kripto btc eth sol`)
              return reply(`${B('HARGA KRIPTO')}\n${LINE}\n${rows.join('\n')}\n\n_Sumber: CoinGecko • bukan saran investasi_`)
            } catch (e) { console.log('[kripto]', e.message); return reply('Gagal mengambil harga: ' + (e.response && e.response.status === 429 ? 'batas permintaan tercapai, coba lagi semenit lagi' : e.message)) }
          },
        }
    }

const libs = {
    style: (module) => {
        const B = (t) => String(t ?? '').replace(/[A-Za-z0-9]/g, (c) => {
            const k = c.charCodeAt(0)
            return String.fromCodePoint(k >= 97 ? 0x1D41A + k - 97 : k >= 65 ? 0x1D400 + k - 65 : 0x1D7CE + k - 48)
        })
        const plain = (t) => String(t ?? '').normalize('NFKC').replace(/[\u{13000}-\u{1342F}]/gu, '').replace(/\s+/g, ' ').trim()
        const cut = (t, n) => { const a = Array.from(String(t ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('') }
        module.exports = { B, plain, cut, fx: (t) => t, ancientize: (t) => t, content: (c) => c, on: () => false }
    },
}

dioRegister("world/kripto", feature, libs)

let handler = (m, ctx) => dioRun("world/kripto", m, ctx)

handler.command = ['kripto', 'coin', 'crypto', 'hargakripto']
handler.hide = ["crypto", "hargakripto", "coin"]
handler.help = ["kripto"]
handler.tags = ['search']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'kripto', { subs: false })
