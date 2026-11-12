import { updateGroupSetting, DEFAULT_TOXIC, getMeta, botIsAdmin } from '../../lib/platform/wa.js'
import { PLUS_FEATURES, PLUS_OPT_IN, PLUS_WARNABLE, PLUS_TITLE, PLUS_ALIAS, PLUS_HELP, plusStatusExtra, plusHandle } from '../../lib/group/guardplus.js'

// antilink, antitoxic, antispam, antidelete, autoreply, antisticker, antiswgc, antitagsw,
// antiviewonce, antiedit, notiflevel: pengaturan per grup.
// Pengecekan pesan-nya ada di lib/platform/wa.js (groupGuard). Supaya bisa menghapus pesan
// dan mengeluarkan member, akunmu harus admin di grup tersebut.

const get = (jid, type) => global.db.groups?.[jid]?.[type] || {}
const flag = (v) => (v ? 'ON' : 'OFF')
const ON = ['on', 'aktif', 'enable']
const OFF = ['off', 'nonaktif', 'disable', 'mati']
const TEST_MS = 10 * 60_000 // lama mode tes

const TITLE = {
    antilink: 'ANTILINK',
    antitoxic: 'ANTITOXIC',
    antispam: 'ANTISPAM',
    antidelete: 'ANTIDELETE',
    autoreply: 'AUTOREPLY',
    antisticker: 'ANTISTICKER',
    antiswgc: 'ANTISWGC',
    antitagsw: 'ANTITAGSW',
    antiviewonce: 'ANTIVIEWONCE',
    antiedit: 'ANTIEDIT',
    notiflevel: 'NOTIFLEVEL',
    notifmakan: 'NOTIFMAKAN'
}

const HELP = {
    antilink: (p) => `${p}antilink on\n${p}antilink off\n${p}antilink kick  (hapus pesan + keluarkan pengirim, bisa di-toggle)\n${p}antilink all   (blokir semua jenis link, termasuk www. dan domain tanpa http, bisa di-toggle)\n_Bawaan memblokir semua link berawalan https:// (dan http://) serta link grup / channel WhatsApp. Untuk menangkap juga www. dan domain tanpa http (domain.com) aktifkan ${p}antilink all._`,
    antitoxic: (p) => `${p}antitoxic on\n${p}antitoxic off\n${p}antitoxic add <kata>\n${p}antitoxic del <kata>\n${p}antitoxic list\n${p}antitoxic reset`,
    antispam: (p) => `${p}antispam on\n${p}antispam off\n${p}antispam set <jumlah> <detik>  (bawaan 5 pesan / 6 detik)\n_Melebihi batas dianggap spam._`,
    antidelete: (p) => `${p}antidelete on\n${p}antidelete off\n_Pesan yang dihapus member dikirim ulang oleh bot: teks, foto, video, audio, VN, sticker, dan dokumen. Media lebih dari 12MB hanya diteruskan jika masih tersedia._`,
    antisticker: (p) => `${p}antisticker on\n${p}antisticker off\n${p}antisticker kick  (hapus sticker + keluarkan pengirim, bisa di-toggle)\n_Sticker dari member dihapus. Admin dikecualikan._`,
    antiswgc: (p) => `${p}antiswgc on\n${p}antiswgc off\n${p}antiswgc kick  (hapus + keluarkan pengirim, bisa di-toggle)\n_Status grup dari member dihapus. Admin dikecualikan._`,
    antitagsw: (p) => `${p}antitagsw on\n${p}antitagsw off\n${p}antitagsw kick  (hapus + keluarkan pengirim, bisa di-toggle)\n_Pesan "grup ini disebut di status" dihapus. Admin dikecualikan._`,
    antiedit: (p) => `${p}antiedit on\n${p}antiedit off\n_Pesan teks yang diedit member dikirim ulang oleh bot lengkap dengan teks sebelum dan sesudahnya._`,
    antiviewonce: (p) => `${p}antiviewonce on\n${p}antiviewonce off\n${p}antiviewonce hapus  (hapus juga pesan aslinya, bisa di-toggle)\n_Foto, video, dan audio sekali lihat dikirim ulang sebagai media biasa._`,
    notifmakan: (p) => `${p}enable notifmakan / ${p}disable notifmakan\n${p}makan  (lihat jadwal, ubah jam, tes notif)\n_Bot mengingatkan jam sarapan, makan siang, dan makan malam di grup (WIB). Default: mati._`,
    notiflevel: (p) => `${p}notiflevel on\n${p}notiflevel off\n_Bot mengirim notifikasi di grup saat member naik level (EXP cukup). Default: mati._`,
    autoreply: (p) => `${p}autoreply on\n${p}autoreply off\n${p}autoreply add <pemicu> | <balasan>\n${p}autoreply del <pemicu>\n${p}autoreply list`
}

