// ---------------------------------------------------------
// Fitur   : AniBatch (cari, detail, episode, stream, download)
// Sumber  : anibatch.moe
// Skrep   : JH a.k.a DHIKA - FIONY BOT
//
// HARGAI WOY JANGAN DIHAPUS!
// Credits to all Fiony's Bot Admin.
// ---------------------------------------------------------
//
// Pakai:
//   .anibatch <judul>                      cari anime
//   .anibatch cari <judul> -p 2            cari, halaman 2
//   .anibatch detail <slug/link>           detail anime
//   .anibatch eps <slug/link>              daftar episode
//   .anibatch stream <slug> <eps>          daftar server streaming
//   .anibatch dl <slug> <eps> [480p]       link download satu episode
//   .anibatch dl <slug> 1-5 [480p]         link download beberapa episode

import axios from 'axios'

async function JHAniBatch(mode, target, extra, opts) {
  const baseRes = { status: true, author_skrep: 'JH a.k.a Dhika', kesayangan: 'Fiony Alveria♡', data: {} };

  const pick = (...vals) => {
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v !== undefined ? (v !== null ? (v !== '' ? true : (v === 0 ? true : (v === false ? true : false))) : false) : false) return v;
    }
    return '';
  };

  const BASE = 'https://anibatch.moe';
  const pipe = String.fromCharCode(124);

  const fileCtRegex = new RegExp(['video', 'audio', 'octet-stream', 'zip', 'rar', 'matroska', 'binary', 'force-download'].join(pipe), 'i');
  const typeRegex = new RegExp('(' + ['TV Series', 'Movie', 'ONA', 'OVA', 'Special'].join(pipe) + ')');
  const statusRegex = new RegExp('(' + ['Tamat', 'Ongoing', 'Upcoming'].join(pipe) + ')');
  const m3u8Regex = new RegExp(['mpegurl', 'm3u8'].join(pipe), 'i');

  const linkRegexArr = ['histats', '\\\\.svg', '\\\\.css', '\\\\.js', 'nimegami\\\\.id/assets', 'anibatch\\\\.moe/(play', 'genres', '\\\\?)'];
  const blockLinksRegex = new RegExp(linkRegexArr.join(pipe), 'i');

  const jantung = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'sec-ch-ua': '"Chromium";v="147", "Not.A/Brand";v="8"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36',
    'referer': `${BASE}/`
  };

  const fileNameFrom = (cd) => {
    if (cd === undefined ? true : (cd === null ? true : (cd === '' ? true : false))) return '';
    const m1 = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (m1 !== null) {
      try { return decodeURIComponent(m1[1]); } catch(e) {}
    }
    const m2 = cd.match(/filename="?([^";]+)"?/i);
    return m2 !== null ? m2[1] : '';
  };

  const reqFollow = async (method, pathStr, cookies, referer, maxRed, extraHeaders) => {
    let current = pathStr.substring(0, 4) === 'http' ? pathStr : BASE + pathStr;
    let jar = pick(cookies, '');
    const chain = [];
    let rStatus = 0;
    let rData = '';
    let rHeaders = {};
    let isFile = false;
    let isTruncated = false;
    let finalUrl = current;

    for (let i = 0; i <= pick(maxRed, 5); i++) {
      const h = {};
      const keys = Object.keys(jantung);
      for (let k = 0; k < keys.length; k++) h[keys[k]] = jantung[keys[k]];
      h['referer'] = pick(referer, BASE + '/');

      if (typeof extraHeaders === 'object' ? (extraHeaders !== null ? true : false) : false) {
        const exKeys = Object.keys(extraHeaders);
        for (let k = 0; k < exKeys.length; k++) h[exKeys[k]] = extraHeaders[exKeys[k]];
      }

      if (jar !== '') h['cookie'] = jar;

      const res = await axios({
        method: method,
        url: current,
        headers: h,
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: 'stream',
        timeout: 45000
      });

      rStatus = res.status;
      rHeaders = res.headers;
      finalUrl = current;

      const sc = rHeaders['set-cookie'];
      if (sc !== undefined ? (sc !== null ? true : false) : false) {
        for (let c = 0; c < sc.length; c++) {
          const cAdd = sc[c].split(';')[0];
          jar = jar !== '' ? jar + '; ' + cAdd : cAdd;
        }
      }
      chain.push({ url: current, status: rStatus });

      const ct = rHeaders['content-type'] !== undefined ? String(rHeaders['content-type']) : '';
      const cd = rHeaders['content-disposition'];
      const isRedir = rStatus === 301 ? true : (rStatus === 302 ? true : (rStatus === 303 ? true : (rStatus === 307 ? true : (rStatus === 308 ? true : false))));

      if (isRedir === false ? (cd !== undefined ? true : fileCtRegex.test(ct)) : false) {
        res.data.destroy();
        isFile = true;
        rData = '';
        break;
      }

      if (isRedir ? (rHeaders.location !== undefined ? true : false) : false) {
        current = new URL(rHeaders.location, current).toString();
        method = 'GET';
        res.data.destroy();
        continue;
      }

      rData = await new Promise((resolve, reject) => {
        let d = '';
        res.data.setEncoding('utf8');
        res.data.on('data', chunk => {
          d += chunk;
          if (d.length > 20 * 1024 * 1024) {
            res.data.destroy();
            isTruncated = true;
            resolve(d);
          }
        });
        res.data.on('end', () => resolve(d));
        res.data.on('error', e => reject(e));
      });
      break;
    }
    return { status: rStatus, data: rData, cookies: jar, headers: rHeaders, finalUrl: finalUrl, chain: chain, isFile: isFile, truncated: isTruncated };
  };

  const escHtml = (s) => {
    return s !== undefined ? (s !== null ? String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '') : '';
  };

  const cleanLabel = (s) => {
    return s !== undefined ? (s !== null ? String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '') : '';
  };

  const parseCatalog = (text) => {
    const j = JSON.parse(text);
    const items = [];
    const jAnim = j.anime ? j.anime : [];
    for (let i = 0; i < jAnim.length; i++) {
      const a = jAnim[i];
      items.push({
        slug: pick(a.slug, ''),
        title: pick(a.title, ''),
        alternative_titles: a.alternativeTitles ? a.alternativeTitles : [],
        url: BASE + '/play/' + pick(a.slug, ''),
        poster: pick(a.poster, ''),
        banner: pick(a.banner, ''),
        format: pick(a.format, ''),
        status: pick(a.status, ''),
        year: pick(a.year, ''),
        season: pick(a.season, ''),
        episodes: pick(a.episodes, ''),
        available_episodes: a.availableEpisodes ? a.availableEpisodes : [],
        genres: a.genres ? a.genres : [],
        score: pick(a.score, ''),
        popularity: pick(a.popularity, ''),
        duration: pick(a.duration, ''),
        studios: a.studios ? a.studios : [],
        country: pick(a.country, ''),
        synopsis: pick(a.synopsis, ''),
        updated_at: pick(a.updatedAt, '')
      });
    }
    return { total: pick(j.total, 0), page: pick(j.page, 1), pages: pick(j.pages, 1), items: items };
  };

  const parseDetailHtml = (html, sSlug) => {
    const detail = { slug: sSlug, url: BASE + '/play/' + sSlug };
    const tMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (tMatch !== null) detail.title = escHtml(tMatch[1].trim());
    const bMatch = html.match(/https:\/\/nimegami\.id\/assets\/anime-data\/images\/banners\/[^"'\s]+/);
    if (bMatch !== null) detail.banner = bMatch[0];
    const pMatch = html.match(/https:\/\/nimegami\.id\/assets\/anime-data\/images\/posters\/[^"'\s]+/);
    if (pMatch !== null) detail.poster = pMatch[0];
    const tyMatch = html.match(typeRegex);
    if (tyMatch !== null) detail.type = tyMatch[1];
    const yMatch = html.match(/·\s*(\d{4})/);
    if (yMatch !== null) detail.year = yMatch[1];
    const rMatch = html.match(/(\d+\.?\d*)\s*\/\s*10/);
    if (rMatch !== null) detail.rating = parseFloat(rMatch[1]);
    const stMatch = html.match(statusRegex);
    if (stMatch !== null) detail.status = stMatch[1];
    const epCMatch = html.match(/(\d+)\s*episode/i);
    if (epCMatch !== null) detail.episode_count = parseInt(epCMatch[1]);
    const sinMatch = html.match(/Tentang anime[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
    if (sinMatch !== null) detail.sinopsis = escHtml(sinMatch[1].replace(/<[^>]+>/g, '').trim());

    const info = {};
    const infoRegex = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
    let im;
    while ((im = infoRegex.exec(html)) !== null) {
      info[escHtml(im[1].trim())] = escHtml(cleanLabel(im[2]));
    }
    const keysInfo = Object.keys(info);
    if (keysInfo.length > 0) detail.info = info;

    const genres = [];
    const genreRegex = /\/genres\/[^"']+">([^<]+)</gi;
    let gm;
    while ((gm = genreRegex.exec(html)) !== null) genres.push(escHtml(gm[1].trim()));
    if (genres.length > 0) detail.genres = genres;

    const episodes = [];
    const epSet = [];
    const epRegex = /\/play\/[^/]+\/ep-(\d+)"/gi;
    let em;
    while ((em = epRegex.exec(html)) !== null) {
      const n = parseInt(em[1]);
      let isHit = false;
      for (let s = 0; s < epSet.length; s++) {
        if (epSet[s] === n) { isHit = true; break; }
      }
      if (isHit === false) {
        epSet.push(n);
        episodes.push({ episode: n, url: BASE + '/play/' + sSlug + '/ep-' + n });
      }
    }
    episodes.sort((a, b) => a.episode - b.episode);
    detail.episodes = episodes;

    const kTip = pick(info['Tipe'], '');
    if (kTip !== '') detail.type = kTip;
    const kStat = pick(info['Status'], '');
    if (kStat !== '') detail.status = kStat;
    const kEp = pick(info['Episode'], '');
    if (kEp !== '' ? /^\d+$/.test(kEp) : false) detail.episode_count = parseInt(kEp);
    const kY = pick(info['Tahun rilis'], '');
    if (kY !== '') detail.year = kY;
    const kR = pick(info['Rating'], '');
    if (kR !== '') {
      const rm = kR.match(/(\d+\.?\d*)/);
      if (rm !== null) detail.rating = parseFloat(rm[1]);
    }
    return detail;
  };

  const extractRscText = (html) => {
    const re = /rsc\.push\(("(?:[^"\\]|\\.)*")\)/g;
    let m, text = '';
    while ((m = re.exec(html)) !== null) {
      try { text += JSON.parse(m[1]); } catch(e) {}
    }
    return text;
  };

  const extractStreams = (html) => {
    const text = extractRscText(html);
    const k = text.indexOf('"streams":[');
    if (k < 0) return [];
    const start = text.indexOf('[', k);
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) { esc = false; }
        else if (c === '\\') { esc = true; }
        else if (c === '"') { inStr = false; }
        continue;
      }
      if (c === '"') { inStr = true; }
      else if (c === '[') { depth++; }
      else if (c === ']') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) return [];
    try { return JSON.parse(text.substring(start, end + 1)); } catch(e) { return []; }
  };

  const epNum = (s) => {
    const v = s.episode;
    if (v === null ? true : (v === undefined ? true : (v === '' ? true : (v === '$undefined' ? true : false)))) return NaN;
    return Number(v);
  };

  const pickStreams = (all, episode) => {
    if (episode !== null ? (episode !== undefined ? (episode !== '' ? true : false) : false) : false) {
      const n = parseInt(episode);
      const res = [];
      for (let i = 0; i < all.length; i++) {
        if (epNum(all[i]) === n) res.push(all[i]);
      }
      return res;
    }
    const eps = [];
    for (let i = 0; i < all.length; i++) {
      const num = epNum(all[i]);
      if (Number.isFinite(num)) {
        let isHas = false;
        for (let e = 0; e < eps.length; e++) {
          if (eps[e] === num) { isHas = true; break; }
        }
        if (isHas === false) eps.push(num);
      }
    }
    if (eps.length > 1) {
      let min = eps[0];
      for (let i = 1; i < eps.length; i++) {
        if (eps[i] < min) min = eps[i];
      }
      const res = [];
      for (let i = 0; i < all.length; i++) {
        if (epNum(all[i]) === min) res.push(all[i]);
      }
      return res;
    }
    const noEp = [];
    for (let i = 0; i < all.length; i++) {
      if (Number.isFinite(epNum(all[i])) === false) noEp.push(all[i]);
    }
    if (noEp.length > 0) return noEp;
    return all;
  };

  const parseServers = (html, episode) => {
    const optLabel = {};
    const optRe = /<option[^>]*\bvalue="([^"]*)"([^>]*)>([\s\S]*?)<\/option>/gi;
    let m;
    while ((m = optRe.exec(html)) !== null) {
      const rawC = String(m[2]) + String(m[3]);
      optLabel[m[1]] = { label: cleanLabel(m[3]), recommended: /rekomendasi/i.test(rawC) };
    }
    const all = extractStreams(html);
    const streams = pickStreams(all, episode);
    const servers = [];
    for (let i = 0; i < streams.length; i++) {
      const s = streams[i];
      const o = optLabel[s.id] ? optLabel[s.id] : {};
      const url = pick(s.playUrl, s.url, '');
      const n = epNum(s);

      let sName = pick(s.label, '');
      const lSplit = pick(o.label, '').split('·');
      if (lSplit.length > 0 ? (lSplit[0] !== '' ? true : false) : false) sName = lSplit[0].trim();

      const fLabel = pick(o.label, pick(s.label, '') + ' · ' + pick(s.quality, ''));

      servers.push({
        id: pick(s.id, ''),
        name: sName,
        provider: pick(s.provider, ''),
        quality: pick(s.quality, ''),
        label: fLabel,
        mode: pick(s.mode, ''),
        episode: Number.isFinite(n) ? n : null,
        recommended: o.recommended ? true : false,
        can_download: s.canDownload ? true : false,
        embed_url: url
      });
    }
    return servers;
  };

  const probeMedia = async (url, referer, cookies) => {
    let r;
    for (let i = 0; i < 3; i++) {
      r = await reqFollow('GET', url, cookies, referer, 5, { accept: '*/*', range: 'bytes=0-0' });
      if (r.status === 416) r = await reqFollow('GET', url, cookies, referer, 5, { accept: '*/*' });
      const rawD = pick(r.data, '');
      if (r.status === 502 ? (/belum tersedia/i.test(rawD) === false ? true : false) : true) break;
      if (i < 2) await new Promise(re => setTimeout(re, 2500));
    }
    const rawCt = pick(r.headers['content-type'], '');
    const ct = rawCt.split(';')[0];
    const cr = r.headers['content-range'];
    let total = NaN;
    if (cr !== undefined ? (cr !== null ? true : false) : false) {
      total = parseInt(String(cr).split('/')[1]);
    } else {
      total = parseInt(r.headers['content-length']);
    }

    const info = {
      status: r.status,
      content_type: ct,
      accept_ranges: pick(r.headers['accept-ranges'], null),
      size_bytes: Number.isFinite(total) ? total : null,
      size_mb: Number.isFinite(total) ? Number((total / 1048576).toFixed(1)) : null
    };

    const body = pick(r.data, '');
    if (r.isFile) {
      info.type = 'video-file';
      info.direct_url = r.finalUrl;
    } else if (m3u8Regex.test(ct) ? true : /^\s*#EXTM3U/.test(body)) {
      info.type = 'hls';
      info.playlist_url = r.finalUrl;
      const variants = [];
      const lines = body.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/^#EXT-X-STREAM-INF/i.test(lines[i])) {
          const mRes = lines[i].match(/RESOLUTION=(\d+x\d+)/i);
          const fRes = mRes !== null ? mRes[1] : null;
          const uri = lines[i + 1] !== undefined ? lines[i + 1].trim() : '';
          if (uri !== '') {
            variants.push({ resolution: fRes, url: new URL(uri, r.finalUrl).toString() });
          }
        }
      }
      if (variants.length > 0) info.variants = variants;
    } else if (r.status === 502 ? /belum tersedia/i.test(body) : false) {
      info.type = 'not_ready';
      info.note = 'File belum tersedia di server.';
    } else {
      info.type = 'other';
      info.body_preview = body.substring(0, 300);
      info.final_url = r.finalUrl;
    }
    return info;
  };

  const resolveServer = async (s, epUrl, cookies) => {
    const out = { ...s };
    const emUrl = pick(s.embed_url, '');
    if (emUrl === '') { out.note = 'playUrl kosong'; return out; }
    try {
      const r = await reqFollow('GET', emUrl, cookies, epUrl, 5, null);
      const body = pick(r.data, '');
      const rawCt = pick(r.headers['content-type'], '');
      out.resolved = { status: r.status, content_type: rawCt.split(';')[0] };

      const im = body.match(/<iframe[^>]*src="([^"]+)"/i);
      if (im !== null) out.resolved.iframe_src = escHtml(im[1]);

      const ds = body.match(/\bdata-src="([^"]+)"/i);
      if (ds !== null) {
        const streamUrl = new URL(escHtml(ds[1]), r.finalUrl).toString();
        out.resolved.stream_url = streamUrl;
        try {
          out.resolved.stream = await probeMedia(streamUrl, r.finalUrl, r.cookies);
        } catch(e) {
          out.resolved.stream = { error: pick(e.message, '') };
        }
      }

      const linkRe = /https?:\/\/[^"'\s<>\\]+?\.(?:m3u8|mp4|mkv)(?=[?#&"'\s<>\\]|$)[^"'\s<>\\]*/gi;
      const cleanB = body.replace(/\\\//g, '/');
      const lMatch = cleanB.match(linkRe);
      if (lMatch !== null) {
        const lSet = [];
        for (let i = 0; i < lMatch.length; i++) {
          let hasL = false;
          for (let z = 0; z < lSet.length; z++) {
            if (lSet[z] === lMatch[i]) { hasL = true; break; }
          }
          if (hasL === false) lSet.push(lMatch[i]);
        }
        out.resolved.direct_links = lSet;
      }
    } catch(e) {
      out.resolved = { error: pick(e.message, '') };
    }
    return out;
  };

  const resolveDownload = async (pathStr, epUrl, cookies) => {
    let last = null;
    for (let i = 0; i < 4; i++) {
      last = await reqFollow('GET', pathStr, cookies, epUrl, 5, null);
      const body = pick(last.data, '');
      if (/File belum tersedia/i.test(body) === false) break;
      if (i < 3) await new Promise(re => setTimeout(re, 2500));
    }
    const bodyF = pick(last.data, '');
    const cdF = last.headers['content-disposition'];
    const sStr = pick(last.headers['content-length'], '');
    const sizeF = parseInt(sStr);

    const out = {};
    const rawCtF = pick(last.headers['content-type'], '');

    if (last.isFile) {
      out.status = last.status;
      out.is_file = true;
      out.filename = fileNameFrom(cdF);
      out.size_bytes = Number.isFinite(sizeF) ? sizeF : null;
      out.size_mb = Number.isFinite(sizeF) ? Number((sizeF / 1048576).toFixed(1)) : null;
      out.content_type = rawCtF.split(';')[0];
      out.direct_url = last.finalUrl;
    } else {
      out.status = last.status;
      out.final_url = last.finalUrl;
      out.is_file = false;
      out.content_type = rawCtF.split(';')[0];
      out.chain = last.chain;
    }

    if (/File belum tersedia/i.test(bodyF)) out.note = 'File belum tersedia setelah 4x retry';

    const lMat = bodyF.match(/https?:\/\/[^"'\s<>\\]+/gi);
    if (lMat !== null) {
      const lSet = [];
      for (let i = 0; i < lMat.length; i++) {
        const u = lMat[i];
        if (blockLinksRegex.test(u) === false) {
          let hasL = false;
          for (let z = 0; z < lSet.length; z++) {
            if (lSet[z] === u) { hasL = true; break; }
          }
          if (hasL === false) lSet.push(u);
        }
      }
      if (lSet.length > 0) out.links = lSet.slice(0, 60);
    }

    if (bodyF !== '' ? (/<[a-z]/i.test(bodyF) === false) : false) out.text = bodyF.substring(0, 300);

    const isL = out.links !== undefined ? (out.links.length > 0 ? true : false) : false;
    const isT = out.text !== undefined ? (out.text !== '' ? true : false) : false;
    const isN = out.note !== undefined ? (out.note !== '' ? true : false) : false;

    if (last.isFile === false ? (isL === false ? (isT === false ? (isN === false ? true : false) : false) : false) : false) {
      out.body_preview = bodyF.substring(0, 500);
    }
    return out;
  };

  const batchDownload = async (sSlug, rangeStr, cookies, quality) => {
    const detailReq = await reqFollow('GET', '/play/' + sSlug, cookies, BASE + '/', 5, null);
    const d = parseDetailHtml(detailReq.data, sSlug);
    const epsAll = d.episodes;
    const eps = [];

    if (rangeStr !== '' ? (rangeStr !== 'all' ? true : false) : false) {
      const parts = rangeStr.split('-');
      const a = parts.length > 0 ? parseInt(parts[0]) : 1;
      const b = parts.length > 1 ? parseInt(parts[1]) : a;
      for (let i = 0; i < epsAll.length; i++) {
        const n = epsAll[i].episode;
        if (n >= a ? (n <= b ? true : false) : false) eps.push(n);
      }
    } else {
      for (let i = 0; i < epsAll.length; i++) eps.push(epsAll[i].episode);
    }

    const items = [];
    for (let i = 0; i < eps.length; i += 3) {
      const chunk = eps.slice(i, i + 3);
      const resChunk = [];
      for (let c = 0; c < chunk.length; c++) {
        const n = chunk[c];
        try {
          const epUrl = `/play/${sSlug}/ep-${n}`;
          const pr = await reqFollow('GET', epUrl, cookies, BASE + '/', 5, null);
          const dlAll = parseServers(pr.data, n);
          const dl = [];
          for (let dli = 0; dli < dlAll.length; dli++) {
            if (dlAll[dli].can_download) dl.push(dlAll[dli]);
          }
          let path = '';
          let q = null;
          if (quality !== '') {
            let o = null;
            for (let dli = 0; dli < dl.length; dli++) {
              if (dl[dli].quality === quality) { o = dl[dli]; break; }
            }
            if (o === null) {
              const av = [];
              for (let a = 0; a < dl.length; a++) {
                let hh = false;
                for (let z = 0; z < av.length; z++) { if (av[z] === dl[a].quality) hh = true; }
                if (hh === false) av.push(dl[a].quality);
              }
              resChunk.push({ episode: n, status: 'quality_not_available', available: av });
              continue;
            }
            path = `/api/download/${sSlug}/${o.id}`;
            q = o.quality;
          } else {
            const hm = pr.data.match(/\/api\/download\/[^"'\s\\]+/);
            if (hm === null) {
              resChunk.push({ episode: n, status: 'no_hash_found' });
              continue;
            }
            path = hm[0];
            const pSplit = path.split('/');
            const pId = pSplit[pSplit.length - 1];
            let o = null;
            for (let dli = 0; dli < dl.length; dli++) {
              if (dl[dli].id === pId) { o = dl[dli]; break; }
            }
            q = o !== null ? o.quality : null;
          }
          const rd = await resolveDownload(path, BASE + epUrl, pr.cookies);
          resChunk.push({ episode: n, quality: q, download_path: path, resolved: rd });
        } catch(e) {
          resChunk.push({ episode: n, status: 'error', error: pick(e.message, '') });
        }
      }
      for (let c = 0; c < resChunk.length; c++) items.push(resChunk[c]);
      if (i + 3 < eps.length) await new Promise(re => setTimeout(re, 400));
    }
    return items;
  };

  try {
    const cleanMode = pick(mode, '').toLowerCase();
    const rawTarget = pick(target, '');
    let cleanTarget = rawTarget.replace(BASE, '').replace(/^\/play\//, '').replace(/\/$/, '');
    let cleanExtra = pick(extra, '');

    const slugEp = cleanTarget.match(/^(.+)\/ep-(\d+)$/);
    if (slugEp !== null) {
      cleanTarget = slugEp[1];
      if (cleanExtra === '') cleanExtra = slugEp[2];
    }

    const pOpts = typeof opts === 'object' ? (opts !== null ? opts : {}) : {};
    const qFlag = pick(pOpts.q, '');

    const rInit = await reqFollow('GET', '/api/site-scripts', '', '', 5, null);
    const cookies = rInit.cookies;

    if (cleanMode === 'search') {
      const pageN = typeof pOpts.page === 'number' ? pOpts.page : (parseInt(cleanExtra) > 0 ? parseInt(cleanExtra) : 1);
      const sortS = pick(pOpts.sort, 'popular');
      const isAll = pOpts.all === true ? true : false;

      const fetchPage = async (pg) => {
        const encT = encodeURIComponent(cleanTarget).replace(/%20/g, '+');
        let aPath = '/api/catalog?q=' + encT + '&sort=' + encodeURIComponent(sortS);
        if (pg > 1) aPath += '&page=' + pg;
        const ref = BASE + '/?q=' + encT + '&sort=' + sortS + (pg > 1 ? '&page=' + pg : '');
        const rx = await reqFollow('GET', aPath, cookies, ref, 5, { accept: '*/*' });
        if (rx.status !== 200) throw new Error('HTTP ' + rx.status + ' on catalog');
        try { return parseCatalog(rx.data); } catch(e) { throw new Error('Respons catalog bukan JSON valid'); }
      };

      const cat = await fetchPage(pageN);
      if (cat.page !== undefined ? (cat.page !== pageN ? true : false) : false) {
        cat.warning = `Minta page ${pageN} server kasih page ${cat.page}`;
      }

      if (isAll ? (cat.warning === undefined ? true : false) : false) {
        const seen = [];
        for (let i = 0; i < cat.items.length; i++) seen.push(cat.items[i].slug);
        const lP = pick(cat.pages, pageN);
        const maxP = pageN + 19;
        const last = lP < maxP ? lP : maxP;

        for (let pg = pageN + 1; pg <= last; pg++) {
          await new Promise(re => setTimeout(re, 300));
          const cx = await fetchPage(pg);
          if (cx.page !== undefined ? (cx.page !== pg ? true : false) : false) {
            cat.warning = `Halaman ${pg} tidak sesuai, berhenti`;
            break;
          }
          for (let i = 0; i < cx.items.length; i++) {
            const ix = cx.items[i];
            let hs = false;
            for (let z = 0; z < seen.length; z++) { if (seen[z] === ix.slug) hs = true; }
            if (hs === false) { seen.push(ix.slug); cat.items.push(ix); }
          }
        }
        cat.fetched_pages = [pageN, last];
      }

      baseRes.data = { mode: 'search', query: cleanTarget };
      const cKeys = Object.keys(cat);
      for (let i = 0; i < cKeys.length; i++) baseRes.data[cKeys[i]] = cat[cKeys[i]];

    } else if (cleanMode === 'detail') {
      const rDet = await reqFollow('GET', '/play/' + cleanTarget, cookies, '', 5, null);
      if (rDet.status !== 200) throw new Error('HTTP ' + rDet.status + ' on detail');

      baseRes.data = { mode: 'detail' };
      const dObj = parseDetailHtml(rDet.data, cleanTarget);
      const dKeys = Object.keys(dObj);
      for (let i = 0; i < dKeys.length; i++) baseRes.data[dKeys[i]] = dObj[dKeys[i]];

    } else if (cleanMode === 'episodes') {
      const rEp = await reqFollow('GET', '/play/' + cleanTarget, cookies, '', 5, null);
      if (rEp.status !== 200) throw new Error('HTTP ' + rEp.status + ' on detail');
      const d = parseDetailHtml(rEp.data, cleanTarget);
      baseRes.data = { mode: 'episodes', slug: cleanTarget, total: d.episodes.length, episodes: d.episodes };

    } else if (cleanMode === 'stream') {
      const epS = cleanExtra !== '' ? cleanExtra : null;
      const pPath = '/play/' + cleanTarget + (epS !== null ? '/ep-' + epS : '');
      const eUrl = BASE + pPath;

      const rStr = await reqFollow('GET', pPath, cookies, '', 5, null);
      if (rStr.status !== 200) throw new Error('HTTP ' + rStr.status + ' on stream page');

      let servers = parseServers(rStr.data, epS);
      if (servers.length === 0) throw new Error('Server tidak ditemukan di halaman');

      const isRes = pOpts.resolve === true ? true : false;
      if (isRes) {
        const resolved = [];
        for (let i = 0; i < servers.length; i += 3) {
          const chunk = servers.slice(i, i + 3);
          const rProm = [];
          for (let c = 0; c < chunk.length; c++) rProm.push(resolveServer(chunk[c], eUrl, cookies));
          const rDone = await Promise.all(rProm);
          for (let c = 0; c < rDone.length; c++) resolved.push(rDone[c]);
        }
        servers = resolved;
      }

      const fnEp = epS !== null ? epS : (servers[0].episode !== null ? String(servers[0].episode) : null);
      baseRes.data = { mode: 'stream', slug: cleanTarget, episode: fnEp, url: eUrl, total: servers.length, servers: servers };

    } else if (cleanMode === 'download') {
      const isAllOrRange = cleanExtra === 'all' ? true : (/^\d+-\d+$/.test(cleanExtra) ? true : false);

      if (isAllOrRange) {
        const items = await batchDownload(cleanTarget, cleanExtra, cookies, qFlag);
        baseRes.data = { mode: 'download', slug: cleanTarget, batch: true, total: items.length, items: items };
      } else {
        let epPath = '/play/' + cleanTarget + (cleanExtra !== '' ? '/ep-' + cleanExtra : '');
        const pReq = await reqFollow('GET', epPath, cookies, '', 5, null);
        if (pReq.status !== 200) throw new Error('HTTP ' + pReq.status + ' on page');

        const dlAll = parseServers(pReq.data, cleanExtra !== '' ? cleanExtra : null);
        const dlSrv = [];
        for (let i = 0; i < dlAll.length; i++) {
          if (dlAll[i].can_download) dlSrv.push(dlAll[i]);
        }

        const options = [];
        for (let i = 0; i < dlSrv.length; i++) {
          const sx = dlSrv[i];
          options.push({ quality: sx.quality, name: sx.name, id: sx.id, recommended: sx.recommended, path: `/api/download/${cleanTarget}/${sx.id}` });
        }

        let chosen = null;
        if (qFlag !== '') {
          for (let i = 0; i < options.length; i++) {
            if (options[i].quality === qFlag) { chosen = options[i]; break; }
          }
          if (chosen === null) throw new Error('Kualitas ' + qFlag + ' tidak tersedia');
        }

        if (chosen === null) {
          const hm = pReq.data.match(/\/api\/download\/[^"'\s\\]+/);
          chosen = hm !== null ? { path: hm[0] } : (options.length > 0 ? options[0] : null);
        }
        if (chosen === null) throw new Error('Download hash tidak ditemukan');

        const rd = await resolveDownload(chosen.path, BASE + epPath, pReq.cookies);
        baseRes.data = { mode: 'download', slug: cleanTarget, episode: cleanExtra !== '' ? cleanExtra : null, download_path: chosen.path, full_url: BASE + chosen.path, available: options, resolved: rd };
      }

    } else {
      throw new Error('Mode tidak dikenali: ' + cleanMode);
    }

    return JSON.stringify(baseRes, null, 2);

  } catch (error) {
    baseRes.status = false;
    baseRes.error = pick(error.message, 'Unknown Error');
    baseRes.data = null;
    return JSON.stringify(baseRes, null, 2);
  }
}

// ───────── handler ─────────

const MODES = {
  cari: 'search', search: 'search',
  detail: 'detail', info: 'detail',
  eps: 'episodes', episode: 'episodes', episodes: 'episodes',
  stream: 'stream',
  dl: 'download', download: 'download'
}

const clip = (s, n = 500) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

const QUALITY_RE = /^\d{3,4}p$/i

let handler = async (m, { sock, text, reply, prefix }) => {
  const p = prefix || '.'
  const input = String(text || m.quoted?.text || '').trim()

  if (!input) {
    return reply(
      `*ANIBATCH*\n\n` +
      `Cari anime : ${p}anibatch <judul>\n` +
      `Detail     : ${p}anibatch detail <slug/link>\n` +
      `Episode    : ${p}anibatch eps <slug/link>\n` +
      `Streaming  : ${p}anibatch stream <slug> <eps>\n` +
      `Download   : ${p}anibatch dl <slug> <eps> [480p]\n` +
      `Beberapa eps: ${p}anibatch dl <slug> 1-5 [480p]\n\n` +
      `Contoh:\n${p}anibatch black clover\n${p}anibatch dl black-clover-sub-indo 6 480p`
    )
  }

  const words = input.split(/\s+/)
  let mode = MODES[words[0].toLowerCase()]
  const rest = mode ? words.slice(1) : words
  if (!mode) mode = 'search'

  try {
    await reply('Memproses, tunggu sebentar...')

    // ── cari ──
    if (mode === 'search') {
      const raw = rest.join(' ')
      const pm = raw.match(/\s-p\s*(\d+)\s*$/i)
      const page = pm ? Math.max(parseInt(pm[1]), 1) : 1
      const query = (pm ? raw.slice(0, pm.index) : raw).trim()
      if (!query) return reply(`Tulis judulnya. Contoh: ${p}anibatch black clover`)

      const res = JSON.parse(await JHAniBatch('search', query, '', { page, sort: 'popular', all: false }))
      if (!res.status) return reply(`Gagal: ${res.error}`)

      const items = res.data.items || []
      if (!items.length) return reply(`Anime "${query}" tidak ditemukan.`)

      const lines = items.slice(0, 10).map((a, i) => {
        const meta = [a.format, a.status, a.year, a.episodes ? `${a.episodes} eps` : '', a.score ? `skor ${a.score}` : '']
          .filter(Boolean).join(' | ')
        return `${i + 1}. *${a.title}*\n   ${meta}\n   slug: ${a.slug}`
      })
      return reply(
        `*HASIL: ${query}*\n` +
        `Halaman ${res.data.page}/${res.data.pages}, total ${res.data.total}\n\n` +
        lines.join('\n\n') +
        `\n\nDetail: ${p}anibatch detail <slug>\nDownload: ${p}anibatch dl <slug> <eps>`
      )
    }

    const target = rest[0]
    if (!target) return reply(`Tulis slug atau link anime-nya. Contoh: ${p}anibatch ${mode === 'download' ? 'dl' : mode} black-clover-sub-indo`)

    // ── detail ──
    if (mode === 'detail') {
      const res = JSON.parse(await JHAniBatch('detail', target, '', {}))
      if (!res.status) return reply(`Gagal: ${res.error}`)
      const d = res.data
      const caption =
        `*${d.title || d.slug}*\n\n` +
        `Tipe    : ${d.type || '-'}\n` +
        `Status  : ${d.status || '-'}\n` +
        `Tahun   : ${d.year || '-'}\n` +
        `Rating  : ${d.rating || '-'}\n` +
        `Episode : ${d.episode_count || (d.episodes ? d.episodes.length : '-')}\n` +
        `Genre   : ${(d.genres || []).join(', ') || '-'}\n\n` +
        `${clip(d.sinopsis, 600) || 'Sinopsis tidak tersedia.'}\n\n` +
        `Link: ${d.url}`
      if (d.poster) {
        return sock.sendMessage(m.chat, { image: { url: d.poster }, caption }, { quoted: m }).catch(() => reply(caption))
      }
      return reply(caption)
    }

    // ── daftar episode ──
    if (mode === 'episodes') {
      const res = JSON.parse(await JHAniBatch('episodes', target, '', {}))
      if (!res.status) return reply(`Gagal: ${res.error}`)
      const eps = res.data.episodes || []
      if (!eps.length) return reply('Episode tidak ditemukan.')
      return reply(
        `*EPISODE ${res.data.slug}*\nTotal ${res.data.total}\n\n` +
        eps.map(e => e.episode).join(', ') +
        `\n\nDownload: ${p}anibatch dl ${res.data.slug} <eps>`
      )
    }

    // ── streaming ──
    if (mode === 'stream') {
      const eps = rest[1] && /^\d+$/.test(rest[1]) ? rest[1] : ''
      const res = JSON.parse(await JHAniBatch('stream', target, eps, { resolve: false }))
      if (!res.status) return reply(`Gagal: ${res.error}`)
      const servers = res.data.servers || []
      const lines = servers.slice(0, 8).map((s, i) =>
        `${i + 1}. ${s.name || s.provider || 'Server'} ${s.quality ? `(${s.quality})` : ''}${s.recommended ? ' [rekomendasi]' : ''}\n   ${s.embed_url}`
      )
      return reply(
        `*STREAMING ${res.data.slug}*\nEpisode ${res.data.episode || '-'} | ${res.data.total} server\n\n` +
        lines.join('\n\n') +
        `\n\nHalaman: ${res.data.url}`
      )
    }

    // ── download ──
    if (mode === 'download') {
      const quality = (rest.slice(1).find(t => QUALITY_RE.test(t)) || '').toLowerCase()
      const eps = rest.slice(1).find(t => !QUALITY_RE.test(t)) || ''
      if (!eps) return reply(`Tulis nomor episodenya. Contoh: ${p}anibatch dl ${target} 1 480p`)

      const res = JSON.parse(await JHAniBatch('download', target, eps, quality ? { q: quality } : {}))
      if (!res.status) return reply(`Gagal: ${res.error}`)
      const d = res.data

      // batch
      if (d.batch) {
        const items = d.items || []
        if (!items.length) return reply('Episode tidak ditemukan pada rentang itu.')
        const lines = items.slice(0, 15).map(it => {
          const r = it.resolved
          const link = r ? (r.direct_url || r.final_url || (r.links && r.links[0]) || '') : ''
          if (link) return `Eps ${it.episode}${it.quality ? ` (${it.quality})` : ''}:\n${link}`
          return `Eps ${it.episode}: ${it.status || (r && r.note) || 'link tidak ditemukan'}`
        })
        return reply(`*DOWNLOAD ${d.slug}*\n\n${lines.join('\n\n')}${items.length > 15 ? `\n\n...dan ${items.length - 15} episode lain, persempit rentangnya.` : ''}`)
      }

      // satu episode
      const r = d.resolved || {}
      const avail = (d.available || []).map(o => o.quality).filter(Boolean)
      const link = r.direct_url || r.final_url || (r.links && r.links[0]) || ''
      if (!link) {
        return reply(`Link download belum tersedia.${r.note ? `\n${r.note}` : ''}${avail.length ? `\nKualitas tersedia: ${avail.join(', ')}` : ''}`)
      }

      const info =
        `*DOWNLOAD ${d.slug}*\n` +
        `Episode : ${d.episode || '-'}\n` +
        (r.filename ? `File    : ${r.filename}\n` : '') +
        (r.size_mb ? `Ukuran  : ${r.size_mb} MB\n` : '') +
        (avail.length ? `Kualitas tersedia: ${avail.join(', ')}\n` : '') +
        `\n${link}`

      // kirim sebagai dokumen kalau ukurannya wajar, kalau gagal cukup kirim link
      if (r.is_file && r.size_mb && r.size_mb <= 80) {
        await reply(info)
        return sock.sendMessage(m.chat, {
          document: { url: link },
          fileName: r.filename || `${d.slug}-${d.episode || 'eps'}.mp4`,
          mimetype: r.content_type && r.content_type.includes('/') ? r.content_type : 'video/mp4'
        }, { quoted: m }).catch(() => null)
      }
      return reply(info)
    }
  } catch (e) {
    return reply(`Gagal: ${e.message || e}`)
  }
}

handler.command = ['anibatch']
handler.help = ['anibatch <judul | detail | eps | stream | dl>']
handler.tags = ['anime']
handler.limit = true

export default handler
