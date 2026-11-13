import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

// Simpan file ini → bot reload otomatis.

// ═══════════════ IDENTITAS ═══════════════
global.owners = Array.isArray(global.owners) ? global.owners : []
global.ownername = 'Tsukasa'
global.nomorbot = ''
global.namebot = "Tsukasa"
global.nameSaluran = "Tsukasa"
global.idSaluran = ""
global.creator = "Tsukasa"
global.versi = "2.0.0"
global.paircode = "TSUKASA"

// ═══════════════ BOT ═══════════════
global.platforms = { whatsapp: true, telegram: true }   // telegram dilewati kalau token kosong

// Mode fitur: 'all' = semua kategori aktif (default). Isi nama folder plugin
// (lihat folder di dalam plugins/, mis. 'store', 'rpg') untuk membatasi bot
// hanya melayani 1 kategori itu buat semua orang (owner selalu lolos).
// Bisa juga diganti lewat command .botmode tanpa edit file ini.
global.botMode = 'all'

global.grupbot = false           // hanya melayani grup di daftar .grupbot
global.buttonMode = true        // true = mode pakai button (menu, store, dll) | false = mode tanpa button, semua jadi teks biasa
global.public = true           // WhatsApp: true = semua orang | false = owner saja
global.publicTelegram = true    // Telegram: true = semua orang | false = owner saja
global.autoLidToJid = true      // auto convert LID → JID

global.hanyaTerdaftar = true    // hanya user terdaftar yang disimpan ke database
global.wajibDaftar = true       // semua fitur plugin wajib .daftar dulu
global.bebasDaftar = ['daftar', 'xp-register', 'unreg', 'xp-unregister', 'unregister']   // boleh dipakai tanpa daftar

global.replyCardOn = true       // m.reply tampil sebagai reply card
global.dbEngine = 'sqlite'      // 'sqlite' (otomatis JSON kalau gagal) | 'json'
global.pconly = false           // hanya private chat
global.gconly = false           // hanya grup
global.anticall = "off"         // off | tolak | block
global.autoblockpm = false        // auto block siapa pun (selain owner) yang chat pribadi ke bot
global.autoblockwhitelist = []   // nomor yang boleh PM bot tanpa diblokir, contoh: ['6281234567890']
global.autoblockmsg = ''         // pesan sebelum diblokir (kosong = tidak kirim pesan)

global.autoreactsw = false       // auto react story/status WhatsApp
global.autoreactemoji = '🥰'    // emoji untuk auto react story
global.autoreadsw = false        // auto lihat story/status WhatsApp
global.autoreadgc = false        // auto baca pesan grup (centang biru)
global.autoreadpc = false        // auto baca pesan private chat (centang biru)
global.autotyping = false         // auto "sedang mengetik..." saat ada pesan masuk
global.autorecordvn = true      // auto "sedang merekam suara..." saat ada pesan masuk (kalau autotyping juga true, dipilih acak)

global.multiplier = 38          // RPG: makin besar, level makin sulit
global.prefix = ["", ".", "!", ","]

// global.updateUrl = ""        // link zip untuk .updatebot
// global.updateToken = ""      // token GitHub (repo private)

global.mess = {
    wait: "Tunggu sebentar ya, lagi aku urus dulu...",
    owner: "Khusus owner. Yang ini nggak bisa aku bukain~",
    admin: "Khusus admin. Nanti aku kena omel kalau nekat!",
    premium: "Yang ini khusus premium. Menarik sih, tapi belum bisa~",
    group: "Fitur ini cuma jalan di dalam grup ya!",
    private: "Fitur ini cuma bisa dipakai di private chat ya!"
}

// ═══════════════ FITUR TAMBAHAN (.setfitur) ═══════════════
// Nyala/mati tiap fitur .setfitur bisa diatur dari sini juga. Command .setfitur di chat menang
// atas nilai di sini (sampai di-reset). Opsi lain (pajak, biaya, jam, dll) juga bisa diisi di sini.

global.fitur = {
    marketplace: { on: false },        // .market .mjual .mbeli
    eventShop: { on: false },          // .eventshop .eventbuy
    reward: { streak: { on: false } }, // bonus streak .harian/.mingguan
    clan: { on: false },               // .clan
    lbMingguan: { on: false },         // leaderboard mingguan
    antidelete: { on: false },         // pesan dihapus -> owner/chat asal
    antiedit: { on: false },           // pesan diedit -> owner/chat asal
    antiviewonce: { on: false },       // sekali lihat -> owner/chat asal
    logCommand: { on: false },         // catat command yang dipakai
    laporanHarian: { on: false },      // ringkasan harian ke owner
    blacklist: { on: false }           // isi lewat .setfitur blacklist tambah ...
}

