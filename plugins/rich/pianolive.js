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
    "cards/piano": (module, exports, require) => {
    // Kartu HTML statis: PIANO LIVE (Piano 2 oktaf: suara sintesis, rekam & putar, lagu demo)
    // Semua jalan di dalam kartu, tanpa fetch. By PIX.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .ctl{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
    .ctl select,.ctl input{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:7px 8px;font-size:12px}
    .kb{position:relative;height:170px;user-select:none;-webkit-user-select:none;touch-action:none;margin:10px 0}
    .wk{position:absolute;top:0;height:100%;background:linear-gradient(#fff,#e6e6e6);border:1px solid #888;border-radius:0 0 7px 7px;color:#555;font-size:9px;text-align:center;padding-top:132px}
    .wk.on{background:linear-gradient(#9ff0b5,#4ade80)}
    .bk{position:absolute;top:0;height:60%;background:linear-gradient(#333,#000);border-radius:0 0 5px 5px;z-index:2}
    .bk.on{background:linear-gradient(#22c55e,#15803d)}
    .disp{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px;min-height:44px;font-size:13px;color:var(--soft)}
    .disp b{color:var(--acc);font-size:20px;margin-right:6px}
    .toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none}.toast.on{opacity:1}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🎹</div><div class="meta"><div class="title">Piano Live</div><div class="sub" id="who"></div></div></div>
     <div class="disp"><b id="nn">–</b><span id="nf">Tekan tuts untuk bermain</span></div>
     <div class="kb" id="kb"></div>
     <div class="ctl">
      <select id="wv"><option value="triangle">Lembut</option><option value="sine">Sinus</option><option value="square">Retro</option><option value="sawtooth">Tajam</option></select>
      <input id="vol" type="range" min="0" max="100" value="60" style="flex:1;min-width:80px">
      <select id="oc"><option value="0">Oktaf 3-4</option><option value="1" selected>Oktaf 4-5</option><option value="2">Oktaf 5-6</option></select>
     </div>
     <div class="row" style="margin-bottom:6px"><button class="btn" id="rec" style="flex:1">⏺ Rekam</button><button class="btn alt" id="play" style="flex:1">▶ Putar</button></div>
     <div class="row"><select id="song" class="inp" style="flex:1"><option value="0">🎵 Twinkle Twinkle</option><option value="1">🎵 Ode to Joy</option><option value="2">🎵 Jingle Bells</option></select><button class="btn alt" id="demo">Mainkan</button></div>
     <div class="muted" style="text-align:center;margin-top:8px">Keyboard: A S D F G H J K L ; (putih) • W E T Y U O P (hitam)</div>
    </div><div class="toast" id="toast"></div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var AC=null,master=null;
    function ctx(){if(!AC){var A=window.AudioContext||window.webkitAudioContext;if(!A)return null;AC=new A();master=AC.createGain();master.connect(AC.destination);}if(AC.state==='suspended')AC.resume();master.gain.value=$('vol').value/100;return AC;}
    var NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    var WH=[0,2,4,5,7,9,11],BL={0:1,1:3,3:6,4:8,5:10};
    function freq(n){return 440*Math.pow(2,(n-69)/12);}
    var base=60,keys=[],act={};
    function build(){
     var kb=$('kb');kb.innerHTML='';keys=[];var n=14,w=100/n,i,o,s,idx=0;
     for(i=0;i<n;i++){o=Math.floor(i/7);s=WH[i%7];var m=base+o*12+s;var d=document.createElement('div');d.className='wk';d.style.left=(i*w)+'%';d.style.width=w+'%';d.textContent=NAMES[s]+(Math.floor(m/12)-1);d.dataset.m=m;kb.appendChild(d);keys.push(d);}
     for(i=0;i<n-1;i++){var k=i%7;if(k===2||k===6)continue;o=Math.floor(i/7);s=WH[k]+1;var m2=base+o*12+s;var e=document.createElement('div');e.className='bk';e.style.left=((i+1)*w-w*0.3)+'%';e.style.width=(w*0.6)+'%';e.dataset.m=m2;kb.appendChild(e);keys.push(e);}
    }
    var rec=false,rdata=[],t0=0,playing=false;
    function on(m,silent){var a=ctx();if(!a||act[m])return;var o=a.createOscillator(),g=a.createGain();o.type=$('wv').value;o.frequency.value=freq(m);g.gain.setValueAtTime(0.0001,a.currentTime);g.gain.exponentialRampToValueAtTime(0.5,a.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.18,a.currentTime+0.4);o.connect(g);g.connect(master);o.start();act[m]={o:o,g:g};
     mark(m,true);$('nn').textContent=NAMES[m%12]+(Math.floor(m/12)-1);$('nf').textContent=Math.round(freq(m))+' Hz';
     if(rec&&!silent)rdata.push({t:Date.now()-t0,m:m,d:1});}
    function off(m,silent){var a=act[m];if(!a)return;var now=AC.currentTime;a.g.gain.cancelScheduledValues(now);a.g.gain.setValueAtTime(Math.max(a.g.gain.value,0.0002),now);a.g.gain.exponentialRampToValueAtTime(0.0001,now+0.25);a.o.stop(now+0.3);delete act[m];mark(m,false);
     if(rec&&!silent)rdata.push({t:Date.now()-t0,m:m,d:0});}
    function mark(m,v){for(var i=0;i<keys.length;i++)if(+keys[i].dataset.m===m)keys[i].classList.toggle('on',v);}
    var down={};
    function hit(e){var t=e.target;if(!t.dataset||t.dataset.m===undefined)return null;return +t.dataset.m;}
    $('kb').addEventListener('pointerdown',function(e){e.preventDefault();var m=hit(e);if(m===null)return;try{$('kb').setPointerCapture(e.pointerId);}catch(x){}down[e.pointerId]=m;on(m);});
    $('kb').addEventListener('pointermove',function(e){if(down[e.pointerId]===undefined)return;var el=document.elementFromPoint(e.clientX,e.clientY);if(!el||!el.dataset||el.dataset.m===undefined)return;var m=+el.dataset.m;if(m!==down[e.pointerId]){off(down[e.pointerId]);down[e.pointerId]=m;on(m);}});
    function up(e){if(down[e.pointerId]===undefined)return;off(down[e.pointerId]);delete down[e.pointerId];}
    $('kb').addEventListener('pointerup',up);$('kb').addEventListener('pointercancel',up);
    var KM={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,';':16};
    document.addEventListener('keydown',function(e){if(e.repeat||e.ctrlKey||e.metaKey)return;var k=KM[e.key.toLowerCase()];if(k!==undefined)on(base+k);});
    document.addEventListener('keyup',function(e){var k=KM[e.key.toLowerCase()];if(k!==undefined)off(base+k);});
    $('oc').onchange=function(){base=48+12*(+this.value);build();};
    $('oc').value=1;base=60;
    function toast(s){var t=$('toast');t.textContent=s;t.classList.add('on');setTimeout(function(){t.classList.remove('on');},1500);}
    $('rec').onclick=function(){if(!rec){rec=true;rdata=[];t0=Date.now();this.textContent='⏹ Stop';toast('Merekam...');}else{rec=false;this.textContent='⏺ Rekam';toast(rdata.length?'Tersimpan '+Math.ceil(rdata.length/2)+' nada':'Kosong');}};
    function seq(list){if(playing)return;playing=true;var i;for(i=0;i<list.length;i++)(function(ev){setTimeout(function(){if(ev.d)on(ev.m,true);else off(ev.m,true);},ev.t);})(list[i]);
     setTimeout(function(){playing=false;},list[list.length-1].t+400);}
    $('play').onclick=function(){if(rec||!rdata.length){toast('Rekam dulu');return;}seq(rdata);};
    var SONGS=[
     '0 0 7 7 9 9 7 5 5 4 4 2 2 0 7 7 5 5 4 4 2 7 7 5 5 4 4 2 0 0 7 7 9 9 7 5 5 4 4 2 2 0',
     '4 4 5 7 7 5 4 2 0 0 2 4 4 2 2 4 4 5 7 7 5 4 2 0 0 2 4 2 0 0',
     '4 4 4 4 4 4 4 7 0 2 4 5 5 5 5 5 4 4 4 4 2 2 4 2 7'];
    $('demo').onclick=function(){var n=SONGS[+$('song').value].split(' ').map(Number),L=[],t=0,i;for(i=0;i<n.length;i++){L.push({t:t,m:60+n[i],d:1});L.push({t:t+300,m:60+n[i],d:0});t+=380;}base=60;$('oc').value=1;build();seq(L);toast('Memainkan...');};
    build();
    })();
    </script>
    `;

    function buildPianoHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildPianoHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Piano Live — Piano 2 oktaf: suara, rekam & putar, lagu demo
const { buildPianoHtml } = require('../../lib/cards/piano')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'piano',
  alias: [],
  category: 'rich',
  desc: "Piano 2 oktaf: suara, rekam & putar, lagu demo",
  run: async ({ sock, m, pushname }) => {
    const html = buildPianoHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Piano Live', '🎹')
  },
}
    }

dioRegister("rich/pianolive", feature, libs)

let handler = (m, ctx) => dioRun("rich/pianolive", m, ctx)

handler.command = ['piano']
handler.help = ['piano']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'pianolive', { subs: false })
