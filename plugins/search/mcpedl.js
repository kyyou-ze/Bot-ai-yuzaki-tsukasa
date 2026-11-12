import axios from 'axios'
import { reactTo } from '../../lib/core/file.js'

/*
- HARGAI WOY JANGAN DIHAPUS!
- Skrep by *JH a.k.a DHIKA - FIONY BOT*
- Credits to all Fiony's Bot Admin.
- Maaf kalo kurang maksimal atau berantakan
- Hasil gabut saja xixixi.
*/

// mode: 'search' | 'download'
async function JHMCPEDL(mode, inputValue, page) {
    const baseRes = { status: true, data: {} }

    const pick = (...vals) => {
        for (const v of vals) if (v !== undefined && v !== null && v !== '') return v
        return ''
    }

    const headers = {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; 23021RAA2Y Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.8059.43 Mobile Safari/537.36'
    }

    try {
        const inputVal = pick(inputValue, '')
        if (inputVal === '') throw new Error('Input tidak boleh kosong')

        const pageNum = page > 0 ? page : 1

        if (mode === 'search') {
            baseRes.data.mode = 'search'
            baseRes.data.query = inputVal
            baseRes.data.page = pageNum
            baseRes.data.results = []

            const encQuery = encodeURIComponent(inputVal)
            const { data: sData, status: sStatus } = await axios.get(
                `https://api.mcpedl.com/api/search/advanced?q=${encQuery}&sort=relevance&page=${pageNum}`,
                { headers: { ...headers, Referer: `https://mcpedl.com/search/?q=${encQuery}` }, validateStatus: () => true }
            )
            if (sStatus >= 400 || !sData) throw new Error(`Search API Error HTTP ${sStatus}`)

            const rawRes = sData.results || []
            for (let i = 0; i < rawRes.length; i++) {
                const r = rawRes[i]
                const typeId = pick(r.type_id, 0)
                const typeStr = typeId === 1 ? 'Addon/Mod' : typeId === 2 ? 'Map/World' : typeId === 3 ? 'Texture Pack' : typeId === 6 ? 'Skin Pack' : 'Unknown'
                const dl = pick(r.downloadCount, 0)
                const fmt = dl >= 1000000 ? (dl / 1000000).toFixed(1) + 'M' : dl >= 1000 ? (dl / 1000).toFixed(1) + 'K' : String(dl)
                const rawUpd = pick(r.updated_at, '')
                const slug = pick(r.slug, '')
                baseRes.data.results.push({
                    no: i + 1,
                    title: pick(r.title, 'Unknown'),
                    type: typeStr,
                    author: pick(r.display_name, 'Unknown'),
                    downloads: fmt,
                    rating: Number(pick(r.average_rating, 0)).toFixed(2),
                    updated: rawUpd !== '' ? rawUpd.substring(0, 10) : '',
                    url: slug !== '' ? `https://mcpedl.com/${slug}/` : ''
                })
            }
            if (baseRes.data.results.length === 0) throw new Error('Tidak ada hasil pencarian')
        } else if (mode === 'download') {
            baseRes.data.mode = 'download'
            baseRes.data.target = inputVal
            baseRes.data.files = []

            let slug = inputVal
            const isHttp = inputVal.substring(0, 4).toLowerCase() === 'http'
            if (isHttp) {
                try {
                    const parts = new URL(inputVal).pathname.split('/').filter(Boolean)
                    slug = parts.length > 0 ? parts[parts.length - 1] : ''
                } catch {}
            }

            const foundLinks = []

            if (slug !== '') {
                const { data: dData, status: dStatus } = await axios.get(`https://api.mcpedl.com/api/route/slug/${slug}`, { headers, validateStatus: () => true })
                if (dStatus === 200) {
                    const dArr = dData?.data?.downloads || []
                    if (Array.isArray(dArr)) {
                        const seen = new Set()
                        for (const dFile of dArr) {
                            if (dFile.file && dFile.file.includes('edge.') && !seen.has(dFile.file)) {
                                seen.add(dFile.file)
                                const sp = dFile.file.split('/')
                                foundLinks.push({ name: pick(dFile.display_name, sp[sp.length - 1]), url: dFile.file, date: pick(dFile.fileDate, 0) })
                            }
                        }
                        foundLinks.sort((a, b) => new Date(b.date) - new Date(a.date))
                    }
                }
            }

            if (foundLinks.length === 0) {
                const targetUrl = isHttp ? inputVal : `https://mcpedl.com/${slug}/`
                const { data: capData, status: capStatus } = await axios.post('https://cap.jhx.my.id/api/createTask', { url: targetUrl, type: 'source' }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true })
                if (capStatus >= 400 || !capData) throw new Error('Solver createTask gagal')
                if (capData.success === false) throw new Error('Solver API gagal')

                const jobId = pick(capData.jobId, '')
                let baseHtml = ''
                let isReady = false
                let attempts = 0

                while (!isReady && attempts < 45) {
                    await new Promise(r => setTimeout(r, 1000))
                    const { data: resData } = await axios.post('https://cap.jhx.my.id/api/getResult', { jobId }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true })
                    if (resData?.status === 'ready') {
                        baseHtml = pick(resData.solution?.token, '')
                        isReady = true
                    } else if (resData?.status === 'failed') {
                        throw new Error('Solver gagal membuka halaman')
                    }
                    attempts++
                }

                if (baseHtml !== '') {
                    const aRegex = /https?:\/\/[^"'\s<>\\]+/gi
                    let mm
                    const edgeLinks = []
                    while ((mm = aRegex.exec(baseHtml)) !== null) {
                        const rawL = mm[0].split('&amp;').join('&')
                        if (rawL.includes('edge.mcpedl.com/files/') || rawL.includes('edge.forgecdn.net/files/')) edgeLinks.push(rawL)
                    }

                    const tokens = slug.split('-').filter(s => s.length > 2).map(s => s.toLowerCase())
                    const seenFb = new Set()
                    for (const currU of edgeLinks) {
                        let uPath = ''
                        try { uPath = new URL(currU).pathname } catch {}
                        if (uPath === '' || seenFb.has(uPath)) continue
                        const pSplits = uPath.split('/')
                        const pName = decodeURIComponent(pSplits[pSplits.length - 1]).toLowerCase()
                        const hit = tokens.length === 0 || tokens.some(t => pName.includes(t))
                        if (hit) {
                            seenFb.add(uPath)
                            foundLinks.push({ name: decodeURIComponent(pSplits[pSplits.length - 1]), url: currU, date: 0 })
                        }
                    }

                    const getId = (u) => {
                        const sp = u.split('/')
                        const k = sp.indexOf('files')
                        if (k < 0) return 0
                        const n = parseInt(`${sp[k + 1] ?? '0'}${sp[k + 2] ?? '0'}`, 10)
                        return isNaN(n) ? 0 : n
                    }
                    foundLinks.sort((a, b) => getId(b.url) - getId(a.url))
                }
            }

            if (foundLinks.length === 0) throw new Error('Tidak ada link download ditemukan')
            foundLinks.forEach((f, i) => baseRes.data.files.push({ no: i + 1, name: f.name, url: f.url }))
        } else {
            throw new Error('Mode tidak dikenali')
        }

        return baseRes
    } catch (error) {
        return { status: false, error: pick(error.message, 'Unknown Error') }
    }
}

