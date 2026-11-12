// plugins/tools/cekresispx.js
// Lacak paket SPX Express (Shopee Xpress Indonesia): .cekresispx SPXID0xxxxxxxxxx
// Tambahkan kata "full" di akhir untuk menampilkan seluruh timeline.

import crypto from 'crypto'

const BASE_URL = 'https://spx.co.id'
const SALT = 'MGViZmZmZTYzZDJhNDgxY2Y1N2ZlN2Q1ZWJkYzlmZDY='
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'

// jumlah checkpoint yang ditampilkan kalau tidak pakai "full"
const TIMELINE_PREVIEW = 8

const clean = (s) => (s ? String(s).replace(/\s+/g, ' ').trim() : '')

// token tanda tangan untuk endpoint fleet tracking
function makeToken(tn) {
    const ts = Math.floor(Date.now() / 1000)
    const hash = crypto.createHash('sha256').update(tn + ts + SALT).digest('hex')
    return `${tn}|${ts}${hash}`
}

// unix detik -> "07 Nov 2026 10.30.00 WIB"
function fmtTime(sec) {
    if (!sec) return '-'
    return new Date(sec * 1000).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }) + ' WIB'
}

const headers = () => ({
    'User-Agent': USER_AGENT,
    Referer: `${BASE_URL}/id`,
    Origin: BASE_URL,
    'x-language': 'id',
    Accept: 'application/json, text/plain, */*'
})

// info order: hub, GPS, resi SLS, order ID Shopee
async function fetchOrderInfo(tn, timeoutMs) {
    try {
        const res = await fetch(
            `${BASE_URL}/shipment/order/open/order/get_order_info?spx_tn=${encodeURIComponent(tn)}`,
            { headers: headers(), signal: AbortSignal.timeout(timeoutMs) }
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.retcode === 0 ? json.data : null
    } catch {
        return null
    }
}

// fleet tracking: milestone, status, tipe kirim
async function fetchFleet(tn, timeoutMs) {
    try {
        const res = await fetch(
            `${BASE_URL}/api/v2/fleet_order/tracking/search?sls_tracking_number=${encodeURIComponent(makeToken(tn))}`,
            { headers: headers(), signal: AbortSignal.timeout(timeoutMs) }
        )
        if (!res.ok) return null
        const json = await res.json()
        return json.retcode === 0 && json.data && Object.keys(json.data).length ? json.data : null
    } catch {
        return null
    }
}

const toHub = (loc) =>
    loc?.location_name
        ? { name: loc.location_name, address: clean(loc.full_address), lat: loc.lat || null, lng: loc.lng || null }
        : null

async function trackSPX(rawTn, timeoutMs = 20000) {
    const tn = String(rawTn).trim().toUpperCase()

    const [fleet, order] = await Promise.all([fetchFleet(tn, timeoutMs), fetchOrderInfo(tn, timeoutMs)])
    if (!fleet && !order) throw new Error(`Resi ${tn} tidak ditemukan di SPX Express.`)

    const sls = order?.sls_tracking_info || {}
    const records = sls.records || []

    let origin = null
    let destination = null
    const transit = new Map()
    const trips = new Set()
    const tags = new Set()

    const scan = (text) => {
        const t = text || ''
        const trip = t.match(/Linehaul Trip \[([A-Z0-9]+)\]/i)
        if (trip) trips.add(trip[1])
        for (const x of t.matchAll(/\[(TO[0-9A-Z]+)\]/gi)) tags.add(x[1])
    }

    for (const f of fleet?.tracking_list || []) scan(f.message)

    for (const r of records) {
        scan(r.description)

        const next = r.next_location
        if (!destination && next?.location_name?.includes('DC')) destination = toHub(next)

        const cur = r.current_location
        if (cur?.location_name) {
            if (cur.location_name.includes('First Mile') && !origin) origin = toHub(cur)
            else if (!transit.has(cur.location_name)) transit.set(cur.location_name, toHub(cur))
        }
    }

    // cadangan asal paket: cari dari lokasi tujuan record paling lama
    if (!origin) {
        for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].next_location?.location_name?.includes('First Mile')) {
                origin = toHub(records[i].next_location)
                break
            }
        }
    }

    // First Mile Hub bukan hub transit
    if (origin) transit.delete(origin.name)

    const timeline = records.map((r, i) => ({
        step: i + 1,
        time: fmtTime(r.actual_time),
        milestone: r.milestone_name || r.tracking_name || '',
        description: clean(r.buyer_description || r.description),
        hub: r.current_location?.location_name || r.next_location?.location_name || null
    }))

    const fleetLast = fleet?.tracking_list?.[0]
    const latest = timeline[0]
        ? { time: timeline[0].time, description: timeline[0].description }
        : fleetLast
            ? { time: fmtTime(fleetLast.timestamp), description: clean(fleetLast.message) }
            : { time: '-', description: '-' }

    return {
        tn,
        slsTn: sls.sls_tn || null,
        shopeeOrderId: sls.client_order_id || null,
        deliveryType: fleet?.delivery_type || (order?.fulfillment_info?.deliver_type === 1 ? 'COD / Reguler' : 'Standard'),
        status: fleet?.current_status || timeline[0]?.milestone || 'Dalam perjalanan',
        latest,
        origin,
        transit: [...transit.values()],
        destination,
        trips: [...trips],
        tags: [...tags],
        timeline
    }
}

