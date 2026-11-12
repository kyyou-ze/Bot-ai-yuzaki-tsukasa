import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const pluginDir = path.resolve(path.dirname(__filename), '..')
const TITLE = 'Plugin Manager'

const USAGE = `*Cara pakai*

1) Lewat file .js
Kirim / reply file .js lalu ketik:
.addplugin
.addplugin tools/nama.js
.addplugin tools  (nama file ikut aslinya)

2) Lewat kode ketikan
.addplugin tools/halo.js
import ...
let handler = async (m, { sock }) => { ... }
handler.command = ['halo']
export default handler

3) Reply pesan berisi kode
.addplugin tools/halo.js

Nama file saja sudah cukup, bot cari sendiri foldernya:
.addplugin menu.js  (timpa plugins/main/menu.js)
.editplugin menu.js
.getplugin menu.js
.delplugin menu.js

File baru tanpa folder masuk ke plugins/custom/

Singkatan: .ap .ep .gp .dp .lp

Edit plugin yang sudah ada:
.editplugin tools/halo.js  (tanpa isi = tampilkan kode sekarang)
.editplugin tools/halo.js
<kode baru>  (timpa seluruh file, bisa juga kirim / reply file .js)
.editplugin tools/halo.js teks lama => teks baru  (ganti sebagian)

Ambil file plugin:
.getplugin tools/halo.js  (kirim file plugin-nya)
.getplugin halo  (bisa juga pakai nama file / nama command)
.getplugin tools  (tampilkan isi folder)

Lainnya:
.delplugin tools/halo.js
.listplugin`

function resolvePlugin(input = '') {
    let name = input.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!name || !/^[\w\-./]+$/.test(name)) return null
    if (!name.endsWith('.js')) name += '.js'
    if (!name.includes('/')) name = 'custom/' + name
    const full = path.resolve(pluginDir, name)
    if (!full.startsWith(pluginDir + path.sep)) return null
    return full
}

function walk(dir) {
    let out = []
    if (!fs.existsSync(dir)) return out
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name)
        if (item.isDirectory()) out.push(...walk(full))
        else if (item.name.endsWith('.js')) out.push(full)
    }
    return out
}

const rel = file => path.relative(pluginDir, file).replace(/\\/g, '/')
// kunci plugin di global.plugins (sama dengan loader di lib/engine/plugins.js)
const keyOf = file => '/' + rel(file)

function pickDoc(m) {
    if (m.mtype === 'documentMessage') return { fileName: m.msg?.fileName || '', download: m.download }
    if (m.quoted?.mtype === 'documentMessage') return { fileName: m.quoted.fileName || '', download: m.quoted.download }
    return null
}

function cleanCode(code = '') {
    return code
        .replace(/^\s*```[a-z]*[ \t]*\r?\n?/i, '')
        .replace(/\r?\n?```\s*$/, '')
        .trim()
}

