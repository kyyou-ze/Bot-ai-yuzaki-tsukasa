const MAX_CODE = 60000
const BYTE_KEYS_CLEAN = new Set(['jpegThumbnail', 'thumbnail', 'thumbnailDirectPath', 'thumbnailSha256', 'thumbnailEncSha256'])

function isBytes(v) {
    return Buffer.isBuffer(v) || v instanceof Uint8Array ||
        (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data))
}

function isLong(v) {
    return v && typeof v === 'object' && !isBytes(v) &&
        typeof v.low === 'number' && typeof v.high === 'number' &&
        Object.keys(v).every(k => k === 'low' || k === 'high' || k === 'unsigned')
}

function longToNumber(v) {
    try {
        const n = (BigInt(v.high) << 32n) + BigInt(v.low >>> 0)
        const num = Number(n)
        return Number.isSafeInteger(num) ? num : String(n)
    } catch {
        return 0
    }
}

function toBase64(v) {
    return Buffer.from(v.data ?? v).toString('base64')
}

function prune(node, clean) {
    if (node === null || node === undefined) return undefined
    if (isLong(node)) return longToNumber(node)
    if (Array.isArray(node)) return node.map(n => prune(n, clean)).filter(v => v !== undefined)
    if (typeof node === 'object' && !isBytes(node)) {
        const out = {}
        for (const [k, v] of Object.entries(node)) {
            if (clean && (k === 'contextInfo' || BYTE_KEYS_CLEAN.has(k))) continue
            const p = prune(v, clean)
            if (p === undefined) continue
            if (Array.isArray(p) && !p.length) continue
            if (p && typeof p === 'object' && !isBytes(p) && !Object.keys(p).length) continue
            if (typeof p === 'string' && p === '' ) continue
            out[k] = p
        }
        return out
    }
    if (isBytes(node) && !toBase64(node)) return undefined
    return node
}

function safeKey(k) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k)
}

function toLiteral(node, depth = 0) {
    const pad = '  '.repeat(depth)
    const padIn = '  '.repeat(depth + 1)
    if (node === undefined) return 'undefined'
    if (node === null) return 'null'
    const t = typeof node
    if (t === 'string') return JSON.stringify(node)
    if (t === 'number' || t === 'boolean') return String(node)
    if (t === 'bigint') return `${node}n`
    if (isBytes(node)) return `Buffer.from(${JSON.stringify(toBase64(node))}, "base64")`
    if (Array.isArray(node)) {
        if (!node.length) return '[]'
        return '[\n' + node.map(n => padIn + toLiteral(n, depth + 1)).join(',\n') + '\n' + pad + ']'
    }
    if (t === 'object') {
        const entries = Object.entries(node).filter(([, v]) => v !== undefined)
        if (!entries.length) return '{}'
        return '{\n' + entries.map(([k, v]) => `${padIn}${safeKey(k)}: ${toLiteral(v, depth + 1)}`).join(',\n') + '\n' + pad + '}'
    }
    return String(node)
}

function buildCode(message) {
    const body = toLiteral(message, 0)
        .split('\n')
        .map(l => (l.length ? '  ' + l : l))
        .join('\n')
    return '=> sock.relayMessage(\n  m.chat,\n' + body + ',\n  {}\n)'
}

let handler = async (m, { sock, text, jid, reply, example }) => {
    const raw = m.quoted?.forwardable?.message
    if (!raw) return example('(reply pesan yang mau diambil kodenya)  [--clean]')

    const clean = /(^|\s)--clean\b/i.test(text || '')

    try {
        const message = prune(raw, clean)
        if (!message || !Object.keys(message).length) return reply('Isi pesan kosong, tidak ada yang bisa diambil.')

        const code = buildCode(message)
        if (code.length > MAX_CODE) {
            return reply(`Kode terlalu panjang (${code.length} karakter, batas ${MAX_CODE}). Coba pakai *--clean* untuk membuang thumbnail dan contextInfo.`)
        }

        return sock.sendMessage(jid, { text: code }, { quoted: m })
    } catch (e) {
        console.error(e)
        return reply(`Gagal membuat kode: ${e.message}`)
    }
}

handler.help = ['crm']
handler.command = ['crm']
handler.tags = ['owner']
handler.owner = true

export default handler
