'use strict';

const wa = require('../wa');
const { isGroupJid, jidUser } = require('../util');
const {
  normalizeAccount,
  normalizeCn,
  normalizeHashtag,
  formatClock,
  formatDate,
} = require('../verifstore');

const COMMANDS = new Set([
  'verif',
  'veriv',
  'listverif',
  'listveriv',
  'unverif',
  'unveriv',
  'me',
  'profile',
  'siapaup',
  'whoup',
  'cekup',
  'history',
]);

function bareJid(value) {
  return String(value || '')
    .replace(/:\d+@/, '@')
    .trim();
}

/** Ambil JID WhatsApp peng-verif dari metadata pesan. */
function senderLink(m) {
  const sender = bareJid(m.key.participant || m.key.remoteJid || '');
  const pnCandidate =
    m.key.participantPn ||
    m.key.participantAlt ||
    m.key.senderPn ||
    m.key.remoteJidAlt ||
    (sender && !/@lid$/i.test(sender) ? sender : '');
  return {
    userJid: sender,
    userPn: bareJid(pnCandidate || ''),
    userName: String(m.pushName || '').trim().slice(0, 80),
  };
}

class VerifFeature {
  constructor(cfg, store, monitor) {
    this.cfg = cfg || {};
    this.store = store;
    this.monitor = monitor || null;
    this.timezone = String(this.cfg.timezone || 'Asia/Jakarta');
    this.tzOffset = Number.isFinite(Number(this.cfg.tzOffset)) ? Number(this.cfg.tzOffset) : 7;
  }

  static isCommand(name) {
    return COMMANDS.has(String(name || '').toLowerCase());
  }

  reply(m, text) {
    return wa.sendText(m.key.remoteJid, text, m).catch(() => {});
  }

  usage() {
    return [
      '*Verif ACC TikTok*',
      '/verif <nama_acc>',
      '/listverif',
      '/unverif <nama_acc>',
      '/me',
      '',
      '*Cek siapa yang UP*',
      '/siapaup',
      '/cekup @username',
      '/history',
      '',
      'Bisa juga: Tsukasa verif <nama_acc>, .verif <nama_acc>',
    ].join('\n');
  }

  groupName(sock, chat) {
    return sock
      .groupMetadata(chat)
      .then((meta) => (meta && (meta.subject || meta.name)) || chat)
      .catch(() => chat);
  }

  async handle(sock, m, cmd, rest, isOwner) {
    const name = String(cmd || '').toLowerCase();
    if (!COMMANDS.has(name)) return false;

    if (!rest && name === 'verif') {
      await this.reply(m, this.usage());
      return true;
    }

    switch (name) {
      case 'verif':
      case 'veriv':
        await this.handleVerif(sock, m, rest);
        return true;
      case 'listverif':
      case 'listveriv':
        await this.handleList(m);
        return true;
      case 'unverif':
      case 'unveriv':
        await this.handleUnverif(m, rest);
        return true;
      case 'me':
      case 'profile':
        await this.handleMe(m, rest);
        return true;
      case 'siapaup':
      case 'whoup':
        await this.handleSiapaUp(m, rest);
        return true;
      case 'cekup':
        await this.handleCekUp(m, rest);
        return true;
      case 'history':
        await this.handleHistory(m, rest);
        return true;
      default:
        return false;
    }
  }

