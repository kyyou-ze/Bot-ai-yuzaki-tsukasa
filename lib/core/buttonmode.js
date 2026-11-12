// Mode tombol WhatsApp. Diatur di config.js:
//   global.buttonMode = true   -> mode pakai button (menu, store, dll)
//   global.buttonMode = false  -> mode tanpa button, semua tampil sebagai teks biasa
// Dibaca setiap kali pesan dikirim, jadi ganti nilainya lalu simpan config.js (reload otomatis).

const NO_BUTTON = new Set(['nobutton', 'no-button', 'no_button', 'nobtn', 'off', 'false', '0', 'teks', 'text', 'plain'])

export function isNoButton() {
    const v = global.buttonMode
    if (v === false || v === 0) return true
    if (v === true || v === 1) return false
    // nilai lama (string) tetap dianggap valid: 'nobutton', 'off', dst
    return NO_BUTTON.has(String(v ?? 'true').trim().toLowerCase())
}

const MEDIA_KEYS = ['image', 'video', 'document']
const BUTTON_KEYS = ['nativeFlow', 'buttons', 'interactiveButtons', 'templateButtons']

function parseParams(raw) {
    if (raw && typeof raw === 'object') return raw
    try { return JSON.parse(raw) } catch { return {} }
}

// satu tombol (berbagai format) -> baris teks
function lineOf(b) {
    if (!b || typeof b !== 'object') return ''
    if (b.name && b.buttonParamsJson) {
        const p = parseParams(b.buttonParamsJson)
        if (b.name === 'quick_reply') return `▢ ${p.id || p.display_text || ''}`
        if (b.name === 'cta_url') return `🔗 ${p.display_text}: ${p.url}`
        if (b.name === 'cta_copy') return `📋 ${p.display_text}: ${p.copy_code}`
        if (b.name === 'cta_call') return `📞 ${p.display_text}: ${p.phone_number}`
        if (b.name === 'single_select') {
            return (p.sections || []).flatMap(s => s.rows || []).map(r => `▢ ${r.id || r.title}`).join('\n')
        }
        return ''
    }
    if (b.buttonId) return `▢ ${b.buttonId}`
    if (b.quickReplyButton) return `▢ ${b.quickReplyButton.id || b.quickReplyButton.displayText || ''}`
    if (b.urlButton) return `🔗 ${b.urlButton.displayText || ''}: ${b.urlButton.url || ''}`
    if (b.id) return `▢ ${b.id}`
    if (b.url) return `🔗 ${b.text || b.displayText || ''}: ${b.url}`
    return ''
}

// Dipanggil di setiap sock.sendMessage. Mode button: tidak mengubah apa pun.
// Mode nobutton: isi pesan yang membawa tombol dibuang, daftar tombolnya ditulis ke teks/caption.
export function applyButtonMode(content) {
    if (!content || typeof content !== 'object' || !isNoButton()) return content
    const present = BUTTON_KEYS.filter(k => Array.isArray(content[k]))
    if (!present.length) return content

    const lines = present.flatMap(k => content[k].map(lineOf)).filter(Boolean)
    for (const k of present) delete content[k]
    delete content.headerType

    const key = MEDIA_KEYS.some(k => content[k]) ? 'caption' : 'text'
    content[key] = [content[key], lines.join('\n'), content.footer].filter(v => typeof v === 'string' && v.trim()).join('\n\n') || ' '
    delete content.footer
    return content
}
