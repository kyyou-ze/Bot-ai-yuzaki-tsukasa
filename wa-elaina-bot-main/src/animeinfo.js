'use strict';

const FOOTER = String(process.env.INFO_FOOTER || '').trim() || '> yuzaki tsukasa by ren';

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function clean(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeGenres(value) {
  let list = [];
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string') list = value.split(',');
  else if (value && Array.isArray(value.nodes)) list = value.nodes;

  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const name = clean(typeof raw === 'string' ? raw : raw && raw.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function formatReleaseDate(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    const year = Number(value.year) || 0;
    const month = Number(value.month) || 0;
    const day = Number(value.day) || 0;
    if (year && month >= 1 && month <= 12 && day >= 1) {
      return `${day} ${MONTHS[month - 1]} ${year}`;
    }
    if (year && month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${year}`;
    if (year) return String(year);
    return '';
  }

  const text = clean(value);
  if (!text) return '';

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) {
      return `${Number(iso[3])} ${MONTHS[month - 1]} ${iso[1]}`;
    }
  }

  if (/^\d{4}$/.test(text)) return text;

  const idDate = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (idDate) {
    const index = MONTHS.findIndex((m) => m.toLowerCase() === idDate[2].toLowerCase());
    if (index >= 0) return `${Number(idDate[1])} ${MONTHS[index]} ${idDate[3]}`;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  return text;
}

function headlineFor(options, title, studio) {
  const custom = clean(options.headline);
  if (custom) return custom;

  const kind = clean(options.kind) || 'Info';
  if (!studio) return `${kind} \`${title}\`.`;

  const verb = clean(options.verb) || 'diproduksi oleh';
  const studioLabel = clean(options.studioLabel);
  const by = studioLabel ? `${verb} ${studioLabel}` : verb;
  return `${kind} \`${title}\` ${by} *${studio}.*`;
}

function buildInfo(options = {}) {
  const title = clean(options.title) || 'Tanpa judul';
  const studio = clean(options.studio);
  const genres = normalizeGenres(options.genres);
  const releaseDate = formatReleaseDate(options.releaseDate);
  const summaryLabel = clean(options.summaryLabel) || 'Sinopsis';
  const summary = clean(options.summary || options.synopsis) || 'Belum ada informasi.';
  const facts = (Array.isArray(options.facts) ? options.facts : [])
    .map((f) => clean(f))
    .filter(Boolean);

  const lines = [headlineFor(options, title, studio), ''];

  const meta = [];
  if (genres.length) meta.push(`Genre : *${genres.join(', ').toUpperCase()}*`);
  if (releaseDate) meta.push(`Tanggal rilis : *${releaseDate}*`);
  if (meta.length) {
    lines.push(...meta);
    lines.push('');
  }

  lines.push(summaryLabel);
  lines.push(summary);

  if (facts.length) {
    lines.push('');
    lines.push('Fakta menarik');
    for (const fact of facts) lines.push(`- ${fact}`);
  }

  const extra = clean(options.extra);
  if (extra) {
    lines.push('');
    lines.push(extra);
  }

  lines.push('');
  lines.push(FOOTER);

  return lines.join('\n');
}

function buildAnimeInfo(options = {}) {
  return buildInfo({
    kind: 'Adaptasi anime',
    verb: 'dikerjakan oleh',
    studioLabel: 'studio',
    summaryLabel: 'Sinopsis',
    ...options,
  });
}

module.exports = {
  FOOTER,
  buildInfo,
  buildAnimeInfo,
  formatReleaseDate,
  normalizeGenres,
};
