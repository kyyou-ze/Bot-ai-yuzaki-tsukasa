/**
 * Kaguya Multi Device — Store
 * Ambil script produk dari URL (apa saja) lalu siapkan sebagai ZIP untuk dikirim bot.
 *
 * Dipakai oleh merchant.js (kirim otomatis setelah lunas) lewat field `url` di global.storeProducts.
 *
 * URL yang didukung:
 *   - Link langsung ke file apa pun (.zip, .rar, .7z, .js, .json, dst)
 *   - GitHub  : repo, /tree/<branch>, /blob/..., /releases/download/..., raw.githubusercontent.com
 *   - GitLab  : repo / folder branch
 *   - Google Drive (file), Dropbox, MediaFire, Pixeldrain
 *   - Halaman web yang memuat link unduhan arsip (.zip/.rar/.7z/.tar.gz) → link pertama dipakai
 *
 * Hasil unduhan:
 *   - Kalau sudah ZIP → dikirim apa adanya
 *   - Kalau bukan ZIP → dibungkus jadi ZIP
 *   - Disimpan di cache (lib/store/script/_cache) supaya pembeli berikutnya tidak menunggu unduhan lagi.
 *     Kalau unduhan baru gagal tapi cache lama ada, cache lama dipakai.
 *
 * Opsional di config.js:
 *   global.storeFetch = { cacheMin: 30, maxMB: 100, timeoutSec: 120, githubToken: '' }
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import axios from 'axios'
import AdmZip from 'adm-zip'

const SCRIPT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'script')
const CACHE_DIR = path.join(SCRIPT_DIR, '_cache')
const UA = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
const ARCHIVE_EXT = /\.(zip|rar|7z|tar\.gz|tgz|tar)$/i

const opt = () => {
    const c = global.storeFetch || {}
    return {
        cacheMs: Math.max(0, Number(c.cacheMin ?? 30)) * 60_000,
        maxBytes: Math.max(1, Number(c.maxMB ?? 100)) * 1024 * 1024,
        timeout: Math.max(5, Number(c.timeoutSec ?? 120)) * 1000,
        githubToken: String(c.githubToken || '')
    }
}

const safeName = (s) => String(s || '').replace(/[^\w.\- ()\[\]]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80)
const decode = (s) => { try { return decodeURIComponent(s) } catch { return s } }

// ───────── ubah link "halaman" jadi link unduhan langsung ─────────

/** Kembalikan { url, name?, headers? }. name = saran nama file ZIP (tanpa ekstensi). */
export async function toDirect(raw, o = {}) {
    let s = String(raw || '').trim()
    if (!s) throw new Error('URL kosong')
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`
    let u
    try { u = new URL(s) } catch { throw new Error('URL tidak valid') }
    if (!/^https?:$/.test(u.protocol)) throw new Error('URL harus http/https')

    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const parts = u.pathname.split('/').filter(Boolean).map(decode)

    // GitHub
    if (host === 'github.com' && parts.length >= 2) {
        const [user, repoRaw, kind, ...rest] = parts
        const repo = repoRaw.replace(/\.git$/i, '')
        const headers = o.githubToken ? { Authorization: `Bearer ${o.githubToken}` } : undefined
        if (kind === 'archive' || kind === 'releases' && rest[0] === 'download' || kind === 'raw') return { url: s, headers }
        if (kind === 'blob' && rest.length) return { url: `https://github.com/${user}/${repo}/raw/${rest.join('/')}`, headers }
        if (kind === 'tree' && rest.length) return { url: `https://github.com/${user}/${repo}/archive/refs/heads/${rest[0]}.zip`, name: repo, headers }
        if (o.githubToken) return { url: `https://api.github.com/repos/${user}/${repo}/zipball`, name: repo, headers: { ...headers, Accept: 'application/vnd.github+json' } }
        return { url: `https://github.com/${user}/${repo}/archive/HEAD.zip`, name: repo }
    }

    // GitLab (repo atau folder branch)
    if (host === 'gitlab.com' && parts.length >= 2 && !s.includes('/-/archive/') && !s.includes('/-/raw/')) {
        const dash = parts.indexOf('-')
        const proj = dash > -1 ? parts.slice(0, dash) : parts
        const repo = proj[proj.length - 1].replace(/\.git$/i, '')
        let ref = 'HEAD'
        if (dash > -1 && parts[dash + 1] === 'tree' && parts[dash + 2]) ref = parts[dash + 2]
        if (dash > -1 && parts[dash + 1] === 'blob' && parts[dash + 2]) {
            return { url: `https://gitlab.com/${proj.join('/')}/-/raw/${parts.slice(dash + 2).join('/')}` }
        }
        return { url: `https://gitlab.com/${proj.join('/').replace(/\.git$/i, '')}/-/archive/${ref}/${repo}-${ref.replace(/\//g, '-')}.zip`, name: repo }
    }

    // Google Drive / Docs (file tunggal)
    if (host === 'drive.google.com' || host === 'docs.google.com' || host === 'drive.usercontent.google.com') {
        if (parts.includes('folders')) throw new Error('Folder Google Drive tidak didukung, kirim link file (atau zip foldernya dulu)')
        const id = (u.pathname.match(/\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get('id')
        if (!id) throw new Error('ID file Google Drive tidak ditemukan')
        return { url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t` }
    }

    // Dropbox
    if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
        u.searchParams.delete('raw')
        u.searchParams.set('dl', '1')
        return { url: u.toString() }
    }

    // Pixeldrain
    if (host === 'pixeldrain.com' && parts[0] === 'u' && parts[1]) {
        return { url: `https://pixeldrain.com/api/file/${parts[1]}?download` }
    }

    // MediaFire (halaman → link unduhan asli)
    if (host === 'mediafire.com' || host.endsWith('.mediafire.com')) {
        if (/^download\d*\./i.test(u.hostname)) return { url: s }
        const html = await getText(s, o)
        const scrambled = html.match(/data-scrambled-url=["']([^"']+)["']/)
        let link = ''
        if (scrambled) { try { link = Buffer.from(scrambled[1], 'base64').toString('utf8') } catch { /* lanjut */ } }
        if (!/^https?:\/\//.test(link)) {
            link = (html.match(/href=["'](https?:\/\/download\d*\.mediafire\.com\/[^"']+)["']/) || [])[1] || ''
        }
        if (!link) throw new Error('Link unduhan MediaFire tidak ditemukan (file dihapus / dilindungi sandi?)')
        return { url: link.replace(/&amp;/g, '&') }
    }

    return { url: s }
}

async function getText(url, o) {
    const r = await axios.get(url, {
        timeout: o.timeout, maxRedirects: 10, responseType: 'text',
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
        maxContentLength: 5 * 1024 * 1024, validateStatus: s => s < 400
    })
    return String(r.data || '')
}

// ───────── unduh ke disk ─────────

function nameFromHeaders(h = {}) {
    const cd = String(h['content-disposition'] || '')
    const star = cd.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/)
    if (star) return safeName(decode(star[1]))
    const plain = cd.match(/filename\s*=\s*"?([^";]+)"?/i)
    return plain ? safeName(decode(plain[1])) : ''
}

