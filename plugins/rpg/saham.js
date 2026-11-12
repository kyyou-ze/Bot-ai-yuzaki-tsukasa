// BURSA SAHAM SIMULASI (fiktif, tanpa API): harga bergerak acak tiap 30 menit.
// .saham               daftar harga & perubahan
// .saham <KODE>        detail + grafik mini + berita
// .belisaham <KODE> <jumlah|all>
// .jualsaham <KODE> <jumlah|all>
// .portofolio          saham yang kamu pegang + untung/rugi
// .beritasaham         berita pasar & suku bunga Bank Sentral
// Biaya transaksi 1%. Suku bunga Bank Sentral tinggi menekan harga, rendah mendorong harga naik.
import { gameStore, save, rupiah, rpgUser, persist, rememberSock, num } from '../../lib/group/sosial.js'

const TICK = 30 * 60_000
const FEE = 0.01
const STOCKS = {
    KGYA: { n: 'Kaguya Teknologi', base: 5000, vol: 0.035 },
    BNTO: { n: 'Bento Pangan', base: 1800, vol: 0.02 },
    RYMN: { n: 'Ryuu Tambang', base: 3200, vol: 0.045 },
    TKYO: { n: 'Tokyo Rel Nusantara', base: 2400, vol: 0.025 },
    NMBK: { n: 'Nami Bank', base: 4100, vol: 0.022 },
    SKRA: { n: 'Sakura Farma', base: 7500, vol: 0.05 }
}
const GOOD = ['mencetak laba rekor', 'meluncurkan produk baru', 'mendapat kontrak besar', 'dipuji analis', 'ekspansi ke pasar baru']
const BAD = ['laporan keuangan mengecewakan', 'produk ditarik dari pasaran', 'gugatan hukum', 'CEO mengundurkan diri', 'pabrik terbakar']
const SPARK = '▁▂▃▄▅▆▇█'

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
const spark = (arr) => { const lo = Math.min(...arr), hi = Math.max(...arr); return arr.map(v => SPARK[hi === lo ? 3 : Math.round((v - lo) / (hi - lo) * 7)]).join('') }

function market() {
    const s = gameStore().stock
    if (!s.prices) {
        s.t = Math.floor(Date.now() / TICK) * TICK
        s.rate = 5; s.news = []; s.holders = {}; s.prices = {}; s.hist = {}; s.open = {}
        for (const [k, v] of Object.entries(STOCKS)) { s.prices[k] = v.base; s.hist[k] = [v.base]; s.open[k] = v.base }
        save()
    }
    // kejar tick yang terlewat (maks 96 = 2 hari)
    const due = Math.min(96, Math.floor((Date.now() - s.t) / TICK))
    if (due > 0) {
        for (let i = 0; i < due; i++) step(s, s.t + (i + 1) * TICK)
        s.t += Math.floor((Date.now() - s.t) / TICK) * TICK
        save()
    }
    return s
}

function step(s, at) {
    // suku bunga bergerak pelan 0.5% - 10%
    if (Math.random() < 0.08) {
        const d = Math.random() < 0.5 ? -0.5 : 0.5
        s.rate = Math.min(10, Math.max(0.5, +(s.rate + d).toFixed(1)))
        s.news.unshift({ at, text: `🏦 Bank Sentral ${d > 0 ? 'MENAIKKAN' : 'MENURUNKAN'} suku bunga ke ${s.rate}%` })
    }
    const drift = -(s.rate - 5) * 0.0008
    const shockCode = Math.random() < 0.15 ? Object.keys(STOCKS)[Math.floor(Math.random() * 6)] : null
    for (const [k, v] of Object.entries(STOCKS)) {
        let ret = drift + v.vol * gauss() + 0.06 * (v.base - s.prices[k]) / v.base // tarikan kembali ke harga wajar
        if (k === shockCode) {
            const up = Math.random() < 0.5
            ret += (up ? 1 : -1) * (0.04 + Math.random() * 0.06)
            const arr = up ? GOOD : BAD
            s.news.unshift({ at, text: `${up ? '📈' : '📉'} ${v.n} (${k}) ${arr[Math.floor(Math.random() * arr.length)]}` })
        }
        s.prices[k] = Math.min(v.base * 3, Math.max(Math.round(v.base * 0.3), Math.round(s.prices[k] * (1 + ret))))
        const h = s.hist[k]; h.push(s.prices[k]); if (h.length > 48) h.shift()
    }
    s.news = s.news.slice(0, 8)
    // harga pembuka tiap awal hari WIB (untuk perubahan harian)
    const day = new Date(at + 7 * 36e5).toISOString().slice(0, 10)
    if (s.day !== day) { s.day = day; s.open = { ...s.prices } }
}

const pct = (a, b) => b ? ((a - b) / b * 100) : 0
const arrow = (p) => p > 0.05 ? '🟢▲' : p < -0.05 ? '🔴▼' : '⚪▬'
const fmtPct = (p) => `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`

