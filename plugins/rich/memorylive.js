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
    "cards/memory": (module, exports, require) => {
    // Kartu HTML statis: MEMORY LIVE (Game cocokkan kartu 3 level, hitung langkah & waktu, rekor tersimpan)
    // Semua jalan di dalam kartu, tanpa fetch. By PIX.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0}
    .cd{aspect-ratio:1;perspective:400px;cursor:pointer}
    .in{position:relative;width:100%;height:100%;transition:transform .35s;transform-style:preserve-3d}
    .cd.f .in{transform:rotateY(180deg)}
    .fc,.bc{position:absolute;inset:0;border-radius:11px;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;-webkit-backface-visibility:hidden;font-size:28px}
    .bc{background:linear-gradient(135deg,#2a3350,#1d2540);border:1px solid var(--line);color:#9db4ff}
    .fc{background:var(--card2);border:1px solid var(--line);transform:rotateY(180deg)}
    .cd.m .fc{background:#143d26;border-color:var(--acc)}
    .st{display:flex;gap:6px;justify-content:space-between}
    .pill{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:5px 11px;font-size:12px;font-weight:800}.pill b{color:var(--acc)}
    .win{text-align:center;padding:10px;color:var(--acc);font-weight:800;min-height:20px}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🧠</div><div class="meta"><div class="title">Memory Live</div><div class="sub" id="who"></div></div></div>
     <div class="chips" id="lv"><button class="chip on" data-n="6">Mudah 4×3</button><button class="chip" data-n="8">Sedang 4×4</button><button class="chip" data-n="10">Susah 4×5</button></div>
     <div class="st"><span class="pill">Langkah <b id="mv">0</b></span><span class="pill">Waktu <b id="tm">0</b>d</span><span class="pill">Rekor <b id="bs">-</b></span></div>
     <div class="grid" id="g"></div>
     <div class="win" id="win"></div>
     <button class="btn" style="width:100%" id="rs">⟳ Acak Ulang</button>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var E=['🐶','🐱','🦊','🐼','🐸','🦁','🐙','','🍕',''],N=6,first=null,lock=false,mv=0,tm=0,iv=null,left=0,rec={};
    try{rec=JSON.parse(localStorage.getItem('pix_mem')||'{}');}catch(e){}
    function shuf(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
    function start(){clearInterval(iv);iv=null;mv=0;tm=0;first=null;lock=false;left=N;$('mv').textContent=0;$('tm').textContent=0;$('win').textContent='';$('bs').textContent=rec[N]||'-';
     var d=shuf(E.slice(0,N).concat(E.slice(0,N))),g=$('g');g.innerHTML='';
     d.forEach(function(e){var c=document.createElement('div');c.className='cd';c.dataset.e=e;c.innerHTML='<div class="in"><div class="bc">❔</div><div class="fc">'+e+'</div></div>';c.onclick=function(){flip(c)};g.appendChild(c);});}
    function flip(c){if(lock||c.classList.contains('f'))return;if(!iv)iv=setInterval(function(){tm++;$('tm').textContent=tm;},1000);
     c.classList.add('f');if(!first){first=c;return;}mv++;$('mv').textContent=mv;
     if(first.dataset.e===c.dataset.e){first.classList.add('m');c.classList.add('m');first=null;left--;if(!left)done();}
     else{lock=true;var a=first;first=null;setTimeout(function(){a.classList.remove('f');c.classList.remove('f');lock=false;},750);}}
    function done(){clearInterval(iv);var b=!rec[N]||mv<rec[N];if(b){rec[N]=mv;try{localStorage.setItem('pix_mem',JSON.stringify(rec));}catch(e){}}$('bs').textContent=rec[N];
     $('win').textContent='🎉 Selesai! '+mv+' langkah, '+tm+' detik'+(b?' — REKOR BARU!':'');}
    $('rs').onclick=start;
    $('lv').onclick=function(e){var n=e.target.dataset&&e.target.dataset.n;if(!n)return;N=+n;[].forEach.call($('lv').children,function(x){x.classList.toggle('on',x===e.target)});start();};
    start();
    })();
    </script>
    `;

    function buildMemoryHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildMemoryHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Memory Live — Game cocokkan kartu 3 level + rekor
const { buildMemoryHtml } = require('../../lib/cards/memory')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'memory',
  alias: [],
  category: 'rich',
  desc: "Game cocokkan kartu 3 level + rekor",
  run: async ({ sock, m, pushname }) => {
    const html = buildMemoryHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Memory Live', '🧠')
  },
}
    }

dioRegister("rich/memorylive", feature, libs)

let handler = (m, ctx) => dioRun("rich/memorylive", m, ctx)

handler.command = ['memory']
handler.help = ['memory']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'memorylive', { subs: false })
