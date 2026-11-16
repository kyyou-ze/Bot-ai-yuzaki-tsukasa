/**
 * alya-alias.js — alias command owner yang dipakai ALYA MD.
 * `block`/`unblock` sama dengan `ban`/`unban`; `backupsc` sama dengan `backup`.
 */

import { makeAliasPlugin } from '../_alias/delegate.js';

const targets = {
  block: 'ban',
  unblock: 'unban',
  backupsc: 'backup',
  groups: 'listgc',
};

const handler = makeAliasPlugin({
  targets,
  tags: 'owner',
  description: 'Alias owner gaya ALYA MD (block, unblock, backupsc, groups)',
});

handler.command = ['block', 'unblock', 'backupsc', 'groups'];
handler.help = handler.command.slice();
handler.owner = true;

export default handler;
