/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Developer Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Info Update Kaguya Channels:
* • https://whatsapp.com/channel/0029VabymHd4CrfnqPLPzk3n
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */
import zlib from 'zlib'
import crypto from 'crypto'
import path from 'path'
import * as cheerio from 'cheerio'
import { netguard } from '../../lib/services/scraper.js'
import { reactTo } from '../../lib/core/file.js'

const { safeFetch } = netguard

/* ============================ KONFIGURASI =============================== */

const DEFAULTS = { depth: 1, pages: 20, assets: 800, external: true }
const LIMIT_USER = { depth: 2, pages: 30, assets: 1500 }
const LIMIT_OWNER = { depth: 4, pages: 80, assets: 3000 }

const MAX_FILE = 8 * 1024 * 1024        // batas per file
const MAX_TOTAL = 40 * 1024 * 1024      // batas total sebelum dikompres
const DEADLINE_MS = 120000              // batas waktu seluruh proses
const CONCURRENCY = 6
const COOLDOWN_MS = 45000               // jeda per pengguna (owner bebas)
const MAX_RUNNING = 2                   // jumlah clone yang boleh jalan bersamaan

const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 KaguyaClone/1.0'

const TEXT_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json', '.map', '.webmanifest', '.svg', '.xml', '.txt', '.ts', '.tsx', '.jsx', '.vue', '.md', '.csv', '.yaml', '.yml'])
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif', '.bmp'])
const FONT_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot'])
const JS_EXT = new Set(['.js', '.mjs', '.cjs'])
const CODE_EXT = new Set(['.ts', '.tsx', '.jsx', '.vue', '.js', '.css', '.scss'])

const cooldowns = new Map()
let running = 0

/* =========================== UTIL ======================================= */

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB'

function parseInput(text, isOwner) {
    const lim = isOwner ? LIMIT_OWNER : LIMIT_USER
    const opts = { ...DEFAULTS }
    let url = null
    for (const tok of String(text || '').trim().split(/\s+/).filter(Boolean)) {
        if (tok.startsWith('--')) {
            const [k, v] = tok.slice(2).split('=')
            if (k === 'external') opts.external = v === undefined ? true : v !== 'false' && v !== '0'
            else if (['depth', 'pages', 'assets'].includes(k) && v !== undefined && !Number.isNaN(Number(v))) opts[k] = Math.max(0, Math.floor(Number(v)))
        } else if (!url) url = tok
    }
    opts.depth = Math.min(opts.depth, lim.depth)
    opts.pages = Math.max(1, Math.min(opts.pages, lim.pages))
    opts.assets = Math.max(1, Math.min(opts.assets, lim.assets))
    return { url, opts }
}

function extFromUrl(u) {
    try { return path.extname(new URL(u).pathname).toLowerCase() } catch { return '' }
}

