// ---------------------------------------------------------
// Fitur   : Trace.moe (cari judul anime dari screenshot)
// Sumber  : api.trace.moe
// Skrep   : JH a.k.a DHIKA - FIONY BOT
//
// HARGAI WOY JANGAN DIHAPUS!
// Credits to all Fiony's Bot Admin.
// ---------------------------------------------------------
//
// Pakai:
//   kirim / reply gambar dengan caption  .tracemoe
//   .tracemoe <link gambar>

import axios from 'axios'
import crypto from 'crypto'
import https from 'https'
import { pickImage } from '../../lib/core/file.js'

const pick = (...vals) => {
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v !== undefined ? (v !== null ? (v !== '' ? true : (v === 0 ? true : (v === false ? true : false))) : false) : false) return v;
  }
  return '';
};

const jantung = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

const insecAgent = new https.Agent({ rejectUnauthorized: false });

const formatTime = (seconds) => {
  if (seconds === undefined ? true : (seconds === null ? true : false)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const sStr = s.toString();
  const sPad = sStr.length < 2 ? '0' + sStr : sStr;
  return `${m}:${sPad}`;
};

// imgBuffer : Buffer gambar | ct : content-type gambar
async function JHTraceMoe(imgBuffer, ct) {
  const baseRes = { status: true, author_skrep: 'JH a.k.a Dhika', kesayangan: 'Fiony Alveria♡', data: null };

  try {
    if (!Buffer.isBuffer(imgBuffer) || !imgBuffer.length) throw new Error('Gambar tidak valid');

    const boundRandom = crypto.randomBytes(8).toString('hex');
    const boundary = '----WebKitFormBoundary' + boundRandom;

    const headPayload = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="image.jpg"\r\nContent-Type: ${pick(ct, 'image/jpeg')}\r\n\r\n`);
    const tailPayload = Buffer.from(`\r\n--${boundary}--\r\n`);
    const payload = Buffer.concat([headPayload, imgBuffer, tailPayload]);

    const keys = Object.keys(jantung);
    const upHead = {};
    for (let i = 0; i < keys.length; i++) upHead[keys[i]] = jantung[keys[i]];
    upHead['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    upHead['Content-Length'] = payload.length;
    upHead['Host'] = 'api.trace.moe';

    const trRes = await axios.post('https://api.trace.moe/search?anilistInfo=2', payload, {
      headers: upHead,
      httpsAgent: insecAgent,
      validateStatus: () => true,
      timeout: 60000
    });

    if (trRes.status >= 400 ? true : !trRes.data) throw new Error(`Trace API Error HTTP ${trRes.status}`);

    const data = trRes.data;
    const apiErr = pick(data.error, '');
    if (apiErr !== '') throw new Error(`API Error: ${apiErr}`);

    const rawResults = data.result ? data.result : [];
    const results = [];

    for (let i = 0; i < rawResults.length; i++) {
      const r = rawResults[i];
      const anilist = r.anilist ? r.anilist : {};
      const titles = anilist.title ? anilist.title : {};

      const simNum = pick(r.similarity, 0);
      const simPct = (simNum * 100).toFixed(2) + '%';

      const tFrom = pick(r.from, null);
      const tTo = pick(r.to, null);
      const tStamp = `${formatTime(tFrom)} - ${formatTime(tTo)}`;

      const coverImg = anilist.coverImage ? anilist.coverImage : {};

      results.push({
        anilist_id: pick(anilist.id, null),
        mal_id: pick(anilist.idMal, null),
        title_romaji: pick(titles.romaji, ''),
        title_english: pick(titles.english, ''),
        title_native: pick(titles.native, ''),
        episode: pick(r.episode, null),
        similarity: simNum,
        similarity_percent: simPct,
        timestamp: tStamp,
        preview_video: pick(r.video, ''),
        preview_image: pick(r.image, ''),
        cover_image: pick(coverImg.large, ''),
        anilist_url: pick(anilist.siteUrl, ''),
        is_adult: anilist.isAdult === true ? true : false,
        filename: pick(r.filename, '')
      });
    }

    baseRes.data = {
      quota_remaining: pick(data.quota, 0) - pick(data.quotaUsed, 0),
      total_results: results.length,
      best_match: results.length > 0 ? results[0] : null,
      results: results
    };

    return baseRes;

  } catch (error) {
    baseRes.status = false;
    baseRes.error = pick(error.message, 'Unknown Error');
    return baseRes;
  }
}

const titleOf = (r) => r.title_romaji || r.title_english || r.title_native || 'Tidak diketahui'

let handler = async (m, { sock, text, reply, prefix }) => {
  const p = prefix || '.'

  // ambil gambar: dari pesan / reply, atau dari link di teks
  let buffer = null
  let mime = 'image/jpeg'

  const image = pickImage(m)
  if (image) {
    try {
      buffer = await image.download()
      mime = image.mime || mime
    } catch (e) {
      return reply('Gagal mengunduh gambar, coba kirim ulang.')
    }
  } else {
    const url = String(text || m.quoted?.text || '').match(/https?:\/\/[^\s]+/i)?.[0]
    if (!url) {
      return reply(
        `*TRACE.MOE*\n\n` +
        `Cari judul anime dari screenshot adegan.\n\n` +
        `Kirim atau reply gambar dengan caption ${p}tracemoe\n` +
        `atau ${p}tracemoe <link gambar>`
      )
    }
    try {
      const dl = await axios.get(url, {
        headers: { ...jantung, 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
        responseType: 'arraybuffer',
        httpsAgent: insecAgent,
        validateStatus: () => true,
        timeout: 30000
      })
      if (dl.status >= 400 || !dl.data) return reply(`Gagal mengambil gambar, HTTP ${dl.status}`)
      buffer = Buffer.from(dl.data)
      mime = String(dl.headers['content-type'] || mime).split(';')[0]
    } catch (e) {
      return reply(`Gagal mengambil gambar: ${e.message}`)
    }
  }

  if (!buffer || !buffer.length) return reply('Gambar kosong, coba kirim ulang.')

  await reply('Mencari anime, tunggu sebentar...')

  const res = await JHTraceMoe(buffer, mime)
  if (!res.status) return reply(`Gagal: ${res.error}`)

  const d = res.data
  const best = d.best_match
  if (!best) return reply('Anime tidak ditemukan dari gambar itu.')

  const others = d.results.slice(1, 3).map((r, i) =>
    `${i + 2}. ${titleOf(r)}${r.episode ? ` (eps ${r.episode})` : ''} - ${r.similarity_percent}`
  )

  let caption =
    `*${titleOf(best)}*\n` +
    (best.title_native && best.title_native !== titleOf(best) ? `${best.title_native}\n` : '') +
    `\nEpisode   : ${best.episode ?? '-'}\n` +
    `Waktu     : ${best.timestamp}\n` +
    `Kemiripan : ${best.similarity_percent}\n` +
    (best.anilist_url ? `AniList   : ${best.anilist_url}\n` : '') +
    (best.mal_id ? `MyAnimeList: https://myanimelist.net/anime/${best.mal_id}\n` : '')

  if (best.similarity < 0.9) caption += `\nKemiripan di bawah 90%, hasilnya mungkin kurang akurat.\n`
  if (others.length) caption += `\nKemungkinan lain:\n${others.join('\n')}\n`
  caption += `\nSisa kuota: ${d.quota_remaining}`

  // konten dewasa: kirim teks saja, tanpa preview
  if (best.is_adult) return reply(`${caption}\n\nPreview tidak dikirim karena konten dewasa.`)

  if (best.preview_video) {
    try {
      return await sock.sendMessage(m.chat, { video: { url: best.preview_video }, caption }, { quoted: m })
    } catch (e) {}
  }
  if (best.preview_image) {
    try {
      return await sock.sendMessage(m.chat, { image: { url: best.preview_image }, caption }, { quoted: m })
    } catch (e) {}
  }
  return reply(caption)
}

handler.command = ['tracemoe']
handler.help = ['tracemoe (reply/kirim gambar)']
handler.tags = ['anime']
handler.limit = true

export default handler
