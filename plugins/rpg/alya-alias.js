/**
 * alya-alias.js — alias command RPG yang dipakai ALYA MD.
 * `tf` / `transfer` / `pay` diteruskan ke subcommand bank.
 */

import { makeAliasPlugin } from '../_alias/delegate.js';

const targets = {
  casino: 'slot',
  battle: 'duel',
  tf: { command: 'bank', prepend: 'transfer' },
  transfer: { command: 'bank', prepend: 'transfer' },
  pay: { command: 'bank', prepend: 'transfer' },
};

const handler = makeAliasPlugin({
  targets,
  tags: 'rpg',
  description: 'Alias RPG gaya ALYA MD (casino, battle, tf/transfer/pay)',
});

handler.command = ['casino', 'battle', 'tf', 'transfer', 'pay'];
handler.help = handler.command.slice();

export default handler;
