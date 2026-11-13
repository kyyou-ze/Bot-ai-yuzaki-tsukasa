'use strict';

const memory = require('../memory');
const wa = require('../wa');
const { isGroupJid, jidUser } = require('../util');

const COMMANDS = ['ingat', 'ingatan', 'catat', 'note', 'notes'];

function isCommand(cmd) {
  return COMMANDS.includes(String(cmd || '').trim().toLowerCase());
}

/** Keterangan sisa masa berlaku, hanya muncul saat sudah mendekati batas. */
function expiryNote(entry) {
  if (!entry || entry.daysLeft === null || entry.daysLeft === undefined) return '';
  const days = Math.ceil(entry.daysLeft);
  if (days <= 0) return ' _(kedaluwarsa)_';
  if (days > 30) return '';
  return ` _(sisa ${days} hari)_`;
}

/**
 * Catatan fakta pribadi yang ditulis sendiri oleh user lewat `.ingat`.
 * Catatan ini privat: hanya dipakai sebagai konteks internal, tidak pernah
 * ditampilkan ke orang lain.
 */
class PersonalMemoryFeature {
  static isCommand(cmd) {
    return isCommand(cmd);
  }

  static isOwnerCommand(cmd) {
    return ['ingatanku', 'memoriku'].includes(String(cmd || '').trim().toLowerCase());
  }

  async handleCommand(sock, m, cmd, rest, isOwner) {
    const chat = m.key.remoteJid;
    const sender = m.key.participant || chat;
    const text = String(rest || '').trim();

    // Fakta pribadi hanya boleh dikelola dari chat pribadi supaya tidak
    // terbaca orang lain di grup.
    if (isGroupJid(chat)) {
      await wa.sendText(
        chat,
        'Catatan pribadi hanya bisa diatur lewat chat pribadi ya. Chat aku langsung, lalu kirim `.ingat <fakta>`.',
        m
      );
      return true;
    }

    const sub = text.toLowerCase();
    if (!text || ['list', 'daftar', 'lihat', 'status'].includes(sub)) {
      await this.sendList(chat, m, sender);
      return true;
    }

    const del = text.match(/^(?:hapus|hapusin|lupakan|del|delete)\s*(.*)$/i);
    if (del) {
      const target = String(del[1] || '').trim().toLowerCase();
      if (['all', 'semua', 'semuanya'].includes(target)) {
        const ok = memory.clearFacts(sender);
        await wa.sendText(
          chat,
          ok ? 'Semua catatan pribadimu sudah aku hapus.' : 'Belum ada catatan yang bisa dihapus.',
          m
        );
        return true;
      }
      const removed = memory.removeFact(sender, target);
      await wa.sendText(
        chat,
        removed ? `Catatan *${removed}* sudah aku hapus.` : 'Nomor catatannya tidak ada. Cek `.ingat list` dulu ya.',
        m
      );
      return true;
    }

    const result = memory.addFact(sender, text);
    if (result.ok) {
      const left = Math.max(0, 10 - (result.count || 0));
      await wa.sendText(
        chat,
        `Aku ingat ya: *${result.fact}*\n_Sisa ${left} catatan lagi._`,
        m
      );
    } else if (result.reason === 'duplikat') {
      await wa.sendText(chat, 'Catatan itu sudah ada di daftarku.', m);
    } else if (result.reason === 'penuh') {
      await wa.sendText(
        chat,
        'Catatanmu sudah penuh (maksimal 10). Hapus satu dulu dengan `.ingat hapus <nomor>`.',
        m
      );
    } else {
      await wa.sendText(chat, 'Tulis fakta yang mau diingat, contoh: `.ingat aku suka kopi`.', m);
    }
    return true;
  }

  async sendList(chat, m, sender) {
    const facts = memory.getFactEntries(sender);
    if (!facts.length) {
      await wa.sendText(
        chat,
        'Belum ada catatan pribadi.\nContoh: `.ingat aku suka kopi` atau `.ingat aku kerja shift malam`.',
        m
      );
      return;
    }
    const ttl = memory.memoryTtl();
    const lines = ['*Catatan pribadimu*'];
    facts.forEach((fact, i) => lines.push(`${i + 1}. ${fact.text}${expiryNote(fact)}`));
    if (ttl.factDays > 0) {
      lines.push('', `_Catatan berlaku ${ttl.factDays} hari sejak terakhir ditulis._`);
    }
    lines.push('', 'Hapus: `.ingat hapus <nomor>` atau `.ingat hapus all`.');
    await wa.sendText(chat, lines.join('\n'), m);
  }

