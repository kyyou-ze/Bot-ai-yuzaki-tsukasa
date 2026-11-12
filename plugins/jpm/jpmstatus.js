import { jpmGroups, jpmCfg, jpmJobs } from '../../lib/group/sosial.js'

const onoff = v => (v ? '🟢 Aktif' : '🔴 Nonaktif')

let handler = async (m, { sock, reply }) => {
    const jobs = jpmJobs()
    const cfg = jpmCfg()

    let total = 0
    let banned = 0
    try {
        total = Object.keys(await sock.groupFetchAllParticipating()).length
        banned = Object.values(global.db.groups || {}).filter(g => g.banned).length
    } catch {}

    return reply(
        `*▢ STATUS JPM*\n` +
        `• Auto JPM : ${onoff(jobs.autoJpm)}\n` +
        `• Auto JPM Tag : ${onoff(jobs.autoJpmTag)}\n` +
        `• Auto SWGC : ${onoff(jobs.autoSwgc)}\n` +
        `• Push Kontak : ${onoff(jobs.pushRunning)}\n` +
        `• Delay JPM : ${cfg.delayJpm}ms\n` +
        `• Delay JPM Tag : ${cfg.delayJpmTag}ms\n` +
        `• Delay Auto SWGC : ${cfg.delayAutoSwgc}ms\n` +
        `• Delay Push Kontak : ${cfg.delayPushKontak}ms\n` +
        `• Total grup : ${total} grup\n` +
        `• Grup banchat (dilewati) : ${banned} grup`
    )
}

handler.command = ['jpmstatus']
handler.tags = ['jpm']
handler.owner = true

export default handler
