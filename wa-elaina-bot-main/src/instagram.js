'use strict';

const { fetchWithTimeout } = require('./util');

// Jina Reader membuka halaman Instagram dari server mereka, jadi bot tidak
// perlu login, cookie, atau API pihak ketiga yang rapuh. Hasilnya markdown
// berisi daftar gambar carousel + judul/caption.
const JINA_BASE = String(
  process.env.JINA_BASE || process.env.TIKTOK_JINA_BASE || 'https://r.jina.ai/'
).replace(/\/?$/, '/');
const JINA_KEY = String(
  process.env.JINA_API_KEY || process.env.TIKTOK_JINA_KEY || ''
).trim();

const MAX_IMAGES = 12;
const MAX_CAPTION = 1200;

const GENERIC_TAGS = new Set([
  'cosplay', 'cosplayer', 'cosu', 'cosplayindonesia', 'indonesia',
  'fyp', 'foryou', 'explore', 'reels', 'instagood', 'photooftheday',
  'otaku', 'anime', 'manga', 'jepang', 'japan', 'photo', 'photography',
]);

// Pemetaan kecil untuk kasus yang paling sering muncul. Kalau tidak ada di
// sini, nama karakter diambil dari hashtag pertama yang bukan nama game.
const CHARACTER_MAP = {
  sandrone: { character: 'Sandrone', anime: 'Genshin Impact' },
  furina: { character: 'Furina', anime: 'Genshin Impact' },
  nahida: { character: 'Nahida', anime: 'Genshin Impact' },
  raiden: { character: 'Raiden Shogun', anime: 'Genshin Impact' },
  hutao: { character: 'Hu Tao', anime: 'Genshin Impact' },
  ganyu: { character: 'Ganyu', anime: 'Genshin Impact' },
  yelan: { character: 'Yelan', anime: 'Genshin Impact' },
  keqing: { character: 'Keqing', anime: 'Genshin Impact' },
  mona: { character: 'Mona', anime: 'Genshin Impact' },
  firefly: { character: 'Firefly', anime: 'Honkai: Star Rail' },
  sparkle: { character: 'Sparkle', anime: 'Honkai: Star Rail' },
  kafka: { character: 'Kafka', anime: 'Honkai: Star Rail' },
  march7th: { character: 'March 7th', anime: 'Honkai: Star Rail' },
  seele: { character: 'Seele', anime: 'Honkai: Star Rail' },
  bronya: { character: 'Bronya', anime: 'Honkai: Star Rail' },
  elysia: { character: 'Elysia', anime: 'Honkai Impact 3rd' },
  kiana: { character: 'Kiana Kaslana', anime: 'Honkai Impact 3rd' },
  yae: { character: 'Yae Miko', anime: 'Genshin Impact' },
  makima: { character: 'Makima', anime: 'Chainsaw Man' },
  power: { character: 'Power', anime: 'Chainsaw Man' },
  marin: { character: 'Marin Kitagawa', anime: 'My Dress-Up Darling' },
  rem: { character: 'Rem', anime: 'Re:Zero' },
  ram: { character: 'Ram', anime: 'Re:Zero' },
  emilia: { character: 'Emilia', anime: 'Re:Zero' },
  zero2: { character: 'Zero Two', anime: 'Darling in the Franxx' },
  asuna: { character: 'Asuna', anime: 'Sword Art Online' },
  nezuko: { character: 'Nezuko Kamado', anime: 'Demon Slayer' },
  shinobu: { character: 'Shinobu Kocho', anime: 'Demon Slayer' },
  mitsuri: { character: 'Mitsuri Kanroji', anime: 'Demon Slayer' },
  hinata: { character: 'Hinata Hyuga', anime: 'Naruto' },
  sakura: { character: 'Sakura Haruno', anime: 'Naruto' },
  nami: { character: 'Nami', anime: 'One Piece' },
  robin: { character: 'Nico Robin', anime: 'One Piece' },
  yor: { character: 'Yor Forger', anime: 'Spy x Family' },
  anya: { character: 'Anya Forger', anime: 'Spy x Family' },
  chisato: { character: 'Chisato Nishikigi', anime: 'Lycoris Recoil' },
  takina: { character: 'Takina Inoue', anime: 'Lycoris Recoil' },
};

