import { rbRun, rbRegister } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const feature = async ({ rbG, rbLib }) => {
  const axios = (__m => __m.default ?? __m)((await import('axios')))
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileP = promisify(execFile)

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  // TikWM sering membalas 403 ke request axios polos: coba kedua host dengan Origin/Referer, lalu curl sebagai cadangan.
  async function tikwmSearch(query) {
    const form = { keywords: query, count: '10', cursor: '0', web: '1' }
    let lastErr
    for (const host of ['https://tikwm.com', 'https://www.tikwm.com']) {
      try {
        const res = await axios.post(`${host}/api/feed/search`, new URLSearchParams(form), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Origin': host,
            'Referer': `${host}/`,
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': UA
          },
          timeout: 20000
        })
        // TikWM membatasi 1 request/detik: tunggu lalu coba lagi sekali
        if (res.data?.code === -1 && /1 request\/second/i.test(res.data?.msg || '')) {
          await sleep(1500)
          continue
        }
        return res.data
      } catch (e) {
        lastErr = e
      }
    }
    try {
      const { stdout } = await execFileP('curl', [
        '-s', '-L', '--max-time', '25', '-X', 'POST', 'https://www.tikwm.com/api/feed/search',
        '-H', 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
        '-H', 'Origin: https://www.tikwm.com', '-H', 'Referer: https://www.tikwm.com/',
        '-H', `User-Agent: ${UA}`,
        '--data-urlencode', `keywords=${query}`, '-d', 'count=10&cursor=0&web=1'
      ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 30000 })
      const out = JSON.parse(stdout)
      if (out?.code === 0) return out
      throw new Error(`curl: ${out?.msg || 'respons tidak valid'}`)
    } catch (e) {
      const why = e.code === 'ENOENT' ? 'curl tidak terpasang di server' : (e.message || '').split('\n')[0]
      throw new Error(`axios: ${lastErr?.message || 'gagal'} | cadangan ${why}`)
    }
  }

  // ── Cadangan: kalau IP server diblokir TikWM, coba API pencarian lain ──
  // Bisa diganti lewat config.js: global.ttSearchApis = ['https://host/path?query={q}', ...]
  const FALLBACK_APIS = () => (Array.isArray(global.ttSearchApis) && global.ttSearchApis.length ? global.ttSearchApis : [
    'https://api.siputzx.my.id/api/s/tiktok?query={q}',
    'https://api.vreden.my.id/api/tiktoksearch?query={q}',
    'https://api.ryzumi.vip/api/search/tiktok?query={q}'
  ])

  const pickArray = (d) => {
    for (const c of [d?.data?.videos, d?.data, d?.result?.videos, d?.result?.data, d?.result, d?.videos, d?.results]) {
      if (Array.isArray(c) && c.length) return c
    }
    return []
  }

  // ubah bentuk hasil API apa pun ke bentuk video TikWM
  const normalize = (v) => {
    const play = v.play || v.nowm || v.no_watermark || v.noWatermark || v.video || v.videoUrl || v.url || v.wmplay
    if (!play || typeof play !== 'string') return null
    const author = typeof v.author === 'object' && v.author ? v.author : {}
    return {
      title: v.title || v.desc || v.description || '',
      author: {
        nickname: author.nickname || author.name || v.nickname || '',
        unique_id: author.unique_id || author.username || author.uniqueId || v.username || v.unique_id || ''
      },
      duration: v.duration || 0,
      digg_count: v.digg_count ?? v.likes ?? v.like_count ?? v.stats?.diggCount ?? 0,
      comment_count: v.comment_count ?? v.comments ?? v.stats?.commentCount ?? 0,
      share_count: v.share_count ?? v.shares ?? v.stats?.shareCount ?? 0,
      play_count: v.play_count ?? v.views ?? v.stats?.playCount ?? 0,
      video_id: v.video_id || v.id || v.aweme_id || '',
      play
    }
  }

  async function searchVideos(query) {
    let tikwmErr
    try {
      const d = await tikwmSearch(query)
      if (d?.code === 0) return d.data?.videos || []
      tikwmErr = new Error(d?.msg || 'respons TikWM tidak valid')
    } catch (e) {
      tikwmErr = e
    }
    const errs = [`TikWM: ${tikwmErr.message}`]
    for (const tpl of FALLBACK_APIS()) {
      try {
        const url = tpl.replace('{q}', encodeURIComponent(query))
        const res = await axios.get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, timeout: 20000 })
        const list = pickArray(res.data).map(normalize).filter(Boolean)
        if (list.length) return list
        errs.push(`${new URL(url).host}: kosong`)
      } catch (e) {
        errs.push(`${new URL(tpl.replace('{q}', 'x')).host}: ${e.message}`)
      }
    }
    throw new Error(errs.join(' | '))
  }

  let handler = async (m, { conn, text, usedPrefix, command }) => {
      if (!text) {
          return m.reply(`*Uhh sayang...* masukin kata kunci pencarian TikTok-nya dong~ 🥺👉👈\n\n*Contoh:* \`${usedPrefix + command} jedag jedug preset\``);
      }

      await conn.sendMessage(m.chat, {
          react: { text: '⏳', key: m.key }
      });

      try {
          const videos = await searchVideos(text);

          if (!videos.length) {
              await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
              return m.reply(`*Aduh ayang...* Kaguya cari-cari sampe basah keringetan nggak nemu hasil buat \`"${text}"\` 🥺💦 Coba kata kunci lain ya mas?`);
          }

          const video = videos[Math.floor(Math.random() * videos.length)];

          const caption = `*─── [ TIKTOK SEARCH ] ───*

*Judul:* ${video.title || 'Tanpa Judul'}
  👤 *Author:* ${video.author?.nickname || '-'} (@${video.author?.unique_id || '-'})
  ⏱️ *Durasi:* ${video.duration || 0} detik
  ❤️ *Likes:* ${Number(video.digg_count || 0).toLocaleString()}
  💬 *Komentar:* ${Number(video.comment_count || 0).toLocaleString()}
  🔁 *Shares:* ${Number(video.share_count || 0).toLocaleString()}
  👀 *Views:* ${Number(video.play_count || 0).toLocaleString()}

  🔗 *Direct Link:* https://www.tiktok.com/@${video.author?.unique_id || '_'}/video/${video.video_id}

  _Udah siap ditonton nih mas gantengku~ mau kaguya temenin nontonnya?_ 💋🥵`;

          const playPath = video.play || video.wmplay;
          if (!playPath) throw new Error('Link video tidak tersedia dari TikWM');
          const videoUrl = playPath.startsWith('http') ? playPath : `https://www.tikwm.com${playPath}`;

          await conn.sendMessage(m.chat, {
              video: { url: videoUrl },
              caption: caption,
              mimetype: 'video/mp4'
          }, { quoted: m });

          await conn.sendMessage(m.chat, {
              react: { text: '💖', key: m.key }
          });
      } catch (err) {
          console.error('[TIKTOK SEARCH ERROR]:', err);
          await conn.sendMessage(m.chat, { react: { text: '⚠️', key: m.key } });
          m.reply(`*Aahh error ayang~* 🥵💦\nAda gangguan pas narik video: ${err.message || err}`);
      }
  };

  handler.help = ['tiktoks']
  handler.tags = ['search', 'download']
  handler.command = /^(tiktoksearch|ttsearch|tiktoks)$/i;
  handler.limit = false;
  handler.register = false;
  return handler
}

rbRegister("search/tiktoks", feature)

let handler = (m, ctx) => rbRun("search/tiktoks", m, ctx)

// command utama = nama file (tiktoks); ttsearch & tiktoksearch ikut terdaftar supaya bisa dipanggil langsung
handler.command = ['tiktoks', 'ttsearch', 'tiktoksearch']
handler.hide = ['ttsearch', 'tiktoksearch']
handler.help = ["tiktoks <query>"]
handler.tags = ['search']

export default handler