const nameFromUrl = (url) => {
    try { return safeName(decode(path.basename(new URL(url).pathname))) } catch { return '' }
}

async function download(url, dest, o, headers = {}) {
    const res = await axios.get(url, {
        responseType: 'stream', timeout: o.timeout, maxRedirects: 10,
        headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
        validateStatus: s => s < 400
    })
    const len = Number(res.headers['content-length'] || 0)
    if (len && len > o.maxBytes) { res.data.destroy(); throw new Error(`File terlalu besar (${(len / 1048576).toFixed(1)} MB, batas ${o.maxBytes / 1048576} MB)`) }
    let got = 0
    res.data.on('data', (c) => {
        got += c.length
        if (got > o.maxBytes) res.data.destroy(new Error(`File melebihi batas ${o.maxBytes / 1048576} MB`))
    })
    await pipeline(res.data, fs.createWriteStream(dest))
    return { headers: res.headers, bytes: got, finalUrl: res.request?.res?.responseUrl || url }
}

const head = (file, n = 512) => {
    const fd = fs.openSync(file, 'r')
    try { const b = Buffer.alloc(n); const r = fs.readSync(fd, b, 0, n, 0); return b.subarray(0, r) } finally { fs.closeSync(fd) }
}
const isZip = (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)
const looksHtml = (b) => /^\s*(<!doctype html|<html|<head|<body)/i.test(b.toString('utf8', 0, 200)) || /<html[\s>]/i.test(b.toString('utf8'))