let handler = async (m, { sock, text, prefix, command, reply }) => {
    const input = String(text || m.quoted?.text || '').trim()
    if (!input) {
        return reply(`Cari addon/map/texture Minecraft PE dari MCPEDL.\n\nContoh:\n${prefix}${command} furniture\n${prefix}${command} furniture | 2\n${prefix}${command} https://mcpedl.com/nama-addon/  (download)`)
    }

    try {
        await reactTo(sock, m, '⏳')

        // link mcpedl atau slug -> download
        if (/^https?:\/\/(www\.)?mcpedl\.com\//i.test(input)) {
            const res = await JHMCPEDL('download', input)
            if (!res.status) throw new Error(res.error)
            const files = res.data.files
            const list = files.slice(0, 8).map(f => `${f.no}. ${f.name}`).join('\n')
            await reply(`*⛏️ MCPEDL DOWNLOAD*\n\nDitemukan ${files.length} file (terbaru di atas):\n${list}\n\nMengirim file nomor 1...`)
            const top = files[0]
            try {
                await sock.sendMessage(m.chat, { document: { url: top.url }, fileName: top.name, mimetype: 'application/octet-stream' }, { quoted: m })
            } catch {
                await reply(`Gagal mengirim file langsung, unduh manual:\n${top.url}`)
            }
            return await reactTo(sock, m, '✅')
        }

        const [queryRaw, pageRaw] = input.split('|')
        const res = await JHMCPEDL('search', queryRaw.trim(), parseInt(pageRaw, 10) || 1)
        if (!res.status) throw new Error(res.error)

        const lines = res.data.results.slice(0, 10).map(r =>
            `${r.no}. *${r.title}*\n   ${r.type} • ${r.author}\n   ⬇️ ${r.downloads} • ⭐ ${r.rating} • ${r.updated}\n   ${r.url}`)
        await reply(`*⛏️ MCPEDL: ${res.data.query}* (hal. ${res.data.page})\n\n${lines.join('\n\n')}\n\nKirim link hasil dengan *${prefix}${command} <link>* untuk download.`)
        await reactTo(sock, m, '✅')
    } catch (e) {
        await reactTo(sock, m, '❌')
        reply(`❌ ${e.message || 'Gagal memproses.'}`)
    }
}

handler.command = ['mcpedl']
handler.help = ['mcpedl']
handler.tags = ['search']

export default handler
