/**

* Kaguya Multi Device — WhatsApp & Tele Bot
*
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
*
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

import sharp from 'sharp'
import { buttonsToText } from '../../lib/platform/wa.js'

// .owner | .creator | .kontak | .links
// Kontak owner (vcard) + kartu logo tautan + tombol link, versi Kaguya dari fitur owner.
// Data diambil dari config.js. Isi (opsional) global.links dan global.ownerInfo supaya semua tautan tampil;
// item yang kosong otomatis dilewati.

const FONT = "Poppins, 'DejaVu Sans', Arial, sans-serif"
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const httpUrl = (u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u)

// ── logo vektor (viewBox 48x48) ──
const ICONS = {
    web: (c) => `<circle cx="24" cy="24" r="14" fill="none" stroke="${c}" stroke-width="3"/><ellipse cx="24" cy="24" rx="6" ry="14" fill="none" stroke="${c}" stroke-width="2.5"/><path d="M10 24h28M12.5 16.5h23M12.5 31.5h23" stroke="${c}" stroke-width="2.5" fill="none"/>`,
    group: (c) => `<path d="M24 8a16 16 0 0 0-13.8 24L8 41l9-2.3A16 16 0 1 0 24 8z" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/><path d="M18 17.5c-1 2.4 0 6 3.4 9.6s7 4.6 9.4 3.6l1.2-2.8-3.8-1.8-1.8 1.6c-1.6-.8-3.6-2.8-4.6-4.6l1.6-1.8-1.8-3.8z" fill="${c}"/>`,
    channel: (c) => `<path d="M9 20v8h6l13 8V12L15 20z" fill="${c}"/><path d="M33 18a9 9 0 0 1 0 12M37 14a15 15 0 0 1 0 20" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    donate: (c) => `<path d="M24 39C9 29 7 20 11.5 14.5c3.4-4 9.6-3 12.5 2.5 2.9-5.5 9.1-6.5 12.5-2.5C41 20 39 29 24 39z" fill="${c}"/>`,
    wallet: (c) => `<rect x="8" y="14" width="32" height="24" rx="6" fill="none" stroke="${c}" stroke-width="3"/><path d="M8 20h32" stroke="${c}" stroke-width="3"/><rect x="29" y="25" width="11" height="8" rx="3" fill="${c}"/>`,
    user: (c) => `<circle cx="24" cy="17" r="8" fill="${c}"/><path d="M8 40c1-9 8-13 16-13s15 4 16 13z" fill="${c}"/>`
}

// ── data owner & tautan (config.js -> fallback) ──
function ownerData() {
    const number = String(global.ownerInfo?.number || global.owners?.[0] || '').replace(/\D/g, '')
    const name = global.ownerInfo?.name || global.ownername || 'Owner'
    return {
        number,
        name,
        display: global.ownerInfo?.display || (number ? `+${number}` : '-'),
        dana: global.ownerInfo?.dana || ''
    }
}

function linkData() {
    const L = global.links || {}
    return {
        website: L.website || 'https://api.yannrzy.my.id',
        group: L.group || 'https://chat.whatsapp.com/DupnUe1SuIqC9UFKwxyX1V',
        channel: L.channel || 'https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16',
        saweria: L.saweria || 'https://www.saweria.co/sajiyanxyz',
        telegram: L.telegram || 'https://t.me/yanncoder'
    }
}

function cardItems(O, L) {
    const items = [
        { ic: 'web', col: '#38bdf8', label: 'WEBSITE', val: String(L.website).replace(/^https?:\/\//, '') },
        { ic: 'group', col: '#22c55e', label: 'GRUP WHATSAPP', val: L.group && 'Gabung komunitas' },
        { ic: 'channel', col: '#a78bfa', label: 'SALURAN', val: L.channel && 'Ikuti info terbaru' },
        { ic: 'donate', col: '#fb7185', label: 'SAWERIA', val: L.saweria && 'Dukung developer' },
        { ic: 'wallet', col: '#3b82f6', label: 'DANA', val: O.dana },
        { ic: 'user', col: '#fbbf24', label: 'OWNER', val: `${O.name}  |  ${O.display}` }
    ]
    return items.filter(i => i.val)
}

async function linksCard(botname, O, L) {
    const items = cardItems(O, L)
    const rows = Math.ceil(items.length / 2)
    const W = 1000, H = 128 + rows * 126 + 76
    let cells = ''
    items.forEach((it, i) => {
        const col = i % 2, row = Math.floor(i / 2), x = 52 + col * 448, y = 128 + row * 126
        cells += `<g>
      <rect x="${x}" y="${y}" width="436" height="108" rx="18" fill="#00000033" stroke="${it.col}" stroke-opacity="0.55" stroke-width="2"/>
      <circle cx="${x + 56}" cy="${y + 50}" r="34" fill="${it.col}" fill-opacity="0.16" stroke="${it.col}" stroke-opacity="0.8" stroke-width="2"/>
      <g transform="translate(${x + 56 - 20},${y + 50 - 20}) scale(0.84)">${ICONS[it.ic](it.col)}</g>
      <text x="${x + 110}" y="${y + 40}" font-family="${FONT}" font-size="14" font-weight="700" fill="${it.col}" letter-spacing="2">${it.label}</text>
      <text x="${x + 110}" y="${y + 70}" font-family="${FONT}" font-size="${it.val.length > 24 ? 17 : 21}" font-weight="700" fill="#fff">${esc(it.val)}</text>
    </g>`
    })
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#1a1330"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="28" fill="none" stroke="#d4af37" stroke-width="3"/>
  <text x="64" y="72" font-family="${FONT}" font-size="34" font-weight="700" fill="#d4af37" letter-spacing="3">${esc(String(botname).toUpperCase())}</text>
  <text x="64" y="102" font-family="${FONT}" font-size="15" font-weight="600" fill="#9ca3af" letter-spacing="4">OWNER &amp; TAUTAN RESMI</text>
  ${cells}
  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="#9ca3af" letter-spacing="2">TEKAN TOMBOL TAUTAN &amp; KONTAK DI BAWAH PESAN</text>
  </svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
}

function buildButtons(O, L) {
    const b = []
    if (O.number) b.push({ type: 'url', text: 'Chat Owner', url: `https://wa.me/${O.number}` })
    if (L.website) b.push({ type: 'url', text: 'Website', url: httpUrl(L.website) })
    if (L.group) b.push({ type: 'url', text: 'Grup WhatsApp', url: httpUrl(L.group) })
    if (L.channel) b.push({ type: 'url', text: 'Saluran WhatsApp', url: httpUrl(L.channel) })
    if (L.telegram) b.push({ type: 'url', text: 'Telegram', url: httpUrl(L.telegram) })
    if (L.saweria) b.push({ type: 'url', text: 'Saweria', url: httpUrl(L.saweria) })
    if (O.dana) b.push({ type: 'copy', text: 'Salin Nomor DANA', code: O.dana, id: 'copy_dana' })
    return b
}

let handler = async (m, { sock, jid, reply }) => {
    const O = ownerData(), L = linkData(), botname = global.namebot || 'Kaguya MD'

    if (O.number) {
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${O.name}\nORG:${botname}\nTEL;type=CELL;type=VOICE;waid=${O.number}:+${O.number}\nEND:VCARD`
        await sock.sendMessage(jid, { contacts: { displayName: O.name, contacts: [{ vcard }] } }, { quoted: m })
    }

    const info = [
        '*INFORMASI OWNER*',
        '',
        `  Nama     : ${O.name}`,
        `  WhatsApp : ${O.display}`,
        ...(O.dana ? [`  DANA     : ${O.dana}`] : []),
        `  Website  : ${L.website}`,
        ...(L.group ? [`  Grup     : ${L.group}`] : []),
        ...(L.channel ? [`  Saluran  : ${L.channel}`] : []),
        ...(L.saweria ? [`  Saweria  : ${L.saweria}`] : []),
        '',
        `_Dukungan kamu membantu ${botname} terus berkembang._`
    ].join('\n')

    const buttons = buildButtons(O, L)

    try {
        const image = await linksCard(botname, O, L)
        await sock.sendButtons(jid, { text: info, footer: botname, image, buttons }, { quoted: m })
    } catch (e) {
        console.error('[OWNERINFO]', e.message)
        // tombol/kartu gagal -> teks + daftar link biasa
        const links = buttonsToText(buttons)
        await reply(links ? `${info}\n\n${links}` : info)
    }
}

handler.command = ['owner']
handler.tags = ['main']

export default handler
