// .mytoken                  -> ringkasan semua token yang pernah kamu simpan (disamarkan)
// .mytoken reset            -> hapus SEMUA token milikmu
// .mytoken reset <layanan>  -> hapus satu: github | vercel | do | panel
// Mengganti token: cukup set lagi (.settoken / .setvercel / .setdo / .setpanel), data lama otomatis tertimpa.
import { allOwn, delOwn, SERVICES, mask } from '../../lib/core/usercreds.js'

const ALIAS = { github: 'github', gh: 'github', vercel: 'vercel', do: 'digitalocean', digitalocean: 'digitalocean', vps: 'digitalocean', panel: 'panel' }
const CMD = { github: 'settoken', vercel: 'setvercel', digitalocean: 'setdo', panel: 'setpanel' }
const when = (t) => (t ? new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '-')

let handler = async (m, { text, prefix, reply, sender }) => {
    const [sub, which] = String(text || '').trim().toLowerCase().split(/\s+/)

    if (/^(reset|hapus|delete|del)$/.test(sub || '')) {
        if (!which || which === 'all' || which === 'semua') {
            return reply(delOwn(sender) ? '🗑️ Semua token milikmu dihapus. Set lagi kapan saja kalau mau memakainya.' : 'Kamu belum menyimpan token apa pun.')
        }
        const svc = ALIAS[which]
        if (!svc) return reply(`Layanan tidak dikenal. Pilih: github, vercel, do, panel`)
        return reply(delOwn(sender, svc) ? `🗑️ Token ${SERVICES[svc].label} milikmu dihapus.` : `Kamu belum menyimpan token ${SERVICES[svc].label}.`)
    }

    const mine = allOwn(sender)
    const rows = Object.keys(SERVICES).map(svc => {
        const v = mine[svc]
        if (!v) return `• ${SERVICES[svc].label}: belum diset  (${prefix}${CMD[svc]})`
        const main = svc === 'panel' ? `${v.domain} • ${mask(v.plta)}` : mask(v.token)
        return `• ${SERVICES[svc].label}: \`${main}\`\n   diperbarui ${when(v.updatedAt)}`
    })
    return reply(
        `🔑 *TOKEN KAMU*\n\n${rows.join('\n')}\n\n` +
        `Ganti: set lagi dengan token baru (otomatis menimpa).\n` +
        `Reset satu: *${prefix}mytoken reset github*\nReset semua: *${prefix}mytoken reset*\n` +
        `_Token tersimpan permanen, tidak perlu set ulang setelah bot restart._`
    )
}

handler.command = ['mytoken']
handler.help = ['mytoken']
handler.tags = ['tools']

export default handler
