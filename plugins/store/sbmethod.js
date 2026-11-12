/**
 * Kaguya Multi Device — Store
 * .sbmethod — sbmethod
 * Satu file = satu command. Helper bersama: lib/store/sociabuzz.js
 */

import { METHODS, GROUP_LABEL, rp } from '../../lib/store/sociabuzz.js'

// ===== .sbmethod =====
let handler = async (m, { sock, text, command, prefix, reply }) => {
    const p = prefix || '.'
    const body = (text || '').trim()
    const groups = {}
    for (const [k, v] of Object.entries(METHODS)) (groups[v.group] ||= []).push(`${k} (min ${rp(v.min)})${v.need_phone ? ' 📞' : ''}`)
    const out = Object.entries(groups).map(([g, list]) => `*${GROUP_LABEL[g] || g}*\n${list.map(x => `• ${x}`).join('\n')}`).join('\n\n')
    return reply(`💳 *METODE SOCIABUZZ*\n\n${out}\n\n📞 = wajib nomor HP\n\nPakai: ${p}sbpay <metode> <nominal> [nama | pesan]\nContoh: ${p}sbpay qris 10k`)
}

handler.command = ['sbmethod']
handler.tags = ['store']
handler.help = ['sbmethod']

export default handler
