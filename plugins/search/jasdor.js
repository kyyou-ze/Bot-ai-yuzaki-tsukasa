// Jasdor Moulii — info toko, outlet, menu & diskon kopi (mouliishop.my.id)
//   .jasdor                         info toko & brand
//   .jasdor bundle                  paket hemat
//   .jasdor outlet <brand> <kota>   cari cabang
//   .jasdor menu <brand> <kodeOutlet>
//   .jasdor opsi <brand> <kodeOutlet> <idProduk>
//   .jasdor cari <kata> [brand]
const BASE = 'https://mouliishop.my.id'
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', Accept: 'application/json, text/plain, */*', Referer: `${BASE}/` }
const BRANDS = ['kopken', 'tomoro', 'fore', 'starbucks', 'janjijiwa']
const rp = (n) => (n || n === 0 ? 'Rp ' + Number(n).toLocaleString('id-ID') : '-')

async function initialData() {
    const res = await fetch(BASE, { headers: { ...HEADERS, Accept: 'text/html' }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`Jasdor Moulii tidak bisa diakses (HTTP ${res.status})`)
    const html = await res.text()
    const raw = html.match(/window\.__JASDOR_DATA__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)?.[1]
    if (!raw) throw new Error('Data awal halaman tidak ditemukan.')
    // hanya JSON murni; isi halaman dari luar tidak dijalankan sebagai kode
    try { return JSON.parse(raw) } catch { throw new Error('Format data halaman berubah (bukan JSON), perlu penyesuaian.') }
}

async function getJson(path) {
    const res = await fetch(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
    if (!res.ok) throw new Error(`Permintaan gagal (HTTP ${res.status})`)
    return res.json()
}

const brandOf = (b) => String(b || 'kopken').toLowerCase().replace(/\s+/g, '')
const arr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.outlets) ? x.outlets : Array.isArray(x?.menu) ? x.menu : Array.isArray(x?.products) ? x.products : [])

let handler = async (m, { text, reply, prefix, command }) => {
    const [act = '', ...rest] = String(text || '').trim().split(/\s+/).filter(Boolean)
    const a = act.toLowerCase()
    const p = prefix + command
    try {
        if (!a || ['info', 'toko', 'store'].includes(a)) {
            const d = await initialData()
            const brands = (d.brands || []).map(b => `• ${b.name || b.id || b}${b.id ? ` (${b.id})` : ''}`).join('\n') || BRANDS.map(b => `• ${b}`).join('\n')
            const banners = (d.banners || []).slice(0, 5).map(b => `• ${b.title || b.name || b.text || ''}`).filter(x => x.length > 2).join('\n')
            return reply(`☕ *JASDOR MOULII*\n_Jasa order kopi kekinian_\n\n*Brand*\n${brands}\n${banners ? `\n*Promo*\n${banners}\n` : ''}\n*Perintah*\n${p} outlet <brand> <kota>\n${p} menu <brand> <kodeOutlet>\n${p} opsi <brand> <kodeOutlet> <idProduk>\n${p} cari <kata>\n${p} bundle`)
        }
        if (['bundle', 'bundles', 'paket'].includes(a)) {
            const list = (await initialData()).bundlePackages || []
            if (!list.length) return reply('Belum ada paket bundling.')
            return reply(`🎁 *PAKET BUNDLING* (${list.length})\n\n` + list.slice(0, 15).map(b => `• *${b.name || b.title}*${b.price ? ` — ${rp(b.price)}` : ''}${b.description ? `\n  ${String(b.description).slice(0, 100)}` : ''}`).join('\n'))
        }
        if (['outlet', 'cabang'].includes(a)) {
            const brand = brandOf(rest[0]); const q = rest.slice(1).join(' ')
            const list = arr(await getJson(`/api/brand/${encodeURIComponent(brand)}/outlets?search=${encodeURIComponent(q)}&lat=&lng=`))
            if (!list.length) return reply(`Outlet ${brand}${q ? ` di "${q}"` : ''} tidak ditemukan.`)
            return reply(`📍 *OUTLET ${brand.toUpperCase()}* (${list.length})\n\n` + list.slice(0, 20).map(o => `• *${o.store_code || o.code || o.id}* — ${o.name || o.store_name}${o.address ? `\n  ${String(o.address).slice(0, 90)}` : ''}`).join('\n') + `\n\nMenu: ${p} menu ${brand} <kode>`)
        }
        if (a === 'menu') {
            const brand = brandOf(rest[0]); const code = rest[1]
            if (!code) return reply(`Format: ${p} menu <brand> <kodeOutlet>\nCari kode lewat: ${p} outlet <brand> <kota>`)
            const list = arr(await getJson(`/api/brand/${encodeURIComponent(brand)}/menu?store_code=${encodeURIComponent(code)}`))
            if (!list.length) return reply('Menu kosong atau outlet tidak ditemukan.')
            return reply(`☕ *MENU ${brand.toUpperCase()} — ${code}* (${list.length})\n\n` + list.slice(0, 30).map(x => {
                const price = x.price ?? x.promo_price, orig = x.original_price ?? x.normal_price
                return `• ${x.name}${x.sold_out || x.is_sold_out ? ' _(habis)_' : ''}\n  ${rp(price)}${orig && orig !== price ? ` ~${rp(orig)}~` : ''} • id ${x.id ?? x.product_id ?? '-'}`
            }).join('\n') + (list.length > 30 ? `\n… dan ${list.length - 30} lainnya` : ''))
        }
        if (['opsi', 'option', 'options'].includes(a)) {
            const [b, code, id] = rest
            if (!code || !id) return reply(`Format: ${p} opsi <brand> <kodeOutlet> <idProduk>`)
            const j = await getJson(`/api/brand/${encodeURIComponent(brandOf(b))}/options?store_code=${encodeURIComponent(code)}&product_id=${encodeURIComponent(id)}`)
            const groups = arr(j?.options ? j.options : j)
            if (!groups.length) return reply('```' + JSON.stringify(j, null, 1).slice(0, 1500) + '```')
            return reply(`⚙️ *OPSI PRODUK ${id}*\n\n` + groups.map(g => `*${g.name || g.title}*\n` + arr(g.options || g.items || g.values).map(o => `  • ${o.name || o.label}${o.price ? ` (+${rp(o.price)})` : ''}`).join('\n')).join('\n\n'))
        }
        if (['cari', 'search'].includes(a)) {
            const q = rest[0] ? rest.join(' ').toLowerCase() : ''
            if (!q) return reply(`Format: ${p} cari <kata>`)
            let list = (await initialData()).products || []
            list = list.filter(x => [x.name, x.category, x.description].some(v => String(v || '').toLowerCase().includes(q)))
            if (!list.length) return reply(`Tidak ada produk "${q}".`)
            return reply(`🔎 *HASIL "${q}"* (${list.length})\n\n` + list.slice(0, 20).map(x => `• ${x.name}${x.brand_id ? ` [${x.brand_id}]` : ''}${x.price ? ` — ${rp(x.price)}` : ''}`).join('\n'))
        }
        return reply(`Perintah tidak dikenal. Ketik *${p}* untuk bantuan.`)
    } catch (e) {
        return reply(`❌ ${e.message || 'Gagal mengambil data'}`)
    }
}

handler.command = ['jasdor']
handler.help = ['jasdor', 'jasdor outlet <brand> <kota>']
handler.tags = ['search']
handler.limit = true

export default handler
