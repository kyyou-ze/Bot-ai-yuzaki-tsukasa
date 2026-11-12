// Bypass shortlink: sub2unlock, vplink, bicolink
//   .bypass <url>   (atau balas pesan berisi link)
import fs from 'fs'
import axios from 'axios'
import * as cheerio from 'cheerio'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const PROVIDERS = [
    { name: 'Sub2Unlock', match: h => /(^|\.)sub2unlock\.[a-z]+$/.test(h), run: sub2unlock },
    { name: 'VPLink', match: h => h === 'vplink.in' || h.endsWith('.vplink.in'), run: vplink },
    { name: 'Bicolink', match: h => h === 'bicolink.com' || h.endsWith('.bicolink.com'), run: bicolink },
]

/* ---------- Sub2Unlock (HTTP murni) ---------- */
async function sub2unlock(url) {
    const base = new URL(url).origin
    const mergeCookies = (jar, res) => {
        for (const c of res.headers['set-cookie'] || []) jar.push(c.split(';')[0])
        return jar
    }

    const r1 = await axios.get(url, { headers: { 'User-Agent': UA }, timeout: 20000 })
    const jar = mergeCookies([], r1)
    let $ = cheerio.load(r1.data)

    const p1 = new URLSearchParams({
        _method: 'POST',
        _csrfToken: $('input[name="_csrfToken"]').val() || '',
        ref: '',
        f_n: 'slc',
        '_Token[fields]': $('input[name="_Token[fields]"]').val() || '',
        '_Token[unlocked]': $('input[name="_Token[unlocked]"]').val() || '',
    })
    const r2 = await axios.post(url, p1.toString(), {
        headers: {
            'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: jar.join('; '), Origin: base, Referer: url,
        },
        validateStatus: () => true, timeout: 20000,
    })
    mergeCookies(jar, r2)

    $ = cheerio.load(r2.data)
    const form = $('#go-link')
    if (!form.length) throw new Error('Form #go-link tidak ditemukan (tahap 2).')
    const val = n => form.find(`input[name="${n}"]`).val() || ''

    const p2 = new URLSearchParams({
        _method: 'POST',
        _csrfToken: val('_csrfToken'),
        ad_form_data: val('ad_form_data'),
        '_Token[fields]': val('_Token[fields]'),
        '_Token[unlocked]': val('_Token[unlocked]'),
    })
    const r3 = await axios.post(`${base}/links/go`, p2.toString(), {
        headers: {
            'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: jar.join('; '), Origin: base, Referer: url,
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
        },
        validateStatus: () => true, timeout: 20000,
    })

    const out = r3.data?.url
    if (!out) throw new Error('Tidak ada URL pada balasan server.')
    if (/^https?:/i.test(out)) return [out]

    const redirect = new URL(`${base}/${out}`)
    const results = []
    for (const k of ['lnk1', 'lnk2', 'lnk3', 'lnk4', 'lnk5']) {
        const enc = redirect.searchParams.get(k)
        if (!enc) continue
        try { results.push(decodeURIComponent(Buffer.from(enc, 'base64').toString('utf8'))) } catch {}
    }
    if (!results.length) throw new Error('Link tujuan tidak bisa didekode.')
    return results
}

/* ---------- Puppeteer helper ---------- */
async function launchBrowser() {
    const { default: puppeteer } = await import('puppeteer')
    const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
    const executablePath = candidates.find(p => p && fs.existsSync(p))
    return puppeteer.launch({
        headless: 'new',
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })
}

function watchGo(page, onUrl) {
    page.on('response', async res => {
        if (!res.url().includes('/links/go')) return
        try {
            const d = await res.json()
            if (d?.url && d.url !== '#') onUrl(d.url)
        } catch {}
    })
}

