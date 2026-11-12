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
    "cards/konverter": (module, exports, require) => {
    // Kartu HTML statis: KONVERTER LIVE (Konverter satuan: panjang, berat, volume, waktu, data, kecepatan, luas, suhu)
    // Semua jalan di dalam kartu, tanpa fetch. By PIX.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .tabs{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;scrollbar-width:none}.tabs::-webkit-scrollbar{display:none}
    .big{font-size:30px;font-weight:800;word-break:break-all;color:var(--acc);margin:6px 0}
    select.inp{padding:9px 8px;font-size:13px}
    .sw{background:var(--card2);border:1px solid var(--line);color:var(--ink);border-radius:50%;width:38px;height:38px;font-size:17px;flex:none;cursor:pointer}
    .lst{display:grid;gap:5px;margin-top:10px;max-height:190px;overflow:auto}
    .lst div{display:flex;justify-content:space-between;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:7px 10px;font-size:12px}
    .lst b{color:var(--acc)}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🔁</div><div class="meta"><div class="title">Konverter Live</div><div class="sub" id="who"></div></div></div>
     <div class="tabs" id="tabs"></div>
     <input class="inp" id="v" type="number" inputmode="decimal" value="1" step="any">
     <div class="row" style="margin:8px 0"><select class="inp" id="a"></select><button class="sw" id="sw">⇅</button><select class="inp" id="b"></select></div>
     <div class="box"><div class="muted" id="eq"></div><div class="big" id="out">0</div></div>
     <div class="lst" id="lst"></div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var U={
     'Panjang':{m:1,u:{mm:0.001,cm:0.01,m:1,km:1000,inci:0.0254,kaki:0.3048,yard:0.9144,mil:1609.344}},
     'Berat':{m:1,u:{mg:0.000001,g:0.001,kg:1,ton:1000,ons:0.1,pon:0.45359237,oz:0.0283495}},
     'Volume':{m:1,u:{ml:0.001,l:1,'m³':1000,'sdt':0.005,'sdm':0.015,cup:0.24,galon:3.78541}},
     'Waktu':{m:1,u:{detik:1,menit:60,jam:3600,hari:86400,minggu:604800,bulan:2629800,tahun:31557600}},
     'Data':{m:1,u:{bit:0.125,byte:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776}},
     'Kecepatan':{m:1,u:{'m/s':1,'km/j':0.277778,'mil/j':0.44704,knot:0.514444}},
     'Luas':{m:1,u:{'cm²':0.0001,'m²':1,'ha':10000,'km²':1000000,'are':100,'acre':4046.86}},
     'Suhu':{t:1,u:{'°C':1,'°F':1,'K':1}}
    };
    var cat='Panjang';
    function fmt(n){if(!isFinite(n))return '—';var a=Math.abs(n);if(a!==0&&(a>=1e12||a<1e-6))return n.toExponential(4);return (+n.toPrecision(10)).toLocaleString('id-ID',{maximumFractionDigits:8});}
    function conv(v,f,t){
     if(U[cat].t){var c=f==='°C'?v:f==='°F'?(v-32)*5/9:v-273.15;return t==='°C'?c:t==='°F'?c*9/5+32:c+273.15;}
     var u=U[cat].u;return v*u[f]/u[t];}
    function fill(){var k=Object.keys(U[cat].u),h=k.map(function(x){return '<option>'+x+'</option>'}).join('');$('a').innerHTML=h;$('b').innerHTML=h;$('b').selectedIndex=Math.min(2,k.length-1);calc();}
    function calc(){var v=parseFloat($('v').value);if(isNaN(v)){$('out').textContent='0';$('eq').textContent='';$('lst').innerHTML='';return;}
     var f=$('a').value,t=$('b').value,r=conv(v,f,t);$('out').textContent=fmt(r)+' '+t;$('eq').textContent=fmt(v)+' '+f+' =';
     $('lst').innerHTML=Object.keys(U[cat].u).map(function(x){return '<div><span>'+x+'</span><b>'+fmt(conv(v,f,x))+'</b></div>'}).join('');}
    var T=$('tabs');Object.keys(U).forEach(function(k,i){var b=document.createElement('button');b.className='chip'+(i?'':' on');b.textContent=k;b.onclick=function(){cat=k;[].forEach.call(T.children,function(c){c.classList.remove('on')});b.classList.add('on');fill();};T.appendChild(b);});
    $('v').oninput=calc;$('a').onchange=calc;$('b').onchange=calc;
    $('sw').onclick=function(){var x=$('a').selectedIndex;$('a').selectedIndex=$('b').selectedIndex;$('b').selectedIndex=x;calc();};
    fill();
    })();
    </script>
    `;

    function buildKonverterHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildKonverterHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Konverter Live — Konverter satuan: panjang, berat, volume, suhu, dll
const { buildKonverterHtml } = require('../../lib/cards/konverter')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'konverter',
  alias: [],
  category: 'rich',
  desc: "Konverter satuan: panjang, berat, volume, suhu, dll",
  run: async ({ sock, m, pushname }) => {
    const html = buildKonverterHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Konverter Live', '🔁')
  },
}
    }

dioRegister("rich/konverterlive", feature, libs)

let handler = (m, ctx) => dioRun("rich/konverterlive", m, ctx)

handler.command = ['konverter']
handler.help = ['konverter']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'konverterlive', { subs: false })
