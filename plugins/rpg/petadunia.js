// PETA DUNIA MINI: 5 kota, tiap kota punya harga barang & monster berbeda.
// .peta                      lihat peta, lokasi, dan kota tujuan
// .pergi <kota|arah>         bepergian (butuh waktu & ongkos). Contoh: .pergi utara / .pergi aurora
// .pasarkota                 harga barang di kota tempatmu (berubah tiap 3 jam)
// .belikota <barang> <jml>   beli di pasar kota ini
// .jualkota <barang> <jml>   jual di pasar kota ini (harga jual 90% dari harga pasar)
// .jelajah                   lawan monster khas kota ini (jeda 60 dtk, HP >= 25)
// Strategi: beli di kota yang murah, jual di kota yang mahal. Di jalan ada risiko bandit!
import { gameStore, save, rupiah, rpgUser, combatStats, simulateFight, persist, rememberSock, num, formatDuration, pick } from '../../lib/group/sosial.js'

const CITIES = {
    aurora: { name: 'Aurora', icon: '❄️', pos: [0, -1], danger: 4, desc: 'Kota salju di utara', mobs: ['Serigala Salju', 'Yeti', 'Golem Es', 'Ratu Salju'], loot: 'ikan' },
    barat: { name: 'Lembah Barat', icon: '🌲', pos: [-1, 0], danger: 2, desc: 'Hutan lebat dan petani', mobs: ['Goblin Hutan', 'Beruang', 'Ent Muda', 'Dryad Marah'], loot: 'apel' },
    tengah: { name: 'Desa Tengah', icon: '🏘️', pos: [0, 0], danger: 1, desc: 'Pusat perjalanan, aman', mobs: ['Slime', 'Tikus Raksasa', 'Anjing Liar', 'Bandit Kecil'], loot: 'ayam' },
    timur: { name: 'Kota Timur', icon: '🏙️', pos: [1, 0], danger: 3, desc: 'Kota dagang yang ramai', mobs: ['Preman Gang', 'Robot Penjaga', 'Pencopet', 'Ninja Bayaran'], loot: 'potion' },
    selatan: { name: 'Bandar Selatan', icon: '🌊', pos: [0, 1], danger: 5, desc: 'Pelabuhan penuh bajak laut', mobs: ['Kepiting Raksasa', 'Bajak Laut', 'Hiu', 'Kraken'], loot: 'udang' }
}
const EDGES = [['aurora', 'tengah'], ['barat', 'tengah'], ['tengah', 'timur'], ['tengah', 'selatan'], ['timur', 'selatan'], ['barat', 'selatan']]
const neighbors = (c) => EDGES.filter(e => e.includes(c)).map(e => e.find(x => x !== c))
const dist = (a, b) => Math.hypot(CITIES[a].pos[0] - CITIES[b].pos[0], CITIES[a].pos[1] - CITIES[b].pos[1])

// barang: harga dasar & pengali per kota (<1 murah / penghasil, >1 mahal / langka)
const ITEMS = {
    apel: { n: '🍎 Apel', base: 400, m: { aurora: 1.4, barat: 0.7, tengah: 1, timur: 1.15, selatan: 1.3 } },
    jeruk: { n: '🍊 Jeruk', base: 450, m: { aurora: 1.35, barat: 0.75, tengah: 1, timur: 1.1, selatan: 1.2 } },
    mangga: { n: '🥭 Mangga', base: 600, m: { aurora: 1.5, barat: 0.8, tengah: 1, timur: 1.1, selatan: 0.9 } },
    pisang: { n: '🍌 Pisang', base: 350, m: { aurora: 1.4, barat: 0.85, tengah: 1, timur: 1.2, selatan: 0.75 } },
    ikan: { n: '🐟 Ikan', base: 700, m: { aurora: 0.7, barat: 1.2, tengah: 1, timur: 1.3, selatan: 0.8 } },
    udang: { n: '🦐 Udang', base: 900, m: { aurora: 1.3, barat: 1.35, tengah: 1.1, timur: 1.25, selatan: 0.65 } },
    ayam: { n: '🐔 Ayam', base: 800, m: { aurora: 1.3, barat: 0.9, tengah: 0.75, timur: 1.2, selatan: 1.15 } },
    kambing: { n: '🐐 Kambing', base: 2500, m: { aurora: 1.2, barat: 0.8, tengah: 1, timur: 1.35, selatan: 1.25 } },
    potion: { n: '🧪 Potion', base: 1500, m: { aurora: 1.3, barat: 1.2, tengah: 1, timur: 0.75, selatan: 1.15 } },
    diamond: { n: '💎 Diamond', base: 25000, m: { aurora: 0.8, barat: 1.3, tengah: 1.15, timur: 1.35, selatan: 1.05 } }
}
const SELL_RATE = 0.9
const MAX_QTY = 500

