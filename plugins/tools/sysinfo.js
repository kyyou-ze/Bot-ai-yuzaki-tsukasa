// SYSINFO (ALYA MD) — disk, ram, run, statistic, server
// Ringkasan kondisi server tanpa API eksternal.

import os from 'node:os'
import fs from 'node:fs'

const fmtBytes = (value) => {
  const n = Number(value) || 0
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`
}

const fmtTime = (ms) => {
  const total = Math.max(0, Math.floor(Number(ms) / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [d && `${d} hari`, h && `${h} jam`, m && `${m} menit`, s && `${s} detik`]
    .filter(Boolean)
    .join(' ') || '0 detik'
}

async function diskStats() {
  try {
    const st = await fs.promises.statfs(process.cwd())
    const total = Number(st.blocks) * Number(st.bsize)
    const free = Number(st.bfree) * Number(st.bsize)
    return { total, free, used: total - free }
  } catch {
    return { total: 0, free: 0, used: 0 }
  }
}

function dbCounts() {
  const users = global.db?.users || global.db?.rpgData?.users || {}
  const groups = global.db?.groups || {}
  return { users: Object.keys(users).length, groups: Object.keys(groups).length }
}

let handler = async (m, { command, reply }) => {
  const mem = process.memoryUsage()

  if (command === 'disk') {
    const disk = await diskStats()
    return reply(`🗂️ *Disk Used*: ${fmtBytes(disk.used)} / ${fmtBytes(disk.total)}`)
  }

  if (command === 'ram') {
    return reply(`💾 *RAM Usage*: ${fmtBytes(mem.rss)} / ${fmtBytes(os.totalmem())}`)
  }

  if (command === 'run') {
    return reply(`👾 *Runtime*: ${fmtTime(process.uptime() * 1000)}`)
  }

  if (command === 'statistic') {
    const db = dbCounts()
    return reply(
      [
        '📊 *STATISTIC*',
        '',
        `👤 User tercatat : ${db.users}`,
        `👥 Grup tercatat : ${db.groups}`,
        `💾 RAM dipakai   : ${fmtBytes(mem.rss)}`,
        `🧠 Heap          : ${fmtBytes(mem.heapUsed)} / ${fmtBytes(mem.heapTotal)}`,
        `⏱️ Runtime       : ${fmtTime(process.uptime() * 1000)}`,
      ].join('\n')
    )
  }

  // server
  const disk = await diskStats()
  const cpu = os.cpus()?.[0] || {}
  return reply(
    [
      '🗄️ *SERVER*',
      '',
      `• OS      : ${os.platform()} ${os.release()}`,
      `• Arch    : ${os.arch()}`,
      `• Uptime  : ${fmtTime(os.uptime() * 1000)}`,
      '',
      '💾 *SYSTEM*',
      `• CPU     : ${cpu.model || '-'}`,
      `• Core    : ${os.cpus().length}`,
      `• RAM     : ${fmtBytes(os.totalmem() - os.freemem())} / ${fmtBytes(os.totalmem())}`,
      `• Disk    : ${fmtBytes(disk.used)} / ${fmtBytes(disk.total)}`,
      '',
      '🔃 *PROCESS*',
      `• Node.js : ${process.version}`,
      `• Heap    : ${fmtBytes(mem.heapUsed)} / ${fmtBytes(mem.heapTotal)}`,
      `• RSS     : ${fmtBytes(mem.rss)}`,
      `• Runtime : ${fmtTime(process.uptime() * 1000)}`,
    ].join('\n')
  )
}

handler.command = ['disk', 'ram', 'run', 'statistic', 'server']
handler.help = handler.command.slice()
handler.tags = ['tools']
handler.description = 'Info disk, RAM, runtime, dan kondisi server'

export default handler
