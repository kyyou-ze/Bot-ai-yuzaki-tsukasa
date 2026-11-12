/**

* Kaguya Multi Device — WhatsApp & Tele Bot
*
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
*
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
*
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */

import { collectSystemInfo, formatBytes, percentOf, usageBar } from '../../lib/core/system.js'

const ON_OFF = (value) => (value ? 'Aktif' : 'Nonaktif')

function latencyLabel(ms) {
    if (ms < 300) return 'Sangat Cepat'
    if (ms < 800) return 'Cepat'
    if (ms < 1500) return 'Normal'
    return 'Lambat'
}

function memoryLines(memory) {
    const hostPercent = percentOf(memory.used, memory.total)
    const lines = [
        `│ ✦ RAM Host : ${formatBytes(memory.used)} / ${formatBytes(memory.total)}`,
        `│   ${usageBar(hostPercent)}`
    ]
    if (memory.panelLimit) {
        const used = memory.panelUsed ?? memory.rss
        lines.push(
            `│ ✦ Limit Panel : ${formatBytes(used)} / ${formatBytes(memory.panelLimit)}`,
            `│   ${usageBar(percentOf(used, memory.panelLimit))}`
        )
    }
    lines.push(
        `│ ✦ RAM Proses : ${formatBytes(memory.rss)}`,
        `│ ✦ Heap : ${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}`,
        `│ ✦ External : ${formatBytes(memory.external)}`
    )
    return lines.join('\n')
}

function diskLines(disk) {
    if (!disk) return '│ ✦ Data penyimpanan tidak tersedia'
    return (
        `│ ✦ Terpakai : ${formatBytes(disk.used)} / ${formatBytes(disk.total)}\n` +
        `│   ${usageBar(percentOf(disk.used, disk.total))}\n` +
        `│ ✦ Sisa : ${formatBytes(disk.free)}`
    )
}

function buildInfo(speed, info) {
    const { os: system, cpu, memory, disk, node, uptime, bot } = info
    const prefixes = bot.prefixes.map(p => (p === '' ? '(kosong)' : p)).join(' ') || '-'
    return (
        `╭━━━〔 *SYSTEM INFO* 〕━━━⬣\n` +
        `┃ ✦ Respon : ${speed} ms (${latencyLabel(speed)})\n` +
        `╰━━━━━━━━━━━━━━━━⬣\n\n` +
        `╭─▣「 *SERVER* 」▣─╮\n` +
        `│ ✦ OS : ${system.distro}\n` +
        `│ ✦ Kernel : ${system.kernel}\n` +
        `│ ✦ Platform : ${system.platform} (${system.arch})\n` +
        `│ ✦ Hostname : ${system.hostname}\n` +
        `│ ✦ Uptime Server : ${uptime.system}\n` +
        `╰─➤\n\n` +
        `╭─▣「 *CPU* 」▣─╮\n` +
        `│ ✦ Model : ${cpu.model}\n` +
        `│ ✦ Core : ${cpu.cores}${cpu.speed ? ` @ ${cpu.speed} MHz` : ''}\n` +
        `│ ✦ Pemakaian : ${usageBar(cpu.usage)}\n` +
        `│ ✦ Load Avg : ${cpu.load.map(l => l.toFixed(2)).join(' / ')} (1m/5m/15m)\n` +
        `│ ✦ Event Loop : ${node.eventLoop.toFixed(1)}%\n` +
        `╰─➤\n\n` +
        `╭─▣「 *MEMORI* 」▣─╮\n${memoryLines(memory)}\n╰─➤\n\n` +
        `╭─▣「 *PENYIMPANAN* 」▣─╮\n${diskLines(disk)}\n` +
        `│ ✦ Database : ${formatBytes(bot.databaseSize)}\n` +
        `│ ✦ Session : ${formatBytes(bot.sessionSize)}\n` +
        `╰─➤\n\n` +
        `╭─▣「 *RUNTIME* 」▣─╮\n` +
        `│ ✦ Node.js : ${node.version}\n` +
        `│ ✦ V8 : ${node.v8}\n` +
        `│ ✦ Baileys : ${bot.baileys || '-'}\n` +
        `│ ✦ Luna Lib : ${bot.luna || '-'}\n` +
        `│ ✦ PID : ${node.pid}\n` +
        `│ ✦ Uptime Bot : ${uptime.bot}\n` +
        `╰─➤\n\n` +
        `╭─▣「 *BOT* 」▣─╮\n` +
        `│ ✦ Versi : ${bot.version}\n` +
        `│ ✦ Mode : ${bot.selfmode ? 'Self' : 'Public'}\n` +
        `│ ✦ Prefix : ${prefixes}\n` +
        `│ ✦ Command : ${bot.commands}\n` +
        `╰─➤`
    )
}

let handler = async (m, { sock, jid }) => {
    const start = Date.now()
    const pending = await sock.sendMessage(jid, { text: global.mess.wait }, { quoted: m })
    const speed = Date.now() - start
    const info = await collectSystemInfo()
    const text = buildInfo(speed, info)
    await sock.sendMessage(jid, { text }, { quoted: m })
    await sock.sendMessage(jid, { delete: pending.key }).catch(() => null)
}

handler.command = ['ping']
handler.tags = ['main']

export default handler