// fitur yang bisa memakai sistem warn (lihat plugins/group/warn.js)
const WARNABLE = ['antilink', 'antitoxic', 'antispam', 'antisticker', 'antiswgc', 'antitagsw']

function status(type, p, jid) {
    const cfg = get(jid, type)
    const extra = {
        antilink: `\n┃ ✦ Keluarkan : ${flag(cfg.kick)}\n┃ ✦ Semua link : ${flag(cfg.all)}`,
        antitoxic: `\n┃ ✦ Daftar kata : ${(cfg.words || DEFAULT_TOXIC).length}${cfg.words ? ' (custom)' : ' (bawaan)'}`,
        autoreply: `\n┃ ✦ Aturan : ${Object.keys(cfg.rules || {}).length}`,
        antisticker: `\n┃ ✦ Keluarkan : ${flag(cfg.kick)}`,
        antiswgc: `\n┃ ✦ Keluarkan : ${flag(cfg.kick)}`,
        antitagsw: `\n┃ ✦ Keluarkan : ${flag(cfg.kick)}`,
        antiviewonce: `\n┃ ✦ Hapus asli : ${flag(cfg.del)}`
    }[type] ?? plusStatusExtra(type, cfg)

    const warnLine = WARNABLE.includes(type) ? `\n┃ ✦ Sistem warn : ${flag(cfg.warn)}` : ''
    const warnHelp = WARNABLE.includes(type) ? `\n${p}${type} warn  (pelanggar dapat peringatan, dikeluarkan saat mencapai batas ${p}setwarn; menggantikan kick)` : ''
    return `╭─▣「 *${TITLE[type]}* 」▣─╮\n┃ ✦ Status : *${flag(cfg.on)}*${extra}${warnLine}\n╰─────────────➤\n\n${HELP[type](p)}${warnHelp}`
}

const FEATURES = ['antilink', 'antitoxic', 'antispam', 'antidelete', 'autoreply', 'antisticker', 'antiswgc', 'antitagsw', 'antiviewonce', 'antiedit', 'notiflevel', 'notifmakan']
const ALIAS = {
    link: 'antilink', toxic: 'antitoxic', spam: 'antispam', delete: 'antidelete', del: 'antidelete', reply: 'autoreply',
    sticker: 'antisticker', stiker: 'antisticker', antistiker: 'antisticker',
    swgc: 'antiswgc', statusgrup: 'antiswgc', tagsw: 'antitagsw', tagstatus: 'antitagsw',
    edit: 'antiedit',
    makan: 'notifmakan', jadwalmakan: 'notifmakan', notifmkn: 'notifmakan',
    levelup: 'notiflevel', naiklevel: 'notiflevel', lvlup: 'notiflevel', notiflvl: 'notiflevel',
    viewonce: 'antiviewonce', vo: 'antiviewonce', antivo: 'antiviewonce', antiv1: 'antiviewonce', antisekalilihat: 'antiviewonce'
}
// fitur tambahan (lib/group/guardplus.js)
Object.assign(TITLE, PLUS_TITLE)
Object.assign(HELP, PLUS_HELP)
WARNABLE.push(...PLUS_WARNABLE)
FEATURES.push(...PLUS_FEATURES)
Object.assign(ALIAS, PLUS_ALIAS)
PLUS_OPT_IN.push('notifmakan') // tidak ikut menyala lewat `enable all` (bot kirim pesan terjadwal, harus pilihan admin)

const pickFeature = (v) => {
    const k = String(v || '').toLowerCase()
    return FEATURES.includes(k) ? k : ALIAS[k]
}

function featureList(p, jid) {
    const rows = FEATURES.map((f) => `┃ ${get(jid, f).on ? '🟢' : '🔴'} ${f.padEnd(13)} : *${flag(get(jid, f).on)}*`).join('\n')
    return `╭─▣「 *FITUR GRUP* 」▣─╮\n${rows}\n╰─────────────➤\n\n` +
        `${p}enable <fitur>  → aktifkan\n${p}disable <fitur> → matikan\n` +
        `${p}enable all / ${p}disable all → semuanya\n\n` +
        `Fitur: ${FEATURES.join(', ')}\n_Pengaturan detail: ${p}antilink, ${p}antitoxic, ${p}autoreply, dst._`
}