global.extra = {
    jamBahagia: { on: false },  // hadiah dikali pengali jam tertentu
    misi: { on: false },        // misi harian (.misi)
    referral: { on: false }     // undang teman (.invite)
}

global.extraFitur = {
    turnamen: { on: false },  // turnamen mingguan antar clan
    badge: { on: false },     // badge pencapaian user
    trial: { on: false }      // trial premium (.trial)
}

// ═══════════════ MEDIA ═══════════════
// Banner/aset lama Kaguya sudah dibuang. Isi hanya lewat env kalau perlu.
global.audioMenu = String(process.env.AUDIO_MENU_URL || '')
global.thumb = {}
const _thumbMenu = String(process.env.THUMB_MENU_URL || '').trim()
const _thumbStore = String(process.env.THUMB_STORE_URL || '').trim()
if (_thumbMenu) {
    global.thumb.utama = _thumbMenu
    global.thumb.menu = _thumbMenu
}
if (_thumbStore) global.thumb.store = _thumbStore
global.stickerPack = {
    packname: "Tsukasa",
    author: "Tsukasa"
}

// ═══════════════ API & TOKEN ═══════════════
global.APIs = { yann: 'https://api.yannrzy.my.id' }
global.APIKeys = { 'https://api.yannrzy.my.id': 'YOUR-APIKEY' }

// Termai API (plugins/ai/termai-*.js) — key diambil dari https://termai.cc, atau env TERMAI_KEY
global.termai = { url: 'https://api.termai.cc', key: process.env.TERMAI_KEY || 'Bell409' }
global.autoai = { name: global.namebot, aliases: [], persona: '', voice: 'cute voice' }

// Premku (plugins/premku) — key ambil di https://premku.com, atau env PREMKU_API_KEY
global.premku = { apiKey: process.env.PREMKU_API_KEY || '' }

global.tokengh = ""   // GitHub (.setghtoken)

// Reseller Panel — key juga bisa lewat env BELIPANEL_API_KEY
// ambil key dan set di https://zanspiwptero.shoppanel.my.id/developer
global.belipanel = {
    url: "https://lyeepedia.shoppanel.biz.id",
    apiKey: process.env.BELIPANEL_API_KEY || process.env.YANNPANEL_API_KEY || process.env.ZANPANEL_API_KEY || "",
    panelUrl: ""                // panel default untuk cekserver / renew (boleh kosong)
}

global.vercel = {
    token: process.env.VERCEL_TOKEN || "",
    teamId: ""                  // isi hanya kalau deploy ke Team
}

global.telegram = {
    token: "",   // @BotFather atau env TELEGRAM_TOKEN
    owners: [7113158281],       // ID angka (kirim /myid ke bot)
    dropPending: true,          // abaikan pesan numpuk saat bot mati
    maxAgeSec: 0,               // abaikan pesan lebih tua dari N detik (0 = off)
    registerCommands: true,     // daftarkan /menu, /myid, /ping
    hideCategories: ['rich', 'rpg', 'relationship', 'user', 'fun', 'clan', 'economy'],   // tidak tampil & tidak direspon di Telegram

    // promosi ke semua user yang pernah /start (berhenti lewat /stop)
    promo: {
        enabled: true,
        perDay: 2,              // kali kirim per hari
        minGapHours: 6,         // jarak minimal antar kiriman
        windowStart: 8,         // jam kirim acak (WIB): dari ...
        windowEnd: 22,          // ... sampai
        buttons: true           // tombol "Beli Panel" & "Menu"
        // texts: ["teks 1", "teks 2"]   // opsional: ganti teks bawaan
    }
}

// ═══════════════ PERFORMA ═══════════════
global.optimizer = {
    maxMsgAgeSec: 0,            // 0 = pesan lama tidak pernah dilewati
    maxPendingPerChat: Infinity,
    memSoftRatio: 1,            // 1 = pembersihan memori tidak pernah jalan
    memHardRatio: 1,
    rssHardRatio: 1,
    connectStuckMs: 86_400_000, // watchdog reconnect saat "connecting"
    deadSocketMs: 86_400_000,   // watchdog reconnect saat websocket mati
    tmpMaxAgeMs: 86_400_000,    // file temp dihapus setelah 1 hari
    quiet: false
}

global.antiban = {
    minDelayMs: 1200,           // jeda minimum antar pesan
    maxDelayMs: 3200,           // jeda maksimum (acak)
    perMinute: 20,              // maks pesan keluar / menit
    perChatPerMinute: 10        // maks per chat / menit
}