async function addPlugin(m, { prefix, firstToken, rest, notifReply }) {
    const doc = pickDoc(m)
    let name, code

    if (doc) {
        if (!doc.fileName.endsWith('.js') && !firstToken.endsWith('.js')) {
            return notifReply('File harus berformat .js', TITLE)
        }
        name = firstToken.endsWith('.js')
            ? firstToken
            : firstToken ? `${firstToken}/${doc.fileName}` : doc.fileName
        code = (await doc.download()).toString('utf8')
    } else {
        if (!firstToken) return notifReply(USAGE, TITLE)
        name = firstToken
        code = rest || m.quoted?.text || ''
    }

    const { target, ambiguous, invalid } = resolveAdd(name)
    if (ambiguous) {
        return notifReply(`Ada ${ambiguous.length} file dengan nama itu, tulis path lengkap:\n\n${ambiguous.map(rel).join('\n')}`, TITLE)
    }
    if (invalid) return notifReply('Nama / path plugin tidak valid. Pakai huruf, angka, _ - . dan /', TITLE)

    code = cleanCode(code)
    if (!code) return notifReply(USAGE, TITLE)
    if (!/export\s+default/.test(code)) {
        return notifReply('Plugin harus punya `export default handler`.', TITLE)
    }
    if (target === __filename) {
        return notifReply('Plugin manager tidak bisa ditimpa lewat command ini.', TITLE)
    }

    fs.mkdirSync(path.dirname(target), { recursive: true })
    const existed = fs.existsSync(target)
    const backup = existed ? fs.readFileSync(target) : null
    fs.writeFileSync(target, code)

    let plugin
    try {
        const mod = await import(`${pathToFileURL(target).href}?update=${Date.now()}`)
        plugin = mod.default
        if (!plugin) throw new Error('Plugin tidak punya export default')
    } catch (e) {
        if (backup) fs.writeFileSync(target, backup)
        else fs.unlinkSync(target)
        return notifReply(`Gagal load plugin, dibatalkan${existed ? ' (file lama dikembalikan)' : ''}.\n\n${e.name}: ${e.message}`, TITLE)
    }
    global.plugins[keyOf(target)] = plugin // langsung aktif, watcher ikut me-reload

    const p = prefix || '.'
    const cmds = (Array.isArray(plugin.command) ? plugin.command : plugin.command ? [plugin.command] : [])
        .filter(c => typeof c === 'string').map(c => p + c)
    await notifReply(
        `✅ Plugin ${existed ? 'diperbarui' : 'ditambahkan'}\n\n📁 plugins/${rel(target)}\n` +
        (cmds.length ? `⌨️ ${cmds.join(', ')}` : ''),
        TITLE
    )
}

// cari file plugin: kalau ada "/" pakai path persis, kalau nama file saja cari di semua folder
function findTarget(input = '') {
    const clean = input.replace(/\\/g, '/').replace(/^\/+/, '')
    if (!clean) return { target: null }

    if (clean.includes('/')) {
        const target = resolvePlugin(clean)
        return { target: target && fs.existsSync(target) ? target : null }
    }

    if (!/^[\w\-.]+$/.test(clean)) return { target: null }
    const base = clean.endsWith('.js') ? clean : clean + '.js'
    const found = walk(pluginDir).filter(f => path.basename(f) === base)
    if (found.length > 1) return { ambiguous: found }
    return { target: found[0] || null }
}

// khusus add: pakai file yang sudah ada kalau ketemu, kalau tidak buat baru (tanpa folder -> custom/)
function resolveAdd(name) {
    const { target, ambiguous } = findTarget(name)
    if (ambiguous) return { ambiguous }
    if (target) return { target }
    const fresh = resolvePlugin(name)
    return fresh ? { target: fresh } : { invalid: true }
}

// tulis kode ke file lalu load; kalau gagal load, file dikembalikan seperti semula
async function writeAndLoad(target, code) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const existed = fs.existsSync(target)
    const backup = existed ? fs.readFileSync(target) : null
    fs.writeFileSync(target, code)

    try {
        const mod = await import(`${pathToFileURL(target).href}?update=${Date.now()}`)
        if (!mod.default) throw new Error('Plugin tidak punya export default')
        global.plugins[keyOf(target)] = mod.default // langsung aktif, watcher ikut me-reload
        return { ok: true, existed, plugin: mod.default }
    } catch (e) {
        if (backup) fs.writeFileSync(target, backup)
        else fs.unlinkSync(target)
        return { ok: false, existed, error: e }
    }
}

const commandsOf = (plugin, p) =>
    (Array.isArray(plugin.command) ? plugin.command : plugin.command ? [plugin.command] : [])
        .filter(c => typeof c === 'string').map(c => p + c)

