/**
 * Kaguya Multi Device — Store
 * .caritoko — caritoko <kata>
 * Satu file = satu command. Helper bersama: lib/store/toko.js
 */

import { storeReply, rp, pick, row, sendBtn, storeDB, available, stockLabel } from '../../lib/store/merchant.js'
import { CATS, catKey, catOf, autoSeed } from '../../lib/store/catalog.js'
import { PICKER_MAX, homeBtn } from '../../lib/store/toko.js'

// ===== .caritoko <kata> =====
let handler = async (m, { sock, text, command, prefix, isOwner, reply: baseReply }) => {
    const reply = storeReply(sock, m, baseReply)
    const p = prefix || '.'
    const body = (text || '').trim()
    const d = storeDB()
    const send = (o) => sendBtn(sock, m.chat, o, m)
    autoSeed()
    if (!body) return reply(`Format: ${p}caritoko <kata kunci>\nContoh: ${p}caritoko script`)
    const q = body.toLowerCase()
    const found = Object.values(d.products).filter(pr =>
        [pr.code, pr.name, pr.desc, CATS[catKey(pr)].name].some(v => String(v || '').toLowerCase().includes(q)))
    if (!found.length) return send({ text: `Tidak ada produk untuk "${body}".`, buttons: [homeBtn(p)] })
    const ready = found.filter(pr => available(pr) > 0)
    return send({
        text:
            `*HASIL PENCARIAN "${body}"* (${found.length})\n\n` +
            found.slice(0, 15).map(pr => `${catOf(pr).emoji} *${pr.name}*\n   💰 ${rp(pr.price)}  |  📦 ${stockLabel(pr)}`).join('\n\n'),
        buttons: [
            ...(ready.length ? [pick('🍰 Pilih Produk', [{ title: 'Hasil pencarian', rows: ready.slice(0, PICKER_MAX).map(pr => row(`${catOf(pr).emoji} ${pr.name}`.slice(0, 24), `${p}order ${pr.code}`, `${rp(pr.price)} • stok ${stockLabel(pr)}`)) }])] : []),
            homeBtn(p)
        ]
    })
}

handler.command = ['caritoko']
handler.tags = ['store']
handler.help = ['caritoko']

export default handler