// noise deterministik per (kota, barang, blok 3 jam) -> semua pemain melihat harga yang sama
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967295 }
function price(city, item, t = Date.now()) {
    const block = Math.floor(t / (3 * 36e5))
    const noise = 0.88 + hash(`${city}|${item}|${block}`) * 0.24
    return Math.max(10, Math.round(ITEMS[item].base * ITEMS[item].m[city] * noise))
}

const findCity = (q, from) => {
    q = String(q || '').toLowerCase().trim()
    if (!q) return null
    const dir = { utara: [0, -1], selatan: [0, 1], barat: [-1, 0], timur: [1, 0] }[q]
    if (dir) {
        // arah relatif dari posisi sekarang -> tetangga yang paling searah
        let best = null, bs = 0.5
        for (const n of neighbors(from)) {
            const dx = CITIES[n].pos[0] - CITIES[from].pos[0], dy = CITIES[n].pos[1] - CITIES[from].pos[1]
            const s = (dx * dir[0] + dy * dir[1]) / Math.hypot(dx, dy)
            if (s > bs) { bs = s; best = n }
        }
        return best || 'none'
    }
    return Object.keys(CITIES).find(k => k === q || CITIES[k].name.toLowerCase().includes(q)) || null
}

const MAP = (cur) => {
    const t = (k) => `${k === cur ? '📍' : ''}${CITIES[k].icon}${CITIES[k].name}`
    return `            ${t('aurora')}\n                 │\n${t('barat')} ── ${t('tengah')} ── ${t('timur')}\n                 │            │\n            ${t('selatan')} ──┘`
}

// selesaikan perjalanan yang sudah lewat waktu; kembalikan teks kejadian di jalan (atau '')
function arrive(st, user) {
    if (!st.trip || Date.now() < st.trip.at) return ''
    const { to } = st.trip
    st.city = to; st.trip = null
    const r = Math.random()
    const money = Number(user.money) || 0
    let ev = `\n\n🏁 Kamu tiba di *${CITIES[to].icon} ${CITIES[to].name}*!`
    if (r < 0.2 && money > 500) {
        const lost = Math.min(5000, Math.floor(money * (0.03 + Math.random() * 0.05)))
        user.money -= lost
        ev += `\n🥷 Di jalan kamu dirampok bandit! -${rupiah(lost)}`
    } else if (r < 0.35) {
        const gain = 300 + Math.floor(Math.random() * 1200)
        user.money = money + gain
        ev += `\n🎒 Menemukan kantong koin di jalan! +${rupiah(gain)}`
    }
    persist(); save()
    return ev
}