  /** Tampilkan ringkasan yang Tsukasa simpan sebagai konteks grup (owner). */
  async handleOwnerCommand(sock, m, cmd, rest, isOwner) {
    if (!isOwner) return false;
    const chat = m.key.remoteJid;
    if (isGroupJid(chat)) return false;

    const text = String(rest || '').trim().toLowerCase();
    if (['reset', 'hapus', 'clear', 'lupakan'].includes(text)) {
      memory.setOwnerGist('');
      await wa.sendText(chat, 'Ringkasan ingatan untuk grup sudah aku hapus.', m);
      return true;
    }

    const gist = memory.getOwnerGist();
    const facts = memory.getFactEntries(chat);
    const lines = ['*Yang aku ingat*'];
    if (gist.text) {
      const when = gist.updatedAt
        ? new Date(gist.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        : '';
      lines.push('', '*Ringkasan suasana/obrolan*');
      lines.push(gist.text);
      if (when) lines.push(`_Diperbarui: ${when}_`);
      if (gist.ttlDays > 0) lines.push(`_Ringkasan berlaku ${gist.ttlDays} hari._`);
    } else if (gist.stale) {
      lines.push(
        '',
        '*Ringkasan suasana/obrolan*',
        '_Ringkasan lama sudah kedaluwarsa dan tidak aku pakai lagi._',
        'Ngobrol dulu di chat pribadi supaya aku buat yang baru.'
      );
    } else {
      lines.push('', 'Belum ada ringkasan obrolan. Ngobrol dulu di chat pribadi ya.');
    }
    if (facts.length) {
      lines.push('', '*Catatan pribadi*');
      facts.forEach((fact, i) => lines.push(`${i + 1}. ${fact.text}${expiryNote(fact)}`));
    }
    lines.push(
      '',
      'Hapus ringkasan: `.ingatanku reset`',
      'Hapus catatan: `.ingat hapus <nomor>`'
    );
    await wa.sendText(chat, lines.join('\n'), m);
    return true;
  }

  /** Prompt konteks untuk chat pribadi satu user. */
  promptForUser(jid) {
    const facts = memory.getFacts(jid);
    if (!facts.length) return '';
    return [
      '## CATATAN PRIBADI PENGGUNA (internal)',
      ...facts.map((fact) => `- ${fact}`),
      'Gunakan catatan ini sebagai latar belakang agar jawabanmu nyambung. Jangan membacakan daftar ini atau menyebut bahwa kamu menyimpannya, kecuali user sendiri membahasnya.',
    ].join('\n');
  }

  /** Prompt konteks untuk peserta grup yang punya catatan pribadi. */
  promptForBatch(items) {
    const bySender = new Map();
    for (const item of items || []) {
      const jid = item && item.sender;
      if (!jid) continue;
      const facts = memory.getFacts(jid);
      if (!facts.length) continue;
      const name = String(item.senderName || jidUser(jid) || 'Peserta').trim();
      const prev = bySender.get(name) || [];
      for (const fact of facts) {
        if (!prev.includes(fact)) prev.push(fact);
      }
      bySender.set(name, prev);
    }
    if (!bySender.size) return '';
    const lines = ['## CATATAN PRIBADI PESERTA (internal)'];
    for (const [name, facts] of bySender) {
      lines.push(`- ${name}: ${facts.join('; ')}`);
    }
    lines.push(
      'Ini hanya latar belakang. JANGAN membacakan, mengutip, atau mengungkit isi catatan ini di grup. Pakai hanya bila orangnya sendiri membahas topik itu, dan tetap jangan menyebut bahwa kamu punya catatan.'
    );
    return lines.join('\n');
  }
}

module.exports = PersonalMemoryFeature;
module.exports.isCommand = isCommand;
