// .encfile (reply file .js / .ts)
// Obfuscate file JS tingkat ekstrem (control flow flattening, dead code, string array RC4, self-defending).
import path from 'path'
import { reactTo } from '../../lib/core/file.js'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const BAR = (p) => '█'.repeat(p / 10) + '▒'.repeat(10 - p / 10)
const title = () => `⚡ *ULTRA HARD ENCRYPT — ${global.namebot || 'Kaguya MD'}* ⚡`

const card = (percent, note, dot = '🔴') =>
    `${title()}\n\n🔐 *Proses Penguncian Skrip*\n[ ${BAR(percent)} ] *${percent}%*\n> ${dot} ${note}`

let handler = async (m, { sock, prefix, command, reply }) => {
    const q = m.quoted
    if (!q) return reply(`Reply file *.js* atau *.ts* dulu, lalu ketik *${prefix || '.'}${command}*`)

    const originalName = q.fileName || q.documentMessage?.fileName || `file_${Date.now()}.js`
    const ext = path.extname(originalName).toLowerCase()
    if (ext !== '.js' && ext !== '.ts') {
        return reply('Mode *Hard Encrypt Anti-Bypass* khusus untuk file berformat *.js* atau *.ts*.')
    }

    let JavaScriptObfuscator
    try {
        JavaScriptObfuscator = (await import('javascript-obfuscator')).default
    } catch {
        return reply('Modul javascript-obfuscator belum terpasang. Jalankan: npm i javascript-obfuscator')
    }

    const edit = (key, text) => sock.sendMessage(m.chat, { text, edit: key }).catch(() => {})

    try {
        await reactTo(sock, m, '🔃')
        const sent = await sock.sendMessage(m.chat, { text: card(0, 'Mengunduh file script...') }, { quoted: m })

        let buffer
        try { buffer = await q.download() } catch (e) { console.error('[encfile] gagal download:', e?.message || e) }
        if (!buffer?.length) {
            await reactTo(sock, m, '❌')
            return edit(sent.key, '❌ Gagal mengunduh file-nya, coba reply ulang file-nya.')
        }

        await edit(sent.key, card(40, 'Menerapkan Control Flow Flattening & Dead Code Injection...'))
        await sleep(500)

        const result = JavaScriptObfuscator.obfuscate(buffer.toString('utf8'), {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 1,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            debugProtection: true,
            disableConsoleOutput: false,
            identifierNamesGenerator: 'hexadecimal',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: true,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 3,
            stringArray: true,
            stringArrayCallsTransform: true,
            stringArrayCallsTransformThreshold: 1,
            stringArrayEncoding: ['rc4'],
            stringArrayIndexShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 5,
            stringArrayWrappersChainedCalls: true,
            stringArrayWrappersParametersMaxCount: 5,
            stringArrayWrappersType: 'function',
            stringArrayThreshold: 1
        })
        const output = Buffer.from(result.getObfuscatedCode(), 'utf8')

        await edit(sent.key, card(80, 'Menanamkan proteksi Anti-Tamper & Self-Defending...', '🟡'))
        await sleep(500)
        await edit(sent.key, card(100, 'Berhasil! Mengirim file aman ke chat...', '🟢'))

        const newName = `Secure-Hard-${originalName}`
        await sock.sendMessage(m.chat, {
            document: output,
            mimetype: 'application/javascript',
            fileName: newName,
            caption: `⚡ *HARD ENCRYPT ANTI-BYPASS BERHASIL* ⚡\n\n📁 Nama File : *${newName}*\n🔒 Status    : Terkunci Rapat\n\n— ${global.namebot || 'Kaguya MD'}`
        }, { quoted: m })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error(e)
        await reactTo(sock, m, '☢')
        reply(`❌ Terjadi kesalahan sistem: ${e.message}`)
    }
}

handler.command = ['encfile']
handler.help = ['encfile (reply file js)']
handler.tags = ['tools']
handler.limit = true

export default handler
