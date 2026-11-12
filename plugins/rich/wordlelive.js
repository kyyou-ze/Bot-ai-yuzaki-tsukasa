import { dioRun, dioRegister } from '../../lib/engine/plugins.js'
import { oneCommand } from '../../lib/engine/plugins.js'

// ───────── logika fitur (sebelumnya di lib/) ─────────
const libs = {
    "htmlcard": (module, exports, require) => {
// Pengirim kartu HTML (rich response) untuk Kaguya.
// Kartu statis: semua data ditanam di HTML, tanpa fetch (sandbox WA memblokir jaringan).
const DEFAULT_BOT_JID = "867051314767696@bot"
const KAPABILITAS = [34, 58, 29, 1, 67, 60, 55, 8]
const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("")
const randomResponseId = () => `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`

function buildRichHtmlPayload(html, title = "Card", opts = {}) {
  // opts.quoted = objek pesan (m) yang mau di-reply: kutipannya tampil di dalam kartu, seperti balasan biasa
  const q = require('./dquote').quoteOf(opts.quoted), qCtx = q && q.message ? { stanzaId: q.key.id, participant: q.key.participant || q.sender, remoteJid: q.chat, quotedMessage: q.message } : {}
  return {
    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { capabilityMetadata: { capabilities: KAPABILITAS } } },
    botForwardedMessage: { message: { richResponseMessage: {
      messageType: 1,
      submessages: [{ messageType: 2, messageText: title }],
      unifiedResponse: { data: Buffer.from(JSON.stringify({
        response_id: randomResponseId(),
        sections: [{ view_model: { primitive: { __typename: "GenAIaeacdsnwHtmlPrimitive", payload: html, trusted_sources: [] }, __typename: "GenAISingleLayoutViewModel" } }],
      })).toString("base64") },
      contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: DEFAULT_BOT_JID }, forwardOrigin: 4, ...qCtx },
    } } },
  }
}

async function sendHtmlCard(sock, m, html, title, emoji = "✨", opts = {}) {
  try {
    await sock.relayMessage(m.chat, buildRichHtmlPayload(html, title, opts), {})
    try { await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) } catch {}
    return true
  } catch (err) {
    console.error(`[HTMLCARD:${title}] gagal kirim:`, err.message)
    await sock.sendMessage(m.chat, { text: "❌ Kartu gagal dikirim. Fitur ini butuh WhatsApp versi terbaru." }, { quoted: m })
    return false
  }
}

const safeJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028|\u2029/g, "")
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

const BASE_CSS = String.raw`
:root{--bg:#0f1115;--card:#181b22;--card2:#20242d;--ink:#fff;--soft:#a3aab8;--line:#2b303b;--acc:#22c55e;--acc2:#16a34a;--warn:#f59e0b;--red:#ef4444;--blue:#3b82f6;--sys:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{background:transparent;color:var(--ink);font-family:var(--sys);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
.stage{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:14px 10px;}
.app{width:100%;max-width:380px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(180deg,#232733 0%,#171a21 30%,var(--bg) 70%);box-shadow:0 18px 40px rgba(0,0,0,.55);padding:14px 12px 16px;}
.top{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.logo{width:30px;height:30px;border-radius:9px;background:var(--acc);flex:none;display:flex;align-items:center;justify-content:center;font-size:16px;}
.meta{min-width:0;flex:1;}
.title{font-size:14px;font-weight:800;}
.sub{font-size:10.5px;color:var(--soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
.chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px;scrollbar-width:none;}
.chips::-webkit-scrollbar{display:none;}
.chip{flex:none;border:1px solid var(--line);background:var(--card);color:var(--soft);border-radius:20px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;}
.chip.on{background:var(--acc);border-color:var(--acc);color:#04130a;}
.btn{border:0;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;cursor:pointer;background:var(--acc);color:#04130a;}
.btn.alt{background:var(--card2);color:var(--ink);border:1px solid var(--line);}
.btn.red{background:var(--red);color:#fff;}
.inp{width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;color:var(--ink);font-size:14px;outline:none;font-family:var(--sys);}
.inp:focus{border-color:var(--acc);}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;}
.row{display:flex;gap:8px;align-items:center;}
.muted{color:var(--soft);font-size:11px;}
.hide{display:none!important;}
`;

