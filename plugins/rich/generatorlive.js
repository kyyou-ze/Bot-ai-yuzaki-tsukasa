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
    "cards/generator": (module, exports, require) => {
    // Kartu HTML statis: GENERATOR LIVE — Generator password, palet warna, lempar dadu & koin
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .tabs{display:flex;gap:6px;margin-bottom:10px}.tabs .chip{flex:1;text-align:center}
    .out{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;font-family:ui-monospace,Menlo,monospace;font-size:16px;word-break:break-all;text-align:center;margin:8px 0;color:var(--acc);font-weight:700;user-select:all;-webkit-user-select:all}
    .opt{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.opt label{font-size:13px;display:flex;gap:5px;align-items:center}
    .sw{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0}
    .sw div{aspect-ratio:.7;border-radius:12px;display:flex;align-items:flex-end;justify-content:center;font-size:10px;font-weight:800;padding-bottom:6px;cursor:pointer;border:2px solid transparent;text-shadow:0 1px 2px #000a;color:#fff}
    .sw div.lk{border-color:#fff}
    .dice{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0}
    .d{width:62px;height:62px;border-radius:14px;background:#f8fafc;position:relative;box-shadow:inset 0 -4px 0 #cbd5e1}
    .d i{position:absolute;width:11px;height:11px;border-radius:50%;background:#111}
    .coin{width:110px;height:110px;border-radius:50%;margin:10px auto;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;background:radial-gradient(circle at 30% 30%,#fde68a,#d97706);color:#78350f;border:4px solid #b45309}
    .coin.fl{animation:fl .6s}@keyframes fl{50%{transform:rotateY(540deg) scale(1.15)}100%{transform:rotateY(1080deg)}}
    .tt{text-align:center;font-weight:800;min-height:22px;color:var(--acc)}
    .hide{display:none!important}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🎲</div><div class="meta"><div class="title">Generator Live</div><div class="sub" id="who"></div></div></div>
     <div class="tabs"><button class="chip on" data-t="p">Password</button><button class="chip" data-t="c">Palet</button><button class="chip" data-t="d">Dadu</button><button class="chip" data-t="k">Koin</button></div>
     <div id="p">
      <div class="out" id="po"></div>
      <div class="row"><span class="muted">Panjang</span><input type="range" id="pl" min="6" max="40" value="16" style="flex:1"><b id="plv">16</b></div>
      <div class="opt"><label><input type="checkbox" id="u" checked>A-Z</label><label><input type="checkbox" id="l" checked>a-z</label><label><input type="checkbox" id="n" checked>0-9</label><label><input type="checkbox" id="s" checked>Simbol</label></div>
      <div class="row"><div class="muted" id="pk" style="flex:1"></div></div>
      <div class="row" style="margin-top:6px"><button class="btn" style="flex:1" id="pg">Buat baru</button><button class="btn alt" style="flex:1" id="pc">Salin</button></div>
     </div>
     <div id="c" class="hide">
      <div class="sw" id="sw"></div>
      <div class="chips" id="hm"><button class="chip on" data-h="a">Analog</button><button class="chip" data-h="m">Mono</button><button class="chip" data-h="t">Triad</button><button class="chip" data-h="r">Acak</button></div>
      <div class="row" style="margin-top:8px"><button class="btn" style="flex:1" id="cg">Acak palet</button></div>
      <div class="muted" style="margin-top:6px">Tap warna untuk kunci/lepas kunci. Hex dapat disalin dari kotak teks.</div>
      <input class="inp" id="hx" readonly style="margin-top:6px">
     </div>
     <div id="d" class="hide">
      <div class="row"><span class="muted">Jumlah dadu</span><input type="range" id="dn" min="1" max="6" value="2" style="flex:1"><b id="dnv">2</b></div>
      <div class="dice" id="dv"></div><div class="tt" id="dt"></div>
      <button class="btn" style="width:100%" id="dg">Lempar dadu</button>
     </div>
     <div id="k" class="hide">
      <div class="coin" id="cn">?</div><div class="tt" id="kt">Lempar koinnya</div>
      <button class="btn" style="width:100%" id="kg">Lempar koin</button><div class="muted" id="ks" style="text-align:center;margin-top:8px"></div>
     </div>
     <div class="tt" id="toast"></div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    function rnd(n){var a=new Uint32Array(1);try{window.crypto.getRandomValues(a);}catch(e){a[0]=Math.floor(Math.random()*4294967296);}return a[0]%n;}
    function toast(s){$('toast').textContent=s;setTimeout(function(){$('toast').textContent=''},1600);}
    // tab
    [].forEach.call(document.querySelectorAll('.tabs .chip'),function(b){b.onclick=function(){[].forEach.call(document.querySelectorAll('.tabs .chip'),function(x){x.classList.toggle('on',x===b)});['p','c','d','k'].forEach(function(t){$(t).classList.toggle('hide',t!==b.dataset.t)});};});
    // password
    var SET={u:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',l:'abcdefghijklmnopqrstuvwxyz',n:'0123456789',s:'!@#$%^&*()-_=+[]{};:,.?'};
    function gp(){var pool='',req=[],k;for(k in SET)if($(k).checked){pool+=SET[k];req.push(SET[k]);}
     if(!pool){$('po').textContent='Pilih minimal satu jenis karakter';$('pk').textContent='';return;}
     var len=+$('pl').value,out=[],i;for(i=0;i<req.length&&i<len;i++)out.push(req[i][rnd(req[i].length)]);
     while(out.length<len)out.push(pool[rnd(pool.length)]);
     for(i=out.length-1;i>0;i--){var j=rnd(i+1),t=out[i];out[i]=out[j];out[j]=t;}
     $('po').textContent=out.join('');var bits=Math.round(len*Math.log(pool.length)/Math.LN2);
     $('pk').textContent='Kekuatan: '+(bits<45?'Lemah':bits<70?'Cukup':bits<100?'Kuat':'Sangat kuat')+' (~'+bits+' bit)';}
    $('pl').oninput=function(){$('plv').textContent=this.value;gp();};
    ['u','l','n','s'].forEach(function(k){$(k).onchange=gp;});$('pg').onclick=gp;
    $('pc').onclick=function(){var t=$('po').textContent;try{navigator.clipboard.writeText(t).then(function(){toast('Tersalin')},function(){sel()});}catch(e){sel();}function sel(){var r=document.createRange();r.selectNodeContents($('po'));var s=window.getSelection();s.removeAllRanges();s.addRange(r);toast('Teks dipilih, tekan salin');}};
    // palet
    var H='a',pal=[];
    function hsl(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;var k=function(n){return (n+h/30)%12},a=s*Math.min(l,1-l),f=function(n){return l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)))};
     var x=function(v){return ('0'+Math.round(v*255).toString(16)).slice(-2)};return '#'+x(f(0))+x(f(8))+x(f(4));}
    function dark(hex){var r=parseInt(hex.substr(1,2),16),g=parseInt(hex.substr(3,2),16),b=parseInt(hex.substr(5,2),16);return (r*299+g*587+b*114)/1000>150;}
    function gc(){var base=rnd(360),s=55+rnd(35),i,c=[];
     for(i=0;i<5;i++){var h,l=40+rnd(30),sa=s;
      if(H==='a')h=base+(i-2)*28;else if(H==='m'){h=base;l=22+i*13;}else if(H==='t')h=base+[0,120,240,0,120][i];else{h=rnd(360);}
      c.push(hsl(h,sa,l));}
     pal=pal.length?pal.map(function(p,i){return p.lock?p:{hex:c[i],lock:0}}):c.map(function(h){return {hex:h,lock:0}});rc();}
    function rc(){var sw=$('sw');sw.innerHTML='';pal.forEach(function(p,i){var d=document.createElement('div');d.style.background=p.hex;d.className=p.lock?'lk':'';d.textContent=p.hex.toUpperCase();if(dark(p.hex))d.style.color='#111',d.style.textShadow='none';d.onclick=function(){p.lock^=1;rc();};sw.appendChild(d);});$('hx').value=pal.map(function(p){return p.hex.toUpperCase()}).join(', ');}
    $('cg').onclick=gc;$('hm').onclick=function(e){var h=e.target.dataset&&e.target.dataset.h;if(!h)return;H=h;[].forEach.call($('hm').children,function(x){x.classList.toggle('on',x===e.target)});gc();};
    // dadu
    var PIPS={1:[[50,50]],2:[[28,28],[72,72]],3:[[28,28],[50,50],[72,72]],4:[[28,28],[72,28],[28,72],[72,72]],5:[[28,28],[72,28],[50,50],[28,72],[72,72]],6:[[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]]};
    function die(v){var d=document.createElement('div');d.className='d';PIPS[v].forEach(function(p){var i=document.createElement('i');i.style.left='calc('+p[0]+'% - 5.5px)';i.style.top='calc('+p[1]+'% - 5.5px)';d.appendChild(i);});return d;}
    function roll(){var n=+$('dn').value,v=[],t=0,i;for(i=0;i<n;i++){var x=1+rnd(6);v.push(x);t+=x;}$('dv').innerHTML='';v.forEach(function(x){$('dv').appendChild(die(x));});$('dt').textContent=n>1?'Total: '+t+'  ('+v.join(' + ')+')':'Hasil: '+t;}
    $('dn').oninput=function(){$('dnv').textContent=this.value;roll();};$('dg').onclick=roll;
    // koin
    var cs={h:0,t:0};
    $('kg').onclick=function(){var r=rnd(2)?'GAMBAR':'ANGKA';var c=$('cn');c.classList.remove('fl');void c.offsetWidth;c.classList.add('fl');setTimeout(function(){c.textContent=r==='GAMBAR'?'G':'A';$('kt').textContent=r;if(r==='GAMBAR')cs.h++;else cs.t++;$('ks').textContent='Gambar '+cs.h+' • Angka '+cs.t;},300);};
    gp();gc();roll();
    })();
    </script>
    `;

    function buildGeneratorHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildGeneratorHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Generator Live — Generator password, palet warna, lempar dadu & koin
const { buildGeneratorHtml } = require('../../lib/cards/generator')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'generator',
  alias: [],
  category: 'rich',
  desc: "Generator password, palet warna, lempar dadu & koin",
  run: async ({ sock, m, pushname }) => {
    const html = buildGeneratorHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Generator Live', '🎲')
  },
}
    }

dioRegister("rich/generatorlive", feature, libs)

let handler = (m, ctx) => dioRun("rich/generatorlive", m, ctx)

handler.command = ['generator']
handler.help = ['generator']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'generatorlive', { subs: false })