// ═══════════════ PEMBAYARAN ═══════════════
global.qrisStatic = "00020101021126570011ID.DANA.WWW011893600915302169795102090216979510303UMI51440014ID.CO.QRIS.WWW0215ID10265029601680303UMI5204549953033605802ID5923Toko Digital Store Iyan6013Kab. Kotabaru6105721626304048D"

// QRIS GoPay otomatis (.order) — token = INTERNAL_TOKEN di Vercel
global.merchantGw = {
    url: "https://payment-yannrzy.vercel.app",
    token: "",
    storeName: "Toko Digital Store Iyan",
    ttlMin: 10,                 // order hangus kalau belum dibayar (menit)
    graceMin: 45,               // tetap dicek setelah hangus (menit)
    pollSec: 8,                 // jeda cek saat ada yang ditunggu (detik)
    idlePollSec: 30,            // jeda cek saat sepi (detik)
    notifyIncoming: true,       // notif ke owner tiap uang masuk
    donateMax: 10000000,        // maks donasi per transaksi
    donateChannel: ""           // ID saluran WhatsApp untuk notif donasi masuk, contoh: "120363xxxxxxxxxxxx@newsletter"
                                // kosong = tidak kirim ke saluran | bot harus admin/pemilik saluran, kalau bukan tidak dikirim
}

global.sociabuzz = { username: 'azresenpai' }

// ═══════════════ SEWA BOT ═══════════════
global.sewamode = false         // true = grup wajib sewa
global.sewaAutoLeave = false    // true = keluar otomatis saat sewa habis

// hari: null = permanen | pakai: .sewa bulanan
global.sewaPlans = [
    { id: "harian",   nama: "1 Hari",   hari: 1,    harga: 2000 },
    { id: "mingguan", nama: "7 Hari",   hari: 7,    harga: 5000 },
    { id: "bulanan",  nama: "30 Hari",  hari: 30,   harga: 10000 },
    { id: "3bulan",   nama: "90 Hari",  hari: 90,   harga: 20000 },
    { id: "permanen", nama: "Permanen", hari: null, harga: 50000 }
]

// ═══════════════ TOKO ═══════════════
// Kunci = kode produk (.order <kode>) | cat: script / web / jasa / lain
// Opsional: demo (link) | deliver (link/teks kirim otomatis setelah lunas) | file (nama file di lib/store/script/)
//           url (link script, diambil otomatis lalu dikirim bot sebagai ZIP setelah lunas)
//   url bisa: GitHub (repo / tree), GitLab, Google Drive, Dropbox, MediaFire, Pixeldrain, atau link langsung ke file apa saja.
//   Kalau file bukan ZIP, bot membungkusnya jadi ZIP. Kalau `file` juga diisi, itu jadi nama ZIP (dan cadangan kalau URL error).
//   Contoh: "sc-kaguya": { name: "...", price: 25000, cat: "script", url: "https://github.com/user/repo" }
//   Tes tanpa beli: .tesscript <kode>
// Nilai di sini menang atas data tersimpan. Stok (.addstok) tidak terpengaruh.
global.storeProducts = {
    "sc-kaguya-update": {
        name: "Script Bot Kaguya MD Free Update Selamanya",
        price: 20000,
        cat: "script",
        url: "",
        file: "Kaguya-MD-FreeUpdate.zip",
        desc: "Script bot WhatsApp multi device, 2.000+ fitur lengkap (RPG, game, download, sticker, AI, grup, store, dll)."
    },
    "sc-kaguya-noupdate": {
        name: "Script Bot Kaguya MD No Update",
        price: 15000,
        cat: "script",
        url: "",
        file: "Kaguya-MD-NoUpdate.zip",
        desc: "Script bot WhatsApp multi device, 2.000+ fitur lengkap (RPG, game, download, sticker, AI, grup, store, dll)."
    },
    "web-api": {
        name: "Source Website REST API",
        price: 20000,
        cat: "web",
        url: "",
        desc: "Source code website dokumentasi REST API (login, docs endpoint, profil, changelog)."
    },
    "web-toko": {
        name: "Source Website Toko Digital",
        price: 85000,
        cat: "web",
        url: "",
        desc: "Source code website toko produk digital dengan katalog dan checkout."
    },
    "web-porto": {
        name: "Source Website Portofolio",
        price: 20000,
        cat: "web",
        url: "",
        desc: "Source code website portofolio satu halaman, responsif."
    },
    "jasa-bot": {
        name: "Jasa Pembuatan Bot",
        price: 15000,
        cat: "jasa",
        desc: "Bot WhatsApp sesuai kebutuhanmu. Detail dibahas lewat chat setelah order."
    },
    "jasa-web": {
        name: "Jasa Pembuatan Website",
        price: 20000,
        cat: "jasa",
        desc: "Website sesuai kebutuhanmu. Detail dibahas lewat chat setelah order."
    },
    "jasa-recode": {
        name: "Jasa Recode & Fix Script",
        price: 10000,
        cat: "jasa",
        desc: "Perbaikan error, penyesuaian fitur, atau pindah base script."
    }
}

