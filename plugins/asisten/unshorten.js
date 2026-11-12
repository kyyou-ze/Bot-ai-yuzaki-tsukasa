// Buka link pendek, tampilkan rantai redirect + tujuan akhir (tanpa membuka isinya)
import { asisten as K } from '../../lib/core/data.js'
import { B } from '../../lib/core/data.js'
import dns from 'dns'
import { isPrivateIp } from '../../lib/services/scraper.js'
import { fromSpec } from '../../lib/platform/wa.js'
const priv = (host) => { const h = host.toLowerCase().replace(/^\[|\]$/g, ''); return h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '::1' || /^f[cd][0-9a-f]{2}:/.test(h) || /^fe80:/.test(h) }
async function hop(url) {
  const o = { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; KaguyaBot)' } }
  let r = await fetch(url, { ...o, method: 'HEAD' })
  if ([403, 405, 501].includes(r.status)) r = await fetch(url, { ...o, method: 'GET' })
  return r
}
const spec = {
  name: 'unshorten', alias: [], category: 'asisten', noLimit: false, cmds: ['unshorten'],
  desc: 'Buka link pendek (bit.ly, tinyurl, dll) dan tampilkan tujuan akhirnya dengan aman',
  run: async ({ m, text, prefix, reply }) => {
    const raw = (text || K.quotedText(m)).match(/https?:\/\/[^\s]+/i)?.[0]
    if (!raw) return reply(`☾ ${B('UNSHORTEN')}\n${prefix}unshorten https://bit.ly/xxxx\n_Bisa juga membalas pesan berisi tautan._`)
    try {
      let url = raw; const chain = [url]
      for (let i = 0; i < 8; i++) {
        const u = new URL(url)
        if (!/^https?:$/.test(u.protocol) || priv(u.hostname)) return reply('✕ Tautan ke alamat internal/lokal tidak diizinkan.')
        try { const addrs = await dns.promises.lookup(u.hostname, { all: true }); if (addrs.some(a => isPrivateIp(a.address))) return reply('✕ Tautan ke alamat internal/lokal tidak diizinkan.') } catch (e) { return reply('✕ Domain tidak bisa dijangkau: ' + e.message) }
        const r = await hop(url), loc = r.headers.get('location')
        if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).href; chain.push(url) } else break
      }
      const fin = chain[chain.length - 1]
      return reply(`☾ ${B('TAUTAN DIBUKA')}\n\n${chain.length > 1 ? chain.map((c, i) => `${i + 1}. ${c.length > 90 ? c.slice(0, 90) + '…' : c}`).join('\n') : 'Tidak ada pengalihan.'}\n\n${B('Tujuan akhir')}\n${fin}\n${B('Domain')} : *${new URL(fin).hostname}*${chain.length >= 8 ? '\n\n⚠ Terlalu banyak pengalihan — hati-hati.' : ''}\n\n_Selalu periksa domain sebelum membuka tautan._`)
    } catch (e) { return reply(e.name === 'TimeoutError' ? 'Server tujuan terlalu lama merespons.' : 'Tautan tidak valid atau tidak bisa dijangkau.') }
  },
}

export default fromSpec(spec)