/* ---------- VPLink ---------- */
async function vplink(url) {
    const slug = url.replace(/\/+$/, '').split('/').pop()
    if (!slug) throw new Error('Slug tidak ditemukan.')

    const headers = { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    const jar = {}
    const save = res => {
        for (const c of res.headers.getSetCookie?.() || []) {
            const [k, ...v] = c.split(';')[0].split('=')
            if (k && v.length) jar[k.trim()] = v.join('=').trim()
        }
    }

    save(await fetch(url, { headers }))
    const r2 = await fetch(`https://jobskiki.in/studyeducates/studyuniversitiess/?studyinsurance=${slug}`, {
        headers: { ...headers, Referer: 'https://sarkarijobcorner.com/educatestudy/learn_more.php' },
    })
    save(r2)
    const m = (await r2.text()).match(/window\.location\.href\s*=\s*["']([^"']+)["']/)
    const jobArt = m ? m[1].replace(/\\\//g, '/') : 'https://jobskiki.in/studyeducates/'

    await fetch('https://jobskiki.in/studyeducates/learn_more.php', {
        headers: { ...headers, Referer: jobArt, Cookie: `PHPSESSID=${jar.PHPSESSID || ''}; _uocat=value` },
    })
    jar.ab = '2'

    const browser = await launchBrowser()
    try {
        const page = await browser.newPage()
        await page.setUserAgent(UA)
        page.setDefaultNavigationTimeout(45000)
        await page.setCookie(...Object.entries(jar).map(([name, value]) => ({ name, value, domain: 'vplink.in', path: '/' })))

        let found = null
        watchGo(page, u => { found = u })

        await page.goto(url, { waitUntil: 'domcontentloaded', referer: 'https://jobskiki.in/studyeducates/learn_more.php' })

        if (!found) {
            found = await page.evaluate(() => {
                const og = document.querySelector('meta[property="og:url"], meta[name="og:url"]')
                const c = og?.getAttribute('content')
                return c && c.startsWith('http') ? c : null
            })
        }

        const until = Date.now() + 15000
        while (!found && Date.now() < until) {
            if (await page.$('#go-link')) {
                await page.evaluate(() => {
                    const f = document.querySelector('#go-link')
                    const b = f?.querySelector('button, input[type=submit]')
                    if (b) b.click(); else f?.submit()
                })
            }
            await sleep(1000)
        }
        if (!found) throw new Error('Gagal mengambil URL tujuan.')
        return [found]
    } finally {
        await browser.close().catch(() => {})
    }
}

/* ---------- Bicolink ---------- */
function nonceAnswer(nonce) {
    let sum = 0
    for (let i = 0; i < nonce.length; i++) sum = (sum * 31 + nonce.charCodeAt(i) + i) % 1000000007
    return sum.toString(36)
}

async function bicolink(url) {
    const slug = url.replace(/\/+$/, '').split('/').pop()
    if (!slug) throw new Error('Slug tidak ditemukan.')

    const browser = await launchBrowser()
    try {
        const page = await browser.newPage()
        await page.setUserAgent(UA)
        page.setDefaultNavigationTimeout(45000)

        let found = null
        watchGo(page, u => { found = u })

        await page.goto(url, { waitUntil: 'networkidle2' })
        const freeUrl = `https://bicolink.com/al/free/${slug}`
        await page.goto(freeUrl, { waitUntil: 'networkidle2', referer: page.url() })

        const nonce = (await page.content()).match(/var\s+nonce\s*=\s*["']([^"']+)["']/)?.[1]
        if (nonce) {
            await page.evaluate(async (ans, s) => {
                const fd = new FormData()
                fd.append('nt_fb', ans)
                fd.append('nt_dari', 'tantangan')
                await fetch(`/al/verify/${s}`, { method: 'POST', body: fd, credentials: 'same-origin' })
            }, nonceAnswer(nonce), slug)
            await page.goto(freeUrl, { waitUntil: 'networkidle2' })
        }

        try {
            await page.waitForSelector('#wpsafe-link a', { timeout: 15000 })
            const href = await page.$eval('#wpsafe-link a', el => el.href)
            if (href) await page.goto(href, { waitUntil: 'networkidle2' })
        } catch {}

        const until = Date.now() + 25000
        while (!found && Date.now() < until) {
            if (await page.$('#go-link')) {
                await sleep(5500)
                await page.evaluate(() => {
                    const f = document.querySelector('#go-link')
                    const b = f?.querySelector('button, input[type=submit], a')
                    if (b) b.click(); else f?.submit()
                })
                await sleep(3000)
                if (found) break
            }
            if (await page.$('#wpsafe-link a')) {
                const next = await page.$eval('#wpsafe-link a', el => el.href)
                if (next && next !== page.url()) {
                    await page.goto(next, { waitUntil: 'networkidle2' })
                    continue
                }
            }
            await sleep(1000)
        }
        if (!found) throw new Error('Gagal mengambil URL tujuan.')
        return [found]
    } finally {
        await browser.close().catch(() => {})
    }
}

/* ---------- Handler ---------- */
let handler = async (m, { text, reply, prefix, command }) => {
    const quoted = m.quoted?.text || m.quoted?.msg?.text || ''
    const raw = (String(text || '') + ' ' + quoted).match(/https?:\/\/[^\s]+/i)?.[0]

    if (!raw) {
        return reply(
            `🔓 *BYPASS SHORTLINK*\n\n` +
            `Penggunaan: *${prefix + command} <url>*\n` +
            `Contoh: ${prefix + command} https://vplink.in/T5Sr3\n\n` +
            `Didukung: ${PROVIDERS.map(p => p.name).join(', ')}\n` +
            `_Bisa juga membalas pesan berisi link._`
        )
    }

    let host
    try { host = new URL(raw).hostname.toLowerCase() } catch { return reply('❌ URL tidak valid.') }

    const provider = PROVIDERS.find(p => p.match(host))
    if (!provider) return reply(`❌ Domain *${host}* belum didukung.\nDidukung: ${PROVIDERS.map(p => p.name).join(', ')}`)

    await reply(`⏳ Memproses link *${provider.name}*, mohon tunggu...`)

    const t0 = Date.now()
    try {
        const urls = await provider.run(raw)
        const body = urls.length === 1 ? urls[0] : urls.map((u, i) => `${i + 1}. ${u}`).join('\n')
        return reply(
            `✅ *BYPASS BERHASIL*\n\n` +
            `🌐 Provider : ${provider.name}\n` +
            `🔗 Asal     : ${raw}\n` +
            `🎯 Tujuan   :\n${body}\n\n` +
            `⏱ ${((Date.now() - t0) / 1000).toFixed(1)} detik`
        )
    } catch (e) {
        return reply(`❌ Gagal: ${e.message || 'terjadi kesalahan'}`)
    }
}

handler.command = ['bypass']
handler.help = ['bypass <url>']
handler.tags = ['tools']
handler.limit = true

export default handler