async function editPlugin(m, { prefix, firstToken, rest, notifReply, sock }) {
    if (!firstToken) return notifReply(USAGE, TITLE)

    const { target, ambiguous } = findTarget(firstToken)
    if (ambiguous) {
        return notifReply(`Ada ${ambiguous.length} file dengan nama itu, tulis path lengkap:\n\n${ambiguous.map(rel).join('\n')}`, TITLE)
    }
    if (!target) return notifReply('Plugin tidak ditemukan. Cek nama lewat .listplugin, atau pakai .addplugin untuk membuat baru.', TITLE)
    if (target === __filename) return notifReply('Plugin manager tidak bisa diedit lewat command ini.', TITLE)

    const doc = pickDoc(m)
    const body = (rest || '').trim()
    const quotedText = m.quoted?.text || ''

    // ── mode 1: lihat kode sekarang ──
    if (!doc && !body && !quotedText) {
        const current = fs.readFileSync(target, 'utf8')
        if (current.length <= 3000) return notifReply(`📁 plugins/${rel(target)}\n\n\`\`\`${current}\`\`\``, TITLE)
        return sock.sendMessage(m.chat, {
            document: Buffer.from(current),
            fileName: path.basename(target),
            mimetype: 'application/javascript',
            caption: `📁 plugins/${rel(target)}`
        }, { quoted: m })
    }

    let code
    let mode = 'timpa'

    if (doc) {
        if (!doc.fileName.endsWith('.js')) return notifReply('File harus berformat .js', TITLE)
        code = (await doc.download()).toString('utf8')
    } else {
        const raw = cleanCode(body || quotedText)
        const replaceMatch = body && !/export\s+default/.test(raw) ? raw.match(/^([^\n]+?)\s*=>\s*([\s\S]*)$/) : null

        if (replaceMatch) {
            // ── mode 2: ganti sebagian ──
            const [, from, to] = replaceMatch
            const current = fs.readFileSync(target, 'utf8')
            if (!current.includes(from)) return notifReply(`Teks yang dicari tidak ketemu:\n${from}`, TITLE)
            const count = current.split(from).length - 1
            code = current.split(from).join(to)
            mode = `ganti ${count} bagian`
        } else {
            code = raw
        }
    }

    code = cleanCode(code)
    if (!code) return notifReply(USAGE, TITLE)
    if (!/export\s+default/.test(code)) return notifReply('Plugin harus punya `export default handler`.', TITLE)

    const result = await writeAndLoad(target, code)
    if (!result.ok) {
        return notifReply(`Gagal load plugin, perubahan dibatalkan (file lama dikembalikan).\n\n${result.error.name}: ${result.error.message}`, TITLE)
    }

    const cmds = commandsOf(result.plugin, prefix || '.')
    await notifReply(
        `✏️ Plugin diedit (${mode})\n\n📁 plugins/${rel(target)}\n` +
        (cmds.length ? `⌨️ ${cmds.join(', ')}` : ''),
        TITLE
    )
}

async function getPlugin(m, { prefix, firstToken, notifReply, sock }) {
    if (!firstToken) return notifReply('Contoh:\n.getplugin tools/halo.js\n.getplugin halo  (nama file atau nama command)\n.getplugin tools  (tampilkan isi folder)', TITLE)

    // folder -> tampilkan isi, pilih salah satu
    const dirPath = path.resolve(pluginDir, firstToken.replace(/\\/g, '/').replace(/^\/+/, ''))
    if (dirPath.startsWith(pluginDir + path.sep) && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const files = walk(dirPath).map(rel).sort()
        if (!files.length) return notifReply('Folder itu kosong.', TITLE)
        return notifReply(`📂 plugins/${rel(dirPath)}/\n\n${files.map(f => `• ${f}`).join('\n')}\n\nAmbil salah satu:\n${prefix || '.'}getplugin ${files[0]}`, TITLE)
    }

    let { target, ambiguous } = findTarget(firstToken)
    if (ambiguous) {
        return notifReply(`Ada ${ambiguous.length} file dengan nama itu, tulis path lengkap:\n\n${ambiguous.map(rel).join('\n')}`, TITLE)
    }

    // tidak ketemu sebagai file -> cari berdasarkan nama command
    if (!target) {
        const cmd = firstToken.replace(/\.js$/i, '').toLowerCase()
        const hits = Object.entries(global.plugins || {})
            .filter(([, pl]) => pl && commandsOf(pl, '').some(c => c.toLowerCase() === cmd))
            .map(([key]) => path.join(pluginDir, key.replace(/^[\\/]+/, '')))
            .filter(f => fs.existsSync(f))
        if (hits.length > 1) {
            return notifReply(`Command itu ada di ${hits.length} file, tulis path lengkap:\n\n${hits.map(rel).join('\n')}`, TITLE)
        }
        target = hits[0] || null
    }

    if (!target) return notifReply('Plugin tidak ditemukan. Cek nama lewat .listplugin', TITLE)

    await sock.sendMessage(m.chat, {
        document: fs.readFileSync(target),
        fileName: path.basename(target),
        mimetype: 'application/javascript',
        caption: `📁 plugins/${rel(target)}`
    }, { quoted: m })
}

