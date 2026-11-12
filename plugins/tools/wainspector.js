// .wainspector 081234567890              cek format, kategori nomor (Mewah / Old / Regular), terdaftar di WhatsApp, dan bio
// .wainspector 0812xxxx, 0813xxxx        beberapa nomor sekaligus (pisah koma / baris baru, maksimal 10)
// Terdaftar & bio diambil dari WhatsApp sungguhan (onWhatsApp / fetchStatus). Kategori memakai pola angka.
const MAX_NUMBERS = 10

function formatPhoneNumber(rawNumber, defaultCountry = '62') {
    let cleaned = String(rawNumber).replace(/[^\d+]/g, '')
    if (!cleaned) return { valid: false, number: rawNumber }
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1)
    else if (cleaned.startsWith('00')) cleaned = cleaned.substring(2)
    else if (cleaned.startsWith('0')) cleaned = defaultCountry + cleaned.substring(1)
    else if (!cleaned.startsWith(defaultCountry) && cleaned.length <= 12) cleaned = defaultCountry + cleaned
    if (cleaned.length < 8 || cleaned.length > 15) return { valid: false, number: rawNumber }
    return { valid: true, number: '+' + cleaned }
}

// nomor cantik: 4 angka kembar, deret naik/turun, atau pasangan berulang
function checkIsMewah(numberStr) {
    const tail = String(numberStr).replace(/\+/g, '').slice(-6)
    return /(\d)\1{3,}/.test(tail) || /0123|1234|2345|3456|4567|5678|6789|9876|8765|7654/.test(tail) || /(\d\d)\1{2,}/.test(tail)
}

// prefix lawas Indonesia (811, 812, 813, 816, 817, 818, 852, 838) atau total digit <= 11
function checkIsOldNumber(numberStr) {
    const n = String(numberStr).replace(/\+/g, '')
    if (n.startsWith('62') && ['811', '812', '813', '816', '817', '818', '852', '838'].includes(n.substring(2, 5))) return true
    return n.length <= 11
}

const bioOf = (st) => {
    if (!st) return null
    const x = Array.isArray(st) ? st[0] : st
    const v = typeof x?.status === 'string' ? x.status : x?.status?.status
    return v ? String(v) : null
}

let handler = async (m, { sock, text, reply, prefix, command }) => {
    const p = prefix || '.'
    const list = String(text || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
    if (!list.length) {
        return reply(`🔎 *WA Inspector*\n\nContoh:\n• ${p}${command} 081234567890\n• ${p}${command} 0812xxxx, 0813xxxx (maks ${MAX_NUMBERS} nomor)`)
    }
    if (list.length > MAX_NUMBERS) return reply(`⚠️ Maksimal ${MAX_NUMBERS} nomor sekali cek.`)

    const rows = []
    for (const [i, raw] of list.entries()) {
        const f = formatPhoneNumber(raw)
        if (!f.valid) { rows.push(`${i + 1}. ${raw}\n   ❌ Format nomor salah`); continue }

        const clean = f.number.replace(/\+/g, '')
        const kategori = []
        if (checkIsMewah(f.number)) kategori.push('Mewah')
        if (checkIsOldNumber(f.number)) kategori.push('Old')
        if (!kategori.length) kategori.push('Regular')

        let registered = null, bio = null
        try {
            const r = await sock.onWhatsApp(`${clean}@s.whatsapp.net`)
            const hit = Array.isArray(r) ? r[0] : null
            registered = !!hit?.exists
            if (registered) bio = bioOf(await sock.fetchStatus(hit.jid || `${clean}@s.whatsapp.net`).catch(() => null))
        } catch { registered = null }

        rows.push(
            `${i + 1}. ${f.number}\n` +
            `   📂 Kategori: ${kategori.join(' + ')}\n` +
            `   ${registered === null ? '❓ Status: gagal dicek' : registered ? '✅ Terdaftar di WhatsApp' : '🚫 Tidak terdaftar di WhatsApp'}` +
            (registered ? `\n   💬 Bio: ${bio || '(kosong / disembunyikan)'}\n   🔗 https://wa.me/${clean}` : '')
        )
        if (i < list.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    return reply(`🔎 *WA INSPECTOR*\n\n${rows.join('\n\n')}`)
}

handler.command = ['wainspector']
handler.help = ['wainspector <nomor>']
handler.tags = ['tools']
handler.limit = true

export default handler
