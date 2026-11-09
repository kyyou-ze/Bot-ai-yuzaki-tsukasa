'use strict';

const wa = require('../wa');
const settings = require('../settings');
const { isGroupJid, jidUser, onlyDigits } = require('../util');

const COMMANDS = new Set([
  'addakun',
  'tambahakun',
  'delakun',
  'hapusakun',
  'listakun',
  'daftarakun',
  'detector',
  'detektor',
]);

function bareJid(jid) {
  return String(jid || '')
    .replace(/:\d+@/, '@')
    .trim();
}

function digitsOf(jid) {
  return onlyDigits(jidUser(jid));
}

/**
 * Kelola akun TikTok yang dipantau langsung dari WhatsApp, tanpa edit .env
 * dan tanpa restart. Bisa dipakai owner, atau admin grup tempat command dikirim.
 */
class TikTokAdminFeature {
  constructor(cfg, accounts, monitor) {
    this.cfg = cfg || {};
    this.accounts = accounts;
    this.monitor = monitor || null;
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  async isGroupAdmin(sock, m, chat) {
    if (!isGroupJid(chat)) return false;

    let meta;
    try {
      meta = await sock.groupMetadata(chat);
    } catch {
      return false;
    }

    const candidates = [
      m.key.participant,
      m.key.participantPn,
      m.key.participantAlt,
      m.key.remoteJidAlt,
      m.key.senderPn,
    ]
      .filter(Boolean)
      .map(bareJid);
    if (!candidates.length) return false;

    const candDigits = new Set(candidates.map(digitsOf).filter(Boolean));

    for (const p of meta.participants || []) {
      if (!p || (p.admin !== 'admin' && p.admin !== 'superadmin')) continue;
      const ids = [p.id, p.phoneNumber, p.lid].filter(Boolean).map(bareJid);
      for (const id of ids) {
        if (candidates.includes(id)) return true;
        const d = digitsOf(id);
        if (d && candDigits.has(d)) return true;
      }
    }
    return false;
  }

  usage() {
    return [
      '*Kelola akun TikTok yang dipantau*',
      '/addakun @username',
      '/delakun @username',
      '/listakun',
      '',
      'Grup notifikasi:',
      '/detector setgc — pakai grup ini',
      '/detector setgc <link grup> — atur dari grup lain (owner)',
      '/detector setgc off — matikan notifikasi tambahan',
      '/detector setgc status — lihat grup notifikasi',
      '',
      'Khusus owner:',
      '/detector on|off|status',
      '',
      'Bisa juga: Tsukasa addakun @username, !addakun @username',
    ].join('\n');
  }

  /** Ubah input jadi JID grup. Mendukung JID langsung dan link undangan. */
  async resolveGroupTarget(sock, raw, chat) {
    const value = String(raw || '').trim();
    const here = !value || ['ini', 'sini', 'here', 'grup', 'gc'].includes(value.toLowerCase());
    if (here) {
      if (!isGroupJid(chat)) {
        throw new Error(
          'Jalankan /detector setgc di dalam grup, atau kirim JID/link grup tujuannya.'
        );
      }
      return { jid: chat, name: '' };
    }

    const invite = value.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{5,})/i);
    if (invite) {
      const meta = await sock.groupGetInviteInfo(invite[1]);
      const jid = String((meta && (meta.id || meta.jid)) || '').trim();
      if (!isGroupJid(jid)) throw new Error('Grup dari link itu tidak ditemukan.');
      return { jid, name: String((meta && (meta.subject || meta.name)) || '').trim() };
    }

