// QUOTED / Q (ALYA MD) — kirim ulang isi pesan yang di-reply.
// Bisa teks, gambar, video, audio, sticker, atau dokumen.

const MEDIA = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  stickerMessage: 'sticker',
  documentMessage: 'document',
}

let handler = async (m, { sock, jid, reply }) => {
  const q = m.quoted
  if (!q) return reply('💭 Reply pesan yang mau diambil isinya.')

  const key = {
    remoteJid: q.chat || jid,
    fromMe: Boolean(q.fromMe),
    id: q.id,
    participant: q.senderRaw || q.sender,
  }

  if (q.raw) {
    try {
      const sent = await sock.sendMessage(
        jid,
        { forward: { key, message: q.raw }, force: true },
        { quoted: m }
      )
      if (sent) return true
    } catch {
      // lanjut ke fallback di bawah
    }
  }

  const kind = MEDIA[q.mtype]
  if (kind && typeof q.download === 'function') {
    try {
      const buffer = await q.download()
      if (buffer) {
        if (kind === 'image') return sock.sendMessage(jid, { image: buffer, caption: q.text || '' }, { quoted: m })
        if (kind === 'video') return sock.sendMessage(jid, { video: buffer, caption: q.text || '' }, { quoted: m })
        if (kind === 'audio') return sock.sendMessage(jid, { audio: buffer, mimetype: q.msg?.mimetype || 'audio/ogg; codecs=opus', ptt: Boolean(q.msg?.ptt) }, { quoted: m })
        if (kind === 'sticker') return sock.sendMessage(jid, { sticker: buffer }, { quoted: m })
        return sock.sendMessage(jid, {
          document: buffer,
          mimetype: q.msg?.mimetype,
          fileName: q.msg?.fileName || 'file',
          caption: q.text || '',
        }, { quoted: m })
      }
    } catch {
      // fallback ke teks
    }
  }

  if (q.text) return reply(q.text)
  return reply('❌ Isi pesan itu tidak bisa dibaca.')
}

handler.command = ['quoted', 'q']
handler.help = ['quoted']
handler.tags = ['group']
handler.description = 'Ambil / kirim ulang isi pesan yang di-reply'

export default handler
