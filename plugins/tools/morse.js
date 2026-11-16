// MORSE (ALYA MD) — morse <teks> dan dmorse <kode morse>
// Contoh: .morse hai  ->  .... .- ..
//         .dmorse .... .- ..  ->  hai

const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....',
  i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.',
  q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....',
  6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.',
  '-': '-....-', '(': '-.--.', ')': '-.--.-', ' ': '/',
}

const DE_MORSE = Object.fromEntries(
  Object.entries(MORSE).map(([plain, code]) => [code, plain])
)

const toMorse = (text) =>
  String(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word].map((ch) => MORSE[ch] || ch).join(' '))
    .join(' / ')

const fromMorse = (text) =>
  String(text)
    .split(/\s*\/\s*/g)
    .filter((word) => word.trim())
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map((code) => DE_MORSE[code] || code)
        .join('')
    )
    .join(' ')

let handler = async (m, { command, text, prefix, reply }) => {
  const body = String(m.quoted?.text || text || '').trim()
  if (!body) {
    return reply(
      command === 'morse'
        ? `Contoh: ${prefix || '.'}morse hai`
        : `Contoh: ${prefix || '.'}dmorse .... .- ..`
    )
  }

  if (command === 'morse') return reply(toMorse(body))
  return reply(fromMorse(body))
}

handler.command = ['morse', 'dmorse']
handler.help = ['morse <teks>', 'dmorse <kode>']
handler.tags = ['tools']
handler.description = 'Konversi teks ke morse dan sebaliknya'

export default handler
