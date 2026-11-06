'use strict';

const crypto = require('crypto');
const { fetchWithTimeout, canonicalTitle } = require('./util');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const SOURCES = {
  ann: {
    label: 'Anime News Network',
    url: 'https://www.animenewsnetwork.com/news/rss.xml',
    kind: 'Anime',
  },
  interest: {
    label: 'ANN Interest',
    url: 'https://www.animenewsnetwork.com/interest/rss.xml',
    kind: 'Cosplayer',
  },
  animecorner: {
    label: 'Anime Corner',
    url: 'https://animecorner.me/feed/',
    kind: 'Anime',
  },
  gematsu: {
    label: 'Gematsu',
    url: 'https://www.gematsu.com/feed',
    kind: 'Game',
  },
  siliconera: {
    label: 'Siliconera',
    url: 'https://www.siliconera.com/feed/',
    kind: 'Game',
  },
};

const DEFAULT_SOURCES = ['ann', 'animecorner', 'gematsu', 'siliconera'];

const GACHA_WORDS = [
  'azur lane', 'nikke', 'blue archive', 'genshin', 'honkai', 'star rail',
  'arknights', 'fate/grand order', 'fgo', 'wuthering waves', 'zenless',
  'granblue', 'uma musume', 'project sekai', 'bang dream', 'gacha', 'skin',
  'banner', 'event', 'update',
];
const COSPLAY_WORDS = ['cosplay', 'cosplayer', 'cosplayer indonesia', 'cosu'];
const MANGA_WORDS = ['manga', 'manhwa', 'manhua', 'chapter', 'volume'];

function decodeEntities(input) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
    ldquo: '“', rdquo: '”', middot: '·',
  };
  return String(input || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(Number(dec));
      } catch {
        return '';
      }
    })
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

function stripCdata(value) {
  let s = String(value || '').trim();
  s = s.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
  return s.trim();
}

function stripHtml(value) {
  let s = stripCdata(value);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function pickTag(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = String(block || '').match(re);
  return m ? stripCdata(m[1]) : '';
}

function pickAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, 'i');
  const m = String(block || '').match(re);
  return m ? decodeEntities(m[1]) : '';
}

function isUsableImage(url) {
  const s = String(url || '').trim();
  if (!/^https?:\/\//i.test(s)) return false;
  if (/feedburner|doubleclick|emoji|s\.w\.org\/images\/core\/emoji/i.test(s)) return false;
  if (/\.(svg|gif)(\?|$)/i.test(s)) return false;
  return true;
}

function imageFromBlock(block) {
  const candidates = [
    pickAttr(block, 'media:content', 'url'),
    pickAttr(block, 'media:thumbnail', 'url'),
    pickAttr(block, 'itunes:image', 'href'),
  ];

  const enclosures = String(block || '').match(/<enclosure[^>]*>/gi) || [];
  for (const tag of enclosures) {
    const url = (tag.match(/\burl=["']([^"']+)["']/i) || [])[1];
    const type = (tag.match(/\btype=["']([^"']+)["']/i) || [])[1] || '';
    if (url && (/^image\//i.test(type) || /\.(jpe?g|png|webp)(\?|$)/i.test(url))) {
      candidates.push(decodeEntities(url));
    }
  }

  const html = `${pickTag(block, 'content:encoded')} ${pickTag(block, 'description')}`;
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img) candidates.push(decodeEntities(img[1]));

  return candidates.find(isUsableImage) || '';
}

function xLinksFrom(text) {
  const out = [];
  const re = /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,30}\/status\/\d{6,}/gi;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[0]);
  return [...new Set(out)].slice(0, 3);
}

function classify(text, fallback = 'Info') {
  const low = String(text || '').toLowerCase();
  if (GACHA_WORDS.some((w) => low.includes(w))) return 'Gacha';
  if (COSPLAY_WORDS.some((w) => low.includes(w))) return 'Cosplayer';
  if (MANGA_WORDS.some((w) => low.includes(w))) return 'Manga';
  return fallback;
}