  async handleVerif(sock, m, rest) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Verif ACC hanya bisa dilakukan di dalam grup.');
      return;
    }

    const accName = normalizeAccount(rest);
    if (!accName) {
      await this.reply(m, 'Gunakan: /verif <nama_acc>\nContoh: /verif ECN');
      return;
    }

    const gcName = await this.groupName(sock, chat);
    const link = senderLink(m);
    const result = await this.store.add({
      gcId: chat,
      accName,
      cnKeyword: this.cfg.tiktokCnKeyword || 'ECN',
      hashtag: this.cfg.tiktokHashtag || '#margaecn',
      gcName,
      ...link,
    });

    const mention = link.userPn || link.userJid;
    const mentions = mention && !/@lid$/i.test(mention) ? [mention] : [];
    const tag = mentions.length ? `@${jidUser(mention)}` : link.userName || 'kamu';

    if (!result.added) {
      if (result.updated) {
        await wa.sendText(
          chat,
          `🔗 Akun *${result.entry.accName}* sudah terverif dan sekarang tertaut ke WhatsApp ${tag}.\n` +
            'Detector akan men-tag kamu saat akun ini UP.',
          m,
          mentions
        );
        return;
      }
      await this.reply(
        m,
        `ACC ${result.entry.accName} ini sudah terverif di GC ini.\n` +
          'Kalau kamu belum tertaut, kirim ulang /verif dengan nama yang sama.'
      );
      return;
    }

    await wa.sendText(
      chat,
      `✅ Berhasil verif ACC ${result.entry.accName} di GC ini.\n` +
        `🔗 Akun TikTok tertaut ke WhatsApp ${tag}.\n` +
        'Saat akun ini UP, detector akan memberi tahu grup ini dan men-tag kamu.',
      m,
      mentions
    );
  }

  /**
   * `.me` — tampilkan akun TikTok yang tertaut ke nomor WhatsApp user,
   * lengkap dengan status UP hari ini. Bisa dipakai di grup maupun chat pribadi.
   */
  async handleMe(m, rest) {
    const link = senderLink(m);
    const candidates = [link.userJid, link.userPn, m.key.participantAlt, m.key.remoteJidAlt].filter(
      Boolean
    );

    let entries = this.store.entriesForUser(candidates);
    if (!entries.length) {
      await this.reply(
        m,
        [
          '👤 *Profil TikTok kamu*',
          '',
          'Belum ada akun TikTok yang tertaut ke nomor WhatsApp ini.',
          'Verifikasi dulu di grup dengan:',
          '/verif <nama_acc TikTok>',
          '',
          'Contoh: /verif @kagenouofficial',
        ].join('\n')
      );
      return;
    }

    const filter = normalizeAccount(rest).toLowerCase();
    if (filter) entries = entries.filter((e) => e.accName.toLowerCase() === filter);
    if (!entries.length) {
      await this.reply(m, `❌ Akun *${normalizeAccount(rest)}* belum tertaut ke nomor kamu.`);
      return;
    }

    const lines = ['👤 *Profil TikTok kamu*', ''];
    for (const entry of entries) {
      const acc = normalizeAccount(entry.accName);
      const videos = this.store
        .todayVideos(entry.cnKeyword)
        .filter((v) => normalizeAccount(v.username).toLowerCase() === acc.toLowerCase());
      const latest = videos[0];
      lines.push(`🎵 *@${acc}*`);
      if (entry.userName) lines.push(`   Nama WA: ${entry.userName}`);
      lines.push(`   Grup: ${entry.gcName || entry.gcId}`);
      lines.push(
        `   CN: ${entry.cnKeyword || '-'} • Hashtag: ${entry.hashtag || this.cfg.tiktokHashtag || '#margaecn'}`
      );
      if (latest) {
        const tag =
          latest.hashtagStatus === 'Ada'
            ? `✅ ${normalizeHashtag(latest.hashtag) || entry.hashtag}`
            : `❎ ${normalizeHashtag(latest.hashtag) || entry.hashtag} (belum ada)`;
        lines.push(
          `   UP hari ini: ${formatClock(latest.timestamp, this.timezone)} WIB • ${tag}`
        );
        lines.push(`   Caption: ${String(latest.caption || '-').slice(0, 140)}`);
        lines.push(`   Link: ${latest.link || '-'}`);
      } else {
        lines.push('   UP hari ini: belum ada');
      }
      lines.push('');
    }
    lines.push(`Total akun tertaut: ${entries.length}`);
    lines.push('Hapus tautan: /unverif <nama_acc>');
    await this.reply(m, lines.join('\n'));
  }

  async handleList(m) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Daftar verif hanya bisa dilihat di dalam grup.');
      return;
    }

    const list = this.store.list(chat);
    if (!list.length) {
      await this.reply(m, 'Belum ada ACC yang terverif di GC ini.');
      return;
    }

    const lines = ['📋 *Daftar ACC terverif di GC ini*', ''];
    list.forEach((e, i) => {
      lines.push(`${i + 1}. *${e.accName}* — ${e.hashtag || '-'} (CN ${e.cnKeyword || '-'})`);
    });
    lines.push('');
    lines.push('Hapus: /unverif <nama_acc>');
    await this.reply(m, lines.join('\n'));
  }

  async handleUnverif(m, rest) {
    const chat = m.key.remoteJid;
    if (!isGroupJid(chat)) {
      await this.reply(m, 'Unverif hanya bisa dilakukan di dalam grup.');
      return;
    }

    const accName = normalizeAccount(rest);
    if (!accName) {
      await this.reply(m, 'Gunakan: /unverif <nama_acc>');
      return;
    }

    const removed = await this.store.remove(chat, accName);
    await this.reply(
      m,
      removed
        ? `🗑️ ACC ${accName} dihapus dari daftar verif GC ini.`
        : `ACC ${accName} tidak ditemukan di daftar verif GC ini.`
    );
  }

  async handleSiapaUp(m, rest) {
    const cn = normalizeCn(rest) || normalizeCn(this.cfg.tiktokCnKeyword || 'ECN');
    const videos = this.store.latestPerAccount(1, cn).slice(0, 5);

    if (!videos.length) {
      await this.reply(m, `Belum ada yang UP hari ini untuk ACC ${cn}.`);
      return;
    }

    const lines = [`📋 *Siapa yang UP hari ini (${cn}):*`];
    videos.forEach((v, i) => {
      const hashtag = v.hashtagStatus === 'Ada' ? 'Ada ✅' : 'Tidak Ada ❌';
      lines.push(
        `${i + 1}. ${v.username} (${v.nickname || '-'}) - ${formatClock(
          v.timestamp,
          this.timezone
        )} WIB - # ${hashtag}`
      );
    });
    await this.reply(m, lines.join('\n'));
  }

  async handleCekUp(m, rest) {
    const username = normalizeAccount(rest);
    if (!username) {
      await this.reply(m, 'Gunakan: /cekup @username\nContoh: /cekup @rinorstr');
      return;
    }

    const cn = normalizeCn(this.cfg.tiktokCnKeyword || 'ECN');
    const target = username.toLowerCase();
    const videos = this.store
      .todayVideos(cn)
      .filter((v) => normalizeAccount(v.username).toLowerCase() === target);

    if (!videos.length) {
      await this.reply(m, `❌ @${username} belum UP hari ini.`);
      return;
    }

    const v = videos[0];
    const lines = [
      `✅ @${username} sudah UP hari ini jam ${formatClock(v.timestamp, this.timezone)} WIB`,
      '',
      `📝 Caption: ${v.caption || '-'}`,
      `📌 ${normalizeHashtag(v.hashtag) || this.cfg.tiktokHashtag} - ${v.hashtagStatus}`,
      `🔗 ${v.link}`,
    ];
    await this.reply(m, lines.join('\n'));
  }

  async handleHistory(m, rest) {
    const cn = normalizeCn(rest) || normalizeCn(this.cfg.tiktokCnKeyword || 'ECN');
    const summary = this.store.historySummary(7, cn);

    if (!summary.length) {
      await this.reply(m, `Belum ada riwayat UP 7 hari terakhir untuk ACC ${cn}.`);
      return;
    }

    const lines = [`📅 *Rekap UP 7 hari terakhir (${cn})*`, ''];
    summary.slice(0, 15).forEach((row, i) => {
      const last = row.lastAt
        ? `${formatDate(row.lastAt, this.timezone)} ${formatClock(row.lastAt, this.timezone)}`
        : '-';
      lines.push(
        `${i + 1}. ${row.username} (${row.nickname || '-'}) — ${row.activeDays} hari, ` +
          `${row.total} video (terakhir: ${last})`
      );
    });
    await this.reply(m, lines.join('\n'));
  }
}

module.exports = { VerifFeature, COMMANDS };