    const jid = settings.normalizeJid(value);
    if (!isGroupJid(jid)) {
      throw new Error(
        'JID grup tidak valid. Contoh: 1203630xxxx@g.us atau link https://chat.whatsapp.com/...'
      );
    }
    return { jid, name: '' };
  }

  async groupLabel(sock, jid) {
    try {
      const meta = await sock.groupMetadata(jid);
      return String((meta && (meta.subject || meta.name)) || '').trim();
    } catch {
      return '';
    }
  }

  async handleSetGc(sock, m, rest, isOwner) {
    const chat = m.key.remoteJid;
    const parts = String(rest || '').trim().split(/\s+/).filter(Boolean);
    const action = String(parts[0] || 'status').toLowerCase();

    if (['status', 'cek', 'info'].includes(action) && parts.length < 2) {
      const current = String((this.cfg && this.cfg.tiktokNotifyJid) || '').trim();
      if (!current) {
        await this.reply(
          m,
          '📭 Belum ada grup notifikasi tambahan.\n' +
            'Atur dengan /detector setgc (di grup tujuan) atau /detector setgc <link grup>.'
        );
        return;
      }
      const name = isGroupJid(current) ? await this.groupLabel(sock, current) : '';
      await this.reply(
        m,
        [
          '📬 *Grup notifikasi TikTok*',
          `JID: ${current}`,
          `Nama: ${name || '-'}`,
          isGroupJid(current) ? '' : '⚠️ Bukan JID grup, notifikasi tidak akan dikirim.',
          '',
          'Ubah: /detector setgc (di grup ini)',
          'Matikan: /detector setgc off',
        ]
          .filter((line) => line !== '')
          .join('\n')
      );
      return;
    }

    if (['off', 'hapus', 'reset', 'clear', 'nonaktif', 'matikan'].includes(action)) {
      settings.set('TIKTOK_NOTIFY_JID', '');
      await this.reply(
        m,
        '📭 Grup notifikasi tambahan *dimatikan*.\n' +
          'Detector tetap mengirim ke grup yang punya akun terverifikasi.'
      );
      return;
    }

    let target;
    try {
      target = await this.resolveGroupTarget(sock, parts.join(' '), chat);
    } catch (err) {
      await this.reply(m, `❌ ${err.message}`);
      return;
    }

    if (!isOwner && target.jid !== chat) {
      await this.reply(m, 'Mengatur grup notifikasi lain hanya bisa dilakukan owner.');
      return;
    }

    const res = settings.set('TIKTOK_NOTIFY_JID', target.jid);
    if (!res || !res.ok) {
      await this.reply(m, `❌ Gagal menyimpan grup notifikasi: ${(res && res.error) || 'unknown'}`);
      return;
    }

    const name = target.name || (await this.groupLabel(sock, target.jid));
    await this.reply(
      m,
      [
        '✅ *Grup notifikasi TikTok diset*',
        `JID: ${target.jid}`,
        `Nama: ${name || '-'}`,
        '',
        'Setiap akun terverifikasi di grup ini akan mendapat notifikasi + tag di sini.',
        'Berlaku langsung tanpa restart.',
      ].join('\n')
    );
  }

  async handle(sock, m, cmd, rest, isOwner) {
    const name = String(cmd || '').toLowerCase();
    if (!COMMANDS.has(name)) return false;

    const chat = m.key.remoteJid;
    const isAdmin = isOwner || (await this.isGroupAdmin(sock, m, chat));
    if (!isAdmin) {
      await this.reply(m, 'Perintah ini khusus owner atau admin grup.');
      return true;
    }

    switch (name) {
      case 'addakun':
      case 'tambahakun':
        await this.handleAdd(m, rest);
        return true;
      case 'delakun':
      case 'hapusakun':
        await this.handleRemove(m, rest);
        return true;
      case 'listakun':
      case 'daftarakun':
        await this.handleList(m);
        return true;
      case 'detector':
      case 'detektor':
        await this.handleDetector(sock, m, rest, isOwner);
        return true;
      default:
        return false;
    }
  }

  statusLine() {
    if (!this.accounts) return 'detector tidak tersedia';
    return this.accounts.isEnabled() ? 'aktif ✅' : 'nonaktif ❌';
  }

  async handleAdd(m, rest) {
    if (!rest) {
      await this.reply(m, 'Gunakan: /addakun @username\nContoh: /addakun @rinorstr');
      return;
    }

    const res = await this.accounts.add(rest);
    if (res.ok) {
      if (this.monitor) this.monitor.refresh();
      await this.reply(
        m,
        `✅ *${res.account}* ditambahkan ke daftar pantauan.\n` +
          `Total: ${res.total} akun • status ${this.statusLine()}.\n` +
          'Video berikutnya dicek otomatis dalam ±3 menit.'
      );
      return;
    }

    if (res.reason === 'exists') {
      await this.reply(m, `ℹ️ *${res.account}* sudah ada di daftar pantauan.`);
      return;
    }
    await this.reply(
      m,
      '❌ Username tidak valid. Gunakan huruf, angka, titik, atau underscore (2-24 karakter).\n' +
        'Contoh: /addakun @rinorstr'
    );
  }

  async handleRemove(m, rest) {
    if (!rest) {
      await this.reply(m, 'Gunakan: /delakun @username\nContoh: /delakun @rinorstr');
      return;
    }

    const res = await this.accounts.remove(rest);
    if (res.ok) {
      if (this.monitor) this.monitor.refresh();
      await this.reply(
        m,
        `🗑️ *${res.account}* dihapus dari daftar pantauan.\n` +
          `Sisa: ${res.total} akun • status ${this.statusLine()}.`
      );
      return;
    }

    if (res.reason === 'missing') {
      await this.reply(m, `ℹ️ *${res.account}* tidak ada di daftar pantauan.`);
      return;
    }
    await this.reply(m, '❌ Username tidak valid.\nContoh: /delakun @rinorstr');
  }

  async handleList(m) {
    const list = this.accounts ? this.accounts.list() : [];
    const lines = [
      '📋 *Akun TikTok yang dipantau*',
      `Status: ${this.statusLine()} • ${list.length} akun`,
      '',
    ];

    if (!list.length) {
      lines.push('Belum ada akun. Tambahkan dengan /addakun @username');
    } else {
      list.forEach((acc, i) => lines.push(`${i + 1}. ${acc}`));
      lines.push('');
      lines.push('Tambah: /addakun @username • Hapus: /delakun @username');
    }

    await this.reply(m, lines.join('\n'));
  }

  async handleDetector(sock, m, rest, isOwner) {
    const parts = String(rest || '').trim().split(/\s+/).filter(Boolean);
    const action = String(parts[0] || 'status').toLowerCase();

    // Pengaturan grup notifikasi bisa dilakukan admin grup lewat WhatsApp.
    if (['setgc', 'setgrup', 'grupnotif', 'notif', 'notify'].includes(action)) {
      await this.handleSetGc(sock, m, parts.slice(1).join(' '), isOwner);
      return;
    }

    if (['status', 'cek', 'info'].includes(action)) {
      const list = this.accounts ? this.accounts.list() : [];
      const health = this.monitor && typeof this.monitor.health === 'function'
        ? this.monitor.health()
        : null;
      const when = (ts) =>
        ts ? new Date(ts).toLocaleString('id-ID', { timeZone: this.cfg.timezone || 'Asia/Jakarta' }) : '-';
      const healthLines = health
        ? [
            `Cek terakhir: ${when(health.lastCheckAt)}`,
            `Sukses terakhir: ${when(health.lastOkAt)}`,
            health.cooldownUntil > Date.now()
              ? `Cooldown WAF sampai: ${when(health.cooldownUntil)}`
              : 'Cooldown WAF: tidak ada',
            health.lastError ? `Error terakhir: ${health.lastError}` : 'Error terakhir: -',
          ]
        : [];
      const notifyJid = String((this.cfg && this.cfg.tiktokNotifyJid) || '').trim();
      const notifyName = notifyJid ? await this.groupLabel(sock, notifyJid) : '';
      await this.reply(
        m,
        [
          '🎬 *Status Detector TikTok*',
          `Status: ${this.statusLine()} • ${list.length} akun`,
          `Interval: tiap ${Math.max(1, Number(this.cfg.tiktokCheckMin) || 3)} menit`,
          `CN: ${this.cfg.tiktokCnKeyword || 'ECN'} • Hashtag: ${this.cfg.tiktokHashtag || '#margaecn'}`,
          `Grup notif: ${notifyJid ? `${notifyName || notifyJid}${isGroupJid(notifyJid) ? '' : ' (bukan grup)'}` : 'mengikuti grup verif'}`,
          `Sumber daftar: ${this.accounts && this.accounts.source() === 'file' ? this.accounts.file : '.env'}`,
          ...healthLines,
          '',
          list.length ? 'Akun: ' + list.join(', ') : 'Akun: (kosong)',
        ].join('\n')
      );
      return;
    }

    if (!isOwner) {
      await this.reply(m, 'Mengaktifkan/mematikan detector hanya bisa dilakukan owner.');
      return;
    }

    const on = ['on', 'enable', 'aktif', 'aktifkan', 'nyala', '1', 'ya'].includes(action);
    const off = [
      'off',
      'disable',
      'mati',
      'matikan',
      'nonaktif',
      'nonaktifkan',
      '0',
      'tidak',
    ].includes(action);
    if (!on && !off) {
      await this.reply(
        m,
        'Gunakan:\n/detector on\n/detector off\n/detector status\n\n' + this.usage()
      );
      return;
    }

    await this.accounts.setEnabled(on);
    if (this.monitor) this.monitor.refresh();

    const list = this.accounts.list();
    if (on && !list.length) {
      await this.reply(
        m,
        '🎬 Detector *diaktifkan*, tapi daftar akun masih kosong.\n' +
          'Tambahkan dengan /addakun @username supaya pengecekan mulai berjalan.'
      );
      return;
    }

    await this.reply(
      m,
      on
        ? `🎬 Detector *diaktifkan*. ${list.length} akun dipantau.\nVideo baru akan dicek tiap ±${Math.max(
            1,
            Number(this.cfg.tiktokCheckMin) || 3
          )} menit.`
        : '🎬 Detector *dimatikan*. Tidak ada pengecekan sampai /detector on.'
    );
  }
}

module.exports = { TikTokAdminFeature, COMMANDS };
