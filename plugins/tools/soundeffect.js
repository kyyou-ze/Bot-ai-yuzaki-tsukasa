/**
 * soundeffect.js — efek suara ala ALYA MD.
 *
 * Reply audio / voice note / video dengan salah satu command di bawah.
 * Audio diproses memakai ffmpeg (filter yang sama dengan ALYA), lalu dikirim
 * kembali sebagai voice note opus.
 *
 * Contoh:
 *   .bass        (reply audio)
 *   .nightcore   (reply audio)
 *   .8d          (reply audio)
 */

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wrapClassic } from '../../lib/engine/plugins.js';

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_DURATION_SEC = 180;

// Nama command -> filter ffmpeg. Nilainya sudah siap dipakai untuk `-af`.
const EFFECTS = {
  bass: 'equalizer=f=94:width_type=o:width=2:g=30',
  blown: 'acrusher=.1:1:64:0:log',
  chipmunk: 'atempo=0.5,asetrate=65100',
  deep: 'atempo=4/4,asetrate=44500*2/3',
  earrape: 'volume=12',
  fast: 'atempo=1.63,asetrate=44100',
  fat: 'atempo=1.6,asetrate=22100',
  nightcore: 'atempo=1.06,asetrate=44100*1.25',
  reverse: 'areverse',
  robot: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
  slow: 'atempo=0.7,asetrate=44100',
  smooth: 'lowpass=f=3000,highpass=f=200',
  vibrato: 'vibrato=f=5.0',
  echo: 'aecho=0.8:0.9:1000:0.3',
  tremolo: 'tremolo=f=5.0:d=0.7',
  cave: 'aecho=0.8:0.88:60:0.4',
  haunted: 'aecho=0.9:0.9:1000:0.6,asetrate=22050',
  underwater: 'aecho=0.6:0.3:1000:0.5,lowpass=f=300',
  cursed: 'aecho=0.8:0.9:1000:0.4,asetrate=16000,atempo=0.8',
  dizzy: 'apulsator=hz=0.3',
  demonic: 'asetrate=44100*0.7,atempo=1.1',
  alien: "afftfilt=real='hypot(re,im)':imag='0':win_size=512:overlap=0.75",
  ghost: 'aecho=0.9:0.7:500:0.6',
  glitch: 'acrusher=8:0.5:3:0.6:0.1',
  vintage: 'highpass=f=200,lowpass=f=3000',
  telephone: 'bandpass=f=1000:width_type=h:width=200',
  '8d': 'apulsator=hz=0.125',
  drunk: 'asetrate=44100*0.9,atempo=0.9',
  helium: 'asetrate=88000,atempo=1.5',
  muted: 'volume=0.1',
  underworld: 'asetrate=22050,atempo=0.75,bass=g=10',
  squirrel: 'atempo=1.8,asetrate=88200',
  boostbass: 'equalizer=f=40:width_type=h:width=50:g=10',
  boosttreble: 'equalizer=f=10000:width_type=h:width=2000:g=8',
  immersive:
    'stereotools=mlev=1.7,volume=1.15,acompressor=level_in=1:threshold=0.4:ratio=2.5:attack=15:release=200,aecho=0.8:0.88:950|1250:0.3|0.25',
  whisper: 'lowpass=f=1000,volume=0.5',
  darthvader: 'asetrate=44100*0.7,atempo=1.2,volume=1.2',
  chipdemon:
    "asetrate=65100,volume=1.5,afftfilt=real='hypot(re,im)*cos(0)':imag='hypot(re,im)*sin(0)'",
  megaphone: 'highpass=f=1000,lowpass=f=3000,volume=1.5',
  reverb: 'aecho=0.6:0.5:60|120:0.4|0.3',
};

const COMMANDS = Object.keys(EFFECTS);

function ffmpegBin() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 6000) stderr = stderr.slice(-6000);
    });
    proc.on('error', (err) => reject(new Error(`ffmpeg tidak tersedia: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split('\n').slice(-2).join(' ') || `ffmpeg keluar dengan code ${code}`));
    });
  });
}

const handler = async (m, { conn, command, usedPrefix }) => {
  const effect = EFFECTS[command];
  if (!effect) return;

  const q = m.quoted || m;
  const mime = (q.msg || q).mimetype || q.mimetype || '';
  const isMedia = /audio|video|ogg|mp3|m4a|opus|wav|webm|mp4/i.test(mime);

  if (!isMedia || typeof q.download !== 'function') {
    return m.reply(
      `💭 Reply audio / voice note / video dengan *${usedPrefix || '.'}${command}*.\n` +
        `Tersedia: ${COMMANDS.map((c) => `${usedPrefix || '.'}${c}`).join(', ')}`
    );
  }

  let dir = null;
  try {
    await m.react('👾');
    const media = await q.download().catch(() => null);
    if (!Buffer.isBuffer(media) || !media.length) {
      await m.react('❌');
      return m.reply('❌ Gagal mengunduh media.');
    }
    if (media.length > MAX_INPUT_BYTES) {
      await m.react('❌');
      return m.reply('❌ Audio terlalu besar (maksimal 25 MB).');
    }

    dir = await mkdtemp(join(tmpdir(), 'tsukasa-sfx-'));
    const input = join(dir, 'input.bin');
    const output = join(dir, 'output.ogg');
    await writeFile(input, media);

    await run(ffmpegBin(), [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      '-t',
      String(MAX_DURATION_SEC),
      '-vn',
      '-af',
      effect,
      '-ar',
      '48000',
      '-ac',
      '1',
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
      '-f',
      'ogg',
      output,
    ]);

    const result = await readFile(output);
    await conn.sendMessage(
      m.chat,
      {
        audio: result,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      },
      { quoted: m }
    );
    await m.react('✅');
  } catch (err) {
    console.error(`[SOUNDEFFECT:${command}]`, err?.message || err);
    await m.react('❌');
    await m.reply(`❌ Gagal memproses audio: ${err?.message || err}`);
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

handler.help = COMMANDS.map((c) => `${c} (reply audio)`);
handler.tags = ['audio'];
// Daftar literal supaya command efek suara terbaca katalog menu (scanner
// statis tidak membaca `handler.command = COMMANDS`).
handler.command = [
  'bass', 'blown', 'chipmunk', 'deep', 'earrape', 'fast', 'fat', 'nightcore',
  'reverse', 'robot', 'slow', 'smooth', 'vibrato', 'echo', 'tremolo', 'cave',
  'haunted', 'underwater', 'cursed', 'dizzy', 'demonic', 'alien', 'ghost',
  'glitch', 'vintage', 'telephone', '8d', 'drunk', 'helium', 'muted',
  'underworld', 'squirrel', 'boostbass', 'boosttreble', 'immersive', 'whisper',
  'darthvader', 'chipdemon', 'megaphone', 'reverb',
];
handler.limit = true;
handler.description = 'Efek suara audio/video (bass, nightcore, robot, dll)';

export default wrapClassic(handler);