let handler = async (m, { sock, text, command, prefix, reply }) => {
    rememberSock(sock)
    const s = market()
    const { pn, user } = await rpgUser(sock, m)
    const id = num(pn)
    const port = (s.holders[id] ||= {})

    if (command === 'beritasaham') {
        return reply(`📰 *BERITA PASAR*\n🏦 Suku bunga Bank Sentral: *${s.rate}%* ${s.rate > 5 ? '(ketat, menekan harga)' : s.rate < 5 ? '(longgar, mendorong harga)' : '(netral)'}\n\n${s.news.length ? s.news.map(n => `${n.text}`).join('\n') : '_Belum ada berita._'}`)
    }

    if (command === 'portofolio') {
        const rows = Object.entries(port).filter(([, p]) => p.qty > 0)
        if (!rows.length) return reply(`Portofolio kosong. Lihat pasar: ${prefix}saham`)
        let val = 0, cost = 0
        const lines = rows.map(([k, p]) => {
            const v = p.qty * s.prices[k]; val += v; cost += p.cost
            const pl = v - p.cost
            return `*${k}* ${p.qty} lembar\n  avg ${rupiah(Math.round(p.cost / p.qty))} → ${rupiah(s.prices[k])}  ${pl >= 0 ? '🟢' : '🔴'} ${pl >= 0 ? '+' : ''}${rupiah(pl)} (${fmtPct(pct(v, p.cost))})`
        })
        const tot = val - cost
        return reply(`💼 *PORTOFOLIO ${user.name}*\n\n${lines.join('\n')}\n\n📊 Nilai: ${rupiah(val)}\n${tot >= 0 ? '🟢' : '🔴'} Total P/L: ${tot >= 0 ? '+' : ''}${rupiah(tot)} (${fmtPct(pct(val, cost))})\n💰 Uang tunai: ${rupiah(user.money)}`)
    }

    if (command === 'saham') {
        const code = String(text).trim().toUpperCase()
        if (code) {
            if (!STOCKS[code]) return reply(`Kode tidak ada. Pilih: ${Object.keys(STOCKS).join(', ')}`)
            const h = s.hist[code], p = pct(s.prices[code], s.open[code])
            const lo = Math.min(...h), hi = Math.max(...h)
            return reply(`📊 *${code}* — ${STOCKS[code].n}\n\nHarga: *${rupiah(s.prices[code])}* ${arrow(p)} ${fmtPct(p)} hari ini\nRentang ${h.length} tick: ${rupiah(lo)} – ${rupiah(hi)}\nHarga wajar: ${rupiah(STOCKS[code].base)}\n\n${spark(h)}\n\nBeli: ${prefix}belisaham ${code} <jumlah>${port[code]?.qty ? `\n📦 Kamu punya ${port[code].qty} lembar` : ''}`)
        }
        const rows = Object.keys(STOCKS).map(k => {
            const p = pct(s.prices[k], s.open[k])
            return `${arrow(p)} *${k}* ${rupiah(s.prices[k])} (${fmtPct(p)}) ${spark(s.hist[k].slice(-12))}`
        })
        const next = Math.ceil((s.t + TICK - Date.now()) / 60000)
        return reply(`📈 *BURSA KAGUYA*\n🏦 Bunga Bank Sentral: ${s.rate}%\n\n${rows.join('\n')}\n\n_Update harga ${next} menit lagi • ${prefix}saham <KODE> untuk detail_`)
    }

    // beli / jual
    const [codeRaw, qtyRaw] = String(text).trim().split(/\s+/)
    const code = String(codeRaw || '').toUpperCase()
    if (!STOCKS[code]) return reply(`Format: ${prefix}${command} <KODE> <jumlah|all>\nKode: ${Object.keys(STOCKS).join(', ')}`)
    const price = s.prices[code]
    const held = port[code] ||= { qty: 0, cost: 0 }

    if (command === 'belisaham') {
        const money = Number(user.money) || 0
        const qty = qtyRaw === 'all' ? Math.floor(money / (price * (1 + FEE))) : parseInt(qtyRaw)
        if (!qty || qty < 1) return reply('Jumlah tidak valid atau uang tidak cukup.')
        const total = Math.ceil(price * qty * (1 + FEE))
        if (money < total) return reply(`💸 Butuh ${rupiah(total)} (termasuk biaya 1%), uangmu ${rupiah(money)}.`)
        user.money = money - total; held.qty += qty; held.cost += total
        persist(); save()
        return reply(`✅ Beli *${qty} ${code}* @${rupiah(price)}\n💰 -${rupiah(total)} (biaya ${rupiah(total - price * qty)})`)
    }

    // jualsaham
    if (held.qty < 1) return reply(`Kamu tidak punya ${code}.`)
    const qty = qtyRaw === 'all' ? held.qty : parseInt(qtyRaw)
    if (!qty || qty < 1 || qty > held.qty) return reply(`Kamu punya ${held.qty} lembar ${code}.`)
    const gross = price * qty, total = Math.floor(gross * (1 - FEE))
    const costPart = Math.round(held.cost * qty / held.qty)
    user.money = (Number(user.money) || 0) + total
    held.qty -= qty; held.cost -= costPart
    if (held.qty === 0) delete port[code]
    persist(); save()
    const pl = total - costPart
    return reply(`✅ Jual *${qty} ${code}* @${rupiah(price)}\n💰 +${rupiah(total)}\n${pl >= 0 ? '🟢 Untung' : '🔴 Rugi'}: ${pl >= 0 ? '+' : ''}${rupiah(pl)}`)
}

handler.command = ['saham', 'belisaham', 'beritasaham', 'jualsaham', 'portofolio']
handler.help = ['saham', 'saham belisaham', 'saham jualsaham', 'saham portofolio', 'saham beritasaham']
handler.tags = ['rpg']
handler.group = true

export default handler