const GAME_HINTS = [
  { keys: ['genshin', '原神', 'genshinimpact', 'genshinimpactmihoyo'], name: 'Genshin Impact' },
  { keys: ['starrail', 'honkaistarrail', '崩壊スターレイル', 'hsr'], name: 'Honkai: Star Rail' },
  { keys: ['honkai', 'honkaiimpact', '崩壊3rd'], name: 'Honkai Impact 3rd' },
  { keys: ['zenless', 'zzz', 'zenlesszonezero'], name: 'Zenless Zone Zero' },
  { keys: ['azurlane', 'azur', '碧蓝航线'], name: 'Azur Lane' },
  { keys: ['nikke', 'goddessofvictorynikke', '胜利女神'], name: 'Goddess of Victory: Nikke' },
  { keys: ['bluearchive', 'ブルアカ', 'bluearchivejp'], name: 'Blue Archive' },
  { keys: ['arknights', '明日方舟'], name: 'Arknights' },
  { keys: ['fgo', 'fategrandorder', 'fategrandorderjp'], name: 'Fate/Grand Order' },
  { keys: ['wutheringwaves', '鳴潮'], name: 'Wuthering Waves' },
  { keys: ['umamusume', 'ウマ娘'], name: 'Uma Musume' },
  { keys: ['projectsekai', 'プロセカ'], name: 'Project Sekai' },
  { keys: ['bangdream', 'バンドリ'], name: 'BanG Dream!' },
  { keys: ['loveanddeepspace', '恋と深空'], name: 'Love and Deepspace' },
  { keys: ['tearsofthemis', '未定事件簿'], name: 'Tears of Themis' },
];