// catatan di bawah daftar fitur: bot admin atau belum, dan siapa yang dikecualikan
async function guardNotes(sock, p, jid) {
    const lines = []
    try {
        const meta = await getMeta(sock, jid, true)
        if (!botIsAdmin(sock, meta)) lines.push('⚠️ *Bot belum jadi admin grup*, jadi pesan tidak bisa dihapus dan member tidak bisa dikeluarkan. Jadikan bot admin dulu.')
    } catch {}
    lines.push(`ℹ️ Owner dan admin grup *dikecualikan* dari semua penjaga. Untuk mencoba dengan akunmu sendiri ketik ${p}guardtest on (10 menit).`)
    return `\n\n${lines.join('\n')}`
}

async function toggle(sock, command, text, p, jid, reply) {
    const turnOn = command === 'enable'
    const arg = (text || '').trim().split(/\s+/)[0].toLowerCase()
    if (!arg) return reply(featureList(p, jid))

    if (['all', 'semua'].includes(arg)) {
        // fitur yang butuh pengaturan dulu (antimedia, slowmode, antiasing, antipromote) tidak ikut menyala lewat `enable all`
        for (const f of FEATURES) if (!(turnOn && PLUS_OPT_IN.includes(f))) updateGroupSetting(jid, f, { on: turnOn })
        return reply(`Semua fitur grup ${turnOn ? 'diaktifkan' : 'dimatikan'}.\n\n${featureList(p, jid)}${turnOn ? await guardNotes(sock, p, jid) : ''}`)
    }

    const feature = pickFeature(arg)
    if (!feature) return reply(`Fitur *${arg}* tidak ada.\n\n${featureList(p, jid)}`)
    updateGroupSetting(jid, feature, { on: turnOn })
    return reply(`*${TITLE[feature]}* ${turnOn ? 'diaktifkan' : 'dimatikan'} di grup ini.\n\n${featureList(p, jid)}${turnOn ? await guardNotes(sock, p, jid) : ''}`)
}

