import { adapt } from '../../lib/engine/plugins.js'
import { kartu } from '../../lib/core/data.js'
import { createHash } from 'crypto'

let handler = async (m) => {
  const sn = createHash('md5').update(m.sender).digest('hex')
  m.reply(kartu('Serial Number', [['SN', sn]], 'Simpan baik-baik, jangan dikasih ke orang lain!'))
}

handler.help = ['xp-ceksn']
handler.tags = ['user']
handler.command = ['xp-ceksn']
handler.register = true

export default adapt(handler, { category: 'user' })