function parseFeed(xml, sourceKey) {
  const source = SOURCES[sourceKey] || {
    label: sourceKey,
    url: '',
    kind: 'Info',
  };
  const blocks = [
    ...(String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];
  const items = [];

  for (const block of blocks) {
    const title = stripHtml(pickTag(block, 'title'));
    if (!title) continue;

    let link = stripHtml(pickTag(block, 'link'));
    if (!/^https?:\/\//i.test(link)) link = pickAttr(block, 'link', 'href');
    if (!/^https?:\/\//i.test(link)) link = stripHtml(pickTag(block, 'guid'));
    if (!/^https?:\/\//i.test(link)) continue;

    const rawDescription =
      pickTag(block, 'content:encoded') ||
      pickTag(block, 'description') ||
      pickTag(block, 'summary') ||
      pickTag(block, 'content');
    const description = stripHtml(rawDescription).slice(0, 700);

    const dateRaw =
      pickTag(block, 'pubDate') ||
      pickTag(block, 'published') ||
      pickTag(block, 'updated') ||
      pickTag(block, 'dc:date');
    const parsedDate = Date.parse(dateRaw);

    const categories = [];
    const catRe = /<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi;
    let cm;
    while ((cm = catRe.exec(block))) {
      const c = stripHtml(cm[1]);
      if (c) categories.push(c);
    }

    const id = stripHtml(pickTag(block, 'guid')) || link;
    const image = imageFromBlock(block);
    const kind = classify(`${title} ${description} ${categories.join(' ')}`, source.kind);
    const xLinks = xLinksFrom(`${rawDescription} ${block}`);

    items.push({
      id,
      source: sourceKey,
      sourceLabel: source.label,
      title,
      description,
      link,
      image,
      kind,
      tags: categories.slice(0, 6),
      publishedAt: Number.isFinite(parsedDate) ? parsedDate : Date.now(),
      xLinks,
    });
  }

  return items;
}

async function fetchSource(sourceKey, limit = 6) {
  const source = SOURCES[sourceKey];
  if (!source) return [];
  const res = await fetchWithTimeout(
    source.url,
    {
      headers: {
        'User-Agent': UA,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    },
    20000
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml, sourceKey).slice(0, Math.max(1, limit));
}

async function fetchCustom(url, label, limit = 6) {
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' } },
    20000
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml, '__custom')
    .map((it) => ({ ...it, source: url, sourceLabel: label }))
    .slice(0, Math.max(1, limit));
}

function normalizeSources(input) {
  if (Array.isArray(input)) return input.map(String).filter(Boolean);
  return String(input || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SOURCES[s]);
}

async function fetchAll(sources, options = {}) {
  const list = normalizeSources(sources);
  const active = list.length ? list : DEFAULT_SOURCES;
  const perSource = Math.max(1, Math.min(20, Number(options.perSource) || 6));

  const results = await Promise.allSettled(
    active.map((key) => fetchSource(key, perSource))
  );

  const items = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') items.push(...r.value);
    else errors.push({ source: active[i], error: r.reason && r.reason.message ? r.reason.message : String(r.reason) });
  });

  if (Array.isArray(options.extraRss)) {
    for (const url of options.extraRss) {
      try {
        items.push(...(await fetchCustom(url, 'X/Twitter', perSource)));
      } catch (err) {
        errors.push({ source: url, error: err.message });
      }
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const item of items.sort((a, b) => b.publishedAt - a.publishedAt)) {
    const key = `${canonicalTitle(item.title)}|${item.link}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return { items: deduped, errors };
}

async function enrichItem(item) {
  if (!item) return item;
  if (item.image && item.xLinks && item.xLinks.length) return item;

  try {
    const res = await fetchWithTimeout(
      item.link,
      { headers: { 'User-Agent': UA }, redirect: 'follow' },
      15000
    );
    if (!res.ok) return item;
    const html = (await res.text()).slice(0, 800000);

    if (!item.image) {
      const patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m && isUsableImage(decodeEntities(m[1]))) {
          item.image = decodeEntities(m[1]);
          break;
        }
      }
    }

    if (!item.xLinks || !item.xLinks.length) {
      item.xLinks = xLinksFrom(html);
    }
  } catch {
    /* gambar/sumber X opsional */
  }

  return item;
}

function shortHash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, 16);
}

function toPostItem(item) {
  const sourceLine = [`🔗 Sumber: ${item.link}`];
  if (item.xLinks && item.xLinks.length) sourceLine.push(`🐦 X: ${item.xLinks[0]}`);

  const published = item.publishedAt
    ? new Date(item.publishedAt).toISOString().slice(0, 10)
    : '';

  return {
    key: `news:${shortHash(item.id || item.link || item.title)}`,
    source: 'news',
    sourceLabel: item.sourceLabel || 'Berita',
    title: item.title,
    altTitle: '',
    description: item.description || '',
    image: item.image || '',
    url: item.link || '',
    genres: Array.isArray(item.tags) ? item.tags : [],
    score: 0,
    episodes: 0,
    status: 'News',
    year: item.publishedAt ? new Date(item.publishedAt).getFullYear() : new Date().getFullYear(),
    type: 'news',
    kind: item.kind || 'Info',
    facts: [],
    studio: '',
    releaseDate: published,
    extra: sourceLine.join('\n'),
    slug: '',
    xLinks: item.xLinks || [],
  };
}

function filterByTopic(items, topic) {
  const t = String(topic || '').trim().toLowerCase();
  if (!t) return items;
  const map = {
    cosplay: 'Cosplayer',
    cosplayer: 'Cosplayer',
    gacha: 'Gacha',
    game: 'Gacha',
    anime: 'Anime',
    manga: 'Manga',
  };
  const kind = map[t];
  if (kind) {
    return items.filter(
      (it) => it.kind === kind || String(it.title).toLowerCase().includes(t)
    );
  }
  return items.filter(
    (it) =>
      String(it.title).toLowerCase().includes(t) ||
      String(it.description).toLowerCase().includes(t) ||
      (it.tags || []).some((tag) => String(tag).toLowerCase().includes(t))
  );
}

function kindLabel(kind) {
  const value = String(kind || '').toLowerCase();
  if (value === 'gacha') return 'INFO GACHA';
  if (value === 'cosplayer') return 'COSPLAY';
  if (value === 'manga') return 'MANGA';
  if (value === 'game') return 'GAME';
  if (value === 'anime') return 'BERITA ANIME';
  return 'BERITA OTAKU';
}

function trimText(value, max) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!max || text.length <= max) return text;
  return text.slice(0, Math.max(40, max - 1)).trimEnd() + '…';
}

/**
 * Caption gaya akun berita otaku: judul tebal, ringkasan singkat, sumber,
 * lalu tautan X/Twitter bila artikel menyebutkannya.
 */
function formatNewsCaption(item, options = {}) {
  if (!item) return '';
  const footer = options.footer || '> yuzaki tsukasa by ren';
  const label = kindLabel(item.kind);
  const date = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const lines = [`*〔 ${label} 〕*`, '', `*${trimText(item.title, 180)}*`];

  const description = trimText(item.description, 420);
  if (description) {
    lines.push('', description);
  }

  const tags = (Array.isArray(item.tags) ? item.tags : [])
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, 4);
  if (tags.length) {
    lines.push('', tags.map((tag) => `#${tag.replace(/^#/, '').replace(/\s+/g, '')}`).join(' '));
  }

  lines.push('', `📰 *${item.sourceLabel || 'Berita'}*${date ? ` • ${date}` : ''}`);
  if (item.link) lines.push(`🔗 ${item.link}`);
  if (item.xLinks && item.xLinks.length) lines.push(`🐦 ${item.xLinks[0]}`);
  if (footer) lines.push('', footer);

  return lines.join('\n');
}

module.exports = {
  SOURCES,
  DEFAULT_SOURCES,
  normalizeSources,
  parseFeed,
  fetchSource,
  fetchAll,
  enrichItem,
  toPostItem,
  filterByTopic,
  formatNewsCaption,
  classify,
  xLinksFrom,
  decodeEntities,
  stripHtml,
};
