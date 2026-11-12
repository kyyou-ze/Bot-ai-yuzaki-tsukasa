'use strict';

const { fetchWithTimeout } = require('./util');
const { downloadImage } = require('./imageutil');
const llm = require('./llm');
const log = require('./logger');

// Jina Reader membuka halaman Instagram dari server mereka, jadi bot tidak
// perlu login, cookie, atau API pihak ketiga yang rapuh. Hasilnya markdown
// berisi daftar gambar carousel + judul/caption.
const JINA_BASE = String(
  process.env.JINA_BASE || process.env.TIKTOK_JINA_BASE || 'https://r.jina.ai/'
).replace(/\/?$/, '/');
const JINA_KEY = String(
  process.env.JINA_API_KEY || process.env.TIKTOK_JINA_KEY || ''
).trim();

// --- Hybrid Instagram ---
// Scraper lokal memakai cookie/session (opsional) + proxy. Kalau cookie belum
// diisi, bot otomatis jatuh ke Jina/vxinstagram. Semua hasil digabung supaya
// carousel tidak terpotong hanya karena satu provider gagal.
const IG_COOKIE = String(process.env.IG_COOKIE || process.env.INSTAGRAM_COOKIE || '').trim();
const IG_SESSIONID =
  String(process.env.IG_SESSIONID || '').trim() ||
  (IG_COOKIE.match(/(?:^|;\s*)sessionid=([^;]+)/i) || [])[1] ||
  '';
const IG_APP_ID = String(process.env.IG_APP_ID || '936619743392459').trim();
const IG_PROXY = String(process.env.IG_PROXY || process.env.INSTAGRAM_PROXY || '').trim();
const IG_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Mobile Safari/537.36';

const MAX_IMAGES = Math.max(
  1,
  Math.min(30, parseInt(process.env.IG_MAX_IMAGES || '12', 10) || 12)
);
const MAX_CAPTION = 1200;

let igProxyDispatcher = null;
function igDispatcher() {
  if (!IG_PROXY) return null;
  if (igProxyDispatcher) return igProxyDispatcher;
  try {
    // undici adalah dependensi Baileys; dipakai agar proxy residensial bisa
    // dipakai tanpa mengubah global fetch.
    const { ProxyAgent } = require('undici');
    igProxyDispatcher = new ProxyAgent(IG_PROXY);
    log.info('[COSPLAY] Proxy Instagram aktif');
  } catch (err) {
    log.warn('[COSPLAY] IG_PROXY gagal dimuat:', err.message);
    igProxyDispatcher = null;
  }
  return igProxyDispatcher;
}

async function igFetch(url, options = {}, timeoutMs = 45000) {
  const dispatcher = igDispatcher();
  return fetchWithTimeout(
    url,
    dispatcher ? { ...options, dispatcher } : options,
    timeoutMs
  );
}

const IG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function shortcodeToMediaId(code) {
  let id = 0n;
  for (const ch of String(code || '')) {
    const v = IG_ALPHABET.indexOf(ch);
    if (v < 0) return '';
    id = id * 64n + BigInt(v);
  }
  return id > 0n ? id.toString() : '';
}

const GENERIC_TAGS = new Set([
  'cosplay', 'cosplayer', 'cosu', 'cosplayindonesia', 'indonesia',
  'fyp', 'foryou', 'explore', 'reels', 'instagood', 'photooftheday',
  'otaku', 'anime', 'manga', 'jepang', 'japan', 'photo', 'photography',
]);

// Pemetaan kecil untuk kasus yang paling sering muncul. Kalau tidak ada di
// sini, nama karakter diambil dari hashtag pertama yang bukan nama game.
const CHARACTER_MAP = {
  sandrone: { character: 'Sandrone', anime: 'Genshin Impact' },
  shisui: { character: 'Shisui', anime: 'The Apothecary Diaries' },
  loulan: { character: 'Loulan', anime: 'The Apothecary Diaries' },
  maomao: { character: 'Maomao', anime: 'The Apothecary Diaries' },
  jinshi: { character: 'Jinshi', anime: 'The Apothecary Diaries' },
  aemeath: { character: 'Aemeath', anime: 'Wuthering Waves' },
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
  { keys: ['wutheringwaves', 'wunderingwaves', '鳴潮'], name: 'Wuthering Waves' },
  { keys: ['umamusume', 'ウマ娘'], name: 'Uma Musume' },
  { keys: ['projectsekai', 'プロセカ'], name: 'Project Sekai' },
  { keys: ['bangdream', 'バンドリ'], name: 'BanG Dream!' },
  { keys: ['loveanddeepspace', '恋と深空'], name: 'Love and Deepspace' },
  { keys: ['tearsofthemis', '未定事件簿'], name: 'Tears of Themis' },
];

