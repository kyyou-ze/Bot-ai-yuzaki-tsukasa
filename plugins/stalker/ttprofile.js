/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const HDR = { 'Content-Type': 'application/json', 'User-Agent': UA, Origin: 'https://omar-thing.site', Referer: 'https://omar-thing.site/' }

// respons worker dikirim dalam hex yang di-encode; dekode sesuai skema situs
function decryptResponse(hex, hint) {
    const pairs = hex.match(/.{2}/g)
    if (!pairs) throw new Error('Format payload tidak valid')
    const enc = Uint8Array.from(pairs.map(h => parseInt(h, 16)))
    const out = new Uint8Array(enc.length)
    for (let i = 0; i < enc.length; i++) {
        let b = enc[i]
        if (i > 0) b ^= enc[i - 1] & 0x3f
        b = ((b >> 3) | (b << 5)) & 0xff
        b ^= (255 - (i % 256)) & 0xff
        b = ((b - 17 + 256) * 43) & 0xff
        b ^= (hint >> (i % 8)) & 0xff
        out[i] = b
    }
    const s = new TextDecoder().decode(out)
    const idx = s.indexOf('\x02\x1F\x03')
    if (idx === -1) throw new Error('Respon gagal didekripsi')
    return JSON.parse(s.slice(idx + 3))
}

async function post(urls, body) {
    let last
    for (const url of urls) {
        try {
            const r = await fetch(url, { method: 'POST', headers: HDR, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) })
            if (r.ok || (r.status < 500 && r.status !== 429)) return r
        } catch (e) { last = e }
    }
    throw last || new Error('Semua endpoint gagal dihubungi')
}

async function inspect(raw) {
    const username = String(raw || '').trim().replace(/^@+/, '')
    if (!/^[\w.]{1,40}$/.test(username)) throw new Error('Username TikTok tidak valid.')
    const seal = await post(['https://dev.omar-thing.site/api/v1/seal', 'https://for.omar-thing.site/api/seal'], { username })
    if (!seal.ok) throw new Error(`Inisialisasi gagal (HTTP ${seal.status})`)
    const sj = await seal.json()
    if (!sj?.s) throw new Error('Token dari server tidak didapat.')
    const w = await post(['https://worker.omar-thing.site/', 'https://for.omar-thing.site/test'], { sealed: sj.s, seal_id: sj.id })
    if (!w.ok) throw new Error(`Akun @${username} tidak ditemukan (HTTP ${w.status})`)
    const j = await w.json()
    const d = j.p && j.h !== undefined ? decryptResponse(j.p, j.h) : j
    if (!d || d.error || !d.nickname) throw new Error(d?.error || `Akun @${username} tidak ditemukan atau private`)
    return d
}

const flag = (cc) => (/^[a-z]{2}$/i.test(cc || '') ? String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))) : '')
const n = (x) => Number(x || 0).toLocaleString('id-ID')
const yes = (v) => v === 'Yes' || v === true

let handler = async (m, { sock, text, reply, prefix, command }) => {
    const u = String(text || '').trim()
    if (!u) return reply(`🎵 *TIKTOK PROFILE*\n\nPenggunaan: *${prefix + command} <username>*\nContoh: ${prefix + command} tiktok`)
    try {
        const d = await inspect(u)
        const s = d.stats || {}
        const region = d.userRegionCode || d.region
        const cap =
            `🎵 *${d.nickname}* (@${d.username || u.replace(/^@/, '')})\n${yes(d.isVerified) ? '✅ Terverifikasi\n' : ''}\n` +
            `• User ID : ${d.userId || '-'}\n• Region : ${flag(region)} ${region || '-'}\n• Bahasa : ${d.language || '-'}\n` +
            `• Dibuat : ${d.accountCreated || '-'}\n• Private : ${yes(d.isPrivate) || d.privateAccount === true ? 'Ya' : 'Tidak'}\n• Live : ${yes(d.isLive) ? 'Sedang live 🔴' : 'Tidak'}\n\n` +
            `👥 Pengikut : ${n(s.followers)}\n➕ Mengikuti : ${n(s.following)}\n❤️ Suka : ${n(s.hearts)}\n🎬 Video : ${n(s.videos)}\n🤝 Teman : ${n(s.friends)}\n` +
            (d.about ? `\n📝 ${String(d.about).slice(0, 300)}` : '') + (d.bioLink ? `\n🔗 ${d.bioLink}` : '')
        if (d.avatar) return sock.sendMessage(m.chat, { image: { url: d.avatar }, caption: cap }, { quoted: m }).catch(() => reply(cap))
        return reply(cap)
    } catch (e) {
        return reply(`❌ ${e.message || 'Gagal mengambil profil'}`)
    }
}

handler.command = ['ttprofile']
handler.help = ['ttprofile <username>']
handler.tags = ['stalker']
handler.limit = true

export default handler
