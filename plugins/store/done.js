/**
 * Kaguya Multi Device — Store
 * .done — done barang | nominal (owner) — kirim teks "transaksi done" manual
 * Jam & hari diisi otomatis sesuai waktu saat dikirim (WIB). Tidak terhubung ke data order/produk.
 * Satu file = satu command.
 */

const jamNow = () => new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB'
const hariNow = () => new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

// ===== .done barang | nominal (owner) =====
let handler = async (m, { sock, text, prefix, isOwner, reply: baseReply }) => {
    const p = prefix || '.'
    const body = String(text || '').trim()
    const at = body.indexOf('|')
    const barang = (at < 0 ? body : body.slice(0, at)).trim()
    const nominal = at < 0 ? '' : body.slice(at + 1).trim()

    if (!barang || !nominal) {
        return baseReply(`Format: ${p}done barang | nominal\nContoh: ${p}done Script Kaguya Premium | Rp 50.000`)
    }

    const teks =
        `✅ *TRANSAKSI DONE*\n\n` +
        `🧾 ${barang}\n` +
        `🛍️ ${nominal}\n` +
        `🕐 ${jamNow()}\n` +
        `📅 ${hariNow()}\n\n` +
        `Terima kasih sudah Order! 🙏`

    return sock.sendMessage(m.chat, { text: teks }, { quoted: m })
}

handler.command = ['done']
handler.tags = ['store']
handler.help = ['done']
handler.owner = true

export default handler