// Judul franchise sering muncul sebagai hashtag. Jangan pernah dipakai sebagai
// nama karakter (contoh: #theapothecarydiaries bukan nama karakter).
const FRANCHISE_HINTS = [
  ...GAME_HINTS,
  { keys: ['theapothecarydiaries', 'apothecarydiaries', '薬屋のひとりごと'], name: 'The Apothecary Diaries' },
  { keys: ['fatalframe', 'crimsonbutterfly', '零'], name: 'Fatal Frame' },
  { keys: ['demonslayer', 'kimetsunoyaiba', '鬼滅の刃'], name: 'Demon Slayer' },
  { keys: ['jujutsukaisen', '呪術廻戦'], name: 'Jujutsu Kaisen' },
  { keys: ['chainsawman', 'チェンソーマン'], name: 'Chainsaw Man' },
  { keys: ['spyfamily', 'spyxfamily', 'スパイファミリー'], name: 'Spy x Family' },
  { keys: ['rezero', 'rezerokara', 'リゼロ'], name: 'Re:Zero' },
  { keys: ['swordartonline', 'sao', 'ソードアートオンライン'], name: 'Sword Art Online' },
  { keys: ['naruto', 'narutoshippuden'], name: 'Naruto' },
  { keys: ['onepiece', 'ワンピース'], name: 'One Piece' },
  { keys: ['bokunoheroacademia', 'myheroacademia', 'heroaca'], name: 'My Hero Academia' },
  { keys: ['attackontitan', 'shingekinokyojin', '進撃の巨人'], name: 'Attack on Titan' },
  { keys: ['mydressupdarling', 'sonobisquedoll', '着せ替え人形'], name: 'My Dress-Up Darling' },
  { keys: ['darlingsinfranxx', 'darlinginthefranxx'], name: 'Darling in the Franxx' },
  { keys: ['lycorisrecoil', 'リコリスリコイル'], name: 'Lycoris Recoil' },
];

const FRANCHISE_MAP = {};
for (const hint of FRANCHISE_HINTS) {
  for (const key of hint.keys) FRANCHISE_MAP[normalizeTag(key)] = hint.name;
}

const COSPLAY_SUFFIX_RE = /(?:cosplay|cosplayer|cosu)+$/i;

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
  const a = String(alt || '');
  const u = String(url || '');
  if (/profile\s*(picture|pic)|foto profil/i.test(a)) return true;
  // Foto post Instagram selalu memakai path t51.xxxx-15. Avatar/profil
  // memakai t51.xxxx-19, termasuk saat alt-nya cuma "Image 1". Tanpa filter
  // ini avatar kecil bisa ikut terkirim di atas foto utama.
  if (/\/t51\.\d+-19\//i.test(u)) return true;
  if (/dst-jpg[^?]*_s150x150|_s150x150_/i.test(u)) return true;
  if (/ig_cache_key=(?:[^&]*profile_pic|YW5vbnltb3VzX3Byb2ZpbGV)/i.test(u)) return true;
  return false;
}