module.exports = { buildRichHtmlPayload, sendHtmlCard, safeJson, escapeHtml, BASE_CSS }
    },
    "dquote": (module, exports, require) => {
// kutipan untuk kartu HTML: pakai pesan user apa adanya (header palsu bisnis tidak dipakai)
const quoteOf = (q) => { try { return q && q.key && q.message && q.chat ? q : null } catch { return null } }
module.exports = { quoteOf, apply: (o) => o, enabled: () => false }
    },
    "cards/wordle": (module, exports, require) => {
    // Kartu HTML statis: TEBAK KATA LIVE — Tebak kata 5 huruf bahasa Indonesia, kata harian & acak
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .gr{display:grid;gap:5px;margin:10px auto;max-width:280px}
    .rw{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
    .t{aspect-ratio:1;border:2px solid var(--line);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;text-transform:uppercase;background:var(--card);transition:transform .25s}
    .t.f{border-color:#6b7599}
    .t.g{background:#15803d;border-color:#15803d}.t.y{background:#b45309;border-color:#b45309}.t.x{background:#374151;border-color:#374151}
    .kb{display:grid;gap:5px;margin-top:6px}
    .kr{display:flex;gap:4px;justify-content:center}
    .k{flex:1;max-width:34px;padding:11px 0;border-radius:8px;border:1px solid var(--line);background:var(--card2);color:var(--ink);font-weight:800;font-size:13px;text-transform:uppercase;touch-action:manipulation;padding-left:0;padding-right:0}
    .k.w{max-width:54px;font-size:11px}
    .k.g{background:#15803d}.k.y{background:#b45309}.k.x{background:#2a2f3d;color:#6b7280}
    .msg{text-align:center;font-weight:800;min-height:22px}
    .shake{animation:sh .3s}@keyframes sh{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🔤</div><div class="meta"><div class="title">Tebak Kata Live</div><div class="sub" id="who"></div></div></div>
     <div class="chips"><button class="chip on" id="md">Kata harian</button><button class="chip" id="mr">Kata acak</button></div>
     <div class="gr" id="gr"></div>
     <div class="msg" id="ms"></div>
     <div class="kb" id="kb"></div>
     <div class="muted" style="text-align:center;margin-top:8px" id="st"></div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var WORDS='abadi acara agama alami angin apung arang atlet aroma badai bahan balon bambu bantu barat batik bebek belut benar besar bijak bisik bukti bulan bunga cabai cinta cuaca dalam damai dapur darah datar dunia emosi gajah garam gelas gemuk harap harga harus hasil hujan hutan indah jalan jaket jujur kabar kaget kamar kamus kanan kapal karya kasur kebun kecil kerja kuasa kursi lampu lemak lemon makan malam mampu mandi mawar mimpi minta mulai murah musim nasib nenek nyata orang padat pagar pahit pasar pasir pasti pedas pelan pikir pintu pohon putih rajin rindu rumah sabar salju sayur segar sehat semut senja siang sinar suara sudut tahun tanah tegas telur tidur tikus tinta tubuh tulis ujian untuk usaha utara wajah waktu warna yakin zaman'.split(' ').filter(function(w){return w.length===5});
    var ROWS=6,word,cur,row,done,mode='d',stat={w:0,p:0};
    try{stat=JSON.parse(localStorage.getItem('pix_wordle')||'{"w":0,"p":0}');}catch(e){}
    function seed(){var d=new Date(),s=d.getFullYear()*372+d.getMonth()*31+d.getDate();return WORDS[(s*7919)%WORDS.length];}
    function init(){word=mode==='d'?seed():WORDS[Math.floor(Math.random()*WORDS.length)];cur='';row=0;done=false;$('ms').textContent='';
     var g=$('gr');g.innerHTML='';for(var i=0;i<ROWS;i++){var r=document.createElement('div');r.className='rw';r.id='r'+i;for(var j=0;j<5;j++){var t=document.createElement('div');t.className='t';r.appendChild(t);}g.appendChild(r);}
     [].forEach.call(document.querySelectorAll('.k'),function(k){k.classList.remove('g','y','x')});st();}
    function st(){$('st').textContent='Menang '+stat.w+' dari '+stat.p+' permainan';}
    function paint(){var r=$('r'+row).children;for(var j=0;j<5;j++){r[j].textContent=cur[j]||'';r[j].classList.toggle('f',!!cur[j]);}}
    function key(k){if(done)return;if(k==='⌫'){cur=cur.slice(0,-1);paint();}else if(k==='OK'){submit();}else if(cur.length<5&&/^[a-z]$/.test(k)){cur+=k;paint();}}
    function submit(){if(cur.length<5){var r0=$('r'+row);r0.classList.add('shake');setTimeout(function(){r0.classList.remove('shake')},300);$('ms').textContent='Isi 5 huruf dulu';return;}
     $('ms').textContent='';var res=['x','x','x','x','x'],used={},i;
     for(i=0;i<5;i++)if(cur[i]===word[i]){res[i]='g';}else used[word[i]]=(used[word[i]]||0)+1;
     for(i=0;i<5;i++)if(res[i]!=='g'&&used[cur[i]]>0){res[i]='y';used[cur[i]]--;}
     var r=$('r'+row).children;for(i=0;i<5;i++){r[i].className='t '+res[i];
      var kk=document.querySelector('.k[data-k="'+cur[i]+'"]');if(kk&&!(kk.classList.contains('g'))&&!(kk.classList.contains('y')&&res[i]==='x')){kk.classList.remove('x','y','g');kk.classList.add(res[i]);}}
     if(cur===word){done=true;$('ms').textContent='Benar! Kamu menebak dalam '+(row+1)+' percobaan';stat.w++;stat.p++;sv();}
     else if(row===ROWS-1){done=true;$('ms').textContent='Kata yang benar: '+word.toUpperCase();stat.p++;sv();}
     else{row++;cur='';}}
    function sv(){try{localStorage.setItem('pix_wordle',JSON.stringify(stat));}catch(e){}st();}
    var L=['qwertyuiop','asdfghjkl','OKzxcvbnm⌫'];
    L.forEach(function(s){var r=document.createElement('div');r.className='kr';
     var arr=s==='OKzxcvbnm⌫'?['OK'].concat('zxcvbnm'.split(''),['⌫']):s.split('');
     arr.forEach(function(k){var b=document.createElement('button');b.className='k'+(k.length>1||k==='⌫'?' w':'');b.textContent=k;if(/^[a-z]$/.test(k))b.dataset.k=k;b.onclick=function(){key(k)};r.appendChild(b);});$('kb').appendChild(r);});
    document.addEventListener('keydown',function(e){if(e.key==='Enter')key('OK');else if(e.key==='Backspace')key('⌫');else key(e.key.toLowerCase());});
    $('md').onclick=function(){mode='d';$('md').classList.add('on');$('mr').classList.remove('on');init();};
    $('mr').onclick=function(){mode='r';$('mr').classList.add('on');$('md').classList.remove('on');init();};
    window.__w=function(){return word;};
    init();
    })();
    </script>
    `;

    function buildWordleHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildWordleHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Tebak Kata Live — Tebak kata 5 huruf bahasa Indonesia, kata harian & acak
const { buildWordleHtml } = require('../../lib/cards/wordle')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'wordle',
  alias: [],
  category: 'rich',
  desc: "Tebak kata 5 huruf bahasa Indonesia, kata harian & acak",
  run: async ({ sock, m, pushname }) => {
    const html = buildWordleHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Tebak Kata Live', '🔤')
  },
}
    }

dioRegister("rich/wordlelive", feature, libs)

let handler = (m, ctx) => dioRun("rich/wordlelive", m, ctx)

handler.command = ['wordle']
handler.help = ['wordle']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'wordlelive', { subs: false })