const cd = new Map()
let handler = async (m, { sock, text, command, prefix, reply }) => {
    rememberSock(sock)
    const { pn, user } = await rpgUser(sock, m)
    const id = num(pn)
    const maps = gameStore().map
    const st = (maps[id] ||= { city: 'tengah', trip: null })
    const arrival = arrive(st, user)
    const traveling = !!st.trip
    const here = CITIES[st.city]
    const lockMsg = () => `🧭 Kamu sedang dalam perjalanan ke *${CITIES[st.trip.to].name}* (${formatDuration(st.trip.at - Date.now())} lagi).`

    if (command === 'peta') {
        const loc = traveling ? `🚶 Menuju ${CITIES[st.trip.to].name} (${formatDuration(st.trip.at - Date.now())})` : `📍 ${here.icon} ${here.name} — ${here.desc}`
        const dests = traveling ? '' : '\n\n*Tujuan dari sini:*\n' + neighbors(st.city).map(n => `• ${CITIES[n].icon} ${CITIES[n].name} — ${Math.ceil(dist(st.city, n) * 60)} dtk, ${rupiah(Math.round(dist(st.city, n) * 800))}`).join('\n') + `\n\n${prefix}pergi <kota/arah>`
        return reply(`🗺️ *PETA DUNIA*\n\n${MAP(traveling ? '' : st.city)}\n\n${loc}${dests}${arrival}`)
    }

    if (command === 'pergi') {
        if (traveling) return reply(lockMsg())
        const to = findCity(text, st.city)
        if (!text) return reply(`Mau ke mana? Contoh: ${prefix}pergi utara  /  ${prefix}pergi aurora\nLihat tujuan: ${prefix}peta${arrival}`)
        if (to === 'none' || !to) return reply(`Tidak ada kota/arah itu dari ${here.name}.${arrival}`)
        if (to === st.city) return reply('Kamu sudah di kota itu.')
        if (!neighbors(st.city).includes(to)) return reply(`${CITIES[to].name} tidak terhubung langsung dari ${here.name}. Lewati kota perantara dulu (cek ${prefix}peta).`)
        const cost = Math.round(dist(st.city, to) * 800), secs = Math.ceil(dist(st.city, to) * 60)
        if ((Number(user.money) || 0) < cost) return reply(`💸 Ongkos ke ${CITIES[to].name} ${rupiah(cost)}, uangmu ${rupiah(user.money)}.`)
        user.money -= cost
        st.trip = { to, at: Date.now() + secs * 1000 }
        persist(); save()
        return reply(`🚶 Berangkat ke *${CITIES[to].icon} ${CITIES[to].name}*\n⏱️ ${secs} detik • 💰 -${rupiah(cost)}\n\n_Kamu bisa ketik ${prefix}peta untuk cek, tiba otomatis saat waktunya._`)
    }

    // semua perintah di bawah butuh berada di kota
    if (traveling) return reply(lockMsg())

    if (command === 'pasarkota') {
        const rows = Object.keys(ITEMS).map(k => {
            const p = price(st.city, k), avg = ITEMS[k].base
            const tag = p < avg * 0.85 ? '🟢 murah' : p > avg * 1.15 ? '🔴 mahal' : '⚪'
            return `${ITEMS[k].n}: ${rupiah(p)} ${tag} _(punya ${Number(user[k]) || 0})_`
        })
        return reply(`🛒 *PASAR ${here.icon} ${here.name.toUpperCase()}*\n_(harga jual ke pasar = ${SELL_RATE * 100}%, harga berubah tiap 3 jam)_\n\n${rows.join('\n')}\n\n${prefix}belikota <barang> <jumlah>\n${prefix}jualkota <barang> <jumlah|all>${arrival}`)
    }

    if (command === 'belikota' || command === 'jualkota') {
        const [item, qtyRaw] = String(text).toLowerCase().split(/\s+/)
        if (!ITEMS[item]) return reply(`Barang: ${Object.keys(ITEMS).join(', ')}\nContoh: ${prefix}${command} apel 10`)
        const p = price(st.city, item)
        const have = Number(user[item]) || 0
        let qty = qtyRaw === 'all' ? (command === 'jualkota' ? have : Math.floor((Number(user.money) || 0) / p)) : parseInt(qtyRaw)
        if (!qty || qty < 1) return reply('Jumlah tidak valid.')
        qty = Math.min(qty, MAX_QTY)
        if (command === 'belikota') {
            const total = p * qty
            if ((Number(user.money) || 0) < total) return reply(`💸 Butuh ${rupiah(total)}, uangmu ${rupiah(user.money)}.`)
            user.money -= total; user[item] = have + qty
            persist()
            return reply(`✅ Beli ${qty} ${ITEMS[item].n} @${rupiah(p)}\n💰 -${rupiah(total)}${arrival}`)
        }
        if (have < qty) return reply(`Kamu hanya punya ${have} ${ITEMS[item].n}.`)
        const total = Math.floor(p * SELL_RATE) * qty
        user[item] = have - qty; user.money = (Number(user.money) || 0) + total
        persist()
        return reply(`✅ Jual ${qty} ${ITEMS[item].n} @${rupiah(Math.floor(p * SELL_RATE))}\n💰 +${rupiah(total)}${arrival}`)
    }

    // jelajah
    if (user.health < 25) return reply(`❤️ HP ${user.health}, minimal 25. Pulihkan dengan ${prefix}heal`)
    const wait = 60_000 - (Date.now() - (cd.get(id) || 0))
    if (wait > 0) return reply(`⏳ Tunggu ${Math.ceil(wait / 1000)} detik.`)
    cd.set(id, Date.now())
    const lvl = Math.max(1, Number(user.level) || 1)
    const dng = here.danger
    const mon = {
        name: pick(here.mobs),
        hp: Math.round(30 + lvl * 7 + dng * 25 + Math.random() * 20),
        atk: Math.round(6 + lvl * 1.2 + dng * 4),
        def: Math.round(dng * 1.5)
    }
    const r = simulateFight(user.health, combatStats(user), mon)
    if (!r.win) {
        user.health = 10; persist()
        return reply(`💀 Kamu dikalahkan *${mon.name}* di ${here.name}! HP tersisa 10.${dng >= 4 ? '\n_Daerah ini berbahaya, naikkan level dulu._' : ''}`)
    }
    user.health = Math.max(1, r.hpLeft)
    const money = Math.round((150 + lvl * 20) * dng * (0.8 + Math.random() * 0.5))
    const exp = Math.round(40 * dng + lvl * 3)
    const lootQty = 1 + Math.floor(Math.random() * 2)
    user.money = (Number(user.money) || 0) + money
    user.exp = (Number(user.exp) || 0) + exp
    user[here.loot] = (Number(user[here.loot]) || 0) + lootQty
    persist()
    return reply(`⚔️ *${mon.name}* di ${here.icon} ${here.name} kalah!\n❤️ HP sisa ${user.health}\n\n💰 +${rupiah(money)}\n✨ EXP +${exp}\n🎁 ${ITEMS[here.loot].n} +${lootQty}${arrival}`)
}

handler.command = ['petadunia', 'peta', 'belikota', 'jelajah', 'jualkota', 'pasarkota', 'pergi']
handler.as = 'peta'
handler.help = ['petadunia peta', 'petadunia pergi', 'petadunia pasarkota', 'petadunia belikota', 'petadunia jualkota', 'petadunia jelajah']
handler.tags = ['rpg']
handler.group = true

export default handler
