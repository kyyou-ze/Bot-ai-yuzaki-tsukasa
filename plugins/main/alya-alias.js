/**
 * alya-alias.js — alias command umum yang dipakai ALYA MD.
 */

import { makeAliasPlugin } from '../_alias/delegate.js';

const targets = {
  arti: 'artinama',
  ca: 'menfess',
  ba: 'balas',
  totalfeature: 'totalfitur',
  jumlahfitur: 'totalfitur',
  rent: 'sewa',
  // Nama fitur ALYA MD -> command yang sudah ada di repo ini.
  dino: 'dinorun',
  calculator: 'calc',
  kalkulator: 'calc',
  chess: 'catur',
  joke: 'jokes',
  jok: 'jokes',
  joks: 'jokes',
  lucu: 'jokes',
  lyric: 'lirik',
  kerja: 'work',
  ppgc: 'getppgc',
  getppgroup: 'getppgc',
  linkgroup: 'linkgc',
  grouplink: 'linkgc',
  cekbayar: 'cekprem',
  claimprem: 'cekprem',
};

const handler = makeAliasPlugin({
  targets,
  tags: 'main',
  description: 'Alias umum gaya ALYA MD (arti, ca, ba, rent, total fitur)',
});

handler.command = [
  'arti',
  'ca',
  'ba',
  'totalfeature',
  'jumlahfitur',
  'rent',
  'dino',
  'calculator',
  'kalkulator',
  'chess',
  'joke',
  'jok',
  'joks',
  'lucu',
  'lyric',
  'kerja',
  'ppgc',
  'getppgroup',
  'linkgroup',
  'grouplink',
  'cekbayar',
  'claimprem',
];
handler.help = handler.command.slice();

export default handler;
