/**
 * alya-alias.js — alias command grup yang dipakai ALYA MD.
 *
 * Semua alias hanya meneruskan ke command asli, jadi perilaku, izin admin,
 * dan format balasannya tetap sama.
 */

import { makeAliasPlugin } from '../_alias/delegate.js';

const targets = {
  hadir: 'absen',
  rekapabsen: 'topabsen',
  gclink: 'linkgc',
  groupid: 'idgrup',
  add: 'addmember',
  setgcname: 'setnamegc',
  setgcdesc: 'setdescgc',
  setgcpp: 'setppgc',
  delwarn: 'unwarn',
  setleft: 'setgoodbye',
  upgcsw: 'swgc',
  sider: 'inactive',
  // Penjaga grup: nama ALYA -> nama fitur yang sudah ada.
  antitagall: 'antitag',
  antitagstatus: 'antitagsw',
  antigroupstatus: 'antiswgc',
  antiwalink: 'antilink',
  // Tag massal gaya ALYA MD.
  everyone: 'tagall',
  totag: 'tagall',
  ht: 'hidetag',
  // Tutup/buka grup gaya ALYA MD.
  setclose: 'closegc',
  setopen: 'opengc',
};

const handler = makeAliasPlugin({
  targets,
  tags: 'group',
  description: 'Alias perintah grup gaya ALYA MD (hadir, gclink, anti tag all, dll)',
});

handler.command = [
  'hadir',
  'rekapabsen',
  'gclink',
  'groupid',
  'add',
  'setgcname',
  'setgcdesc',
  'setgcpp',
  'delwarn',
  'setleft',
  'upgcsw',
  'sider',
  'antitagall',
  'antitagstatus',
  'antigroupstatus',
  'antiwalink',
  'everyone',
  'totag',
  'ht',
  'setclose',
  'setopen',
];
handler.help = handler.command.slice();
handler.group = true;

export default handler;