// satu blok hub -> teks
function hubText(label, hub) {
    if (!hub) return `*${label}:* -`
    let out = `*${label}:* ${hub.name}`
    if (hub.address) out += `\n   ${hub.address}`
    if (hub.lat && hub.lng) out += `\n   https://maps.google.com/?q=${hub.lat},${hub.lng}`
    return out
}

let handler = async (m, { text, reply, example, command, usedPrefix, prefix }) => {
    const p = usedPrefix ?? prefix ?? '.'
    const args = String(text || '').trim().split(/\s+/).filter(Boolean)
    const full = args.some((a) => /^full$/i.test(a))
    const tn = args.find((a) => !/^full$/i.test(a))

    if (!tn) return example(`SPXID0xxxxxxxxxx  (tambah "full" untuk timeline lengkap)`)
    if (!/^[A-Za-z0-9]{8,30}$/.test(tn)) return reply('Format nomor resi tidak valid. Contoh: *SPXID0xxxxxxxxxx*')

    await reply('Melacak paket SPX, tunggu sebentar...')

    let r
    try {
        r = await trackSPX(tn)
    } catch (e) {
        return reply(`❌ ${e.message}`)
    }

    const shown = full ? r.timeline : r.timeline.slice(0, TIMELINE_PREVIEW)
    const lines = shown.map((t, i) => {
        const icon = i === 0 ? '🟢' : '⚪'
        return `${icon} *${t.time}*\n${t.description}${t.hub ? `\n🏢 ${t.hub}` : ''}`
    })

    const parts = [
        `*[ SPX EXPRESS ]*`,
        ``,
        `*Resi SPX:* ${r.tn}`,
        r.slsTn ? `*Resi SLS:* ${r.slsTn}` : null,
        r.shopeeOrderId ? `*Order ID Shopee:* ${r.shopeeOrderId}` : null,
        `*Layanan:* ${r.deliveryType}`,
        `*Status:* ${r.status}`,
        `*Update terakhir:* ${r.latest.time}`,
        ``,
        hubText('Asal (First Mile Hub)', r.origin),
        r.transit.length ? `\n*Hub transit:* ${r.transit.map((h) => h.name).join(' → ')}` : null,
        `\n${hubText('Tujuan (DC)', r.destination)}`,
        r.trips.length ? `\n*Trip linehaul:* ${r.trips.join(', ')}` : null,
        r.tags.length ? `*Tag karung/TO:* ${r.tags.join(', ')}` : null,
        ``,
        `*Timeline (${shown.length}${shown.length < r.timeline.length ? ` dari ${r.timeline.length}` : ''}):*`,
        lines.join('\n\n') || '-',
        !full && r.timeline.length > shown.length ? `\n_Timeline lengkap: ${p}${command || 'cekresispx'} ${r.tn} full_` : null
    ]

    return reply(parts.filter((v) => v !== null).join('\n'))
}

handler.command = ['cekresispx']
handler.help = ['cekresispx']
handler.tags = ['tools']
handler.limit = true

export default handler
