'use strict';

/**
 * Bridge plugin Kaguya untuk bot Tsukasa.
 *
 * File plugin Kaguya yang sudah dipindah ke ./plugins dimuat secara lazy
 * (hanya saat command-nya dipakai). Metadata menu dibaca dari source file
 * sekali saja, jadi tidak perlu meng-import 1500 plugin saat startup.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const LIB_DIR = path.join(ROOT, 'lib');

let configured = null;
let runtimePromise = null;
let catalogCache = null;
const moduleCache = new Map();

const CATEGORY_META = {
  anime: { icon: '🍥', label: 'Anime' },
  asisten: { icon: '🧰', label: 'Asisten' },
  audio: { icon: '🎧', label: 'Audio' },
  bajaklaut: { icon: '🏴‍☠️', label: 'Bajak Laut' },
  blackjack: { icon: '🃏', label: 'Blackjack' },
  canvas: { icon: '🎨', label: 'Canvas' },
  catur: { icon: '♟️', label: 'Catur' },
  cek: { icon: '🔎', label: 'Cek' },
  ceme: { icon: '🎴', label: 'Ceme' },
  channel: { icon: '📡', label: 'Channel' },
  clan: { icon: '🛡️', label: 'Clan' },
  convert: { icon: '🔄', label: 'Convert' },
  crypto: { icon: '🪙', label: 'Crypto' },
  dam: { icon: '⚪', label: 'Dam' },
  download: { icon: '📥', label: 'Download' },
  economy: { icon: '💰', label: 'Ekonomi' },
  ephoto: { icon: '🖼️', label: 'Ephoto' },
  esport: { icon: '🏆', label: 'Esport' },
  freefire: { icon: '🔥', label: 'Free Fire' },
  fun: { icon: '🎉', label: 'Fun' },
  game: { icon: '🎮', label: 'Game' },
  gaple: { icon: '🀄', label: 'Gaple' },
  genshin: { icon: '🌌', label: 'Genshin' },
  group: { icon: '👥', label: 'Grup' },
  'honkai-starrail': { icon: '🚄', label: 'Honkai Star Rail' },
  jpm: { icon: '📨', label: 'JPM' },
  kampus: { icon: '🎓', label: 'Kampus' },
  koboy: { icon: '🤠', label: 'Koboy' },
  ludo: { icon: '🎲', label: 'Ludo' },
  mafia: { icon: '🕵️', label: 'Mafia' },
  mafiakota: { icon: '🏙️', label: 'Mafia Kota' },
  main: { icon: '🧩', label: 'Main' },
  menfess: { icon: '💌', label: 'Menfess' },
  minecraft: { icon: '⛏️', label: 'Minecraft' },
  mobilelegends: { icon: '⚔️', label: 'Mobile Legends' },
  monopoli: { icon: '🏦', label: 'Monopoli' },
  ninja: { icon: '🥷', label: 'Ninja' },
  othello: { icon: '⚫', label: 'Othello' },
  owner: { icon: '👑', label: 'Owner' },
  poker: { icon: '♠️', label: 'Poker' },
  primbon: { icon: '🔮', label: 'Primbon' },
  quotes: { icon: '💬', label: 'Quotes' },
  relationship: { icon: '💞', label: 'Relationship' },
  rich: { icon: '✨', label: 'Rich' },
  rpg: { icon: '🗺️', label: 'RPG' },
  search: { icon: '🔍', label: 'Search' },
  'sewa-bot': { icon: '🧾', label: 'Sewa Bot' },
  stalker: { icon: '🕵️', label: 'Stalker' },
  sticker: { icon: '🖼️', label: 'Sticker' },
  store: { icon: '🛒', label: 'Store' },
  tebak: { icon: '❓', label: 'Tebak-tebakan' },
  tools: { icon: '🔧', label: 'Tools' },
  tycoon: { icon: '🏭', label: 'Tycoon' },
  ulartangga: { icon: '🪜', label: 'Ular Tangga' },
  undercover: { icon: '🎭', label: 'Undercover' },
  uno: { icon: '🎴', label: 'UNO' },
  user: { icon: '👤', label: 'User' },
  valorant: { icon: '🎯', label: 'Valorant' },
  'wuwa-wiki': { icon: '📖', label: 'WuWa Wiki' },
  zenless: { icon: '🌆', label: 'Zenless Zone Zero' },
  zombie: { icon: '🧟', label: 'Zombie' },
};

const SMALL_CAPS = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ',
  j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ',
  s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

function smallCaps(value) {
  return String(value || '').replace(/[a-zA-Z]/g, (ch) => SMALL_CAPS[ch.toLowerCase()] || ch);
}

function categoryMeta(key) {
  const meta = CATEGORY_META[key] || {};
  return {
    key,
    icon: meta.icon || '📦',
    label: meta.label || key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

function cleanCommand(value) {
  const cmd = String(value || '').trim().toLowerCase().replace(/^[.\/!]+/, '');
  if (!cmd || cmd.length > 32) return '';
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(cmd)) return '';
  if (['command', 'text', 'string', 'number', 'undefined', 'null'].includes(cmd)) return '';
  return cmd;
}

function quotedList(block) {
  const out = [];
  const re = /['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(String(block || '')))) {
    const cmd = cleanCommand(m[1]);
    if (cmd) out.push(cmd);
  }
  return out;
}

function readCommandMetadata(source, folder) {
  const commands = new Set();
  const help = [];
  let description = '';

  const add = (list) => list.forEach((cmd) => commands.add(cmd));

  for (const m of source.matchAll(/(?:handler|plugin)\.command\s*=\s*(\[[\s\S]{0,900}?\]|'[^']*'|"[^"]*"|`[^`]*`)/g)) {
    add(quotedList(m[1]));
  }
  for (const m of source.matchAll(/oneCommand\s*\([^,]{0,240},\s*['"]([^'"]+)['"]/g)) {
    add([m[1]]);
  }
  for (const m of source.matchAll(/\bcmd\s*\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g)) {
    add([m[1]]);
  }
  for (const m of source.matchAll(/\bcmds\s*:\s*(\[[\s\S]{0,900}?\])/g)) {
    add(quotedList(m[1]));
  }
  // Pola plugin RPG / wrapPlugin dengan pluginConfig.
  const head = source.slice(0, 5000);
  for (const m of head.matchAll(/\bname\s*:\s*['"]([^'"]+)['"]/g)) {
    if (/rpgPlugin|wrapPlugin|pluginConfig|customPrefix/.test(source)) add([m[1]]);
  }
  for (const m of head.matchAll(/\balias\s*:\s*(\[[\s\S]{0,500}?\])/g)) {
    if (/rpgPlugin|wrapPlugin|pluginConfig|customPrefix/.test(source)) add(quotedList(m[1]));
  }

  for (const m of source.matchAll(/(?:handler|plugin)\.help\s*=\s*(\[[\s\S]{0,1200}?\])/g)) {
    const re = /['"`]([^'"`]+)['"`]/g;
    let h;
    while ((h = re.exec(m[1]))) help.push(String(h[1]).trim());
  }
  for (const m of source.matchAll(/\busage\s*:\s*['"]([^'"]+)['"]/g)) help.push(String(m[1]).trim());
  for (const m of source.matchAll(/\bdescription\s*:\s*['"]([^'"]{3,180})['"]/g)) {
    if (!description) description = String(m[1]).trim();
  }
  for (const m of source.matchAll(/(?:handler|plugin)\.description\s*=\s*['"]([^'"]{3,180})['"]/g)) {
    if (!description) description = String(m[1]).trim();
  }

  return {
    commands: [...commands],
    help: [...new Set(help)].slice(0, 8),
    description,
    folder,
  };
}

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function buildCatalog() {
  const files = walk(PLUGINS_DIR);
  const categories = new Map();
  const byCommand = new Map();
  const entries = [];

  for (const file of files) {
    let source = '';
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(PLUGINS_DIR, file).split(path.sep);
    const folder = rel[0];
    const meta = readCommandMetadata(source, folder);
    if (!meta.commands.length) continue;

    const entry = {
      file,
      rel: rel.join('/'),
      folder,
      commands: meta.commands,
      help: meta.help,
      description: meta.description,
      owner: /\b(?:handler|plugin)\.owner\s*=\s*true|\bisOwner\s*:\s*true/.test(source),
      premium: /\b(?:handler|plugin)\.premium\s*=\s*true|\bisPremium\s*:\s*true/.test(source),
      admin: /\b(?:handler|plugin)\.admin\s*=\s*true|\bisAdmin\s*:\s*true/.test(source),
      group: /\b(?:handler|plugin)\.group\s*=\s*true|\bisGroup\s*:\s*true/.test(source),
      private: /\b(?:handler|plugin)\.private\s*=\s*true|\bisPrivate\s*:\s*true/.test(source),
    };
    entries.push(entry);

    if (!categories.has(folder)) {
      categories.set(folder, { ...categoryMeta(folder), commands: new Set(), files: 0 });
    }
    const cat = categories.get(folder);
    cat.files += 1;
    for (const cmd of entry.commands) {
      cat.commands.add(cmd);
      const list = byCommand.get(cmd) || [];
      list.push(entry);
      byCommand.set(cmd, list);
    }
  }

  const list = [...categories.values()]
    .map((cat) => ({ ...cat, commands: [...cat.commands].sort(), count: cat.commands.size }))
    .filter((cat) => cat.count > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'id'));

  return { categories: list, byCommand, entries, scannedAt: Date.now() };
}

function getCatalog() {
  if (!catalogCache) catalogCache = buildCatalog();
  return catalogCache;
}

function setGlobals(cfg) {
  const g = global;
  g.prefix = ['.', '!', '/'];
  g.namebot = (cfg && cfg.botName) || 'Tsukasa';
  g.ownername = g.namebot;
  g.creator = g.namebot;
  g.nameSaluran = g.namebot;
  g.idSaluran = '';
  g.versi = '2.0.0';
  g.owners = [];
  g.mess = {
    wait: 'Tunggu sebentar ya...',
    owner: 'Perintah ini khusus owner.',
    admin: 'Perintah ini khusus admin grup.',
    premium: 'Perintah ini khusus premium.',
    group: 'Perintah ini hanya bisa dipakai di grup.',
    private: 'Perintah ini hanya bisa dipakai di chat pribadi.',
  };
  g.dbEngine = 'json';
  g.hanyaTerdaftar = false;
  g.wajibDaftar = false;
  g.bebasDaftar = [];
  g.public = true;
  g.publicTelegram = true;
  g.pconly = false;
  g.gconly = false;
  g.sewamode = false;
  g.grupbot = false;
  g.botMode = 'all';
  g.buttonMode = false;
  g.replyCardOn = false;
  g.multiplier = 38;
  g.fitur = g.fitur || {};
  g.thumb = g.thumb || {};
  g.prefix = Array.isArray(g.prefix) ? g.prefix : ['.'];
  g.isPublic = () => true;
}

async function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      setGlobals(configured);
      let kaguyaConfig = {};
      try {
        kaguyaConfig = await import(pathToFileURL(path.join(LIB_DIR, 'kaguya-config.js')).href);
      } catch (err) {
        console.error('[KAGUYA] config gagal dimuat:', err && err.message);
      }
      // Identitas tetap milik Tsukasa.
      setGlobals(configured);
      if (kaguyaConfig && kaguyaConfig.default) {
        // no-op, config hanya memasang global
      }

      try {
        const db = await import(pathToFileURL(path.join(LIB_DIR, 'db', 'database.js')).href);
        if (!global.db) db.initDatabase();
      } catch (err) {
        console.error('[KAGUYA] database gagal dimuat:', err && err.message);
        throw err;
      }

      const wa = await import(pathToFileURL(path.join(LIB_DIR, 'platform', 'wa.js')).href);
      const engine = await import(pathToFileURL(path.join(LIB_DIR, 'engine', 'plugins.js')).href);
      return { wa, engine };
    })().catch((err) => {
      runtimePromise = null;
      throw err;
    });
  }
  return runtimePromise;
}

function configure(cfg) {
  configured = cfg || {};
  setGlobals(configured);
}

async function attachSock(sock) {
  if (!sock) return;
  const runtime = await ensureRuntime();
  if (!sock.__tsukasaKaguyaHelpers) {
    try {
      runtime.wa.attachHelpers(sock);
      sock.__tsukasaKaguyaHelpers = true;
    } catch (err) {
      console.error('[KAGUYA] attachHelpers gagal:', err && err.message);
    }
  }
  global.sock = sock;
}

async function loadPlugin(entry) {
  if (!moduleCache.has(entry.file)) {
    moduleCache.set(
      entry.file,
      import(pathToFileURL(entry.file).href).then((mod) => mod.default || mod)
    );
  }
  return moduleCache.get(entry.file);
}

function prefixesFor(cfg) {
  return ['.', '!', '/'];
}

function hasCommand(command) {
  return getCatalog().byCommand.has(String(command || '').toLowerCase());
}

function commandEntries(command) {
  return getCatalog().byCommand.get(String(command || '').toLowerCase()) || [];
}

async function getGroupMeta(sock, chat) {
  if (!chat || !String(chat).endsWith('@g.us')) return null;
  try {
    return await sock.groupMetadata(chat);
  } catch {
    return null;
  }
}

async function dispatch({
  sock,
  raw,
  cfg,
  command,
  rest,
  prefix,
  chat,
  sender,
  isOwner,
  isAdmin,
  isPremium,
  reply,
}) {
  const cmd = String(command || '').toLowerCase();
  const entries = commandEntries(cmd);
  if (!entries.length) return false;

  await ensureRuntime();
  await attachSock(sock);

  let lastError = null;
  for (const entry of entries) {
    let plugin;
    try {
      plugin = await loadPlugin(entry);
    } catch (err) {
      lastError = err;
      continue;
    }
    if (typeof plugin !== 'function') continue;
    if (plugin.disabled || (Array.isArray(plugin.command) && !plugin.command.length)) continue;
    if (plugin.owner && !isOwner) {
      await reply('Perintah ini khusus owner.');
      return true;
    }
    if (plugin.premium && !isPremium && !isOwner) {
      await reply('Perintah ini khusus premium.');
      return true;
    }
    if (plugin.admin && !isAdmin && !isOwner) {
      await reply('Perintah ini khusus admin grup.');
      return true;
    }
    if (plugin.group && !String(chat).endsWith('@g.us')) {
      await reply('Perintah ini hanya bisa dipakai di grup.');
      return true;
    }
    if (plugin.private && String(chat).endsWith('@g.us')) {
      await reply('Perintah ini hanya bisa dipakai di chat pribadi.');
      return true;
    }

    const { wa } = await ensureRuntime();
    let m;
    try {
      m = wa.serialize(sock, raw);
    } catch (err) {
      lastError = err;
      continue;
    }
    if (!m) continue;

    const groupMetadata = await getGroupMeta(sock, chat);
    const text = String(rest || '');
    const args = text ? text.split(/\s+/).filter(Boolean) : [];
    const botIds = [sock.user && sock.user.id, sock.user && sock.user.lid].filter(Boolean);
    const botAdmin = Boolean(
      groupMetadata &&
        botIds.some((id) =>
          (groupMetadata.participants || []).some(
            (p) =>
              p.admin &&
              [p.id, p.phoneNumber, p.jid, p.lid]
                .filter(Boolean)
                .map((v) => String(v))
                .includes(String(id))
          )
        )
    );

    const ctx = {
      sock,
      conn: sock,
      m,
      text,
      body: text,
      args,
      prefix: prefix || '.',
      usedPrefix: prefix || '.',
      command: cmd,
      reply: (value, options) => m.reply(value, options),
      example: (usage) => m.reply(`Contoh: ${prefix || '.'}${cmd} ${usage || ''}`.trim()),
      sender: m.sender || sender,
      jid: chat,
      chat,
      isOwner: Boolean(isOwner),
      isAdmin: Boolean(isAdmin),
      isPremium: Boolean(isPremium || isOwner),
      isBotAdmin: botAdmin,
      isCmd: true,
      pushName: m.pushName,
      pushname: m.pushName,
      mentionedJid: m.mentionedJid || [],
      quoted: m.quoted || null,
      groupMetadata,
      participants:
        groupMetadata && Array.isArray(groupMetadata.participants)
          ? groupMetadata.participants.map((p) => ({ ...p, id: p.phoneNumber || p.id }))
          : [],
      config: {},
    };

    try {
      await plugin(m, ctx);
      return true;
    } catch (err) {
      lastError = err;
      console.error(`[KAGUYA] ${entry.rel} (${cmd}) error:`, err && (err.stack || err.message || err));
      break;
    }
  }

  if (lastError) {
    const message = String(lastError.message || lastError).slice(0, 220);
    await reply(`⚠️ Plugin *${cmd}* gagal dijalankan.\n${message}`);
    return true;
  }
  return false;
}

function box(title, lines, footer) {
  const out = [`╭─「 ${smallCaps(title)} 」`];
  for (const line of lines) out.push(`│ ${line}`);
  out.push('╰─' + '─'.repeat(Math.max(6, Math.min(28, String(title).length + 8))));
  if (footer) out.push('', footer);
  return out.join('\n');
}

function normalizeBuiltins(builtinCategories) {
  return (Array.isArray(builtinCategories) ? builtinCategories : [])
    .filter((b) => b && Array.isArray(b.commands) && b.commands.length)
    .map((b) => ({
      key: String(b.key || '').toLowerCase(),
      label: b.label || b.key || 'Fitur',
      description: b.description || '',
      commands: [...new Set(b.commands.map((c) => String(c).toLowerCase()))].sort(),
    }));
}

function formatMenu({ category, isOwner, prefix, builtinCategories }) {
  const cat = String(category || '').trim().toLowerCase();
  const p = prefix || '.';
  const catalog = getCatalog();
  const builtins = normalizeBuiltins(builtinCategories);

  if (cat) {
    if (cat === 'all' || cat === 'semua') {
      return formatAllCommands(p, builtins);
    }
    const found = catalog.categories.find(
      (c) => c.key === cat || c.label.toLowerCase() === cat
    );
    if (found) {
      const lines = found.commands.map((cmd) => {
        const entry = (catalog.byCommand.get(cmd) || [])[0];
        const desc = entry && entry.description ? ` — ${entry.description}` : '';
        return `• ${p}${cmd}${desc}`;
      });
      return box(`ᴍᴇɴᴜ ${found.label}`, lines, `Total: ${found.count} command • .help ${found.key}`);
    }
    const builtin = builtins.find((b) => b.key === cat || b.label.toLowerCase() === cat);
    if (builtin) {
      const lines = builtin.commands.map((cmd) => `• ${p}${cmd}`);
      return box(
        `ᴍᴇɴᴜ ${builtin.label}`,
        lines,
        `Total: ${builtin.commands.length} command • .help ${builtin.key}`
      );
    }
    return null;
  }

  const lines = [];
  lines.push(`Hai! Aku ${configured && configured.botName ? configured.botName : 'Tsukasa'} ✨`);
  lines.push('');
  lines.push(`╭─「 ${smallCaps('menu utama')} 」`);
  if (builtins.length) {
    lines.push('│ *Fitur Tsukasa*');
    for (const b of builtins) {
      lines.push(`│ ${b.label} — ${b.commands.length} cmd`);
    }
  }
  if (catalog.categories.length) {
    lines.push('│ *Fitur Kaguya*');
    for (const c of catalog.categories) {
      lines.push(`│ ${c.label} — ${c.count} cmd`);
    }
  }
  lines.push('╰──────────────────────');
  lines.push('');
  lines.push(`${p}menu <kategori> — lihat command per kategori`);
  lines.push(`${p}menu all — semua command`);
  lines.push(`${p}help — panduan & bantuan command`);
  lines.push(`${p}help <command> — cara pakai command`);
  lines.push(isOwner ? 'Owner mode aktif' : 'User mode');
  return lines.join('\n');
}

function formatAllCommands(prefix, builtins = []) {
  const catalog = getCatalog();
  const lines = [];
  for (const b of builtins) {
    lines.push(`*${b.label.toUpperCase()}*`);
    lines.push(b.commands.map((cmd) => `${prefix}${cmd}`).join(' • '));
    lines.push('');
  }
  if (builtins.length && catalog.categories.length) {
    lines.push('*FITUR KAGUYA*');
    lines.push('');
  }
  for (const c of catalog.categories) {
    lines.push(`*${c.label.toUpperCase()}*`);
    lines.push(c.commands.map((cmd) => `${prefix}${cmd}`).join(' • '));
    lines.push('');
  }
  return lines.join('\n').trim();
}

function formatHelp({ query, prefix, builtinCategories }) {
  const q = String(query || '').trim().toLowerCase().replace(/^[.\/!]+/, '');
  const catalog = getCatalog();
  const builtins = normalizeBuiltins(builtinCategories);
  const p = prefix || '.';

  if (!q) {
    return [
      `╭─「 ${smallCaps('bantuan')} 」`,
      `│ ${p}menu — katalog menu`,
      `│ ${p}menu <kategori> — command per kategori`,
      `│ ${p}menu all — semua command`,
      `│ ${p}help <command> — cara pakai command`,
      `│ ${p}help <kategori> — daftar command kategori`,
      `│`,
      `│ Command bisa memakai prefix . ! /`,
      `│ atau panggil dengan trigger "${configured && configured.trigger ? configured.trigger : 'tsukasa'}".`,
      `╰──────────────────────`,
      '',
      `Contoh: ${p}help anime`,
      `Contoh: ${p}help sticker`,
    ].join('\n');
  }

  const builtinCat = builtins.find((b) => b.key === q || b.label.toLowerCase() === q);
  if (builtinCat) {
    const lines = [builtinCat.description, ''].filter(Boolean);
    lines.push(...builtinCat.commands.map((cmd) => `• ${p}${cmd}`));
    return box(`ʙᴀɴᴛᴜᴀɴ ${builtinCat.label}`, lines, `${p}menu ${builtinCat.key} untuk katalog`);
  }

  const builtinCmd = builtins.find((b) => b.commands.includes(q));
  if (builtinCmd) {
    return box(`ʙᴀɴᴛᴜᴀɴ ${q}`, [
      builtinCmd.description,
      '',
      `Fitur : ${builtinCmd.label}`,
      `Pakai : ${p}${q}`,
      '',
      `Command lain di fitur ini:`,
      ...builtinCmd.commands.filter((cmd) => cmd !== q).slice(0, 12).map((cmd) => `• ${p}${cmd}`),
    ].filter(Boolean));
  }

  const cat = catalog.categories.find((c) => c.key === q || c.label.toLowerCase() === q);
  if (cat) {
    const lines = cat.commands.slice(0, 60).map((cmd) => {
      const entry = (catalog.byCommand.get(cmd) || [])[0];
      const usage = entry && entry.help && entry.help[0] ? entry.help[0] : cmd;
      return `• ${p}${usage}${entry && entry.description ? ` — ${entry.description}` : ''}`;
    });
    if (cat.commands.length > 60) lines.push(`… dan ${cat.commands.length - 60} command lainnya`);
    return box(`ʙᴀɴᴛᴜᴀɴ ${cat.label}`, lines, `${p}menu ${cat.key} untuk katalog`);
  }

  const entries = catalog.byCommand.get(q) || [];
  if (!entries.length) {
    return `Command *${q}* tidak ditemukan.\nCoba ${p}menu atau ${p}help <kategori>.`;
  }
  const entry = entries[0];
  const usage = entry.help.length ? entry.help : entry.commands;
  const meta = categoryMeta(entry.folder);
  const lines = [];
  if (entry.description) lines.push(entry.description);
  lines.push('');
  lines.push(`Kategori : ${meta.label}`);
  lines.push(`File     : ${entry.rel}`);
  lines.push(`Alias    : ${entry.commands.map((c) => p + c).join(', ')}`);
  lines.push('');
  lines.push('Cara pakai:');
  for (const u of usage.slice(0, 6)) {
    const text = String(u).trim();
    lines.push(`• ${text.startsWith(p) ? text : p + text}`);
  }
  if (entry.owner) lines.push('', 'Khusus owner');
  if (entry.premium) lines.push('', 'Khusus premium');
  if (entry.admin) lines.push('', 'Khusus admin grup');
  if (entry.group) lines.push('', 'Hanya di grup');
  if (entry.private) lines.push('', 'Hanya di chat pribadi');
  return box(`ʙᴀɴᴛᴜᴀɴ ${q}`, lines);
}

module.exports = {
  configure,
  ensureRuntime,
  attachSock,
  getCatalog,
  hasCommand,
  commandEntries,
  dispatch,
  formatMenu,
  formatHelp,
  prefixesFor,
  categoryMeta,
  smallCaps,
};
