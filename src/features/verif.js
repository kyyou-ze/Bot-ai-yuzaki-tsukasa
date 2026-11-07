'use strict';

const wa = require('../wa');
const { isGroupJid } = require('../util');
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
  'siapaup',
  'whoup',
  'cekup',
  'history',
]);

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
    const result = await this.store.add({
      gcId: chat,
      accName,
      cnKeyword: this.cfg.tiktokCnKeyword || 'ECN',
      hashtag: this.cfg.tiktokHashtag || '#margaecn',
      gcName,
    });

    if (!result.added) {
      await this.reply(m, `ACC ${result.entry.accName} ini sudah terverif di GC ini.`);
      return;
    }
    await this.reply(m, `✅ Berhasil verif ACC ${result.entry.accName} di GC ini`);
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
