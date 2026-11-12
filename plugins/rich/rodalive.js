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
    "cards/roda": (module, exports, require) => {
    // Kartu HTML statis: RODA PUTAR LIVE — Roda putar pilihan sendiri: makan apa, truth or dare, undian
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .wh{position:relative;width:min(100%,320px);margin:6px auto}
    .wh canvas{display:block;width:100%}
    .pt{position:absolute;left:50%;top:-4px;transform:translateX(-50%);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:24px solid #fff;filter:drop-shadow(0 2px 3px #0008);z-index:2}
    .out{text-align:center;font-size:22px;font-weight:800;color:var(--acc);min-height:34px;margin:6px 0;word-break:break-word}
    textarea.inp{min-height:96px;resize:vertical}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🎡</div><div class="meta"><div class="title">Roda Putar Live</div><div class="sub" id="who"></div></div></div>
     <div class="chips" id="pr"></div>
     <div class="wh"><div class="pt"></div><canvas id="cv" width="360" height="360"></canvas></div>
     <div class="out" id="out">Putar rodanya!</div>
     <button class="btn" style="width:100%" id="sp">🎡 PUTAR</button>
     <div class="muted" style="margin:10px 0 4px">Pilihan (satu per baris, 2-12 item):</div>
     <textarea class="inp" id="ta"></textarea>
     <div class="row" style="margin-top:6px"><button class="btn alt" id="rm" style="flex:1">Buang hasil dari daftar</button><label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="so" checked> Suara</label></div>
     <div class="muted" id="hs" style="margin-top:8px"></div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var c=$('cv').getContext('2d'),CX=180,CY=180,R=170;
    var PRE={'Makan apa?':'Nasi goreng\nMie ayam\nBakso\nSate\nGado-gado\nSoto','Ya / Tidak':'Ya\nTidak\nMungkin\nCoba lagi nanti','Truth or Dare':'Truth\nDare\nTruth\nDare\nSkip','Giliran siapa?':'Pemain 1\nPemain 2\nPemain 3\nPemain 4','Hadiah':'Zonk\n10 Poin\n50 Poin\nJackpot 100\nZonk\n25 Poin'};
    var COLS=['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#84cc16','#a855f7'];
    var opts=[],rot=0,spinning=false,hist=[],AC=null;
    function parse(){opts=$('ta').value.split('\n').map(function(s){return s.trim()}).filter(Boolean).slice(0,12);}
    function tick(){if(!$('so').checked)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=700;g.gain.setValueAtTime(.08,AC.currentTime);g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+.06);o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+.07);}catch(e){}}
    function draw(){c.clearRect(0,0,360,360);var n=opts.length;
     if(n<2){c.fillStyle='#ffffff22';c.beginPath();c.arc(CX,CY,R,0,7);c.fill();c.fillStyle='#fff';c.textAlign='center';c.font='bold 16px sans-serif';c.fillText('Isi minimal 2 pilihan',CX,CY);return;}
     var a=Math.PI*2/n;
     for(var i=0;i<n;i++){var s=rot+i*a-Math.PI/2;c.beginPath();c.moveTo(CX,CY);c.arc(CX,CY,R,s,s+a);c.closePath();c.fillStyle=COLS[i%COLS.length];c.fill();c.strokeStyle='#0b0f1f';c.lineWidth=3;c.stroke();
      c.save();c.translate(CX,CY);c.rotate(s+a/2);c.textAlign='right';c.fillStyle='#fff';c.font='bold '+(n>8?13:16)+'px sans-serif';c.shadowColor='#0008';c.shadowBlur=3;var t=opts[i];if(t.length>14)t=t.slice(0,13)+'…';c.fillText(t,R-14,5);c.restore();}
     c.beginPath();c.arc(CX,CY,22,0,7);c.fillStyle='#0b0f1f';c.fill();c.strokeStyle='#fff';c.lineWidth=4;c.stroke();}
    function idxAt(){var n=opts.length,a=Math.PI*2/n,x=((-rot)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);return Math.floor(x/a)%n;}
    function spin(){if(spinning)return;parse();if(opts.length<2){draw();return;}spinning=true;$('out').textContent='...';
     var start=rot,extra=(5+Math.random()*3)*Math.PI*2+Math.random()*Math.PI*2,dur=4200,t0=performance.now(),lastI=-1;
     function f(t){var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3.4);rot=start+extra*e;var i=idxAt();if(i!==lastI){tick();lastI=i;}draw();
      if(p<1)requestAnimationFrame(f);else{spinning=false;var w=opts[idxAt()];$('out').textContent=w;hist.unshift(w);hist=hist.slice(0,6);$('hs').textContent='Riwayat: '+hist.join(' • ');}}
     requestAnimationFrame(f);}
    Object.keys(PRE).forEach(function(k,i){var b=document.createElement('button');b.className='chip'+(i?'':' on');b.textContent=k;b.onclick=function(){[].forEach.call($('pr').children,function(x){x.classList.toggle('on',x===b)});$('ta').value=PRE[k];parse();draw();$('out').textContent='Putar rodanya!';};$('pr').appendChild(b);});
    $('ta').value=PRE['Makan apa?'];$('ta').oninput=function(){parse();draw();};
    $('sp').onclick=spin;$('cv').onclick=spin;
    $('rm').onclick=function(){var w=$('out').textContent;if(spinning||opts.length<=2)return;var i=opts.indexOf(w);if(i<0)return;opts.splice(i,1);$('ta').value=opts.join('\n');draw();$('out').textContent='Dibuang: '+w;};
    parse();draw();
    })();
    </script>
    `;

    function buildRodaHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildRodaHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Roda Putar Live — Roda putar pilihan sendiri: makan apa, truth or dare, undian
const { buildRodaHtml } = require('../../lib/cards/roda')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'roda',
  alias: [],
  category: 'rich',
  desc: "Roda putar pilihan sendiri: makan apa, truth or dare, undian",
  run: async ({ sock, m, pushname }) => {
    const html = buildRodaHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Roda Putar Live', '🎡')
  },
}
    }

dioRegister("rich/rodalive", feature, libs)

let handler = (m, ctx) => dioRun("rich/rodalive", m, ctx)

handler.command = ['roda']
handler.help = ['roda']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'rodalive', { subs: false })
