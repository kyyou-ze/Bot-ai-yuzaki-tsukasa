'use strict';

const log = require('../logger');
const crypto = require('crypto');
const memory = require('../memory');
const llm = require('../llm');
const wa = require('../wa');
const { isGroupJid, jidUser } = require('../util');

const MAX_REMINDERS_PER_CHAT = 50;
const MIN_REMINDER_MS = 10 * 1000;
const MAX_REMINDER_MS = 30 * 24 * 60 * 60 * 1000;
const REMINDER_TICK_MS = 30 * 1000;
const MAX_BUFFER = 150;
const MAX_SUMMARY_MESSAGES = 100;
const MAX_SUMMARY_CHARS = 7000;

const UNIT_MS = {
  s: 1000,
  dtk: 1000,
  detik: 1000,
  m: 60 * 1000,
  mnt: 60 * 1000,
  menit: 60 * 1000,
  j: 60 * 60 * 1000,
  jam: 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  hari: 24 * 60 * 60 * 1000,
};

const SUMMARY_SYSTEM = `Kamu asisten yang merangkum percakapan grup WhatsApp berbahasa Indonesia.
Buat ringkasan padat, netral, dan mudah dibaca dari transkrip yang diberikan.
Jangan mengarang informasi yang tidak ada di transkrip. Pertahankan nama orang dan istilah penting.
Balas dengan format:
*Topik utama*
- ...

*Keputusan / kesimpulan*
- ... (tulis "Tidak ada" jika tidak ada)

*Perlu ditindaklanjuti*
- ... (tulis "Tidak ada" jika tidak ada)`;

function zonedDate(now, offsetHours, dayOffset, hour, minute) {
  const offset = Number(offsetHours) || 0;
  const zoned = new Date(now + offset * 60 * 60 * 1000);
  return (
    Date.UTC(
      zoned.getUTCFullYear(),
      zoned.getUTCMonth(),
      zoned.getUTCDate() + (Number(dayOffset) || 0),
      Number(hour) || 0,
      Number(minute) || 0,
      0,
      0
    ) -
    offset * 60 * 60 * 1000
  );
}

function startOfToday(now, offsetHours) {
  const offset = Number(offsetHours) || 0;
  const zoned = new Date(now + offset * 60 * 60 * 1000);
  return (
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate()) -
    offset * 60 * 60 * 1000
  );
}

function formatDue(dueAt, timezone) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone || 'Asia/Jakarta',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(dueAt));
  } catch {
    return new Date(dueAt).toLocaleString('id-ID');
  }
}

function formatClock(ts, timezone) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone || 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toTimeString().slice(0, 5);
  }
}

function localHour(ts, offsetHours) {
  const offset = Number(offsetHours) || 0;
  return new Date(ts + offset * 60 * 60 * 1000).getUTCHours();
}

/**
 * Parse waktu pengingat dari awal teks.
 * Contoh: "10m minum air", "1 jam 30 menit rapat", "besok 08:00 meeting",
 * "jam 15:30 telepon", atau "10 minum air" (angka polos = menit).
 */