function isUnwantedImage(url) {
  const u = String(url || '');
  if (!/^https?:\/\//i.test(u)) return true;
  if (/\.gif(?:\?|$)/i.test(u)) return true;
  if (/cdn\.fbsbx\.com\/v\/t59/i.test(u)) return true;
  if (/emoji|static\.cdninstagram\.com\/rsrc|sprite/i.test(u)) return true;
  // Avatar dan thumbnail kotak (s640x640/s1080x1080) adalah versi crop.
  // URL CDN Instagram sudah ditandatangani, jadi menghapus suffix ukuran akan
  // menghasilkan 403. Lebih aman buang thumbnail lalu andalkan sumber lengkap
  // (vxinstagram) yang memberi URL resolusi penuh.
  if (/\/t51\.\d+-19\//i.test(u)) return true;
  if (/dst-jpg[^?]*_s\d+x\d+|_s\d+x\d+_tt\d/i.test(u)) return true;
  if (/ig_cache_key=(?:[^&]*profile_pic|YW5vbnltb3VzX3Byb2ZpbGV)/i.test(u)) return true;
  return false;
}

function imageId(url) {
  const m = String(url || '').match(/\/([^/?#]+?)(?:\?|#|$)/);
  return m ? m[1] : String(url || '');
}

/**
 * Skor kualitas URL foto Instagram. URL tanpa suffix ukuran biasanya versi
 * asli; thumbnail `_s150x150`/`_s640x640` dan avatar `-19` diberi skor rendah
 * supaya saat provider berbeda memberi URL yang sama, versi terbaik menang.
 */
function imageScore(url) {
  const u = String(url || '');
  if (!u) return -Infinity;
  let score = 0;
  if (/\/t51\.\d+-15\//i.test(u)) score += 80;
  if (/\/t51\.\d+-19\//i.test(u)) score -= 200;
  if (/_s150x150/i.test(u)) score -= 200;
  const sized = u.match(/dst-jpg[^?]*_s(\d+)x(\d+)/i);
  if (sized) score += Math.min(50, (Number(sized[1]) || 0) / 40);
  else score += 60;
  return score;
}

/**
 * Tambahkan foto ke daftar tanpa duplikat. Jika id yang sama sudah ada,
 * simpan URL dengan kualitas terbaik (bukan sekadar yang pertama datang).
 */
function addImage(images, index, url) {
  const clean = String(url || '').replace(/\)+$/, '');
  if (isUnwantedImage(clean)) return false;
  const id = imageId(clean);
  if (!id) return false;
  const at = index.get(id);
  if (at === undefined) {
    index.set(id, images.length);
    images.push(clean);
    return true;
  }
  if (imageScore(clean) > imageScore(images[at])) images[at] = clean;
  return false;
}

function parseImages(markdown) {
  const md = String(markdown || '');
  // Jangan ikut mengambil foto dari komentar/related posts/rekomendasi akun.
  const cutoff = md.search(
    /\n(?:More posts from|You might like|Related posts|Add a comment|View all comments)\b/i
  );
  const main = cutoff >= 0 ? md.slice(0, cutoff) : md;
  const out = [];
  const index = new Map();

  const add = (alt, url) => {
    const cleanUrl = decodeEntities(String(url || '').replace(/\)+$/, ''));
    if (!cleanUrl || isProfilePicture(alt, cleanUrl)) return;
    addImage(out, index, cleanUrl);
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
      const url = m[2] || '';
      if (!/(photo|video) by|^image \d+$/i.test(alt)) continue;
      add(alt, url);
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

function hasWord(text, word) {
  const needle = String(word || '').trim().toLowerCase();
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(
    String(text || '')
  );
}

function franchiseOfTag(tag) {
  let base = normalizeTag(tag).replace(COSPLAY_SUFFIX_RE, '');
  if (!base) return '';
  if (FRANCHISE_MAP[base]) return FRANCHISE_MAP[base];
  for (const [key, name] of Object.entries(FRANCHISE_MAP)) {
    // Key pendek (zzz, sao, hsr) hanya cocok persis supaya tidak salah tangkap.
    if (key.length >= 5 && base.includes(key)) return name;
  }
  return '';
}

// Nama karakter paling akurat biasanya ada di hashtag berakhiran "cosplay":
// #shisuicosplay -> Shisui, #aemeathcosplay -> Aemeath.
function characterFromTag(tag) {
  const normalized = normalizeTag(tag);
  const base = normalized.replace(COSPLAY_SUFFIX_RE, '');
  if (!base || base === normalized) return '';
  if (GENERIC_TAGS.has(base) || franchiseOfTag(base)) return '';
  if (!/[a-z\u3040-\u30ff\u4e00-\u9fff]/i.test(base)) return '';
  return CHARACTER_MAP[base] ? CHARACTER_MAP[base].character : titleCase(base);
}

function inferMeta(tags, caption, overrides = {}) {
  const list = (Array.isArray(tags) ? tags : []).map(normalizeTag).filter(Boolean);

  let anime = String(overrides.anime || '').trim();
  let character = String(overrides.character || '').trim();
  const characterTags = [];

  for (const tag of list) {
    const name = characterFromTag(tag);
    if (!name) continue;
    if (!characterTags.includes(name)) characterTags.push(name);
    const base = tag.replace(COSPLAY_SUFFIX_RE, '');
    const mapped = CHARACTER_MAP[base];
    if (mapped && !anime) anime = mapped.anime;
  }

  // Cocokkan nama karakter dari hashtag/caption dengan batas kata. Dulu
  // "rem" ikut cocok di "remake" sehingga nama karakter jadi ngawur.
  if (!character) {
    const entries = Object.entries(CHARACTER_MAP).sort((a, b) => b[0].length - a[0].length);
    for (const [key, value] of entries) {
      if (!(list.includes(key) || hasWord(caption, key))) continue;
      character = value.character;
      if (!anime) anime = value.anime;
      break;
    }
  }

  if (!anime) {
    for (const tag of list) {
      const franchise = franchiseOfTag(tag);
      if (franchise) {
        anime = franchise;
        break;
      }
    }
  }

  if (!anime) {
    for (const game of GAME_HINTS) {
      if (game.keys.some((k) => list.includes(normalizeTag(k)) || hasWord(caption, k))) {
        anime = game.name;
        break;
      }
    }
  }

  if (!character && characterTags.length) {
    character = characterTags.slice(0, 3).join(' & ');
  }

  if (!character) {
    const generic = new Set(GENERIC_TAGS);
    const candidate = list.find((tag) => {
      if (generic.has(tag) || franchiseOfTag(tag)) return false;
      if (COSPLAY_SUFFIX_RE.test(tag)) return false;
      if (!/[a-z\u3040-\u30ff\u4e00-\u9fff]/i.test(tag)) return false;
      if (!/^[a-z0-9\u3040-\u30ff\u4e00-\u9fff]{3,}$/.test(tag)) return false;
      return true;
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

function needsAiMeta(post) {
  const character = String(post.character || '').trim().toLowerCase();
  const anime = String(post.anime || '').trim().toLowerCase();
  return (
    !character ||
    !anime ||
    character === 'cosplay' ||
    anime === 'cosplay' ||
    character === anime
  );
}

function parseLooseJson(text) {
  let source = String(text || '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) source = fenced[1].trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Kalau hashtag/caption tidak cukup jelas, kirim satu foto ke Gemini Vision
// untuk menebak nama karakter + judul anime/game.
async function identifyWithAI(post) {
  if (String(process.env.COSPLAY_AI_IDENTIFY || '').toLowerCase() === 'off') return post;
  if (!post.images.length) return post;
  if (typeof llm.getKeyList !== 'function' || llm.getKeyList().length === 0) return post;

  try {
    const got = await downloadImage(post.images[0], {
      maxBytes: 8 * 1024 * 1024,
      timeoutMs: 20000,
      maxWidth: 1280,
      quality: 82,
      compressAbove: 400 * 1024,
    });
    const tags = (post.tags || []).slice(0, 12).join(', ');
    const caption = String(post.caption || '').slice(0, 600);
    const system =
      'Kamu ahli identifikasi cosplay. Tentukan nama karakter yang di-cosplay dan judul anime/game asalnya. ' +
      'Balas HANYA JSON valid: {"character":"...","anime":"..."}. Jangan mengarang; jika tidak yakin isi "Cosplay".';
    const prompt = `Identifikasi foto cosplay ini.\nCaption: ${caption}\nHashtag: ${tags}\n\nBalas JSON saja.`;
    const answer = await llm.askVision(system, prompt, got.data, got.mime);
    const data = parseLooseJson(answer);
    if (!data) {
      log.warn('[COSPLAY] AI tidak memberi JSON valid:', String(answer || '').slice(0, 120));
      return post;
    }

    const character = String(data.character || '').trim();
    const anime = String(data.anime || '').trim();
    const invalid = (v) => !v || /^(cosplay|unknown|tidak\s*yakin)$/i.test(v);
    if (!invalid(character)) post.character = character;
    if (!invalid(anime)) post.anime = anime;
    log.info(`[COSPLAY] AI identifikasi: ${post.character} / ${post.anime}`);
  } catch (err) {
    log.warn('[COSPLAY] Identifikasi AI gagal:', err.message);
  }
  return post;
}

function metaContent(html, key) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  const wanted = String(key || '').toLowerCase();
  for (const tag of tags) {
    const prop = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!prop || prop.toLowerCase() !== wanted) continue;
    const content = (tag.match(/content\s*=\s*["']([\s\S]*?)["']/i) || [])[1];
    if (content !== undefined) return decodeEntities(content).trim();
  }
  return '';
}

/**
 * Fallback saat Jina Reader menolak (mis. HTTP 402) atau tidak memberi foto.
 * vxinstagram merender halaman publik Instagram lalu menyediakan tautan
 * unduhan langsung ke CDN Facebook (scontent/fbcdn). Tidak perlu login.
 */
function parseVxinstagram(html, url) {
  const source = String(html || '');
  const shortcode = extractShortcode(url) || extractShortcode(source) || '';
  const title = metaContent(source, 'og:title');
  const description = metaContent(source, 'og:description');
  const creator = metaContent(source, 'twitter:creator');

  let author = '';
  let username = '';
  const titleMatch = title.match(/^(.*?)\s*\(@([A-Za-z0-9._]+)\)\s*$/);
  if (titleMatch) {
    author = cleanCaption(titleMatch[1]);
    username = titleMatch[2].toLowerCase();
  } else if (title) {
    author = cleanCaption(title);
  }
  if (!username && creator) username = cleanCaption(creator).replace(/^@/, '').toLowerCase();

  const images = [];
  const index = new Map();
  const anchors = source.match(/<a\b[^>]*\bdownload\b[^>]*>/gi) || [];
  for (const tag of anchors) {
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href) continue;
    const cleanUrl = decodeEntities(href).replace(/\)+$/, '');
    if (!/^https?:\/\//i.test(cleanUrl)) continue;
    addImage(images, index, cleanUrl);
    if (images.length >= MAX_IMAGES) break;
  }

  if (!images.length) {
    const ogImage = metaContent(source, 'og:image');
    if (ogImage && /^https?:\/\//i.test(ogImage)) addImage(images, index, ogImage);
  }

  const caption = cleanCaption(description);
  const tags = extractTags(source, caption);
  const meta = inferMeta(tags, caption);
  return {
    shortcode,
    url: shortcode ? `https://www.instagram.com/p/${shortcode}/` : normalizePostUrl(url),
    author,
    username,
    caption,
    tags,
    images,
    character: meta.character,
    anime: meta.anime,
  };
}

async function fetchViaVxinstagram(url, timeoutMs) {
  const shortcode = extractShortcode(url);
  if (!shortcode) throw new Error('shortcode Instagram tidak ditemukan');

  const target = `https://www.vxinstagram.com/p/${shortcode}/?_cb=${Date.now()}`;
  const res = await fetchWithTimeout(
    target,
    {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    },
    timeoutMs
  );
  if (!res.ok) throw new Error(`vxinstagram gagal (HTTP ${res.status})`);
  const html = await res.text();
  if (!html || html.length < 200) throw new Error('vxinstagram tidak mengembalikan konten');

  const post = parseVxinstagram(html, url);
  if (!post.images.length) {
    throw new Error('vxinstagram tidak menemukan foto pada post ini');
  }
  return post;
}

function bestCandidateUrl(candidates) {
  const list = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && typeof c.url === 'string' && /^https?:\/\//i.test(c.url))
    .sort(
      (a, b) =>
        (Number(b.width) || 0) * (Number(b.height) || 0) -
        (Number(a.width) || 0) * (Number(a.height) || 0)
    );
  return list.length ? list[0].url : '';
}

function postFromApiItem(item, url) {
  const code = extractShortcode(url);
  const images = [];
  const index = new Map();
  const collect = (media) => {
    const node = media && (media.image_versions2 || media.imageVersions2);
    const candidates = node && (node.candidates || node);
    const best = bestCandidateUrl(candidates);
    if (best) addImage(images, index, best);
  };
  const carousel = Array.isArray(item && item.carousel_media) ? item.carousel_media : [];
  if (carousel.length) for (const media of carousel) collect(media);
  else collect(item);

  const username = String((item && item.user && item.user.username) || '').toLowerCase();
  const caption = cleanCaption(item && item.caption && item.caption.text);
  const tags = extractTags('', caption);
  const meta = inferMeta(tags, caption);
  return {
    shortcode: code,
    url: code ? `https://www.instagram.com/p/${code}/` : normalizePostUrl(url),
    author: username,
    username,
    caption,
    tags,
    images: images.slice(0, MAX_IMAGES),
    character: meta.character,
    anime: meta.anime,
    carouselCount: Math.max(
      images.length,
      Number((item && item.carousel_media_count) || 0) || 0
    ),
  };
}

/**
 * Provider lokal (scraper sendiri): butuh IG_SESSIONID/IG_COOKIE. Tidak
 * memakai API berbayar, hanya endpoint web Instagram + cookie akun bot.
 */
async function fetchViaInstagramApi(url, timeoutMs) {
  if (!IG_SESSIONID) throw new Error('IG_SESSIONID/IG_COOKIE belum diset');
  const code = extractShortcode(url);
  const mediaId = shortcodeToMediaId(code);
  if (!mediaId) throw new Error('shortcode Instagram tidak valid');

  const headers = {
    'x-ig-app-id': IG_APP_ID,
    'User-Agent': IG_UA,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `https://www.instagram.com/p/${code}/`,
    Cookie: IG_COOKIE || `sessionid=${IG_SESSIONID}`,
  };
  const endpoints = [
    `https://i.instagram.com/api/v1/media/${mediaId}/info/`,
    `https://www.instagram.com/api/v1/media/${mediaId}/info/`,
  ];
  let lastError = '';
  for (const endpoint of endpoints) {
    try {
      const res = await igFetch(endpoint, { headers, redirect: 'follow' }, timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const item = data && Array.isArray(data.items) ? data.items[0] : null;
      if (!item) throw new Error('API tidak mengembalikan media');
      const post = postFromApiItem(item, url);
      if (!post.images.length) throw new Error('media tidak punya foto');
      return post;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
    }
  }
  throw new Error(`Instagram API gagal (${lastError})`);
}

/**
 * Gabungkan hasil beberapa provider ke satu post. Foto dideduplikasi per id,
 * dan versi beresolusi terbaik dipertahankan.
 */
function absorbPost(base, extra) {
  if (!base) return { post: extra, added: extra ? extra.images.length : 0 };
  if (!extra) return { post: base, added: 0 };
  const index = new Map(base.images.map((u, i) => [imageId(u), i]));
  let added = 0;
  for (const image of extra.images) {
    if (addImage(base.images, index, image)) added += 1;
  }
  if (!base.caption) base.caption = extra.caption;
  if (!base.tags || !base.tags.length) base.tags = extra.tags || [];
  if (!base.author) base.author = extra.author;
  if (!base.username) base.username = extra.username;
  if (!base.character && extra.character) base.character = extra.character;
  if (!base.anime && extra.anime) base.anime = extra.anime;
  base.carouselCount = Math.max(
    Number(base.carouselCount) || 0,
    Number(extra.carouselCount) || 0
  );
  return { post: base, added };
}

/**
 * Provider Jina (tanpa login). Instagram hanya merender satu slide per URL,
 * jadi halaman di-probe per `?img_index=N` sampai tidak ada foto baru.
 */
async function fetchViaJina(url, timeoutMs, options = {}) {
  const headers = {
    Accept: 'text/plain, text/markdown, */*',
    'X-Return-Format': 'markdown',
    // Jina menyimpan hasil per URL. Tanpa header ini, probe slide berikutnya
    // bisa menerima halaman cache yang sama dan carousel tampak terpotong.
    'X-No-Cache': 'true',
    'Cache-Control': 'no-cache',
  };
  if (JINA_KEY) headers.Authorization = `Bearer ${JINA_KEY}`;

  const knownCount = Math.max(0, Number(options.knownCount) || 0);
  const maxProbes = Math.max(MAX_IMAGES + 2, knownCount + 2);
  let best = null;
  let lastError = '';
  let prevSignature = '';
  let emptyStreak = 0;
  let repeatStreak = 0;

  for (let index = 1; index <= maxProbes; index++) {
    try {
      // Cache-busting: parameter tambahan hanya untuk Jina, bukan Instagram.
      const probeUrl = `${JINA_BASE}${url}?img_index=${index}&_cb=${Date.now()}-${index}`;
      const res = await fetchWithTimeout(probeUrl, { headers, redirect: 'follow' }, timeoutMs);
      if (!res.ok) throw new Error(`Jina Reader gagal (HTTP ${res.status})`);
      const markdown = await res.text();
      if (!markdown || markdown.length < 80) {
        throw new Error('Instagram tidak mengembalikan konten');
      }

      const post = parsePost(markdown, url);
      if (!post.images.length) {
        lastError = 'Tidak ada foto carousel yang bisa diambil.';
        emptyStreak += 1;
        if (emptyStreak >= 2) break;
        continue;
      }
      emptyStreak = 0;

      const merged = absorbPost(best, post);
      best = merged.post;
      const added = merged.added;

      // Halaman index biasanya berisi slide saat ini + slide berikutnya.
      // Jangan langsung berhenti saat signature sama: cache Jina bisa
      // mengembalikan halaman lama, padahal slide berikutnya masih ada.
      const signature = post.images.map(imageId).join('|');
      if (knownCount && best.images.length >= knownCount) break;
      if (best.images.length >= MAX_IMAGES) break;
      if (added > 0) {
        repeatStreak = 0;
      } else if (signature && signature === prevSignature) {
        repeatStreak += 1;
        if (repeatStreak >= 3) break;
      } else {
        repeatStreak = 0;
      }
      prevSignature = signature;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      emptyStreak += 1;
      if (emptyStreak >= 2) break;
    }
  }

  if (!best || !best.images.length) {
    throw new Error(lastError || 'Jina tidak menemukan foto pada post ini');
  }
  return best;
}

async function fetchPost(input, options = {}) {
  const url = normalizePostUrl(input);
  if (!url) throw new Error('Link Instagram tidak valid. Contoh: !cosplay https://www.instagram.com/p/xxxx/');

  const timeoutMs = Math.max(15000, Number(options.timeoutMs) || 45000);
  let best = null;
  let lastError = '';
  let knownCount = 0;

  const merge = (post) => {
    if (!post) return;
    const res = absorbPost(best, post);
    best = res.post;
    knownCount = Math.max(
      knownCount,
      Number(post.carouselCount) || 0,
      Number(best.carouselCount) || 0
    );
  };
  const needMore = () =>
    !best || !best.images.length || (knownCount > 0 && best.images.length < knownCount);

  // 1) Scraper lokal dengan cookie/session + proxy (kalau dikonfigurasi).
  if (IG_SESSIONID) {
    try {
      const post = await fetchViaInstagramApi(url, timeoutMs);
      merge(post);
      log.info(`[COSPLAY] API IG: ${post.images.length} foto`);
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      log.warn('[COSPLAY] API IG gagal, pakai fallback:', lastError);
    }
  }

  // 2) Provider publik tanpa login (Jina). Jadi jalur utama kalau cookie kosong.
  if (needMore()) {
    try {
      const post = await fetchViaJina(url, timeoutMs, { knownCount });
      merge(post);
      log.info(`[COSPLAY] Jina: ${post.images.length} foto (total ${best.images.length})`);
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      log.warn('[COSPLAY] Jina gagal:', lastError);
    }
  }

  // 3) Provider ketiga sebagai cadangan terakhir.
  if (needMore()) {
    try {
      const post = await fetchViaVxinstagram(url, timeoutMs);
      merge(post);
      log.info(
        `[COSPLAY] vxinstagram: ${post.images.length} foto (total ${best.images.length})`
      );
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      log.warn('[COSPLAY] vxinstagram gagal:', lastError);
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
  if (needsAiMeta(best)) await identifyWithAI(best);
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