let handler = async (m, { sock, text, command, prefix, jid, reply }) => {
    const p = prefix || '.'
    if (command === 'enable' || command === 'disable') return toggle(sock, command, text, p, jid, reply)

    // .guardtest [on|off] — coba penjaga dengan akun owner / admin
    if (command === 'guardtest') {
        const arg = (text || '').trim().split(/\s+/)[0].toLowerCase()
        const until = Number(global.db.groups?.[jid]?.guardtest?.until) || 0
        if (ON.includes(arg)) {
            updateGroupSetting(jid, 'guardtest', { until: Date.now() + TEST_MS })
            const active = FEATURES.filter(f => get(jid, f).on)
            return reply(
                `🧪 *MODE TES AKTIF* (${TEST_MS / 60_000} menit)\n\n` +
                `Owner dan admin sekarang ikut diperiksa. Pelanggar hanya dihapus pesannya dan ditegur (tanpa kick / warn).\n\n` +
                `Fitur aktif: ${active.length ? active.join(', ') : '-'}\n` +
                `Coba kirim: kata kasar, stiker, atau link (sesuai fitur yang aktif).\n\nMatikan: ${p}guardtest off` +
                (await guardNotes(sock, p, jid))
            )
        }
        if (OFF.includes(arg)) {
            updateGroupSetting(jid, 'guardtest', { until: undefined })
            return reply('🧪 Mode tes dimatikan. Owner dan admin kembali dikecualikan.')
        }
        return reply(
            `🧪 *MODE TES*: ${until > Date.now() ? `aktif, sisa ${Math.ceil((until - Date.now()) / 60_000)} menit` : 'mati'}\n\n` +
            `${p}guardtest on  → owner & admin ikut diperiksa selama ${TEST_MS / 60_000} menit\n${p}guardtest off` +
            (await guardNotes(sock, p, jid))
        )
    }

    const raw = (text || '').trim()
    const sub = (raw.split(/\s+/)[0] || '').toLowerCase()
    const value = raw.slice(sub.length).trim()
    const cfg = get(jid, command)
    const set = (patch) => updateGroupSetting(jid, command, patch)

    if (ON.includes(sub)) {
        set({ on: true })
        return reply(`*${TITLE[command]}* diaktifkan di grup ini.`)
    }
    if (OFF.includes(sub)) {
        set({ on: false })
        return reply(`*${TITLE[command]}* dimatikan di grup ini.`)
    }

    if (command === 'antilink' && sub === 'kick') {
        set({ on: true, kick: !cfg.kick })
        return reply(`Antilink ${!cfg.kick ? 'akan menghapus pesan dan mengeluarkan pengirim' : 'hanya menghapus pesan'}.`)
    }
    if (command === 'antilink' && sub === 'all') {
        set({ on: true, all: !cfg.all })
        return reply(`Antilink sekarang memblokir ${!cfg.all ? 'semua link' : 'link WhatsApp saja'}.`)
    }

    if (WARNABLE.includes(command) && sub === 'warn') {
        set({ on: true, warn: !cfg.warn })
        return reply(`${TITLE[command]} ${!cfg.warn ? `memakai sistem warn: pelanggar dapat peringatan dan dikeluarkan setelah ${(global.db.groups?.[jid]?.warn?.limit) || 3}x` : 'tidak lagi memakai sistem warn'}.`)
    }
    if (['antisticker', 'antiswgc', 'antitagsw'].includes(command) && sub === 'kick') {
        set({ on: true, kick: !cfg.kick })
        return reply(`${TITLE[command]} ${!cfg.kick ? 'akan menghapus pesan dan mengeluarkan pengirim' : 'hanya menghapus pesan'}.`)
    }
    if (command === 'antiviewonce' && ['hapus', 'del', 'delete'].includes(sub)) {
        set({ on: true, del: !cfg.del })
        return reply(`Antiviewonce ${!cfg.del ? 'juga menghapus pesan aslinya (bot harus admin)' : 'hanya mengirim ulang medianya'}.`)
    }

    if (command === 'antitoxic') {
        const words = new Set(cfg.words || DEFAULT_TOXIC)
        const word = value.toLowerCase()
        if (sub === 'add' && word) {
            words.add(word)
            set({ words: [...words] })
            return reply(`Kata *${word}* ditambahkan (${words.size} kata).`)
        }
        if (sub === 'del' && word) {
            if (!words.delete(word)) return reply(`Kata *${word}* tidak ada di daftar.`)
            set({ words: [...words] })
            return reply(`Kata *${word}* dihapus (${words.size} kata).`)
        }
        if (sub === 'list') return reply(`*▢ KATA TERLARANG* (${words.size})\n${[...words].join(', ')}`)
        if (sub === 'reset') {
            set({ words: undefined })
            return reply('Daftar kata dikembalikan ke bawaan.')
        }
    }

    if (command === 'autoreply') {
        const rules = { ...(cfg.rules || {}) }
        if (sub === 'add') {
            const [trigger, ...answer] = value.split('|')
            const key = (trigger || '').trim().toLowerCase()
            const body = answer.join('|').trim()
            if (!key || !body) return reply(`Format: ${p}autoreply add <pemicu> | <balasan>\nContoh: ${p}autoreply add p | Assalamualaikum`)
            rules[key] = body
            set({ rules })
            return reply(`Aturan ditambahkan.\n*${key}* → ${body}`)
        }
        if (sub === 'del') {
            const key = value.toLowerCase()
            if (!(key in rules)) return reply(`Pemicu *${key || '-'}* tidak ada.`)
            delete rules[key]
            set({ rules })
            return reply(`Aturan *${key}* dihapus.`)
        }
        if (sub === 'list') {
            const entries = Object.entries(rules)
            if (!entries.length) return reply('Belum ada aturan autoreply.')
            return reply(`*▢ AUTOREPLY* (${entries.length})\n${entries.map(([k, v]) => `-▢ ${k} → ${v}`).join('\n')}`)
        }
    }

    const extra = await plusHandle(command, sub, value, { cfg, set, reply, p, jid, sock, m, text })
    if (extra !== undefined) return extra

    return reply(status(command, p, jid))
}

handler.command = [
  'guard', 'antilink', 'antidelete', 'antiedit', 'antispam', 'antisticker', 'antiswgc', 'antitagsw',
  'antitoxic', 'antiviewonce', 'autoreply', 'disable', 'enable', 'guardtest', 'notiflevel'
]
handler.as = 'antilink'
// tetap bisa dipanggil langsung, tapi tidak ditampilkan di menu (cukup .enable / .disable)
handler.hide = ['antilink', 'antitoxic', 'antispam', 'antidelete', 'autoreply', 'antisticker', 'antiswgc', 'antitagsw', 'antiviewonce', 'antiedit', 'notiflevel', 'guardtest']
handler.tags = ['group']
handler.group = true
// pengaturan penjaga hanya untuk admin grup (owner otomatis lolos)
handler.admin = true

// fitur tambahan
handler.command.push(...PLUS_FEATURES)
handler.hide.push(...PLUS_FEATURES)

export default handler