function parseWhen(input, options = {}) {
  const now = Number(options.now) || Date.now();
  const tzOffset = Number.isFinite(Number(options.tzOffset)) ? Number(options.tzOffset) : 7;
  const text = String(input || '').trim();
  if (!text) return null;

  // besok [jam] HH:MM <teks>
  let m = text.match(/^besok(?:\s+(?:jam\s+)?(\d{1,2})[.:](\d{2}))?\s+([\s\S]+)$/i);
  if (m) {
    const hour = m[1] !== undefined ? Number(m[1]) : 9;
    const minute = m[2] !== undefined ? Number(m[2]) : 0;
    const rest = String(m[3] || '').trim();
    if (!rest || hour > 23 || minute > 59) return null;
    return {
      dueAt: zonedDate(now, tzOffset, 1, hour, minute),
      rest,
      mode: 'besok',
    };
  }

  // [jam] HH:MM <teks>
  m = text.match(/^(?:jam\s+)?(\d{1,2})[.:](\d{2})\s+([\s\S]+)$/i);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    const rest = String(m[3] || '').trim();
    if (!rest || hour > 23 || minute > 59) return null;
    let dueAt = zonedDate(now, tzOffset, 0, hour, minute);
    if (dueAt <= now) dueAt += 24 * 60 * 60 * 1000;
    return { dueAt, rest, mode: 'jam' };
  }

  // Durasi relatif: 10m, 2j, 1 jam 30 menit, 2 hari, ...
  let rest = text;
  let ms = 0;
  let matched = false;
  const unitRe = /^(\d+)\s*(detik|dtk|menit|mnt|jam|hr|hari|s|m|j|h|d)(?![a-z])[\s,.]*/i;
  for (;;) {
    const u = rest.match(unitRe);
    if (!u) break;
    matched = true;
    ms += Number(u[1]) * (UNIT_MS[String(u[2]).toLowerCase()] || 0);
    rest = rest.slice(u[0].length).trim();
  }
  if (matched) {
    if (!rest || ms < MIN_REMINDER_MS || ms > MAX_REMINDER_MS) return null;
    return { dueAt: now + ms, rest, mode: 'relative' };
  }

  // Angka polos dianggap menit: "10 minum air".
  m = text.match(/^(\d+)\s+([\s\S]+)$/);
  if (m) {
    const minutes = Number(m[1]);
    const rest = String(m[2] || '').trim();
    const ms2 = minutes * 60 * 1000;
    if (rest && ms2 >= MIN_REMINDER_MS && ms2 <= MAX_REMINDER_MS) {
      return { dueAt: now + ms2, rest, mode: 'relative' };
    }
  }

  return null;
}

