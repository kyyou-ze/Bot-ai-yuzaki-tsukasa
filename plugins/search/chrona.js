import { dioRegister, dioRun, dioSave, dioStore } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "daily": (module, exports, require) => {
        // MESIN KEHIDUPAN SEHARI-HARI: tanggal, Hijriah, weton, zodiak, shio, libur nasional, salat, kiblat
        const tzOf = () => global.settingsDefault?.timezone || 'Asia/Jakarta'
        const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
        const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
        const HMONTHS = ['Muharam', 'Safar', 'Rabiulawal', 'Rabiulakhir', 'Jumadilawal', 'Jumadilakhir', 'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah']
        const pad = (n) => String(n).padStart(2, '0')

        // ── waktu sekarang di zona waktu tertentu ──
        function parts(date, tz) {
          const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz || tzOf(), hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }).formatToParts(date).forEach(x => { p[x.type] = x.value })
          return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }
        }
        const now = (tz) => parts(new Date(), tz)
        // selisih UTC (ms) zona waktu pada saat tertentu
        const offsetMs = (tz, date) => { const p = parts(date, tz); return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - Math.floor(date.getTime() / 1000) * 1000 }
        // jam dinding (y,m,d,hh,mm) di zona tz -> epoch ms
        function zonedToUtc(y, m, d, hh, mm, tz) { let t = Date.UTC(y, m - 1, d, hh, mm) - offsetMs(tz || tzOf(), new Date(Date.UTC(y, m - 1, d, hh, mm))); t = Date.UTC(y, m - 1, d, hh, mm) - offsetMs(tz || tzOf(), new Date(t)); return t }

        const dayNum = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5)           // nomor hari (tanpa jam)
        const diffDays = (a, b) => dayNum(b.y, b.m, b.d) - dayNum(a.y, a.m, a.d)
        const addDays = (o, n) => { const t = new Date(Date.UTC(o.y, o.m - 1, o.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() } }
        const dowOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay()
        const fmtDate = (o, withDow = true) => `${withDow ? DAYS[o.dow ?? dowOf(o.y, o.m, o.d)] + ', ' : ''}${o.d} ${MONTHS[o.m - 1]} ${o.y}`
        const iso = (o) => `${o.y}-${pad(o.m)}-${pad(o.d)}`
        const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
        const dayOfYear = (o) => diffDays({ y: o.y, m: 1, d: 1 }, o) + 1
        function isoWeek(o) { const t = new Date(Date.UTC(o.y, o.m - 1, o.d)), dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7) }

        // ── parser tanggal: 17-08-2027, 17/8/27, 2027-08-17, "17 agustus 2027", "17 agu" ──
        const MON_ALIAS = { jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12 }
        function parseDate(str, ref) {
          const s = String(str || '').toLowerCase().trim().replace(/,/g, ' '); if (!s) return null
          const cur = ref || now(); let m
          const ok = (y, mo, d) => { if (y < 1000) y += y < 50 ? 2000 : 1900; const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d, dow: t.getUTCDay() } : null }
          if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return ok(+m[1], +m[2], +m[3])
          if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) return ok(+m[3], +m[2], +m[1])
          if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})$/))) return ok(cur.y, +m[2], +m[1])
          if ((m = s.match(/^(\d{1,2})\s+([a-z]+)\s*(\d{2,4})?$/)) && MON_ALIAS[m[2]]) return ok(m[3] ? +m[3] : cur.y, MON_ALIAS[m[2]], +m[1])
          return null
        }
        // ambil tanggal dari awal teks (1-3 kata) -> {date, rest}
        function takeDate(text, ref) {
          const w = String(text || '').trim().split(/\s+/)
          for (const n of [3, 2, 1]) { const d = parseDate(w.slice(0, n).join(' '), ref); if (d) return { date: d, rest: w.slice(n).join(' ') } }
          return { date: null, rest: text }
        }

        // ── Hijriah (kalender sipil; resmi ditetapkan Kemenag, bisa ±1 hari) ──
        function hijri(o) {
          const p = {}; new Intl.DateTimeFormat('en-u-ca-islamic-civil', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(Date.UTC(o.y, o.m - 1, o.d, 12))).forEach(x => { p[x.type] = x.value })
          return { d: +p.day, m: +p.month, y: parseInt(p.year), name: HMONTHS[+p.month - 1], text: `${+p.day} ${HMONTHS[+p.month - 1]} ${parseInt(p.year)} H` }
        }

        // ── Weton Jawa ──
        const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'], NEPTU_HARI = [5, 4, 3, 7, 8, 6, 9], NEPTU_PASARAN = [5, 9, 7, 4, 8]
        const pasaranOf = (o) => PASARAN[(((dayNum(o.y, o.m, o.d) - dayNum(1945, 8, 17)) % 5) + 5) % 5]   // 17-8-1945 = Jumat Legi
        function weton(o) { const dow = dowOf(o.y, o.m, o.d), ps = pasaranOf(o), pi = PASARAN.indexOf(ps); return { hari: DAYS[dow], pasaran: ps, neptu: NEPTU_HARI[dow] + NEPTU_PASARAN[pi], nh: NEPTU_HARI[dow], np: NEPTU_PASARAN[pi] } }
        const PASARAN_SIFAT = { Legi: 'ramah, murah hati, mudah bergaul', Pahing: 'tegas, ambisius, pekerja keras', Pon: 'tenang, bijaksana, penuh pertimbangan', Wage: 'teguh, mandiri, setia pada prinsip', Kliwon: 'intuitif, peka, punya daya tarik tersendiri' }
        const NEPTU_ARTI = (n) => n <= 9 ? 'sederhana dan rendah hati; rezeki mengalir lewat ketekunan' : n <= 12 ? 'seimbang dan tenang; hidup stabil bila sabar' : n <= 15 ? 'penuh semangat dan kepemimpinan; pandai memanfaatkan peluang' : 'berwibawa dan beruntung; hati-hati dengan ego sendiri'

        // ── Zodiak & Shio (hiburan) ──
        const ZODIAK = [['Capricorn', 12, 22, 'ambisius, disiplin, dan bertanggung jawab'], ['Aquarius', 1, 20, 'mandiri, kreatif, dan visioner'], ['Pisces', 2, 19, 'empatik, imajinatif, dan lembut'], ['Aries', 3, 21, 'berani, energik, dan pemimpin alami'], ['Taurus', 4, 20, 'setia, sabar, dan menyukai kenyamanan'], ['Gemini', 5, 21, 'cerdas, luwes, dan banyak ide'], ['Cancer', 6, 21, 'penyayang, protektif, dan intuitif'], ['Leo', 7, 23, 'percaya diri, hangat, dan dermawan'], ['Virgo', 8, 23, 'teliti, analitis, dan membantu'], ['Libra', 9, 23, 'adil, diplomatis, dan menyukai harmoni'], ['Scorpio', 10, 23, 'gigih, misterius, dan penuh tekad'], ['Sagitarius', 11, 22, 'optimis, bebas, dan suka petualangan']]
        function zodiak(o) { let z = ZODIAK[0]; for (const x of ZODIAK) if (o.m > x[1] || (o.m === x[1] && o.d >= x[2])) z = x; if (o.m === 1 && o.d < 20) z = ZODIAK[0]; return { name: z[0], sifat: z[3] } }
        const SHIO = [['Tikus', 'cerdik, adaptif, dan pandai melihat peluang'], ['Kerbau', 'tekun, jujur, dan pekerja keras'], ['Macan', 'berani, kharismatik, dan kompetitif'], ['Kelinci', 'lembut, diplomatis, dan artistik'], ['Naga', 'berwibawa, penuh semangat, dan ambisius'], ['Ular', 'bijak, tenang, dan analitis'], ['Kuda', 'bebas, enerjik, dan supel'], ['Kambing', 'kreatif, penyayang, dan cinta damai'], ['Monyet', 'jenaka, cerdas, dan inovatif'], ['Ayam', 'rajin, teliti, dan percaya diri'], ['Anjing', 'setia, jujur, dan melindungi'], ['Babi', 'dermawan, tulus, dan penuh kasih']]
        function shio(o) { const y = (o.m < 2 || (o.m === 2 && o.d < 5)) ? o.y - 1 : o.y, i = (((y - 2020) % 12) + 12) % 12, s = SHIO[i]; return { name: s[0], sifat: s[1], year: y, edge: o.m === 1 || (o.m === 2 && o.d < 20) } }

        // ── Libur nasional & cuti bersama (SKB 3 Menteri). Update tiap tahun! ──
        const L = (d, n, t = 'libur') => ({ d, n, t })
        const HOLIDAYS = [
          L('2026-01-01', 'Tahun Baru 2026 Masehi'), L('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'), L('2026-02-16', 'Cuti Bersama Tahun Baru Imlek', 'cuti'), L('2026-02-17', 'Tahun Baru Imlek 2577'),
          L('2026-03-18', 'Cuti Bersama Hari Suci Nyepi', 'cuti'), L('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'), L('2026-03-20', 'Cuti Bersama Idulfitri', 'cuti'), L('2026-03-21', 'Hari Raya Idulfitri 1447 H'), L('2026-03-22', 'Hari Raya Idulfitri 1447 H'),
          L('2026-03-23', 'Cuti Bersama Idulfitri', 'cuti'), L('2026-03-24', 'Cuti Bersama Idulfitri', 'cuti'), L('2026-04-03', 'Wafat Yesus Kristus'), L('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
          L('2026-05-01', 'Hari Buruh Internasional'), L('2026-05-14', 'Kenaikan Yesus Kristus'), L('2026-05-15', 'Cuti Bersama Kenaikan Yesus Kristus', 'cuti'), L('2026-05-27', 'Hari Raya Iduladha 1447 H'), L('2026-05-28', 'Cuti Bersama Iduladha', 'cuti'),
          L('2026-05-31', 'Hari Raya Waisak 2570 BE'), L('2026-06-01', 'Hari Lahir Pancasila'), L('2026-06-16', '1 Muharam Tahun Baru Islam 1448 H'), L('2026-08-17', 'Proklamasi Kemerdekaan RI'), L('2026-08-25', 'Maulid Nabi Muhammad SAW'),
          L('2026-12-24', 'Cuti Bersama Natal', 'cuti'), L('2026-12-25', 'Kelahiran Yesus Kristus (Natal)'),
          L('2027-01-01', 'Tahun Baru 2027 Masehi'), L('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW 1448 H'), L('2027-02-05', 'Cuti Bersama Tahun Baru Imlek', 'cuti'), L('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
          L('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)'), L('2027-03-09', 'Cuti Bersama Idulfitri', 'cuti'), L('2027-03-10', 'Hari Raya Idulfitri 1448 H'), L('2027-03-11', 'Hari Raya Idulfitri 1448 H'),
          L('2027-03-12', 'Cuti Bersama Idulfitri', 'cuti'), L('2027-03-15', 'Cuti Bersama Idulfitri', 'cuti'), L('2027-03-25', 'Cuti Bersama Wafat Yesus Kristus', 'cuti'), L('2027-03-26', 'Wafat Yesus Kristus'), L('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
          L('2027-05-01', 'Hari Buruh Internasional'), L('2027-05-06', 'Kenaikan Yesus Kristus'), L('2027-05-17', 'Hari Raya Iduladha 1448 H'), L('2027-05-18', 'Cuti Bersama Iduladha', 'cuti'), L('2027-05-19', 'Cuti Bersama Waisak', 'cuti'),
          L('2027-05-20', 'Hari Raya Waisak 2571 BE'), L('2027-06-01', 'Hari Lahir Pancasila'), L('2027-06-06', '1 Muharam Tahun Baru Islam 1449 H'), L('2027-08-15', 'Maulid Nabi Muhammad SAW'), L('2027-08-17', 'Proklamasi Kemerdekaan RI'),
          L('2027-12-24', 'Cuti Bersama Natal', 'cuti'), L('2027-12-25', 'Kelahiran Yesus Kristus (Natal)'), L('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW 1449 H'),
        ]
        const HOL_MAP = Object.fromEntries(HOLIDAYS.map(h => [h.d, h]))
        const HOL_LAST = HOLIDAYS[HOLIDAYS.length - 1].d.slice(0, 4)
        const holidayOn = (o) => HOL_MAP[iso(o)] || null
        const isWorkday = (o) => { const dw = o.dow ?? dowOf(o.y, o.m, o.d); return dw !== 0 && dw !== 6 && !(holidayOn(o) && holidayOn(o).t === 'libur') && !(holidayOn(o) && holidayOn(o).t === 'cuti') }
        function nextHolidays(from, n = 5, type = 'libur') {
          const f = iso(from); return HOLIDAYS.filter(h => h.d >= f && (type === 'all' || h.t === type)).slice(0, n).map(h => { const [y, m, d] = h.d.split('-').map(Number); return { ...h, date: h.d, y, m, d, dow: dowOf(y, m, d), in: diffDays(from, { y, m, d }) } })
        }

        // ── Kota (lat, lng, UTC offset) ──
        const C = (name, lat, lng, tz) => ({ name, lat, lng, tz })
        const CITIES = { jakarta: C('Jakarta', -6.2088, 106.8456, 7), bandung: C('Bandung', -6.9175, 107.6191, 7), surabaya: C('Surabaya', -7.2575, 112.7521, 7), semarang: C('Semarang', -6.9667, 110.4167, 7), yogyakarta: C('Yogyakarta', -7.7956, 110.3695, 7),
          medan: C('Medan', 3.5952, 98.6722, 7), palembang: C('Palembang', -2.9761, 104.7754, 7), makassar: C('Makassar', -5.1477, 119.4327, 8), denpasar: C('Denpasar', -8.6705, 115.2126, 8), balikpapan: C('Balikpapan', -1.2379, 116.8529, 8),
          pontianak: C('Pontianak', -0.0263, 109.3425, 7), banjarmasin: C('Banjarmasin', -3.3194, 114.5908, 8), manado: C('Manado', 1.4748, 124.8421, 8), padang: C('Padang', -0.9471, 100.4172, 7), pekanbaru: C('Pekanbaru', 0.5071, 101.4478, 7),
          batam: C('Batam', 1.0456, 104.0305, 7), bandarlampung: C('Bandar Lampung', -5.4294, 105.261, 7), malang: C('Malang', -7.9666, 112.6326, 7), bogor: C('Bogor', -6.5971, 106.806, 7), depok: C('Depok', -6.4025, 106.7942, 7),
          tangerang: C('Tangerang', -6.1783, 106.6319, 7), bekasi: C('Bekasi', -6.2383, 106.9756, 7), surakarta: C('Surakarta (Solo)', -7.5755, 110.8243, 7), cirebon: C('Cirebon', -6.732, 108.5523, 7), tasikmalaya: C('Tasikmalaya', -7.3274, 108.2207, 7),
          serang: C('Serang', -6.1201, 106.1503, 7), jambi: C('Jambi', -1.6101, 103.6131, 7), bengkulu: C('Bengkulu', -3.8004, 102.2655, 7), bandaaceh: C('Banda Aceh', 5.5483, 95.3238, 7), mataram: C('Mataram', -8.5833, 116.1167, 8),
          kupang: C('Kupang', -10.1772, 123.607, 8), ambon: C('Ambon', -3.6954, 128.1814, 9), jayapura: C('Jayapura', -2.5337, 140.7181, 9), palu: C('Palu', -0.9003, 119.878, 8), kendari: C('Kendari', -3.9985, 122.513, 8),
          samarinda: C('Samarinda', -0.5022, 117.1536, 8), pangkalpinang: C('Pangkalpinang', -2.1316, 106.1169, 7), tanjungpinang: C('Tanjungpinang', 0.9186, 104.4666, 7), gorontalo: C('Gorontalo', 0.5435, 123.0568, 8), ternate: C('Ternate', 0.7833, 127.3667, 9),
          sorong: C('Sorong', -0.8762, 131.2558, 9), merauke: C('Merauke', -8.4932, 140.4018, 9), palangkaraya: C('Palangkaraya', -2.2161, 113.9135, 7), jember: C('Jember', -8.1845, 113.6681, 7), kediri: C('Kediri', -7.848, 112.0178, 7),
          purwokerto: C('Purwokerto', -7.4242, 109.2393, 7), tegal: C('Tegal', -6.8694, 109.1402, 7), sukabumi: C('Sukabumi', -6.9277, 106.93, 7), cilegon: C('Cilegon', -6.0025, 106.0111, 7), tarakan: C('Tarakan', 3.3, 117.6333, 8),
          bukittinggi: C('Bukittinggi', -0.3055, 100.3692, 7), pematangsiantar: C('Pematangsiantar', 2.9595, 99.0687, 7), lhokseumawe: C('Lhokseumawe', 5.1801, 97.1507, 7), kudus: C('Kudus', -6.8048, 110.8405, 7), madiun: C('Madiun', -7.6298, 111.5239, 7) }
        const CITY_ALIAS = { solo: 'surakarta', jogja: 'yogyakarta', jogjakarta: 'yogyakarta', yogya: 'yogyakarta', lampung: 'bandarlampung', bdl: 'bandarlampung', banda: 'bandaaceh', aceh: 'bandaaceh', jkt: 'jakarta', sby: 'surabaya', bali: 'denpasar', ujungpandang: 'makassar' }
        function findCity(q) {
          let k = String(q || '').toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/, '').replace(/[^a-z]/g, ''); if (!k) return null
          k = CITY_ALIAS[k] || k; if (CITIES[k]) return { key: k, ...CITIES[k] }
          const m = Object.keys(CITIES).find(x => x.startsWith(k) || (k.length >= 4 && x.includes(k))); return m ? { key: m, ...CITIES[m] } : null
        }

        // ── Jadwal salat (algoritma astronomi; metode Kemenag RI: Subuh 20°, Isya 18°, ihtiyath +2 menit) ──
        const R = Math.PI / 180, dsin = d => Math.sin(d * R), dcos = d => Math.cos(d * R), dtan = d => Math.tan(d * R)
        const darcsin = x => Math.asin(x) / R, darccos = x => Math.acos(Math.max(-1, Math.min(1, x))) / R, darctan2 = (y, x) => Math.atan2(y, x) / R, darccot = x => Math.atan(1 / x) / R
        const fixA = a => a - 360 * Math.floor(a / 360), fixH = a => a - 24 * Math.floor(a / 24)
        function julian(y, m, d) { if (m <= 2) { y -= 1; m += 12 } const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 }
        function sunPos(jd) { const D = jd - 2451545.0, g = fixA(357.529 + 0.98560028 * D), q = fixA(280.459 + 0.98564736 * D), L = fixA(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g)), e = 23.439 - 0.00000036 * D, RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15; return { decl: darcsin(dsin(e) * dsin(L)), eqt: q / 15 - fixH(RA) } }
        function prayerTimes(o, lat, lng, tz) {
          const jd = julian(o.y, o.m, o.d) - lng / (15 * 24), mid = (t) => fixH(12 - sunPos(jd + t).eqt)
          const ang = (angle, t, ccw) => { const decl = sunPos(jd + t).decl, v = darccos((-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat))) / 15; return mid(t) + (ccw ? -v : v) }
          const asr = (f, t) => { const decl = sunPos(jd + t).decl; return ang(-darccot(f + dtan(Math.abs(lat - decl))), t) }
          let T = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 }
          for (let i = 0; i < 2; i++) { const t = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v / 24])); T = { fajr: ang(20, t.fajr, true), sunrise: ang(0.833, t.sunrise, true), dhuhr: mid(t.dhuhr), asr: asr(1, t.asr), sunset: ang(0.833, t.sunset), isha: ang(18, t.isha) } }
          const adj = tz - lng / 15, IH = 2 / 60, out = {}
          out.imsak = T.fajr + adj + IH - 10 / 60; out.subuh = T.fajr + adj + IH; out.terbit = T.sunrise + adj - IH; out.dhuha = T.sunrise + adj + 20 / 60
          out.dzuhur = T.dhuhr + adj + IH; out.ashar = T.asr + adj + IH; out.maghrib = T.sunset + adj + IH; out.isya = T.isha + adj + IH
          return out
        }
        const hm = (h) => { h = fixH(h + 0.5 / 60); return `${pad(Math.floor(h))}:${pad(Math.floor((h % 1) * 60))}` }
        function qibla(lat, lng) {
          const k = [21.4225, 39.8262], dl = (k[1] - lng) * R, b = fixA(darctan2(Math.sin(dl) * dcos(k[0]), dcos(lat) * dsin(k[0]) - dsin(lat) * dcos(k[0]) * Math.cos(dl)))
          const dirs = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'], p1 = lat * R, p2 = k[0] * R
          const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
          return { deg: b, dir: dirs[Math.round(b / 45) % 8], km: Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) }
        }
        // zona waktu IANA -> offset jam (untuk kota hasil pencarian internet)
        const tzHours = (tz, date) => offsetMs(tz, date || new Date()) / 3600000

        const QUOTES = ['Mulailah dari yang kecil, tapi mulailah hari ini.', 'Konsisten mengalahkan motivasi yang naik-turun.', 'Istirahat bukan tanda menyerah, itu bagian dari perjalanan.', 'Hari yang buruk tidak berarti hidup yang buruk.',
          'Fokus pada progres, bukan kesempurnaan.', 'Kerjakan yang bisa kamu kendalikan, lepaskan sisanya.', 'Satu langkah kecil hari ini lebih baik dari seribu rencana.', 'Bersyukur membuat yang cukup terasa lebih dari cukup.',
          'Tidak ada kata terlambat untuk belajar hal baru.', 'Orang sabar dan tekun selalu menemukan jalannya.', 'Jaga kesehatanmu, dia investasi paling berharga.', 'Kebaikan kecil yang konsisten mengubah banyak hal.',
          'Berani salah adalah syarat untuk jadi benar.', 'Air yang tenang pun bisa menghanyutkan, tetaplah rendah hati dan kuat.', 'Percayalah pada prosesmu sendiri.', 'Hari ini adalah halaman baru, tulislah dengan baik.',
          'Waktu tidak bisa dibeli, gunakan dengan bijak.', 'Jangan bandingkan bab awalmu dengan bab tengah orang lain.', 'Senyummu bisa jadi alasan orang lain bertahan hari ini.', 'Disiplin adalah bentuk cinta pada diri di masa depan.',
          'Belajar dari kemarin, hidup untuk hari ini, berharap untuk esok.', 'Lelah itu wajar, menyerah itu pilihan.', 'Mulai dengan alasan, bertahan dengan kebiasaan.', 'Teman baik membuat beban terasa ringan.', 'Rezeki datang pada yang berusaha dan berdoa.',
          'Jangan tunda: hari ini akan jadi "kemarin" besok.', 'Mimpi besar butuh jadwal kecil yang rutin.', 'Sedikit demi sedikit, lama-lama menjadi bukit.', 'Tenangkan pikiran, jawabannya sering muncul saat hening.', 'Hargai prosesnya, nikmati perjalanannya.']
        const quoteOf = (o) => QUOTES[dayNum(o.y, o.m, o.d) % QUOTES.length]
        const greet = (hh) => hh < 4 ? 'Selamat dini hari' : hh < 11 ? 'Selamat pagi' : hh < 15 ? 'Selamat siang' : hh < 18 ? 'Selamat sore' : 'Selamat malam'
        const dur = (min) => { min = Math.max(0, Math.round(min)); const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60; return [d && d + 'h', h && h + 'j', (m || (!d && !h)) && m + 'm'].filter(Boolean).join(' ') }

        module.exports = { tzOf, DAYS, MONTHS, pad, parts, now, offsetMs, zonedToUtc, dayNum, diffDays, addDays, dowOf, fmtDate, iso, isLeap, dayOfYear, isoWeek, parseDate, takeDate,
          hijri, weton, pasaranOf, PASARAN_SIFAT, NEPTU_ARTI, zodiak, shio, HOLIDAYS, HOL_LAST, holidayOn, isWorkday, nextHolidays, CITIES, findCity, prayerTimes, hm, qibla, tzHours, quoteOf, greet, dur }
    },
    profiledb: (module) => {
        module.exports = {
            get: (j) => dioStore().profile[j] || {},
            set: (j, k, v) => { (dioStore().profile[j] ||= {})[k] = v; dioSave() },
            del: (j, k) => { const p = dioStore().profile[j]; if (p) { delete p[k]; dioSave() } }
        }
    },
    npcutil: (module) => {
        const NPC = {
            alma: ['📒', 'Alma', 'Sekretaris Pribadi'], bilal: ['🕌', 'Pak Bilal', 'Penjaga Waktu Salat'],
            chrona: ['📅', 'Chrona', 'Penjaga Kalender'], zora: ['🔮', 'Madam Zora', 'Peramal Kota']
        }
        module.exports = {
            head: (id) => { const n = NPC[id]; return n ? `${n[0]} *${n[1]}* — ${n[2]}` : '' },
            bump: () => ''
        }
    },
    style: (module) => {
        const B = (t) => String(t ?? '').replace(/[A-Za-z0-9]/g, (c) => {
            const k = c.charCodeAt(0)
            return String.fromCodePoint(k >= 97 ? 0x1D41A + k - 97 : k >= 65 ? 0x1D400 + k - 65 : 0x1D7CE + k - 48)
        })
        const plain = (t) => String(t ?? '').normalize('NFKC').replace(/[\u{13000}-\u{1342F}]/gu, '').replace(/\s+/g, ' ').trim()
        const cut = (t, n) => { const a = Array.from(String(t ?? '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join('') }
        module.exports = { B, plain, cut, fx: (t) => t, ancientize: (t) => t, content: (c) => c, on: () => false }
    },
    "settingsdb": (module) => { module.exports = { get: (k) => (k === 'botname' ? global.namebot : undefined) } },
    "ancientsvg": (module, exports, require) => {
            // DEKORASI SVG GAYA KUNO (Mesir/Yunani): bingkai emas + pola meander, Mata Horus vektor, huruf serif
            const sharp = require('sharp')
            const ST = require('./style')

            const SERIF = "'Cinzel','Cormorant Garamond','Trajan Pro','Palatino Linotype','Book Antiqua',Georgia,'DejaVu Serif',serif"
            const SANS = "Poppins,'DejaVu Sans',Arial,sans-serif"
            const C = { gold: '#d4af37', goldL: '#f6e4a0', goldD: '#8a6d1d', night: '#080d1f', lapis: '#14224f', sand: '#efe3bf', stone: '#c9b98c' }

            // definisi bersama: gradasi emas, pola meander
            const defs = (accent = C.gold, id = 'a') => `
              <linearGradient id="${id}gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.goldL}"/><stop offset="0.5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldD}"/></linearGradient>
              <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.night}"/><stop offset="0.55" stop-color="${C.lapis}"/><stop offset="1" stop-color="#1b1233"/></linearGradient>
              <radialGradient id="${id}glow" cx="0.15" cy="0.3" r="0.75"><stop offset="0" stop-color="${accent}" stop-opacity="0.30"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
              <pattern id="${id}key" width="18" height="14" patternUnits="userSpaceOnUse"><path d="M0 12.5H18M2 12.5V1.5H15.5V9H5.5V4.5H12.5V6.5" fill="none" stroke="url(#${id}gold)" stroke-width="1.5" stroke-linejoin="miter"/></pattern>`

            // Mata Horus (Wedjat). (x,y) = pojok kiri-atas, w = lebar
            function eye(x, y, w, fill = 'url(#agold)') {
              const s = w / 120
              return `<g transform="translate(${x},${y}) scale(${s})" fill="none" stroke="${fill}" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10 20 C36 3 74 2 104 17" stroke-width="6"/>
                <path d="M8 42 C30 22 64 22 90 38 C72 52 30 54 8 42 Z" stroke-width="4.5"/>
                <circle cx="49" cy="38" r="11" fill="${fill}" stroke="none"/><circle cx="49" cy="38" r="4.5" fill="#080d1f" stroke="none"/>
                <path d="M90 38 L112 44 C118 56 108 66 97 60 C90 56 93 48 100 50" stroke-width="4.5"/>
                <path d="M46 51 C47 64 44 72 36 76 L18 78" stroke-width="4.5"/>
                <path d="M30 76 C24 70 26 62 33 62" stroke-width="3.5"/>
              </g>`
            }
            // latar + bingkai emas + sudut. return string elemen (taruh setelah <defs>)
            function frame(w, h, accent = C.gold, r = 24, id = 'a') {
              let st = '', x = 7919; const rn = () => (x = (x * 9301 + 49297) % 233280) / 233280
              for (let i = 0; i < 38; i++) st += `<circle cx="${(rn() * w) | 0}" cy="${(rn() * h) | 0}" r="${(rn() * 1.5 + 0.4).toFixed(1)}" fill="${C.goldL}" opacity="${(rn() * 0.35 + 0.08).toFixed(2)}"/>`
              const corner = (cx, cy, sx, sy) => `<g transform="translate(${cx},${cy}) scale(${sx},${sy})"><path d="M0 0H34V6H6V34H0Z" fill="url(#${id}gold)"/><rect x="11" y="11" width="9" height="9" fill="none" stroke="url(#${id}gold)" stroke-width="2" transform="rotate(45 15.5 15.5)"/></g>`
              return `<rect width="${w}" height="${h}" rx="${r}" fill="url(#${id}bg)"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#${id}glow)"/>${st}
              <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="${r - 3}" fill="none" stroke="url(#${id}gold)" stroke-width="3.5"/>
              <rect x="14" y="14" width="${w - 28}" height="${h - 28}" rx="${r - 10}" fill="none" stroke="${C.gold}" stroke-opacity="0.35" stroke-width="1.2"/>
              <rect x="${r + 8}" y="3" width="${w - 2 * r - 16}" height="9" fill="url(#${id}key)" opacity="0.9" transform="translate(0,2)"/>
              <rect x="${r + 8}" y="${h - 14}" width="${w - 2 * r - 16}" height="9" fill="url(#${id}key)" opacity="0.9"/>
              ${corner(16, 16, 1, 1)}${corner(w - 16, 16, -1, 1)}${corner(16, h - 16, 1, -1)}${corner(w - 16, h - 16, -1, -1)}`
            }
            // judul bot: mata Horus + nama (ASCII) huruf serif emas
            function brand(x, y, botname, size = 26, sub = '') {
              const name = ST.plain(botname).toUpperCase() || 'KAGUYA'
              return `${eye(x, y - size * 0.9, size * 1.9)}
              <text x="${x + size * 2.2}" y="${y}" font-family="${SERIF}" font-size="${size}" font-weight="700" fill="url(#agold)" letter-spacing="${Math.round(size / 6)}">${name}</text>
              ${sub ? `<text x="${x + size * 2.2}" y="${y + size * 0.85}" font-family="${SERIF}" font-size="${Math.round(size * 0.5)}" fill="${C.stone}" letter-spacing="2">${sub}</text>` : ''}`
            }
            const render = (svg) => sharp(Buffer.from(svg)).png().toBuffer()
            module.exports = { C, SERIF, SANS, defs, eye, frame, brand, render }
        },
    "daycard": (module, exports, require) => {
            // KARTU KALENDER (canvas SVG -> PNG lewat sharp)
            const sharp = require('sharp')
            const AN = require('./ancientsvg'), ST = require('./style')
            const D = require('./daily')
            const FONT = "Poppins, 'DejaVu Sans', Arial, sans-serif"
            const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
            const cut = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s }

            function stars(seed) { let x = seed, o = ''; const r = () => (x = (x * 9301 + 49297) % 233280) / 233280; for (let i = 0; i < 40; i++) o += `<circle cx="${(r() * 1000) | 0}" cy="${(r() * 660) | 0}" r="${(r() * 1.6 + 0.4).toFixed(1)}" fill="#fff" opacity="${(r() * 0.4 + 0.08).toFixed(2)}"/>`; return o }

            // opt: { y, m, today:{y,m,d}, botname }
            async function calendarCard({ y, m, today, botname = 'Kaguya' }) {
              botname = ST.plain(botname) || 'KAGUYA'
              const AC = '#38bdf8', RED = '#f87171', ORG = '#fb923c', first = D.dowOf(y, m, 1), dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
              const isCur = today.y === y && today.m === m, hol = {}
              D.HOLIDAYS.forEach(h => { if (h.d.slice(0, 7) === `${y}-${D.pad(m)}`) hol[+h.d.slice(8)] = h })
              const hFirst = D.hijri({ y, m, d: 1 }), hLast = D.hijri({ y, m, d: dim })
              const hRange = hFirst.name === hLast.name ? `${hFirst.name} ${hFirst.y} H` : `${hFirst.name} – ${hLast.name} ${hLast.y === hFirst.y ? hLast.y : hFirst.y + '/' + hLast.y} H`
              let work = 0; for (let d = 1; d <= dim; d++) if (D.isWorkday({ y, m, d, dow: D.dowOf(y, m, d) })) work++
              const holCount = Object.values(hol).filter(h => h.t === 'libur').length

              // sel kalender
              const CW = 84, CH = 60, GX = 372, GY = 150, DN = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB']
              let cells = DN.map((n, i) => `<text x="${GX + i * CW + CW / 2}" y="${GY - 14}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="800" fill="${i === 0 ? RED : i === 6 ? '#fda4af' : '#8fa0cf'}" letter-spacing="1">${n}</text>`).join('')
              for (let d = 1; d <= dim; d++) {
                const idx = first + d - 1, col = idx % 7, row = Math.floor(idx / 7), x = GX + col * CW, yy = GY + row * CH, h = hol[d]
                const isToday = isCur && today.d === d, red = col === 0 || (h && h.t === 'libur'), col2 = h ? (h.t === 'libur' ? RED : ORG) : col === 0 ? RED : col === 6 ? '#fda4af' : '#e5e9ff'
                const hj = D.hijri({ y, m, d })
                cells += `<g>
                  <rect x="${x + 3}" y="${yy + 3}" width="${CW - 6}" height="${CH - 6}" rx="14" fill="${isToday ? AC : '#ffffff0b'}" ${isToday ? '' : `stroke="${h ? col2 : '#ffffff14'}" stroke-opacity="${h ? 0.7 : 1}"`}/>
                  <text x="${x + CW / 2}" y="${yy + 33}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="800" fill="${isToday ? '#06202e' : col2}">${d}</text>
                  <text x="${x + CW - 11}" y="${yy + CH - 11}" text-anchor="end" font-family="${FONT}" font-size="10" font-weight="600" fill="${isToday ? '#06202e' : '#7f8db8'}">${hj.d}</text>
                  ${h ? `<circle cx="${x + 14}" cy="${yy + CH - 15}" r="4" fill="${isToday ? '#06202e' : col2}"/>` : ''}
                </g>`
              }
              // daftar libur bulan ini
              const hents = Object.entries(hol), per = Math.ceil(hents.length / 2) || 1
              const hl = hents.slice(0, 12).map(([d, h], i) => { const col = Math.floor(i / per), row = i % per
                return `<g transform="translate(${GX + col * 300},${GY + 6 * CH + 42 + row * 21})"><circle cx="5" cy="-4" r="4.5" fill="${h.t === 'libur' ? RED : ORG}"/><text x="18" y="0" font-family="${FONT}" font-size="13" font-weight="600" fill="#dfe5ff"><tspan font-weight="800">${d}</tspan>  ${esc(cut(h.n.replace(/\s*\(.*\)$/, ''), col ? 36 : 32))}</text></g>` }).join('')

              // panel kiri
              let left
              if (isCur) {
                const w = D.weton(today), nx = D.nextHolidays(today, 1)[0], hj = D.hijri(today), dow = D.DAYS[D.dowOf(today.y, today.m, today.d)]
                left = `<text x="40" y="128" font-family="${FONT}" font-size="22" font-weight="700" fill="${AC}" letter-spacing="3">${dow.toUpperCase()}</text>
                  <text x="40" y="250" font-family="${AN.SERIF}" font-size="140" font-weight="700" fill="url(#agold)">${today.d}</text>
                  <text x="40" y="292" font-family="${FONT}" font-size="26" font-weight="700" fill="#e5e9ff">${D.MONTHS[m - 1]} ${y}</text>
                  <text x="40" y="326" font-family="${FONT}" font-size="17" font-weight="600" fill="#8fa0cf">${esc(hj.text)}</text>
                  <text x="40" y="354" font-family="${FONT}" font-size="17" font-weight="600" fill="#8fa0cf">${dow} ${D.pasaranOf(today)} • neptu ${w.neptu}</text>
                  <rect x="40" y="380" width="296" height="104" rx="18" fill="#ffffff0d" stroke="${AC}55"/>
                  <text x="58" y="408" font-family="${FONT}" font-size="12" font-weight="800" fill="${AC}" letter-spacing="2">HARI LIBUR BERIKUTNYA</text>
                  ${nx ? `<text x="58" y="436" font-family="${FONT}" font-size="15" font-weight="700" fill="#fff">${esc(cut(nx.n, 34))}</text><text x="58" y="464" font-family="${FONT}" font-size="15" font-weight="600" fill="#c7cff0">${nx.d} ${D.MONTHS[nx.m - 1]} • ${nx.in === 0 ? 'HARI INI' : nx.in + ' hari lagi'}</text>` : `<text x="58" y="440" font-family="${FONT}" font-size="15" fill="#c7cff0">Data libur belum tersedia</text>`}`
              } else {
                left = `<text x="40" y="128" font-family="${FONT}" font-size="22" font-weight="700" fill="${AC}" letter-spacing="3">KALENDER</text>
                  <text x="40" y="236" font-family="${FONT}" font-size="64" font-weight="800" fill="#fff">${D.MONTHS[m - 1]}</text>
                  <text x="40" y="292" font-family="${FONT}" font-size="46" font-weight="800" fill="${AC}">${y}</text>
                  <text x="40" y="332" font-family="${FONT}" font-size="17" font-weight="600" fill="#8fa0cf">${esc(hRange)}</text>
                  <rect x="40" y="368" width="296" height="116" rx="18" fill="#ffffff0d" stroke="${AC}55"/>
                  <text x="58" y="398" font-family="${FONT}" font-size="12" font-weight="800" fill="${AC}" letter-spacing="2">RINGKASAN BULAN</text>
                  <text x="58" y="430" font-family="${FONT}" font-size="16" font-weight="700" fill="#fff">${dim} hari • ${work} hari kerja</text>
                  <text x="58" y="458" font-family="${FONT}" font-size="16" font-weight="700" fill="#fff">${holCount} libur nasional</text>`
              }
              const prog = isCur ? D.dayOfYear(today) / (D.isLeap(y) ? 366 : 365) : 0
              const info = isCur ? `<text x="40" y="520" font-family="${FONT}" font-size="12" font-weight="800" fill="#8fa0cf" letter-spacing="2">PROGRES TAHUN ${y}</text><rect x="40" y="530" width="296" height="10" rx="5" fill="#0b0f1f" stroke="#ffffff22"/><rect x="40" y="530" width="${Math.max(10, 296 * prog)}" height="10" rx="5" fill="${AC}"/><text x="40" y="566" font-family="${FONT}" font-size="14" font-weight="600" fill="#c7cff0">Hari ke-${D.dayOfYear(today)} • Minggu ke-${D.isoWeek(today)} • ${(prog * 100).toFixed(0)}%</text>` : ''

              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680" viewBox="0 0 1000 680">
              <defs>${AN.defs(AC)}</defs>
              ${AN.frame(1000, 680, AC, 28)}
              ${AN.brand(64, 70, botname, 24, 'KALENDER &amp; PENANGGALAN • CHRONA')}
              <text x="944" y="66" text-anchor="end" font-family="${AN.SERIF}" font-size="30" font-weight="700" fill="url(#agold)">${D.MONTHS[m - 1].toUpperCase()} ${y}</text>
              <text x="944" y="90" text-anchor="end" font-family="${AN.SANS}" font-size="14" font-weight="600" fill="${AN.C.stone}">${esc(hRange)}</text>
              ${left}${info}${cells}${hl}
              <g transform="translate(${GX},${GY + 6 * CH + 6})" font-family="${FONT}" font-size="11" font-weight="600" fill="#8fa0cf"><circle cx="6" cy="-3" r="4" fill="${RED}"/><text x="16" y="0">Libur nasional</text><circle cx="116" cy="-3" r="4" fill="${ORG}"/><text x="126" y="0">Cuti bersama</text><text x="236" y="0">Angka kecil = tanggal Hijriah (perkiraan)</text></g>
              </svg>`
              return sharp(Buffer.from(svg)).png().toBuffer()
            }
            module.exports = { calendarCard }
        }
}

const feature = (module, exports, require) => {
        // CHRONA — Penjaga Kalender: tanggal (kartu canvas), hitung hari
        const D = require('../../lib/daily'), NU = require('../../lib/npcutil'), P = require('../../lib/profiledb')
        const card = require('../../lib/daycard')
        const MON = { jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12 }
        const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
        const rel = (n) => n === 0 ? 'hari ini' : n === 1 ? 'besok' : n === -1 ? 'kemarin' : n > 0 ? `${n} hari lagi` : `${-n} hari lalu`
        const span = (n) => { n = Math.abs(n); const w = Math.floor(n / 7), d = n % 7; return n >= 7 ? `${n} hari (${w} minggu${d ? ' ' + d + ' hari' : ''})` : `${n} hari` }
        function workdays(a, b) { let c = 0, s = a, e = b; if (diffSign(a, b) < 0) [s, e] = [b, a]; for (let n = D.diffDays(s, e), i = 1; i <= n; i++) { const x = D.addDays(s, i); if (D.isWorkday(x)) c++ } return c }
        const diffSign = (a, b) => Math.sign(D.diffDays(a, b))
        const withDow = (o) => ({ ...o, dow: D.dowOf(o.y, o.m, o.d) })
        const info = (o) => { const h = D.hijri(o), w = D.weton(o); return `${D.fmtDate(withDow(o))}\n${h.text} • ${w.hari} ${w.pasaran} (neptu ${w.neptu})` }

        function age(b, t) {
          let y = t.y - b.y, m = t.m - b.m, d = t.d - b.d
          if (d < 0) { m--; d += dim(t.m === 1 ? t.y - 1 : t.y, t.m === 1 ? 12 : t.m - 1) }
          if (m < 0) { y--; m += 12 }
          return { y, m, d }
        }

        module.exports = {
          name: 'tanggal',
          alias: ['kalender', 'calendar', 'date', 'hitunghari'],   // countdown/selisih/tambahhari/umur/usia dimiliki plugin ekstra (countdown, umur) sejak versi lama; alias dobel dihapus v4.7.6
          category: 'search',
          cmds: ['tanggal', 'hitunghari'],
          desc: 'Kalender bergambar, libur nasional, hitung hari, umur (Chrona)',
          run: async ({ sock, m, command, args, text, prefix, reply }) => {
            const jid = m.sender, t = D.now(), today = { y: t.y, m: t.m, d: t.d }
            const done = (body, n = 2) => reply(`${NU.head('chrona', jid)}\n\n${body}${NU.bump(jid, 'chrona', n)}`)

            // ── KALENDER (CANVAS) ──
            if (['tanggal', 'kalender', 'calendar', 'date'].includes(command)) {
              let y = t.y, mo = t.m
              for (const a of args.map(x => x.toLowerCase())) {
                let q
                if ((q = a.match(/^(\d{4})[-/](\d{1,2})$/))) { y = +q[1]; mo = +q[2] }
                else if (/^\d{4}$/.test(a)) y = +a
                else if (MON[a]) mo = MON[a]
                else if (/^\d{1,2}$/.test(a) && +a >= 1 && +a <= 12) mo = +a
                else if (a === 'depan' || a === 'next') { mo++; if (mo > 12) { mo = 1; y++ } }
                else if (a === 'lalu' || a === 'prev') { mo--; if (mo < 1) { mo = 12; y-- } }
              }
              if (mo < 1 || mo > 12 || y < 1900 || y > 2100) return reply(`Contoh: ${prefix}tanggal  |  ${prefix}tanggal maret 2027  |  ${prefix}tanggal 2027-08  |  ${prefix}tanggal depan`)
              const img = await card.calendarCard({ y, m: mo, today, botname: require('../../lib/settingsdb').get('botname') })
              const cur = y === t.y && mo === t.m, h = D.holidayOn(today), nx = D.nextHolidays(today, 1)[0]
              const cap = cur
                ? `${NU.head('chrona', jid)}\n\n${info(today)}\nMinggu ke-${D.isoWeek(today)} • hari ke-${D.dayOfYear(today)} dari ${D.isLeap(t.y) ? 366 : 365}\n${h ? `Hari ini: *${h.n}*\n` : ''}${nx && !h ? `Libur berikutnya: ${nx.n} (${rel(nx.in)})\n` : ''}\n_Hijriah perkiraan (±1 hari). Coba: ${prefix}tanggal maret 2027_`
                : `${NU.head('chrona', jid)}\n\nKalender ${D.MONTHS[mo - 1]} ${y}\n_Libur: ${prefix}harilibur  |  Hitung hari: ${prefix}hitunghari <tgl>_`
              await sock.sendMessage(m.chat, { image: img, caption: cap + NU.bump(jid, 'chrona', 2) }, { quoted: m }); return
            }

            // ── HITUNG HARI ──
            if (['hitunghari', 'countdown', 'selisih'].includes(command)) {
              const a = D.takeDate(text, today); if (!a.date) return reply(`Contoh:\n${prefix}hitunghari 17-08-2027  (dari hari ini)\n${prefix}selisih 01-01-2026 31-12-2026  (dua tanggal)\nFormat: dd-mm-yyyy, yyyy-mm-dd, atau "17 agustus 2027".`)
              const b = D.takeDate(a.rest, today), from = b.date ? a.date : today, to = b.date || a.date, n = D.diffDays(from, to)
              const wd = workdays(from, to)
              return done(`*${b.date ? 'SELISIH TANGGAL' : 'HITUNG MUNDUR'}*\n\n${b.date ? `Dari: ${D.fmtDate(withDow(from))}\n` : ''}${b.date ? 'Ke  : ' : 'Tanggal: '}${D.fmtDate(withDow(to))}\n\n⏳ *${n === 0 ? 'Hari yang sama' : n > 0 ? span(n) + (b.date ? '' : ' lagi') : span(n) + (b.date ? ' sebelumnya' : ' yang lalu')}*\n💼 Hari kerja: ${wd} (tanpa Sabtu, Minggu, dan libur)\n\n${info(to)}`)
            }
            if (command === 'tambahhari') {
              const n = parseInt(args[0]); if (!Number.isFinite(n) || Math.abs(n) > 36500) return reply(`Contoh: ${prefix}tambahhari 100  |  ${prefix}tambahhari -30  |  ${prefix}tambahhari 45 17-08-2026`)
              const base = D.takeDate(args.slice(1).join(' '), today).date || today, r = D.addDays(base, n)
              return done(`*${n >= 0 ? '+' : ''}${n} hari dari ${D.fmtDate(withDow(base))}*\n\n➡️ ${info(r)}\n${D.holidayOn(r) ? `🔴 Bertepatan dengan: ${D.holidayOn(r).n}` : ''}`)
            }

            // ── UMUR ──
            if (['umur', 'usia'].includes(command)) {
              const b = D.takeDate(text, today).date || (P.get(jid).bday ? D.parseDate(P.get(jid).bday) : null)
              if (!b) return reply(`Contoh: ${prefix}umur 31-01-2000\nSimpan tanggal lahir supaya tak perlu mengetik lagi: ${prefix}setlahir 31-01-2000`)
              if (D.diffDays(b, today) < 0) return reply('Tanggal lahir itu ada di masa depan 😄')
              const a = age(b, today), total = D.diffDays(b, today)
              let nb = D.parseDate(`${b.d}-${b.m}-${t.y}`) || { y: t.y, m: 2, d: 28, dow: 0 }; if (D.diffDays(today, nb) < 0) nb = D.parseDate(`${b.d}-${b.m}-${t.y + 1}`) || { y: t.y + 1, m: 2, d: 28 }
              const z = D.zodiak(b), s = D.shio(b), w = D.weton(b), nd = D.diffDays(today, nb)
              return done(`*UMUR KAMU*\n\n🎂 Lahir: ${D.fmtDate(withDow(b))}\n📈 *${a.y} tahun ${a.m} bulan ${a.d} hari*\n🗓️ Sudah menjalani ${total.toLocaleString('id-ID')} hari (± ${Math.floor(total / 7).toLocaleString('id-ID')} minggu)\n🎉 Ulang tahun berikutnya: ${nd === 0 ? '*HARI INI! Selamat ulang tahun!*' : rel(nd)} (${D.fmtDate(withDow(nb))})\n\n✨ Zodiak ${z.name} • Shio ${s.name}${s.edge ? '*' : ''} • Weton ${w.hari} ${w.pasaran}${s.edge ? '\n_*lahir Jan–Feb: shio mengikuti Imlek, bisa berbeda_' : ''}`)
            }
          },
        }
    }

dioRegister("world/chrona", feature, libs)

let handler = (m, ctx) => dioRun("world/chrona", m, ctx)

handler.command = ['tanggal', 'calendar', 'date', 'hitunghari', 'kalender']
handler.hide = ["kalender", "calendar", "date"]
handler.help = ["tanggal", "hitunghari"]
handler.tags = ['search']

const __plugin = handler

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'chrona', { as: 'tanggal' })
