import { updateConfigBlock } from '../../lib/core/file.js'
import { describePrefix, getPrefixes, normalizePrefixToken } from '../../lib/engine/plugins.js'

const formatList = (list) => list.map(p => `*${describePrefix(p)}*`).join('  ')

function usage(prefix, command, current) {
    return (
        `Format: *${prefix}${command} <prefix>*\n\n` +
        `Bisa lebih dari satu sekaligus dipisah spasi, maksimal 5 karakter per prefix.\n` +
        `Untuk prefix kosong (bot bisa dipanggil tanpa prefix) ketik *""* atau *kosong*.\n\n` +
        `Contoh:\n${prefix}${command} #\n${prefix}${command} ""\n${prefix}${command} ! $ /\n\n` +
        `Prefix saat ini: ${formatList(current)}`
    )
}

function persist(next, previous) {
    global.prefix = next
    if (updateConfigBlock('prefix', next)) return true
    global.prefix = previous
    return false
}

let handler = async (m, { command, text, reply, prefix }) => {
    const current = getPrefixes()
    const tokens = (text || '').trim().split(/\s+/).filter(Boolean)

    if (!tokens.length) return reply(usage(prefix, command, current))

    const parsed = tokens.map(token => ({ token, value: normalizePrefixToken(token) }))
    const invalid = parsed.filter(p => p.value === null).map(p => p.token)

    if (invalid.length) {
        return reply(`[ ! ] Prefix gak valid: ${invalid.map(t => `*${t}*`).join(', ')}\n\nPrefix maksimal 5 karakter dan tanpa spasi.`)
    }

    const requested = [...new Set(parsed.map(p => p.value))]

    if (command === 'addprefix') {
        const added = requested.filter(p => !current.includes(p))
        const existing = requested.filter(p => current.includes(p))

        if (!added.length) return reply(`[ ! ] Prefix ${formatList(existing)} sudah ada.\n\nPrefix saat ini: ${formatList(current)}`)

        const next = [...current, ...added]
        if (!persist(next, current)) return reply('[ ! ] Blok global.prefix gak ketemu di config.js, jadi perubahan dibatalkan.')

        return reply(
            `Prefix ${formatList(added)} berhasil ditambahkan.` +
            (existing.length ? `\nSudah ada sebelumnya: ${formatList(existing)}` : '') +
            `\n\nPrefix saat ini: ${formatList(next)}`
        )
    }

    const removed = requested.filter(p => current.includes(p))
    const missing = requested.filter(p => !current.includes(p))

    if (!removed.length) return reply(`[ ! ] Prefix ${formatList(missing)} gak ada di daftar.\n\nPrefix saat ini: ${formatList(current)}`)

    const next = current.filter(p => !removed.includes(p))
    if (!next.length) return reply('[ ! ] Gak bisa hapus semua prefix, minimal harus ada satu.')

    if (!persist(next, current)) return reply('[ ! ] Blok global.prefix gak ketemu di config.js, jadi perubahan dibatalkan.')

    return reply(
        `Prefix ${formatList(removed)} berhasil dihapus.` +
        (missing.length ? `\nTidak ada di daftar: ${formatList(missing)}` : '') +
        `\n\nPrefix saat ini: ${formatList(next)}`
    )
}

handler.command = ['prefix', 'addprefix', 'delprefix']
handler.as = 'addprefix'
handler.tags = ['owner']
handler.owner = true

export default handler
