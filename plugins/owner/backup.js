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

import fs from 'fs'
import path from 'path'
import { createZip } from '../../lib/core/file.js'

const EXCLUDE_ROOT = [
    'node_modules',
    '.file-backups',
    'session',
    'package-lock.json',
    'yarn.lock',
    '.npm',
    '.cache',
    'sampah',
    'backup-db'
]

const EXCLUDE_ANYWHERE = ['node_modules']
// folder runtime di dalam database/ (sesi login, backup, cache, sementara) tidak ikut backup
const EXCLUDE_NESTED = ['database/session', 'database/backup-db', 'database/backup-session', 'database/file-backups', 'database/update-backups', 'database/tmp', 'database/cache']

function collectFiles(dir, base = '') {
    const files = []

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!base && EXCLUDE_ROOT.includes(entry.name)) continue
        if (EXCLUDE_ANYWHERE.includes(entry.name)) continue

        const name = base ? `${base}/${entry.name}` : entry.name
        if (EXCLUDE_NESTED.includes(name)) continue
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath, name))
        } else if (entry.isFile()) {
            files.push({ name, data: fs.readFileSync(fullPath), date: fs.statSync(fullPath).mtime })
        }
    }

    return files
}

let handler = async (m, { sock, jid, sender, reply }) => {
    if (m.fromMe) return // chat dari nomor bot sendiri: abaikan

    const inGroup = m.isGroup
    const target = inGroup ? sender : jid
    const options = inGroup ? {} : { quoted: m }

    try {
        await sock.sendMessage(target, { text: 'Wait....' }, options)
    } catch {
        return reply('[ ! ] Backup gak bisa dikirim ke chat pribadi kamu. Chat bot di private dulu, lalu ulangi perintahnya.')
    }

    const zipName = `${global.namebot.replace(/\s+/g, '_')}.zip`

    try {
        const files = collectFiles('.')
        if (!files.length) return sock.sendMessage(target, { text: 'Tidak ada file yang bisa dibackup.' }, options)

        await sock.sendMessage(target, {
            document: createZip(files),
            fileName: zipName,
            mimetype: 'application/zip'
        }, options)

        if (inGroup) {
            await sock.sendMessage(jid, {
                text: `Backup sudah dikirim ke chat pribadi kamu.`,
                mentions: [sender]
            }, { quoted: m })
        }
    } catch (e) {
        console.error(e)
        await sock.sendMessage(target, { text: 'Backup gagal.' }, options).catch(() => null)
        if (inGroup) await reply('[ ! ] Backup gagal, cek log server.').catch(() => null)
    }
}

handler.command = ['backup']
handler.tags = ['owner']
handler.owner = true

export default handler
