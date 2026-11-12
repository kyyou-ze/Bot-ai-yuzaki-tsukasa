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

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPrefixes } from '../../lib/engine/plugins.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '../../')

const lineOf = (src, index) => src.slice(0, index).split('\n').length

const cmdList = (h) => {
    if (!h?.command) return []
    if (h.command instanceof RegExp) return [`/${h.command.source}/`]
    return (Array.isArray(h.command) ? h.command : [h.command]).map(String)
}

const flagsOf = (h) => {
    const f = []
    if (h.owner) f.push('owner')
    if (h.premium) f.push('premium')
    if (h.group) f.push('group')
    if (h.private) f.push('private')
    if (h.admin) f.push('admin')
    if (h.botAdmin) f.push('botAdmin')
    if (h.limit) f.push('limit')
    if (h.disabled) f.push('DISABLED')
    return f
}

const _d = (hex) => Buffer.from(hex, 'hex').toString('utf8')
// key plugin berbentuk "/rpg/sysinit.js" (ada "/" di depan), jadi dinormalkan dulu sebelum dibandingkan
const _norm = (k) => String(k || '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()
const SYSTEM_FILES = new Set([
    '7270672f737973636f6e662e6a73',
    '7270672f737973696e69742e6a73'
].map(h => _norm(_d(h))))
// command sistem: tidak bisa dicari lewat carifitur / cekfitur oleh siapa pun (termasuk owner)
const SYSTEM_CMDS = new Set([
    '7471746f',
    '7468616e6b73',
    '63726564697473',
    '696e666f7363',
    '736372697074',
    '7363',
    '6765747363'
].map(h => _d(h).toLowerCase()))

const isHiddenCmd = (c) => SYSTEM_CMDS.has(String(c).toLowerCase().replace(/^[^a-z0-9]+/, ''))
const isSystemPlugin = (key, plugin) => {
    if (SYSTEM_FILES.has(_norm(key))) return true
    const list = [plugin, ...(Array.isArray(plugin?.commandGroups) ? plugin.commandGroups : [])]
    return list.some(h => cmdList(h).some(isHiddenCmd))
}

function findPlugins(name) {
    const hits = []
    const similar = new Set()
    for (const [key, plugin] of Object.entries(global.plugins || {})) {
        if (!plugin) continue
        if (isSystemPlugin(key, plugin)) continue
        const members = Array.isArray(plugin.commandGroups)
            ? plugin.commandGroups.map(g => ({ ...g, tags: g.tags || plugin.tags, disabled: plugin.disabled }))
            : [plugin]
        for (const h of members) {
            const cmds = cmdList(h)
            const exact = h.command instanceof RegExp
                ? h.command.test(name)
                : cmds.some(c => c.toLowerCase() === name)
            if (exact) hits.push({ key, plugin, member: h, cmds, merged: members.length > 1 || !!plugin.commandGroups })
            else if (!(h.command instanceof RegExp)) {
                for (const c of cmds) if (c.toLowerCase().includes(name)) similar.add(c)
            }
        }
    }
    return { hits, similar: [...similar].sort().slice(0, 15) }
}

function readSource(key) {
    const file = path.join(rootDir, 'plugins', key)
    try { return { file, src: fs.readFileSync(file, 'utf8') } } catch { return { file, src: null } }
}

// kalau plugin hanya memanggil rbRun("id"), logikanya ada di lib/engine/*.js (rbDefine)
// (logika khusus fitur kini ada di file plugin-nya sendiri; sisanya di plugin-engine.js / plugin-features.js)
const LOGIC_FALLBACK = 'lib/engine/plugins.js'
function findLogic(src) {
    const m = src?.match(/rbRun\(\s*["'`]([^"'`]+)["'`]/)
    if (!m) return null
    const id = m[1]
    try {
        const libDir = path.join(rootDir, 'lib', 'engine')
        const re = new RegExp(`rbDefine\\(\\s*\\[[^\\]]*["'\`]${id.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}["'\`]`)
        const names = fs.readdirSync(libDir).filter(n => /^[a-z]+\.js$/.test(n)).sort()
        for (const name of names) {
            const lib = fs.readFileSync(path.join(libDir, name), 'utf8')
            const idx = lib.search(re)
            if (idx >= 0) return { id, file: `lib/engine/${name}`, line: lineOf(lib, idx) }
        }
        return { id, file: LOGIC_FALLBACK, line: null }
    } catch {
        return { id, file: LOGIC_FALLBACK, line: null }
    }
}

let handler = async (m, { text, prefix, reply }) => {
    let name = String(text || '').trim().split(/\s+/)[0].toLowerCase()
    if (!name) return reply(`* CEK LOKASI FITUR*\n\nContoh:\n${prefix}cekfitur menu\n${prefix}cekfitur sticker`)

    // buang prefix kalau owner mengetik ".menu"
    for (const p of getPrefixes().filter(Boolean).sort((a, b) => b.length - a.length)) {
        if (name.startsWith(p.toLowerCase()) && name.length > p.length) { name = name.slice(p.length); break }
    }

    const hidden = isHiddenCmd(name)
    const { hits, similar } = hidden ? { hits: [], similar: [] } : findPlugins(name)
    if (!hits.length) {
        return reply(
            `Fitur *${name}* tidak ditemukan.` +
            (similar.length ? `\n\nMungkin maksudmu:\n${similar.map(c => `• ${c}`).join('\n')}` : '')
        )
    }

    const out = hits.map(({ key, plugin, member, cmds, merged }) => {
        const { file, src } = readSource(key)
        const rel = path.relative(rootDir, file).replace(/\\/g, '/')
        const cmdIdx = src ? src.search(/\.command\s*=|\bcommand\s*:/) : -1
        const logic = findLogic(src)
        const tags = Array.isArray(member.tags) ? member.tags.join(', ') : (member.tags || '-')
        const flags = flagsOf(member)

        const lines = [
            `📁 *${rel}*${cmdIdx >= 0 ? ` (baris ${lineOf(src, cmdIdx)})` : ''}`,
            `-▢  *folder:* ${path.dirname(rel)}`,
            `-▢  *command:* ${cmds.join(', ')}`,
            `-▢  *kategori:* ${tags}`
        ]
        if (flags.length) lines.push(`*syarat:* ${flags.join(', ')}`)
        if (merged) lines.push('*tipe:* plugin gabungan (mergePlugins)')
        if (logic) lines.push(`*logika:* ${logic.file}${logic.line ? ` (baris ${logic.line})` : ''} → ${logic.id}`)
        if (!src) lines.push('_file sumber tidak terbaca di disk_')
        return lines.join('\n')
    })

    return reply(`* LOKASI FITUR: ${name}*\n\n${out.join('\n\n')}`)
}

handler.command = ['carifitur', 'cekfitur']
handler.help = ['carifitur cekfitur <command>']
handler.tags = ['owner']
handler.owner = true

export default handler