function decodeEntities(input) {
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
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanCaption(input) {
  let text = decodeEntities(String(input || ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > MAX_CAPTION) text = text.slice(0, MAX_CAPTION - 1).trimEnd() + '…';
  return text;
}

function extractShortcode(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const m = raw.match(
    /(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i
  );
  if (m) return m[1];
  // Izinkan user menempel shortcode saja.
  if (/^[A-Za-z0-9_-]{5,}$/.test(raw)) return raw;
  return '';
}

function normalizePostUrl(input) {
  const code = extractShortcode(input);
  return code ? `https://www.instagram.com/p/${code}/` : '';
}

function isProfilePicture(alt, url) {
  if (/profile picture/i.test(alt)) return true;
  if (/dst-jpg_s150x150|ig_cache_key=.*profile_pic/i.test(url)) return true;
  return false;
}

function isUnwantedImage(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return true;
  if (/\.gif(?:\?|$)/i.test(u)) return true;
  if (/cdn\.fbsbx\.com\/v\/t59/i.test(u)) return true;
  if (/emoji|static\.cdninstagram\.com\/rsrc|sprite/i.test(u)) return true;
  return false;
}

function imageId(url) {
  const m = String(url || '').match(/\/([^/?#]+?)(?:\?|#|$)/);
  return m ? m[1] : String(url || '');
}

function parseImages(markdown) {
  const md = String(markdown || '');
  const main = md.split(/\nMore posts from\s+/i)[0] || md;
  const out = [];
  const seen = new Set();

  const add = (alt, url) => {
    const cleanUrl = decodeEntities(String(url || '').replace(/\)+$/, ''));
    if (isUnwantedImage(cleanUrl) || isProfilePicture(alt, cleanUrl)) return;
    const id = imageId(cleanUrl);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(cleanUrl);
  };

  // Carousel Instagram tampil sebagai bullet list di markdown Jina.
  const bullet = /\*\s+!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
  let m;
  while ((m = bullet.exec(main))) add(m[1], m[2]);

  if (out.length === 0) {
    // Fallback: ambil gambar utama sebelum bagian komentar/related posts.
    const candidate = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
    while ((m = candidate.exec(main))) {
      const alt = m[1] || '';
      if (!/(photo|video) by|^image \d+$/i.test(alt)) continue;
      add(alt, m[2]);
    }
  }

  return out.slice(0, MAX_IMAGES);
}

function parseTitle(markdown) {
  const md = String(markdown || '');
  const title = md.match(/^Title:\s*([\s\S]*?)\n(?:URL Source:|Markdown Content:)/m);
  if (!title) return { author: '', caption: '' };
  const body = title[1].trim();
  const m = body.match(/^(.*?)\s+on Instagram:\s*"([\s\S]*)"$/is);
  if (m) return { author: cleanCaption(m[1]), caption: cleanCaption(m[2]) };
  return { author: '', caption: cleanCaption(body) };
}

function extractTags(markdown, caption) {
  const tags = [];
  const seen = new Set();
  const push = (value) => {
    let tag = String(value || '').trim();
    if (!tag) return;
    try {
      tag = decodeURIComponent(tag);
    } catch {
      /* biarkan */
    }
    tag = tag.replace(/^#/, '').trim();
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  };

  const linkRe = /instagram\.com\/explore\/tags\/([^/?#)\s]+)/gi;
  let m;
  while ((m = linkRe.exec(String(markdown || '')))) push(m[1]);

  const hashRe = /#([\p{L}\p{N}_]+)/gu;
  while ((m = hashRe.exec(String(caption || '')))) push(m[1]);

  return tags;
}

function extractUsername(markdown) {
  const md = String(markdown || '');
  const more = md.match(/More posts from\s+\[([A-Za-z0-9._]+)\]/i);
  if (more) return more[1].toLowerCase();
  const first = md.match(/\[([A-Za-z0-9._]{2,30})\]\(https:\/\/www\.instagram\.com\/\1\/\)/i);
  return first ? first[1].toLowerCase() : '';
}

function normalizeTag(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, '');
}

function titleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

function inferMeta(tags, caption, overrides = {}) {
  const list = (Array.isArray(tags) ? tags : []).map(normalizeTag).filter(Boolean);
  const lowCaption = String(caption || '').toLowerCase();

  let anime = String(overrides.anime || '').trim();
  let character = String(overrides.character || '').trim();

  for (const [key, value] of Object.entries(CHARACTER_MAP)) {
    if (list.includes(key) || lowCaption.includes(key)) {
      if (!character) character = value.character;
      if (!anime) anime = value.anime;
      break;
    }
  }

  if (!anime) {
    for (const game of GAME_HINTS) {
      if (game.keys.some((k) => list.includes(normalizeTag(k)) || lowCaption.includes(k.toLowerCase()))) {
        anime = game.name;
        break;
      }
    }
  }

  const generic = new Set(GENERIC_TAGS);
  const gameKeys = new Set(GAME_HINTS.flatMap((g) => g.keys.map(normalizeTag)));

  if (!character) {
    const candidate = list.find((tag) => {
      if (generic.has(tag) || gameKeys.has(tag)) return false;
      if (!/^[a-z0-9\u3040-\u30ff\u4e00-\u9fff]{3,}$/.test(tag)) return false;
      return !CHARACTER_MAP[tag] || CHARACTER_MAP[tag].character !== character;
    });
    if (candidate) {
      character = CHARACTER_MAP[candidate]
        ? CHARACTER_MAP[candidate].character
        : titleCase(candidate);
    }
  }

  return {
    character: character || 'Cosplay',
    anime: anime || 'Cosplay',
  };
}

function parsePost(markdown, url) {
  const title = parseTitle(markdown);
  const tags = extractTags(markdown, title.caption);
  const username = extractUsername(markdown);
  const meta = inferMeta(tags, title.caption);
  const shortcode = extractShortcode(url) || extractShortcode(markdown) || '';
  const canonicalUrl = shortcode
    ? `https://www.instagram.com/p/${shortcode}/`
    : normalizePostUrl(url) || String(url || '');

  return {
    shortcode,
    url: canonicalUrl,
    author: title.author,
    username,
    caption: title.caption,
    tags,
    images: parseImages(markdown),
    character: meta.character,
    anime: meta.anime,
  };
}

async function fetchPost(input, options = {}) {
  const url = normalizePostUrl(input);
  if (!url) throw new Error('Link Instagram tidak valid. Contoh: !cosplay https://www.instagram.com/p/xxxx/');

  const headers = {
    Accept: 'text/plain, text/markdown, */*',
    'X-Return-Format': 'markdown',
  };
  if (JINA_KEY) headers.Authorization = `Bearer ${JINA_KEY}`;

  const timeoutMs = Math.max(15000, Number(options.timeoutMs) || 45000);
  // Instagram kadang hanya merender slide pertama. Coba beberapa varian URL
  // lalu gabungkan gambarnya supaya carousel 2+ foto tetap lengkap.
  const variants = [
    `${url}?x-respond-with=markdown`,
    `${url}?img_index=2`,
    `${url}?img_index=1`,
  ];

  let best = null;
  let lastError = '';
  for (let i = 0; i < variants.length; i++) {
    if (best && best.images.length >= 2) break;
    try {
      const res = await fetchWithTimeout(
        `${JINA_BASE}${variants[i]}`,
        { headers, redirect: 'follow' },
        timeoutMs
      );
      if (!res.ok) throw new Error(`Jina Reader gagal (HTTP ${res.status})`);
      const markdown = await res.text();
      if (!markdown || markdown.length < 80) throw new Error('Instagram tidak mengembalikan konten');

      const post = parsePost(markdown, url);
      if (!post.images.length) {
        lastError = 'Tidak ada foto carousel yang bisa diambil.';
        continue;
      }

      if (!best) {
        best = post;
      } else {
        const seen = new Set(best.images.map(imageId));
        for (const image of post.images) {
          if (seen.has(imageId(image))) continue;
          seen.add(imageId(image));
          best.images.push(image);
        }
        if (!best.caption) best.caption = post.caption;
        if (!best.tags.length) best.tags = post.tags;
        if (!best.author) best.author = post.author;
        if (!best.username) best.username = post.username;
      }

      if (best.images.length >= 2) break;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }

  if (!best || !best.images.length) {
    throw new Error(
      lastError ||
        'Tidak ada foto carousel yang bisa diambil. Pastikan post publik (bukan story/reel private).'
    );
  }
  best.images = best.images.slice(0, MAX_IMAGES);
  const meta = inferMeta(best.tags, best.caption);
  best.character = best.character || meta.character;
  best.anime = best.anime || meta.anime;
  return best;
}

function formatCaption(post, overrides = {}) {
  const character = String(overrides.character || post.character || 'Cosplay').trim();
  const anime = String(overrides.anime || post.anime || 'Cosplay').trim();
  return [
    `*Name Karakter* *『${character}』*`,
    `*Name Anime/Game* \`\`\`|${anime}|\`\`\``,
    `*SC:${post.url}*`,
  ].join('\n');
}

/**
 * Format argumen `!cosplay <link> [--karakter Nama] [--anime Judul]`.
 */
function parseArgs(rest) {
  const text = String(rest || '').trim();
  const urlMatch = text.match(/https?:\/\/\S+|\b[A-Za-z0-9_-]{9,}\b/);
  const url = urlMatch ? urlMatch[0].replace(/[),.]+$/, '') : '';

  const meta = {};
  const char = text.match(/(?:--karakter|--character|-c)\s+([^|]+?)(?=\s+--|\s*$)/i);
  const anime = text.match(/(?:--anime|-a)\s+([^|]+?)(?=\s+--|\s*$)/i);
  if (char) meta.character = char[1].trim();
  if (anime) meta.anime = anime[1].trim();

  return { url, meta };
}

module.exports = {
  extractShortcode,
  normalizePostUrl,
  parseImages,
  parsePost,
  fetchPost,
  formatCaption,
  inferMeta,
  parseArgs,
  extractTags,
  JINA_BASE,
};