/** Unduh sampai dapat file asli (bukan halaman HTML). */
async function fetchRaw(rawUrl, dest, o) {
    let direct = await toDirect(rawUrl, o)
    let dl
    for (let hop = 0; hop < 2; hop++) {
        dl = await download(direct.url, dest, o, direct.headers)
        const b = head(dest)
        if (!looksHtml(b) || isZip(b)) return { ...dl, name: direct.name }
        // dapat halaman HTML: cari link arsip di dalamnya (mis. halaman unduhan sederhana)
        const html = fs.readFileSync(dest, 'utf8')
        // Google Drive: halaman peringatan virus-scan → form unduhan
        const form = html.match(/<form[^>]+id="download-form"[^>]+action="([^"]+)"/)
        if (form) {
            const q = new URLSearchParams()
            for (const m of html.matchAll(/<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"/g)) q.set(m[1], m[2])
            direct = { url: `${form[1].replace(/&amp;/g, '&')}?${q}` }
            continue
        }
        const base = dl.finalUrl || direct.url
        const links = [...html.matchAll(/href=["']([^"'#]+)["']/gi)]
            .map(m => m[1].replace(/&amp;/g, '&'))
            .filter(h => ARCHIVE_EXT.test(h.split('?')[0]))
        if (!links.length) break
        try { direct = { url: new URL(links[0], base).toString() } } catch { break }
    }
    throw new Error('URL mengarah ke halaman web, bukan file unduhan')
}

// ───────── bungkus jadi ZIP + cache ─────────

const inflight = new Map()

/**
 * Ambil script produk dari pr.url dan kembalikan ZIP siap kirim.
 * @returns {Promise<{ok:true,name:string,path:string,size:number,cached:boolean}>} (melempar Error kalau gagal)
 */
export async function fetchScriptZip(pr) {
    const url = String(pr?.url || '').trim()
    if (!url) throw new Error('produk tidak punya url')
    const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16)
    if (inflight.has(key)) return inflight.get(key)
    const job = run(pr, url, key).finally(() => inflight.delete(key))
    inflight.set(key, job)
    return job
}

async function run(pr, url, key) {
    const o = opt()
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    const zipPath = path.join(CACHE_DIR, `${key}.zip`)
    const metaPath = path.join(CACHE_DIR, `${key}.json`)
    const readMeta = () => { try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch { return null } }
    const outName = (suggest) => {
        const base = safeName(String(pr.file || '').replace(/\.[a-z0-9]{1,4}$/i, '')) || safeName(suggest) || safeName(pr.code) || 'script'
        return `${base}.zip`
    }

    const meta = readMeta()
    const hasCache = meta && fs.existsSync(zipPath)
    if (hasCache && Date.now() - meta.at < o.cacheMs) {
        return { ok: true, name: outName(meta.suggest), path: zipPath, size: fs.statSync(zipPath).size, cached: true }
    }

    const part = path.join(CACHE_DIR, `${key}.part`)
    try {
        const r = await fetchRaw(url, part, o)
        const b = head(part)
        let suggest = nameFromHeaders(r.headers) || r.name || nameFromUrl(r.finalUrl) || nameFromUrl(url) || pr.code
        suggest = suggest.replace(ARCHIVE_EXT, '').replace(/\.[a-z0-9]{1,5}$/i, '') || pr.code

        if (isZip(b)) {
            try { if (!new AdmZip(part).getEntries().length) throw new Error('ZIP kosong') } catch (e) { throw new Error(`ZIP rusak (${e.message})`) }
            fs.renameSync(part, zipPath)
        } else {
            // bukan zip → bungkus jadi zip (nama file asli dipertahankan di dalam)
            const inner = nameFromHeaders(r.headers) || nameFromUrl(r.finalUrl) || nameFromUrl(url) || `${safeName(pr.code) || 'file'}.txt`
            const zip = new AdmZip()
            zip.addFile(inner, fs.readFileSync(part))
            zip.writeZip(zipPath)
            fs.rmSync(part, { force: true })
        }
        fs.writeFileSync(metaPath, JSON.stringify({ url, at: Date.now(), suggest }))
        return { ok: true, name: outName(suggest), path: zipPath, size: fs.statSync(zipPath).size, cached: false }
    } catch (e) {
        fs.rmSync(part, { force: true })
        if (hasCache) {
            console.warn(`[STORE] unduh ulang "${pr.code}" gagal (${e?.message || e}), pakai cache lama`)
            return { ok: true, name: outName(meta.suggest), path: zipPath, size: fs.statSync(zipPath).size, cached: true, stale: true }
        }
        throw e
    }
}

/** Hapus cache (semua, atau satu URL). Mengembalikan jumlah file ZIP yang dihapus. */
export function clearScriptCache(url) {
    if (!fs.existsSync(CACHE_DIR)) return 0
    const only = url ? crypto.createHash('sha1').update(String(url).trim()).digest('hex').slice(0, 16) : null
    let n = 0
    for (const f of fs.readdirSync(CACHE_DIR)) {
        if (only && !f.startsWith(only)) continue
        fs.rmSync(path.join(CACHE_DIR, f), { force: true })
        if (f.endsWith('.zip')) n++
    }
    return n
}
