import { wrapClassic } from '../../lib/engine/plugins.js'
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

const API = 'https://www.sankavollerei.web.id/anime/alqanime';

const DATA_DIR = path.join(process.cwd(), 'database');
const DATA_FILE = path.join(DATA_DIR, 'alqanime.json');

const CHECK_INTERVAL = 5 * 60 * 1000;
const MAX_UPDATE = 10;

let activeSock = null;
let watcherStarted = false;
let checking = false;

// ==========================================
// DATABASE
// ==========================================

function ensureDatabase() {
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	if (!fs.existsSync(DATA_FILE)) {
		fs.writeFileSync(
			DATA_FILE,
			JSON.stringify({ groups: {}, seen: {} }, null, 2)
		);
	}
}

function loadData() {
	ensureDatabase();
	try {
		const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
		if (!data.groups) data.groups = {};
		if (!data.seen) data.seen = {};
		return data;
	} catch (e) {
		return { groups: {}, seen: {} };
	}
}

function saveData(data) {
	ensureDatabase();
	fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ==========================================
// API ALQANIME
// ==========================================

async function getLatest() {
	const response = await axios.get(`${API}/home`, {
		timeout: 30000,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	if (
		!response.data ||
		response.data.status !== 'success' ||
		!response.data.data ||
		!Array.isArray(response.data.data.latest)
	) {
		throw new Error('Format API AlqAnime tidak valid');
	}

	return response.data.data.latest;
}

async function getDetail(slug) {
	const response = await axios.get(`${API}/detail/${encodeURIComponent(slug)}`, {
		timeout: 30000,
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
		}
	});

	if (
		!response.data ||
		response.data.status !== 'success' ||
		!response.data.data
	) {
		throw new Error('Detail anime tidak ditemukan');
	}

	return response.data.data;
}

// ==========================================
// FORMAT DOWNLOAD & PESAN
// ==========================================

function formatDownloads(detail) {
	if (!detail.downloads || !Array.isArray(detail.downloads)) {
		return '';
	}

	let text = '';
	for (const episode of detail.downloads) {
		text += `\n*${episode.title || 'Download'}*\n`;
		if (!Array.isArray(episode.links)) continue;

		for (const quality of episode.links) {
			text += `\n*Resolusi:* ${quality.resolution || 'Unknown'}\n`;
			if (!Array.isArray(quality.urls)) continue;

			for (const server of quality.urls) {
				if (!server.url) continue;
				text += `• ${server.server || 'Server'}: ${server.url}\n`;
			}
		}
	}

	return text;
}

function createMessage(item, detail) {
	const botName = global.namaBot || 'Elysia AI';
	const title = detail.title || item.title || 'Anime Terbaru';
	const poster = detail.poster || item.poster || null;
	const originalUrl = item.url || `https://alqanime.net/${item.slug}/`;
	const info = detail.info || {};

	const caption = [
		'*ALQANIME AUTO UPDATE*',
		'----------------------------------------',
		`*Judul:* ${title}`,
		`*Status:* ${info.status || '-'}`,
		`*Tipe:* ${info.tipe || '-'}`,
		`*Musim:* ${info.musim || '-'}`,
		`*Rilis:* ${info.dirilis || '-'}`,
		`*Studio:* ${info.studio || '-'}`,
		'----------------------------------------'
	];

	if (detail.synopsis) {
		const cleanSynopsis = detail.synopsis.length > 350 
			? detail.synopsis.slice(0, 350) + '...' 
			: detail.synopsis;
		caption.push('', '*Sinopsis:*', cleanSynopsis);
	}

	caption.push('', '*Sumber:* ' + originalUrl);

	const downloads = formatDownloads(detail);
	if (downloads) {
		caption.push(downloads);
	}

	caption.push('', `© ${botName}`);

	return {
		text: caption.join('\n'),
		poster
	};
}

// ==========================================
// KIRIM UPDATE
// ==========================================

async function sendAnime(sock, jid, item) {
	const botName = global.namaBot || 'Elysia AI';

	try {
		const detail = await getDetail(item.slug);
		const result = createMessage(item, detail);

		if (result.poster) {
			await sock.sendMessage(
				jid,
				{
					image: { url: result.poster },
					caption: result.text
				}
			);
		} else {
			await sock.sendMessage(jid, { text: result.text });
		}

		console.log(`[ALQANIME] Terkirim: ${item.title} -> ${jid}`);
		return true;

	} catch (error) {
		console.error(`[ALQANIME] Gagal mengirim detail ${item.title}:`, error?.message || error);

		try {
			const url = item.url || `https://alqanime.net/${item.slug}/`;
			const fallbackText = [
				'*ALQANIME AUTO UPDATE*',
				'----------------------------------------',
				`*Judul:* ${item.title || '-'}`,
				`*Episode:* ${item.episode || '-'}`,
				'----------------------------------------',
				'*Sumber:* ' + url,
				'',
				`© ${botName}`
			].join('\n');

			if (item.poster) {
				await sock.sendMessage(
					jid,
					{
						image: { url: item.poster },
						caption: fallbackText
					}
				);
			} else {
				await sock.sendMessage(jid, { text: fallbackText });
			}

			return true;
		} catch (sendError) {
			console.error('[ALQANIME] Fallback gagal:', sendError?.message || sendError);
			return false;
		}
	}
}

// ==========================================
// CHECKER LOOP
// ==========================================

async function checkUpdates() {
	if (!activeSock) return;
	if (checking) return;

	const data = loadData();
	const enabledGroups = Object.keys(data.groups).filter((jid) => data.groups[jid] === true);

	if (!enabledGroups.length) return;

	checking = true;

	try {
		const latest = await getLatest();
		if (!latest || !latest.length) return;

		const newItems = [];
		for (const item of latest) {
			if (!item?.slug) continue;
			const episode = item.episode || item.title || '';
			const updateId = `${item.slug}|${episode}`;

			if (data.seen[updateId]) continue;

			newItems.push({ item, updateId });
			if (newItems.length >= MAX_UPDATE) break;
		}

		if (!newItems.length) return;

		for (const entry of newItems) {
			const item = entry.item;
			let isSuccess = true;

			for (const jid of enabledGroups) {
				try {
					const ok = await sendAnime(activeSock, jid, item);
					if (!ok) isSuccess = false;
					await new Promise((resolve) => setTimeout(resolve, 2000));
				} catch (err) {
					isSuccess = false;
					console.error(`[ALQANIME] Error kirim ke ${jid}:`, err?.message || err);
				}
			}

			if (isSuccess) {
				data.seen[entry.updateId] = Date.now();
				saveData(data);
			}
		}

		const expire = Date.now() - (30 * 24 * 60 * 60 * 1000);
		for (const key of Object.keys(data.seen)) {
			if (data.seen[key] < expire) {
				delete data.seen[key];
			}
		}
		saveData(data);

	} catch (error) {
		console.error('[ALQANIME] Error check update:', error?.message || error);
	} finally {
		checking = false;
	}
}

function startWatcher(sock) {
	activeSock = sock;
	if (watcherStarted) return;

	watcherStarted = true;
	console.log('[ALQANIME] Auto updater watcher aktif (Interval: 5m).');

	setTimeout(() => {
		checkUpdates();
	}, 10000);

	setInterval(() => {
		checkUpdates();
	}, CHECK_INTERVAL);
}

// ==========================================
// PLUGIN HANDLER
// ==========================================

const handler = async (m, { sock, args, reply, usedPrefix, command }) => {
	const botName = global.namaBot || 'Elysia AI';
	startWatcher(sock);

	if (!m.isGroup) {
		return reply('Perintah ini hanya dapat diaktifkan di dalam grup.');
	}

	const action = (args?.[0] || 'status').toLowerCase();
	const jid = m.chat;
	const data = loadData();

	if (action === 'on') {
		data.groups[jid] = true;
		saveData(data);

		await sock.sendMessage(m.chat, { react: { text: '\u2728', key: m.key } }).catch(() => null);

		const text = [
			'*ALQANIME AUTO UPDATE AKTIF*',
			'----------------------------------------',
			'Grup ini sekarang akan menerima pembaruan anime otomatis dari AlqAnime.',
			'',
			'*Interval Cek:* Setiap 5 menit',
			'*Maksimal:* 10 anime / check',
			'*Sumber:* AlqAnime',
			'',
			'Matikan kapan saja dengan `' + usedPrefix + command + ' off`',
			'',
			`© ${botName}`
		].join('\n');

		return reply(text);
	}

	if (action === 'off') {
		data.groups[jid] = false;
		saveData(data);

		await sock.sendMessage(m.chat, { react: { text: '\u2728', key: m.key } }).catch(() => null);

		const text = [
			'*ALQANIME AUTO UPDATE NONAKTIF*',
			'----------------------------------------',
			'Grup ini telah berhenti menerima pembaruan otomatis.',
			'',
			`© ${botName}`
		].join('\n');

		return reply(text);
	}

	if (action === 'status') {
		const isEnabled = data.groups[jid] === true;

		const text = [
			'*ALQANIME AUTO UPDATE STATUS*',
			'----------------------------------------',
			`*Status Grup:* ${isEnabled ? 'AKTIF' : 'NONAKTIF'}`,
			'*Interval Pengecekan:* 5 Menit',
			'*Maksimal / Update:* 10 Anime',
			`*Status Watcher:* ${watcherStarted ? 'Berjalan' : 'Standby'}`,
			'',
			`© ${botName}`
		].join('\n');

		return reply(text);
	}

	if (action === 'test') {
		await sock.sendMessage(m.chat, { react: { text: '\u23F3', key: m.key } }).catch(() => null);

		try {
			const latest = await getLatest();
			if (!latest || !latest.length) {
				await sock.sendMessage(m.chat, { react: { text: '\u274C', key: m.key } }).catch(() => null);
				return reply('Tidak ada data terbaru yang diterima dari API AlqAnime.');
			}

			const item = latest[0];
			await sendAnime(sock, jid, item);
			await sock.sendMessage(m.chat, { react: { text: '\u2728', key: m.key } }).catch(() => null);

		} catch (error) {
			console.error('[ALQANIME TEST ERROR]:', error);
			await sock.sendMessage(m.chat, { react: { text: '\u274C', key: m.key } }).catch(() => null);
			return reply('Uji coba AlqAnime gagal: ' + (error?.message || error));
		}

		return;
	}

	return reply(
		'*ALQANIME AUTO UPDATE*\n\n' +
		'Pilihan perintah:\n' +
		'- `' + usedPrefix + command + ' on` (Aktifkan di grup ini)\n' +
		'- `' + usedPrefix + command + ' off` (Matikan di grup ini)\n' +
		'- `' + usedPrefix + command + ' status` (Lihat status berjalan)\n' +
		'- `' + usedPrefix + command + ' test` (Kirim sample anime terbaru)'
	);
};

handler.help = ['alqanime <on|off|status|test>'];
handler.tags = ['anime'];
handler.command = ['alqanime'];
handler.group = true;
handler.admin = true;
handler.limit = true;

const plugin = wrapClassic(handler);
plugin.limit = true; // wrapClassic tidak menyalin limit

export default plugin;