function unquote(value) {
  return String(value || '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

/**
 * Parse "pertanyaan | opsi1 | opsi2". Minimal 2 opsi.
 */
function parsePoll(input) {
  const parts = String(input || '')
    .split('|')
    .map((s) => unquote(s))
    .filter(Boolean);
  if (parts.length < 3) return null;
  const question = parts[0];
  const options = parts.slice(1, 13);
  return { question, options, truncated: parts.length - 1 > options.length };
}

class GroupTools {
  constructor(cfg, store) {
    this.cfg = cfg || {};
    this.store = store;
    this.timezone = String(this.cfg.timezone || 'Asia/Jakarta');
    this.tzOffset = Number.isFinite(Number(this.cfg.tzOffset)) ? Number(this.cfg.tzOffset) : 7;
    this.timer = null;
    this.ticking = false;
    // Buffer pesan hanya di memori (tidak ditulis ke disk) untuk fitur
    // rangkuman & statistik. Otomatis hilang saat bot restart.
    this.buffers = new Map();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), REMINDER_TICK_MS);
    this.tick();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = this.store.dueReminders(Date.now());
      for (const r of due) {
        // Jangan retry selamanya jika pengiriman terus gagal.
        if (Date.now() - Number(r.dueAt) > 24 * 60 * 60 * 1000) {
          await this.store.removeReminderById(r.id);
          continue;
        }
        const mention = r.by && isGroupJid(r.chat) ? [r.by] : [];
        const who = mention.length ? `@${jidUser(r.by)} ` : '';
        try {
          await wa.sendText(r.chat, `⏰ *Pengingat* ${who}\n${r.text}`, undefined, mention);
          await this.store.removeReminderById(r.id);
        } catch (err) {
          log.error('[REMINDER] gagal kirim:', err.message);
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  reply(m, text, mentions) {
    return wa.sendText(m.key.remoteJid, text, m, mentions).catch(() => {});
  }

  reminderUsage() {
    return [
      '*Pengingat*',
      '!ingatkan <waktu> <teks>',
      '!ingatkan list',
      '!ingatkan hapus <id>',
      '',
      'Contoh:',
      '!ingatkan 10m minum air',
      '!ingatkan 1 jam 30 menit rapat',
      '!ingatkan besok 08:00 berangkat kerja',
      '!ingatkan jam 15:30 telepon ibu',
    ].join('\n');
  }

  async handleReminder(sock, m, rest) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;
    const args = String(rest || '').trim();
    const parts = args.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || '').toLowerCase();

    if (!args || sub === 'help' || sub === 'bantuan') {
      await this.reply(m, this.reminderUsage());
      return true;
    }

    if (sub === 'list' || sub === 'daftar') {
      const list = this.store.listReminders(chat).slice(0, 20);
      if (list.length === 0) {
        await this.reply(m, 'Belum ada pengingat di chat ini.');
        return true;
      }
      const lines = ['⏰ *Daftar pengingat*', ''];
      for (const r of list) {
        lines.push(`• [${r.id}] ${formatDue(r.dueAt, this.timezone)}`);
        lines.push(`  ${r.text}`);
      }
      lines.push('');
      lines.push('Hapus: !ingatkan hapus <id>');
      await this.reply(m, lines.join('\n'));
      return true;
    }

    if (['hapus', 'del', 'delete', 'cancel', 'batal'].includes(sub)) {
      const id = String(parts[1] || '').trim();
      if (!id) {
        await this.reply(m, 'Gunakan: !ingatkan hapus <id>');
        return true;
      }
      const mine = this.store.listReminders(chat);
      const matches = mine.filter((r) => r.id === id || r.id.startsWith(id));
      if (matches.length === 0) {
        await this.reply(m, `Pengingat dengan id "${id}" tidak ditemukan.`);
        return true;
      }
      if (matches.length > 1) {
        await this.reply(
          m,
          `Id "${id}" ambigu. Kandidat: ${matches.map((r) => r.id).join(', ')}`
        );
        return true;
      }
      await this.store.removeReminder(chat, matches[0].id);
      await this.reply(m, `🗑️ Pengingat [${matches[0].id}] dihapus.`);
      return true;
    }

    const parsed = parseWhen(args, { tzOffset: this.tzOffset });
    if (!parsed) {
      await this.reply(
        m,
        'Format waktu tidak dikenali.\n\n' + this.reminderUsage()
      );
      return true;
    }

    const existing = this.store.listReminders(chat);
    if (existing.length >= MAX_REMINDERS_PER_CHAT) {
      await this.reply(
        m,
        `Batas pengingat tercapai (${MAX_REMINDERS_PER_CHAT}). Hapus beberapa dulu dengan !ingatkan list.`
      );
      return true;
    }

    const id = crypto.randomBytes(3).toString('hex');
    const text = parsed.rest.slice(0, 500);
    await this.store.addReminder({
      id,
      chat,
      by: sender,
      text,
      dueAt: parsed.dueAt,
      createdAt: Date.now(),
    });

    const mention = isGroupJid(chat) ? [sender] : [];
    const who = mention.length ? `@${jidUser(sender)} ` : '';
    await this.reply(
      m,
      `⏰ Siap, ${who}aku ingatkan:\n*${text}*\n\nPada: ${formatDue(parsed.dueAt, this.timezone)}\nId: ${id}`,
      mention
    );
    return true;
  }

  pollUsage() {
    return [
      '*Polling grup*',
      '!poll <pertanyaan> | <opsi1> | <opsi2> [| opsi3 ...]',
      '',
      'Contoh:',
      '!poll Makan apa? | Nasi goreng | Mie ayam | Bakso',
      '',
      'Maksimal 12 opsi.',
    ].join('\n');
  }

  async handlePoll(sock, m, rest) {
    const chat = m.key.remoteJid;
    const parsed = parsePoll(rest);
    if (!parsed) {
      await this.reply(m, this.pollUsage());
      return true;
    }

    try {
      await wa.sendMessage(
        chat,
        {
          poll: {
            name: parsed.question,
            values: parsed.options,
            selectableCount: 1,
          },
        },
        m
      );
    } catch (err) {
      // Fallback jika server/versi WhatsApp tidak mendukung poll native.
      log.warn('[POLL] gagal kirim poll native:', err.message);
      const lines = [`📊 *${parsed.question}*`, ''];
      parsed.options.forEach((opt, i) => lines.push(`${i + 1}. ${opt}`));
      lines.push('');
      lines.push('Balas dengan nomor pilihanmu.');
      await this.reply(m, lines.join('\n'));
    }

    if (parsed.truncated) {
      await this.reply(m, 'ℹ️ Opsi dibatasi maksimal 12.');
    }
    return true;
  }

  recordMessage(chat, sender, text, options = {}) {
    if (options.isCommand) return;
    const clean = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean || clean.length < 2) return;

    const name = memory.getUserName(sender) || jidUser(sender);
    const list = this.buffers.get(chat) || [];
    list.push({
      by: sender,
      name,
      text: clean.slice(0, 500),
      at: Date.now(),
    });
    if (list.length > MAX_BUFFER) list.splice(0, list.length - MAX_BUFFER);
    this.buffers.set(chat, list);
  }

  async handleSummary(sock, m, rest) {
    const chat = m.key.remoteJid;
    const parts = String(rest || '').trim().split(/\s+/).filter(Boolean);
    let count = parseInt(parts[0], 10);
    if (!Number.isFinite(count) || count <= 0) count = 40;
    count = Math.max(5, Math.min(MAX_SUMMARY_MESSAGES, count));

    const buffer = this.buffers.get(chat) || [];
    if (buffer.length < 3) {
      await this.reply(
        m,
        'Belum cukup pesan untuk dirangkum. Ajak ngobrol dulu, nanti coba lagi ya.'
      );
      return true;
    }

    const slice = buffer.slice(-count);
    const lines = [];
    let chars = 0;
    for (let i = slice.length - 1; i >= 0; i--) {
      const msg = slice[i];
      const name = memory.getUserName(msg.by) || msg.name || jidUser(msg.by);
      const line = `[${formatClock(msg.at, this.timezone)}] ${name}: ${msg.text.slice(0, 300)}`;
      if (chars + line.length > MAX_SUMMARY_CHARS) break;
      lines.unshift(line);
      chars += line.length + 1;
    }

    if (lines.length < 2) {
      await this.reply(m, 'Pesan terlalu panjang/sedikit untuk dirangkum.');
      return true;
    }

    let summary = '';
    try {
      summary = await llm.askText(SUMMARY_SYSTEM, lines.join('\n'));
    } catch (err) {
      log.error('[SUMMARY] gagal:', err.message);
    }
    if (!summary) {
      await this.reply(m, 'Gagal membuat rangkuman. Coba lagi sebentar ya.');
      return true;
    }

    const header = `🧾 *Rangkuman ${lines.length} pesan terakhir*`;
    await this.reply(m, `${header}\n\n${String(summary).trim().slice(0, 3500)}`);
    return true;
  }

  async handleStats(sock, m) {
    const chat = m.key.remoteJid;
    const buffer = this.buffers.get(chat) || [];
    if (buffer.length === 0) {
      await this.reply(m, 'Belum ada pesan yang terekam di chat ini sejak bot aktif.');
      return true;
    }

    const now = Date.now();
    const todayStart = startOfToday(now, this.tzOffset);
    const today = buffer.filter((msg) => msg.at >= todayStart);
    const counts = new Map();
    const hours = new Map();

    for (const msg of buffer) {
      const key = msg.by || msg.name || 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
      const hour = localHour(msg.at, this.tzOffset);
      hours.set(hour, (hours.get(hour) || 0) + 1);
    }

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, 5);
    const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0] || [0, 0];

    const label = isGroupJid(chat) ? 'Grup' : 'Chat';
    const lines = [
      `📊 *Statistik ${label}*`,
      '',
      `• Pesan terekam : ${buffer.length}`,
      `• Pesan hari ini: ${today.length}`,
      `• Anggota aktif : ${counts.size}`,
      `• Jam tersibuk  : ${String(peak[0]).padStart(2, '0')}:00–${String(
        (Number(peak[0]) + 1) % 24
      ).padStart(2, '0')}:00 (${peak[1]} pesan)`,
    ];

    if (top.length) {
      lines.push('');
      lines.push('*Paling aktif*');
      top.forEach(([jid, total], i) => {
        const name = memory.getUserName(jid) || jidUser(jid);
        lines.push(`${i + 1}. ${name} — ${total} pesan`);
      });
    }

    lines.push('');
    lines.push(`_Dihitung dari ${buffer.length} pesan terakhir di memori (reset saat bot restart)._`);
    await this.reply(m, lines.join('\n'));
    return true;
  }
}

module.exports = {
  GroupTools,
  parseWhen,
  parsePoll,
  formatDue,
  formatClock,
};