function resolveUrl(base, ref) {
    if (!ref || typeof ref !== 'string') return null
    const r = ref.trim().replace(/^["']|["']$/g, '')
    if (!r || /^(data:|blob:|mailto:|tel:|javascript:|about:|#)/i.test(r)) return null
    try {
        const u = new URL(r, base)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
        u.hash = ''
        return u.href
    } catch { return null }
}

function sanitizeRel(rel) {
    const out = []
    for (const s of String(rel).split(/[\\/]+/).filter(s => s && s !== '.')) {
        if (s === '..') out.pop()
        else out.push(s.replace(/[:*?"<>|\u0000-\u001f]/g, '_'))
    }
    return out.join('/')
}

function filePathFor(url, { isHtml = false, isExternal = false } = {}) {
    const u = new URL(url)
    let p = u.pathname || '/'
    try { p = decodeURIComponent(p) } catch {}
    if (!p || p === '/') p = '/index.html'
    else if (p.endsWith('/')) p += 'index.html'
    else if (isHtml && !path.extname(p)) p = p.replace(/\/?$/, '') + '/index.html'
    p = sanitizeRel(p) || 'index.html'
    if (isExternal) p = path.posix.join('_external', u.hostname.replace(/[^a-zA-Z0-9.-]/g, '_'), p)
    return p
}

/* ========================= KLASIFIKASI ================================== */

function classifyType(ctype, ext) {
    if (ctype === 'text/html' || ext === '.html' || ext === '.htm') return 'html'
    if (ctype.includes('css') || ext === '.css' || ext === '.scss') return 'css'
    if (/javascript|ecmascript/.test(ctype) || JS_EXT.has(ext)) return 'javascript'
    if (/typescript/.test(ctype) || ext === '.ts' || ext === '.tsx') return 'typescript'
    if (ext === '.jsx' || ext === '.vue') return 'source'
    if (ext === '.map' || /sourcemap/.test(ctype)) return 'sourcemap'
    if (ctype.includes('json') || ext === '.json' || ext === '.webmanifest') return 'json'
    if (ctype.includes('svg') || ext === '.svg') return 'svg'
    if (ctype.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image'
    if (ctype.includes('font') || FONT_EXT.has(ext)) return 'font'
    if (ctype.includes('wasm') || ext === '.wasm') return 'wasm'
    if (ctype.startsWith('audio/') || ctype.startsWith('video/') || ['.mp3', '.mp4', '.webm', '.ogg', '.m4a'].includes(ext)) return 'media'
    if (ctype.startsWith('text/') || ctype.includes('xml')) return 'text'
    return 'other'
}

function isTextType(ctype, ext, type) {
    if (ctype.startsWith('text/')) return true
    if (/json|javascript|ecmascript|xml|svg|x-sh|yaml/.test(ctype)) return true
    if (TEXT_EXT.has(ext)) return true
    return ['html', 'css', 'javascript', 'typescript', 'json', 'sourcemap', 'svg', 'source', 'text'].includes(type)
}

function decodeText(buf, ctype) {
    const m = /charset=([\w-]+)/i.exec(ctype || '')
    const enc = m ? m[1].toLowerCase().replace('utf-8', 'utf8') : 'utf8'
    try { return buf.toString(enc) } catch { return buf.toString('utf8') }
}

/* ========================= PENEMUAN ASET ================================ */

const ASSET_RE = new RegExp(
    '["\'`(\\s](?:\\.{0,2}\\/|/)?[^"\'`\\s(){}<>]+?\\.(' +
    'png|jpe?g|webp|gif|svg|ico|avif|bmp|woff2?|ttf|otf|eot|' +
    'json|webmanifest|xml|wasm|mp4|webm|mp3|ogg|pdf|css|js|mjs|cjs|map|txt' +
    ')(?:\\?[^"\'`\\s(){}<>]*)?["\'`)\\s]', 'gi')

function findAssetRefs(text) {
    const found = new Set()
    let m
    ASSET_RE.lastIndex = 0
    while ((m = ASSET_RE.exec(text)) !== null) {
        let ref = m[0].slice(1, -1).trim().replace(/^["'`(]|["'`)]$/g, '').trim()
        if (!ref || ref.length > 400 || /\s/.test(ref)) continue
        const base = path.posix.basename(ref.split('?')[0])
        const stem = base.slice(0, base.length - path.extname(base).length)
        if (!/[A-Za-z0-9]/.test(stem)) continue
        found.add(ref)
    }
    return [...found]
}

function findSourceMapUrl(text, isCss) {
    if (isCss) {
        const m = text.match(/\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//)
        if (m) return m[1].trim()
    }
    const m = text.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/)
    if (m) return m[1].trim()
    const m2 = text.match(/sourceMappingURL=([^\s"';]+)/)
    return m2 ? m2[1].trim() : null
}

function extractCssRefs(cssText) {
    const refs = new Set()
    let m
    const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
    while ((m = urlRe.exec(cssText)) !== null) refs.add(m[2].trim())
    const importRe = /@import\s+(?:url\(\s*)?(['"]?)([^'")]+)\1/gi
    while ((m = importRe.exec(cssText)) !== null) refs.add(m[2].trim())
    return [...refs]
}

function extractHtmlRefs($, pageUrl) {
    const resources = [], pages = []
    const push = (ref, kind) => { const u = resolveUrl(pageUrl, ref); if (u) resources.push({ url: u, kind }) }

    $('link[href]').each((_, el) => {
        const rel = ($(el).attr('rel') || '').toLowerCase()
        if (/stylesheet|icon|apple-touch-icon|manifest|preload|prefetch|modulepreload/.test(rel)) push($(el).attr('href'), 'link')
    })
    $('script[src]').each((_, el) => push($(el).attr('src'), 'script'))
    $('img[src],source[src],video[src],audio[src],embed[src],object[data]').each((_, el) => push($(el).attr('src') || $(el).attr('data'), 'media'))
    $('[srcset]').each((_, el) => ($(el).attr('srcset') || '').split(',').forEach(p => push(p.trim().split(/\s+/)[0], 'media')))
    $('video[poster]').each((_, el) => push($(el).attr('poster'), 'media'))
    $('style').each((_, el) => extractCssRefs($(el).html() || '').forEach(r => push(r, 'css')))
    $('[style]').each((_, el) => extractCssRefs($(el).attr('style') || '').forEach(r => push(r, 'css')))
    $('script:not([src])').each((_, el) => findAssetRefs($(el).html() || '').forEach(r => push(r, 'asset')))
    $('a[href]').each((_, el) => { const u = resolveUrl(pageUrl, $(el).attr('href')); if (u) pages.push(u) })
    return { resources, pages }
}

/* ======================= PEMULIHAN SOURCE MAP =========================== */

function recoverFromSourceMap(mapJson, mapUrl, store, budget) {
    const recovered = []
    if (!mapJson || typeof mapJson !== 'object') return recovered
    const sources = Array.isArray(mapJson.sources) ? mapJson.sources : []
    const contents = Array.isArray(mapJson.sourcesContent) ? mapJson.sourcesContent : []
    const root = mapJson.sourceRoot ? String(mapJson.sourceRoot) : ''

    for (let i = 0; i < sources.length; i++) {
        const content = contents[i]
        if (content == null) continue
        let src = String(sources[i]).replace(/^[a-zA-Z][\w+.-]*:\/\//, '').replace(/^(webpack|file|rollup|ng):?/, '')
        if (root) src = root + '/' + src
        const rel = sanitizeRel(src)
        if (!rel || rel.includes('node_modules/')) continue
        const localPath = path.posix.join('_recovered', rel)
        const buf = Buffer.from(String(content), 'utf8')
        if (store.has(localPath) || budget.total + buf.length > MAX_TOTAL) continue
        budget.total += buf.length
        const ext = path.extname(rel).toLowerCase()
        const rec = {
            path: localPath, url: null, type: classifyType('', ext), contentType: null, size: buf.length,
            language: CODE_EXT.has(ext) ? ext.slice(1) : null, recoveredFrom: mapUrl, source: src
        }
        store.set(localPath, { buf, meta: rec })
        recovered.push(rec)
    }
    return recovered
}

/* ============================ ZIP WRITER ================================ */

const CRC_TABLE = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
    }
    return t
})()

function crc32(buf) {
    let crc = -1
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
    return (crc ^ -1) >>> 0
}

function dosDateTime(d) {
    return {
        time: ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
        date: ((((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f)) >>> 0
    }
}

function createZip(entries) {
    const chunks = [], central = []
    let offset = 0
    const { time, date } = dosDateTime(new Date())

    for (const e of entries) {
        const nameBuf = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8')
        const data = e.data
        const crc = crc32(data)
        const compressed = zlib.deflateRawSync(data, { level: 9 })
        const useDeflate = compressed.length < data.length
        const method = useDeflate ? 8 : 0
        const out = useDeflate ? compressed : data

        const lh = Buffer.alloc(30)
        lh.writeUInt32LE(0x04034b50, 0)
        lh.writeUInt16LE(20, 4)
        lh.writeUInt16LE(0x0800, 6)
        lh.writeUInt16LE(method, 8)
        lh.writeUInt16LE(time, 10)
        lh.writeUInt16LE(date, 12)
        lh.writeUInt32LE(crc, 14)
        lh.writeUInt32LE(out.length, 18)
        lh.writeUInt32LE(data.length, 22)
        lh.writeUInt16LE(nameBuf.length, 26)
        lh.writeUInt16LE(0, 28)

        chunks.push(lh, nameBuf, out)
        central.push({ nameBuf, crc, method, compSize: out.length, size: data.length, offset })
        offset += lh.length + nameBuf.length + out.length
    }

    const cdStart = offset
    for (const c of central) {
        const ch = Buffer.alloc(46)
        ch.writeUInt32LE(0x02014b50, 0)
        ch.writeUInt16LE(0x031e, 4)
        ch.writeUInt16LE(20, 6)
        ch.writeUInt16LE(0x0800, 8)
        ch.writeUInt16LE(c.method, 10)
        ch.writeUInt16LE(time, 12)
        ch.writeUInt16LE(date, 14)
        ch.writeUInt32LE(c.crc, 16)
        ch.writeUInt32LE(c.compSize, 20)
        ch.writeUInt32LE(c.size, 24)
        ch.writeUInt16LE(c.nameBuf.length, 28)
        ch.writeUInt32LE(c.offset, 42)
        chunks.push(ch, c.nameBuf)
        offset += ch.length + c.nameBuf.length
    }

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(central.length, 8)
    eocd.writeUInt16LE(central.length, 10)
    eocd.writeUInt32LE(offset - cdStart, 12)
    eocd.writeUInt32LE(cdStart, 16)
    chunks.push(eocd)
    return Buffer.concat(chunks)
}

/* ============================== CRAWLER ================================= */

async function fetchRes(url, deadline) {
    let lastErr
    for (let attempt = 0; attempt <= 1; attempt++) {
        if (Date.now() > deadline) throw Object.assign(new Error('waktu habis'), { code: 'EDEADLINE' })
        try {
            return await safeFetch(url, { timeout: 20000, maxBytes: MAX_FILE, maxRedirects: 5, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,id;q=0.8' } })
        } catch (e) {
            lastErr = e
            if (['EBADURL', 'ETOOBIG', 'EBLOCKED'].includes(e.code)) break
            if (attempt < 1) await sleep(400)
        }
    }
    throw lastErr
}

async function crawl(startUrl, opts, deadline) {
    const base = new URL(startUrl)
    const baseHost = base.hostname
    const store = new Map()          // localPath -> { buf, meta }
    const visited = new Set()
    const errors = [], skipped = [], recovered = []
    const budget = { total: 0 }
    const queue = []
    let pagesCrawled = 0, idx = 0, inflight = 0, truncated = false

    const urlKey = (u) => { try { const x = new URL(u); return x.origin + x.pathname + x.search } catch { return u } }

    function enqueue(url, meta) {
        if (!url) return
        let u
        try { u = new URL(url) } catch { return }
        const sameHost = u.hostname === baseHost
        if (!opts.external && !sameHost && meta.kind !== 'page') return
        const key = urlKey(url)
        if (visited.has(key)) return
        if (store.size + queue.length >= opts.assets) { truncated = true; return }
        visited.add(key)
        queue.push({ url, ...meta })
    }

    enqueue(base.href, { kind: 'page', depth: 0, isRoot: true })

    async function processItem(item) {
        const { url, kind, depth, isRoot } = item
        const sameHost = new URL(url).hostname === baseHost
        let res
        try { res = await fetchRes(url, deadline) } catch (e) {
            errors.push({ url, error: e.code || e.message })
            return
        }

        const status = res.status
        const finalUrl = res.url || url
        const buf = res.buffer
        const ctype = String(res.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
        const ext = extFromUrl(finalUrl)
        const type = classifyType(ctype, ext)

        if (status < 200 || status >= 300) { errors.push({ url, status }); return }
        if (!buf || buf.length === 0) { errors.push({ url, status, error: 'empty body' }); return }

        const wantsHtml = isRoot || (!ext && kind === 'page') || ['.html', '.htm'].includes(ext)
        if (ctype === 'text/html' && !wantsHtml) { skipped.push({ url, status, reason: 'spa-fallback (bukan file asli)' }); return }

        const isExternal = !sameHost
        const isHtml = ctype === 'text/html' || ['.html', '.htm'].includes(ext)
        const localPath = filePathFor(finalUrl, { isHtml, isExternal })
        if (store.has(localPath)) return
        if (budget.total + buf.length > MAX_TOTAL) { truncated = true; skipped.push({ url, reason: 'melewati batas total ukuran' }); return }
        budget.total += buf.length

        const text = isTextType(ctype, ext, type) ? decodeText(buf, String(res.headers['content-type'] || '')) : null
        const rec = {
            path: localPath, url: finalUrl, type, contentType: ctype || null, size: buf.length,
            sha256: sha256(buf), external: isExternal || undefined, status
        }
        store.set(localPath, { buf, meta: rec })

        if (type === 'html' && text) {
            if (depth <= opts.depth && pagesCrawled < opts.pages) {
                pagesCrawled++
                const $ = cheerio.load(text)
                const { resources, pages } = extractHtmlRefs($, finalUrl)
                for (const r of resources) enqueue(r.url, { kind: r.kind, depth: depth + 1 })
                for (const p of pages) {
                    try { if (new URL(p).hostname === baseHost) enqueue(p, { kind: 'page', depth: depth + 1 }) } catch {}
                }
            }
        } else if (type === 'css' && text) {
            for (const r of extractCssRefs(text)) { const u = resolveUrl(finalUrl, r); if (u) enqueue(u, { kind: 'css-asset', depth: depth + 1 }) }
            const sm = findSourceMapUrl(text, true)
            if (sm) { const u = resolveUrl(finalUrl, sm); if (u) enqueue(u, { kind: 'sourcemap', depth: depth + 1 }) }
        } else if ((type === 'javascript' || type === 'typescript') && text) {
            for (const r of findAssetRefs(text)) { const u = resolveUrl(finalUrl, r); if (u) enqueue(u, { kind: 'js-asset', depth: depth + 1 }) }
            const sm = findSourceMapUrl(text, false)
            if (sm) { const u = resolveUrl(finalUrl, sm); if (u) enqueue(u, { kind: 'sourcemap', depth: depth + 1 }) }
        } else if (type === 'json' && text) {
            try {
                const j = JSON.parse(text)
                const list = []
                if (Array.isArray(j.icons)) j.icons.forEach(i => i?.src && list.push(i.src))
                if (Array.isArray(j.shortcuts)) j.shortcuts.forEach(s => s?.url && list.push(s.url))
                if (Array.isArray(j.screenshots)) j.screenshots.forEach(s => s?.src && list.push(s.src))
                for (const r of list) { const u = resolveUrl(finalUrl, r); if (u) enqueue(u, { kind: 'manifest-asset', depth: depth + 1 }) }
            } catch {}
        } else if (type === 'sourcemap' && text) {
            try {
                recovered.push(...recoverFromSourceMap(JSON.parse(text), finalUrl, store, budget))
            } catch (e) {
                errors.push({ url, error: 'sourcemap parse: ' + e.message })
            }
        }
    }

    // worker pool: baru berhenti kalau antrean kosong DAN tidak ada pekerjaan yang masih berjalan
    async function worker() {
        while (Date.now() < deadline) {
            if (idx < queue.length) {
                const item = queue[idx++]
                inflight++
                try { await processItem(item) } catch (e) { errors.push({ url: item.url, error: e.message }) } finally { inflight-- }
            } else if (inflight > 0) {
                await sleep(25)
            } else break
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    const timedOut = Date.now() >= deadline && (idx < queue.length || inflight > 0)
    return { store, errors, skipped, recovered, pagesCrawled, truncated: truncated || timedOut, timedOut }
}

/* ============================== HANDLER ================================= */

let handler = async (m, { sock, text, prefix, command, reply, isOwner }) => {
    const input = String(text || m.quoted?.text || '').trim()
    if (!input) {
        return reply(
            `*🌐 CLONE SOURCE WEBSITE*\n\n` +
            `Ambil HTML, CSS, JS, source map (pulihkan file asli TS/TSX/JSX/Vue), gambar, font, dan JSON jadi ZIP.\n\n` +
            `*Contoh:*\n${prefix}${command} https://contoh.com\n${prefix}${command} contoh.com --depth=2 --pages=30\n\n` +
            `*Opsi:*\n• --depth=N  kedalaman halaman (default ${DEFAULTS.depth}, maks ${isOwner ? LIMIT_OWNER.depth : LIMIT_USER.depth})\n` +
            `• --pages=N  jumlah halaman (default ${DEFAULTS.pages}, maks ${isOwner ? LIMIT_OWNER.pages : LIMIT_USER.pages})\n` +
            `• --assets=N  jumlah file (default ${DEFAULTS.assets}, maks ${isOwner ? LIMIT_OWNER.assets : LIMIT_USER.assets})\n` +
            `• --external=false  jangan ambil aset dari domain lain`
        )
    }

    const { url: rawUrl, opts } = parseInput(input, isOwner)
    const parsed = netguard.parseUrl(rawUrl)
    if (!parsed) return reply('❌ Link tidak valid atau mengarah ke alamat internal.')

    if (!isOwner) {
        const left = (cooldowns.get(m.sender) || 0) - Date.now()
        if (left > 0) return reply(`⏳ Tunggu ${Math.ceil(left / 1000)} detik lagi sebelum clone website berikutnya.`)
    }
    if (running >= MAX_RUNNING) return reply('⏳ Bot sedang memproses clone lain. Coba lagi sebentar.')

    running++
    if (!isOwner) cooldowns.set(m.sender, Date.now() + COOLDOWN_MS)
    try {
        await reactTo(sock, m, '⏳')
        await reply(`⏳ Mengambil source *${parsed.hostname}* ...\nDepth ${opts.depth} • maks ${opts.pages} halaman • maks ${opts.assets} file`)

        const t0 = Date.now()
        const result = await crawl(parsed.href, opts, t0 + DEADLINE_MS)
        const { store, errors, skipped, recovered } = result

        if (!store.size) throw new Error(errors[0] ? `tidak ada file yang berhasil diambil (${errors[0].error || 'HTTP ' + errors[0].status})` : 'tidak ada file yang berhasil diambil')

        const files = [...store.values()].map(v => v.meta).sort((a, b) => a.path.localeCompare(b.path))
        const byType = {}
        let totalBytes = 0
        for (const f of files) { totalBytes += f.size; byType[f.type] = (byType[f.type] || 0) + 1 }

        const manifest = {
            generatedAt: new Date().toISOString(),
            durationMs: Date.now() - t0,
            target: parsed.href,
            host: parsed.hostname,
            options: opts,
            stats: { totalFiles: files.length, totalBytes, byType },
            partial: result.truncated || undefined,
            sourceMaps: { found: byType.sourcemap || 0, recoveredFiles: recovered.length },
            recoveredSources: recovered.map(r => ({ path: r.path, language: r.language, recoveredFrom: r.recoveredFrom })),
            files, errors, skipped
        }

        const root = parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, '_')
        const entries = [...store.entries()].map(([p, v]) => ({ name: `${root}/${p}`, data: v.buf }))
        entries.push({ name: `${root}/_manifest.json`, data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') })
        const zip = createZip(entries)

        const caption =
            `🌐 *CLONE SOURCE WEBSITE*\n\n` +
            `• *Target:* ${parsed.href}\n` +
            `• *File:* ${files.length} (${fmtSize(totalBytes)})\n` +
            `• *Halaman:* ${result.pagesCrawled}\n` +
            `• *Source map dipulihkan:* ${recovered.length} file asli\n` +
            `• *Gagal/dilewati:* ${errors.length}/${skipped.length}\n` +
            `• *Ukuran ZIP:* ${fmtSize(zip.length)}\n` +
            `• *Waktu:* ${((Date.now() - t0) / 1000).toFixed(1)} detik` +
            (result.truncated ? `\n\n⚠️ Hasil sebagian (kena batas waktu/ukuran/jumlah file).` : '')

        await sock.sendMessage(m.chat, {
            document: zip,
            fileName: `${root}-source.zip`,
            mimetype: 'application/zip',
            caption
        }, { quoted: m })
        await reactTo(sock, m, '✅')
    } catch (e) {
        console.error('[CLONESITE ERROR]', e?.message || e)
        await reactTo(sock, m, '❌')
        cooldowns.delete(m.sender)
        reply(`❌ Gagal clone website: ${e?.message || e}`)
    } finally {
        running--
    }
}

handler.command = ['clonesite']
handler.help = ['clonesite <url>']
handler.tags = ['tools']

handler.limit = true

export default handler