async function delPlugin(m, { firstToken, notifReply }) {
    if (!firstToken) return notifReply('Contoh:\n.delplugin menu.js\n.delplugin main/menu.js', TITLE)

    const { target, ambiguous } = findTarget(firstToken)
    if (ambiguous) {
        return notifReply(`Ada ${ambiguous.length} file dengan nama itu, tulis path lengkap:\n\n${ambiguous.map(rel).join('\n')}`, TITLE)
    }
    if (!target) return notifReply('Plugin tidak ditemukan.', TITLE)
    if (target === __filename) return notifReply('Plugin manager tidak bisa dihapus lewat command ini.', TITLE)

    delete global.plugins[keyOf(target)]
    fs.unlinkSync(target)
    await notifReply(`🗑️ Plugin dihapus\n\n📁 plugins/${rel(target)}`, TITLE)
}

async function listPlugin(m, { notifReply }) {
    const groups = {}
    for (const f of walk(pluginDir).map(rel).sort()) {
        const dir = path.dirname(f)
        ;(groups[dir] ||= []).push(path.basename(f))
    }
    const text = Object.entries(groups)
        .map(([dir, files]) => `*${dir}/*\n${files.map(f => `• ${f}`).join('\n')}`)
        .join('\n\n')
    await notifReply(text || 'Belum ada plugin.', TITLE)
}

// command singkat -> command lengkap
const SHORT = {
    ap: 'addplugin',
    dp: 'delplugin',
    ep: 'editplugin',
    gp: 'getplugin',
    lp: 'listplugin'
}

let handler = async (m, { sock, prefix, command: rawCommand, text }) => {
    const command = SHORT[rawCommand] || rawCommand
    const notifReply = (t, title = 'Notification') => sock.sendMessage(m.chat, { text: `*${title}*\n\n${t}` }, { quoted: m })
    try {
        const raw = (text || '').replace(/^\s+/, '')
        const firstToken = raw.match(/^\S*/)[0]
        const rest = raw.slice(firstToken.length).replace(/^[ \t]*\r?\n?/, '')
        const ctx = { prefix, firstToken, rest, notifReply, sock }

        if (/^add/.test(command)) return await addPlugin(m, ctx)
        if (/^edit/.test(command)) return await editPlugin(m, ctx)
        if (/^del/.test(command)) return await delPlugin(m, ctx)
        if (/^get/.test(command)) return await getPlugin(m, ctx)
        return await listPlugin(m, ctx)
    } catch (e) {
        console.error(e)
        await notifReply(`${e.name}: ${e.message}`, 'Plugin Error')
    }
}

handler.command = ['plugin', 'addplugin', 'delplugin', 'editplugin', 'getplugin', 'listplugin'] // .plugin addplugin <path> ...
handler.subs = Object.keys(SHORT) // .ap .dp .ep .gp .lp — alias singkat, tidak tampil di menu
handler.as = 'listplugin'   // .plugin saja = daftar plugin
handler.tags = ['owner']
handler.owner = true

export default handler
