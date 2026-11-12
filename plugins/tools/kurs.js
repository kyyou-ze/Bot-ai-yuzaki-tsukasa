import { fetchJSON, FriendlyError, cached, peekCache, guard } from '../../lib/services/scraper.js'

// Kurs dari ExchangeRate-API (open access, tanpa key, wajib atribusi, dibatasi 1 request/jam).
const API = 'https://open.er-api.com/v6/latest/USD'
const KEY = 'kurs:usd'
const TTL = 60 * 60 * 1000

const DEFAULT_LIST = ['USD', 'EUR', 'SGD', 'MYR', 'JPY', 'GBP', 'AUD', 'SAR', 'CNY']

async function getRates() {
    try {
        return await cached(KEY, TTL, async () => {
            const json = await fetchJSON(API)
            if (json?.result !== 'success' || !json?.rates || typeof json.rates !== 'object') {
                throw new FriendlyError('Data kurs belum tersedia, coba lagi nanti.')
            }
            return { rates: json.rates, updated: json.time_last_update_utc || '' }
        })
    } catch (e) {
        // kalau server gagal tapi masih ada data lama, pakai itu
        const old = peekCache(KEY)
        if (old) return { ...old, stale: true }
        throw e
    }
}

function parseAmount(token) {
    let s = String(token).replace(/\s/g, '')
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(',', '.')
    const n = Number(s)
    return /^\d+(\.\d+)?$/.test(s) && Number.isFinite(n) ? n : NaN
}

function fmt(n, code) {
    const digits = code === 'IDR' || Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 1 ? 2 : 6
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(n)
}

const convert = (rates, amount, from, to) => (amount / rates[from]) * rates[to]

let handler = guard(async (m, { text, reply }) => {
    const tokens = String(text || '').trim().split(/\s+/).filter(Boolean)

    let amount = 1
    if (tokens.length && !Number.isNaN(parseAmount(tokens[0]))) {
        amount = parseAmount(tokens.shift())
    }
    if (!(amount > 0) || amount > 1e15) return reply('Jumlah tidak valid.')

    const { rates, updated, stale } = await getRates()
    const footer = `\n\n_Sumber: ExchangeRate-API${updated ? ` | ${updated.replace(/ \+0000$/, ' UTC')}` : ''}${stale ? ' (data lama, server sedang bermasalah)' : ''}_`

    const codes = tokens.map(t => t.toUpperCase())
    for (const c of codes) {
        if (!/^[A-Z]{3}$/.test(c) || !rates[c]) {
            return reply(`Mata uang *${c}* tidak dikenal.\n\nPakai kode 3 huruf, contoh: USD, EUR, SGD, JPY, IDR.`)
        }
    }

    // kurs   -> tabel mata uang populer ke rupiah
    if (!codes.length) {
        const lines = DEFAULT_LIST.map(c => `${fmt(amount, c)} ${c} = Rp ${fmt(convert(rates, amount, c, 'IDR'), 'IDR')}`)
        return reply(`💱 *KURS KE RUPIAH*\n\n${lines.join('\n')}${footer}`)
    }

    // kurs usd / kurs 100 usd  -> ke rupiah
    // kurs usd eur            -> antar mata uang
    const from = codes[0]
    const to = codes[1] || (from === 'IDR' ? 'USD' : 'IDR')
    const result = convert(rates, amount, from, to)

    return reply(
        `💱 *KURS*\n\n` +
        `${fmt(amount, from)} ${from} = *${to === 'IDR' ? 'Rp ' : ''}${fmt(result, to)}${to === 'IDR' ? '' : ` ${to}`}*` +
        (amount === 1 ? '' : '\n\n') +
        (amount === 1 ? '' : `1 ${from} = ${to === 'IDR' ? 'Rp ' : ''}${fmt(convert(rates, 1, from, to), to)}${to === 'IDR' ? '' : ` ${to}`}`) +
        footer
    )
})

handler.command = ['kurs']
handler.help = ['kurs']
handler.tags = ['tools']

export default handler