// Pengaturan ambil script dari URL (semua opsional)
global.storeFetch = {
    cacheMin: 30,               // simpan hasil unduhan (menit); pembeli berikutnya tidak menunggu unduhan lagi
    maxMB: 100,                 // batas ukuran file
    timeoutSec: 120,
    githubToken: ""             // isi kalau repo GitHub-nya private
}

// ═══════════════ VPS DIGITALOCEAN ═══════════════
// Token: cloud.digitalocean.com/account/api/tokens (Read & Write)
// Akses: owner, Reseller Panel ke atas, atau nomor di sellers / ownerPanels
global.digitalocean = {
    token: "",
    region: "sgp1",
    sellers: [],                // ["628xxx"]
    ownerPanels: [],            // ["628xxx"]
    // image: "ubuntu-22-04-x64",

    // paket = command (.vps1g1c <host>)
    plans: {
        vps1g1c: { size: "s-1vcpu-1gb", ram: "1GB", cpu: "1 vCPU" },
        vps2g1c: { size: "s-1vcpu-2gb", ram: "2GB", cpu: "1 vCPU" },
        vps2g2c: { size: "s-2vcpu-2gb", ram: "2GB", cpu: "2 vCPU" },
        vps4g2c: { size: "s-2vcpu-4gb", ram: "4GB", cpu: "2 vCPU" },
        vps8g4c: { size: "s-4vcpu-8gb", ram: "8GB", cpu: "4 vCPU" }
    }
}

// ═══════════════ PANEL PTERODACTYL ═══════════════
// plta = Application API (ptla_...) | pltc = Client API (ptlc_...)
global.panel = {
    // Server 1
    domain: "",                 // contoh: https://panel.domainmu.com
    plta: "",
    pltc: "",
    egg: 15,
    nest: 5,
    node: 1,
    location: 1,
    docker: "ghcr.io/parkervcp/yolks:nodejs_22",

    // Server 2 (opsional) → .srv21gb, .cadmin2
    domain2: "",
    plta2: "",
    pltc2: "",
    egg2: 15,
    nest2: 5,
    node2: 1,
    location2: 1,
    docker2: "ghcr.io/parkervcp/yolks:nodejs_22",

    // info toko di kartu & struk
    store: {
        name: "YannRzy Panel",
        web: "",
        contact: "",            // contoh: wa.me/628xxxxxxxxxx
        expired: "1 bulan",
        garansi: "15 hari",
        email: "panel.local",   // email akun: username@<ini>
        terms: [
            "Dilarang memakai script DDoS",
            "Dilarang menambah egg tanpa izin pemilik",
            "Dilarang menyalakan 2FA / membuat rusuh",
            "Dilarang menghapus akun admin",
            "Dilarang mengintip / mencuri / mengganti script",
            "Pelanggaran = blacklist dan hukuman lainnya",
            "Simpan data ini sebaik mungkin"
        ]
    },

    // paket = command (.1gb, .2gb, ...) | ram & disk MB, cpu %, 0 = unlimited
    // opsional price (rupiah) → penjualan masuk omset (.panelrekap) & ledger toko
    plans: {
        "1gb":  { ram: 1050,  disk: 3050,  cpu: 30 },
        "2gb":  { ram: 2070,  disk: 2070,  cpu: 60 },
        "3gb":  { ram: 3090,  disk: 3090,  cpu: 90 },
        "4gb":  { ram: 4110,  disk: 4110,  cpu: 120 },
        "5gb":  { ram: 5130,  disk: 5130,  cpu: 150 },
        "6gb":  { ram: 6050,  disk: 6050,  cpu: 180 },
        "7gb":  { ram: 7050,  disk: 7050,  cpu: 210 },
        "8gb":  { ram: 8050,  disk: 8050,  cpu: 240 },
        "9gb":  { ram: 9050,  disk: 9050,  cpu: 270 },
        "10gb": { ram: 10050, disk: 10050, cpu: 300 },
        "unli": { ram: 0,     disk: 0,     cpu: 0 }
    },

    onlyGroup: false            // true = jualan hanya di grup
}

// ═══════════════ AUTO RELOAD ═══════════════
let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
    unwatchFile(file)
    console.log(chalk.redBright("Update config.js"))
    import(`${file}?update=${Date.now()}`)
})
