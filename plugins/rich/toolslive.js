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
    "cards/tools": (module, exports, require) => {
    // Kartu HTML statis: TOOLS LIVE (kalkulator, timer/stopwatch, harga jual, diskon)
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .pane{display:none;}.pane.on{display:block;}
    .disp{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px;text-align:right;}
    .disp small{display:block;min-height:14px;color:var(--soft);font-size:11px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}
    .disp b{display:block;font-size:26px;font-weight:800;overflow:hidden;white-space:nowrap;}
    .pad{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
    .pad button{padding:13px 0;border-radius:10px;border:1px solid var(--line);background:var(--card2);color:var(--ink);font-size:16px;font-weight:700;}
    .pad .op{background:#2a3350;color:#9db4ff;}.pad .eq{background:var(--acc);color:#04130a;}.pad .cl{background:#3a2226;color:#ff8a8a;}
    .f{display:grid;gap:8px;margin-bottom:10px;}
    .f label{font-size:11px;color:var(--soft);display:block;margin-bottom:4px;}
    .res{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:13px;line-height:1.7;}
    .res b{color:var(--acc);}
    .big{font-size:38px;font-weight:900;text-align:center;letter-spacing:.02em;margin:10px 0;font-variant-numeric:tabular-nums;}
    .lap{max-height:90px;overflow:auto;font-size:11.5px;color:var(--soft);margin-top:8px;}
    </style>
    <div class="stage"><div class="app">
      <div class="top"><div class="logo">🧰</div><div class="meta"><div class="title">Tools Live</div><div class="sub" id="who"></div></div></div>
      <div class="chips" id="tabs"></div>
    
      <div class="pane on" id="p0">
        <div class="disp"><small id="ex"></small><b id="dv">0</b></div>
        <div class="pad" id="pad"></div>
      </div>
    
      <div class="pane" id="p1">
        <div class="row" style="margin-bottom:8px"><button class="chip on" id="m0">Timer</button><button class="chip" id="m1">Stopwatch</button></div>
        <div id="tim"><div class="row"><input class="inp" id="tmin" type="number" min="0" placeholder="Menit" value="5"><input class="inp" id="tsec" type="number" min="0" max="59" placeholder="Detik" value="0"></div></div>
        <div class="big" id="clk">00:00</div>
        <div class="row"><button class="btn" id="st" style="flex:1">Mulai</button><button class="btn alt" id="lp" style="flex:1">Reset</button></div>
        <div class="lap" id="lap"></div>
      </div>
    
      <div class="pane" id="p2">
        <div class="f"><div><label>Modal (Rp)</label><input class="inp" id="hm" type="number" inputmode="numeric" placeholder="15000"></div>
        <div><label>Target untung (%)</label><input class="inp" id="hu" type="number" inputmode="decimal" placeholder="30" value="30"></div>
        <div><label>Fee QRIS/e-wallet (%)</label><input class="inp" id="hf" type="number" inputmode="decimal" placeholder="0.7" value="0"></div></div>
        <div class="res" id="hr">Isi modal untuk melihat harga jual.</div>
      </div>
    
      <div class="pane" id="p3">
        <div class="f"><div><label>Harga normal (Rp)</label><input class="inp" id="dh" type="number" inputmode="numeric" placeholder="50000"></div>
        <div><label>Diskon (%)</label><input class="inp" id="dd" type="number" inputmode="decimal" placeholder="20"></div>
        <div><label>Jumlah beli</label><input class="inp" id="dq" type="number" min="1" value="1"></div></div>
        <div class="res" id="dr">Isi harga & diskon.</div>
      </div>
    </div></div>
    <script>
    (function(){
    var C=__CFG__;var $=function(i){return document.getElementById(i);};
    var rp=function(n){return 'Rp'+String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');};
    $('who').textContent='Untuk '+C.nama;
    var names=['Kalkulator','Timer','Harga Jual','Diskon'],cur=0;
    function tabs(){var h='';names.forEach(function(n,i){h+='<button class="chip'+(i===cur?' on':'')+'" data-i="'+i+'">'+n+'</button>';});$('tabs').innerHTML=h;
     var b=$('tabs').children;for(var j=0;j<b.length;j++){b[j].onclick=function(){cur=+this.getAttribute('data-i');for(var k=0;k<4;k++)$('p'+k).classList.toggle('on',k===cur);tabs();};}}
    tabs();
    
    /* ---- kalkulator (parser sendiri, tanpa eval) ---- */
    var expr='';
    var keys=['C','(',')','\u00F7','7','8','9','\u00D7','4','5','6','\u2212','1','2','3','+','0','.','\u232B','='];
    var cls={'C':'cl','\u00F7':'op','\u00D7':'op','\u2212':'op','+':'op','(':'op',')':'op','=':'eq'};
    function calc(s){var t=s.replace(/\u00F7/g,'/').replace(/\u00D7/g,'*').replace(/\u2212/g,'-');var p=0;
     function ws(){while(t[p]===' ')p++;}
     function num(){ws();var m=/^\d*\.?\d+/.exec(t.slice(p));if(!m)throw 0;p+=m[0].length;return parseFloat(m[0]);}
     function fac(){ws();if(t[p]==='-'){p++;return -fac();}if(t[p]==='('){p++;var v=expr2();ws();if(t[p]!==')')throw 0;p++;return v;}return num();}
     function term(){var v=fac();for(;;){ws();var c=t[p];if(c==='*'){p++;v*=fac();}else if(c==='/'){p++;var d=fac();if(d===0)throw 0;v/=d;}else return v;}}
     function expr2(){var v=term();for(;;){ws();var c=t[p];if(c==='+'){p++;v+=term();}else if(c==='-'){p++;v-=term();}else return v;}}
     var r=expr2();ws();if(p<t.length)throw 0;return r;}
    function fmt(v){if(!isFinite(v))return 'Error';var s=String(Math.round(v*1e10)/1e10);return s;}
    function show(){$('ex').textContent=expr;}
    var pad='';keys.forEach(function(k){pad+='<button class="'+(cls[k]||'')+'" data-k="'+k+'">'+k+'</button>';});$('pad').innerHTML=pad;
    var pb=$('pad').children;for(var i=0;i<pb.length;i++){pb[i].onclick=function(){var k=this.getAttribute('data-k');
     if(k==='C'){expr='';$('dv').textContent='0';}
     else if(k==='\u232B'){expr=expr.slice(0,-1);}
     else if(k==='='){try{var r=fmt(calc(expr));$('dv').textContent=r;expr=r==='Error'?'':r;}catch(e){$('dv').textContent='Error';expr='';}}
     else{expr+=k;try{$('dv').textContent=fmt(calc(expr.replace(/[+\u2212\u00D7\u00F7.(]+$/,'')||'0'));}catch(e){}}
     show();};}
    
    /* ---- timer / stopwatch ---- */
    var mode=0,run=false,iv=null,left=0,elapsed=0,t0=0,laps=[];
    function two(n){return (n<10?'0':'')+n;}
    function clock(ms){var s=Math.floor(ms/1000),m=Math.floor(s/60);return two(m)+':'+two(s%60)+(mode===1?'.'+two(Math.floor((ms%1000)/10)):'');}
    function paint(){$('clk').textContent=clock(mode===0?left:elapsed);}
    function setMode(m){mode=m;stop();$('m0').classList.toggle('on',m===0);$('m1').classList.toggle('on',m===1);$('tim').style.display=m===0?'block':'none';$('lp').textContent=m===0?'Reset':'Lap';$('lap').innerHTML='';laps=[];rst();}
    function rst(){stop();elapsed=0;left=(Math.max(0,+$('tmin').value||0)*60+Math.min(59,Math.max(0,+$('tsec').value||0)))*1000;paint();}
    function stop(){run=false;clearInterval(iv);$('st').textContent='Mulai';}
    function beep(){$('clk').textContent='00:00';$('clk').style.color='#ef4444';setTimeout(function(){$('clk').style.color='';},4000);}
    $('st').onclick=function(){if(run){stop();return;}if(mode===0&&left<=0)rst();if(mode===0&&left<=0)return;run=true;this.textContent='Jeda';t0=Date.now();var base=mode===0?left:elapsed;
     iv=setInterval(function(){var d=Date.now()-t0;if(mode===0){left=base-d;if(left<=0){left=0;stop();beep();return;}}else elapsed=base+d;paint();},50);};
    $('lp').onclick=function(){if(mode===0){rst();return;}if(!run&&elapsed===0)return;if(run){laps.push(clock(elapsed));$('lap').innerHTML=laps.map(function(l,i){return 'Lap '+(i+1)+': '+l;}).reverse().join('<br>');}else{rst();$('lap').innerHTML='';laps=[];}};
    $('m0').onclick=function(){setMode(0);};$('m1').onclick=function(){setMode(1);};
    $('tmin').oninput=$('tsec').oninput=function(){if(!run&&mode===0)rst();};
    rst();
    
    /* ---- harga jual ---- */
    function hj(){var m=+$('hm').value,u=+$('hu').value||0,f=+$('hf').value||0;if(!m){$('hr').textContent='Isi modal untuk melihat harga jual.';return;}
     var g=m*(1+u/100);if(f)g=g/(1-f/100);var j=Math.ceil(g/500)*500,fee=j*f/100,b=j-fee,l=b-m;
     $('hr').innerHTML='Modal: <b>'+rp(m)+'</b><br>Harga jual: <b>'+rp(j)+'</b>'+(f?'<br>Fee '+f+'%: '+rp(fee):'')+'<br>Bersih masuk: '+rp(b)+'<br>Laba: <b>'+rp(l)+'</b> ('+(l/m*100).toFixed(1)+'%)';}
    $('hm').oninput=$('hu').oninput=$('hf').oninput=hj;
    /* ---- diskon ---- */
    function dk(){var h=+$('dh').value,d=+$('dd').value||0,q=Math.max(1,+$('dq').value||1);if(!h){$('dr').textContent='Isi harga & diskon.';return;}
     var a=h*(1-d/100);$('dr').innerHTML='Harga setelah diskon: <b>'+rp(a)+'</b><br>Hemat per item: '+rp(h-a)+'<br>Total ('+q+'x): <b>'+rp(a*q)+'</b><br>Total hemat: '+rp((h-a)*q);}
    $('dh').oninput=$('dd').oninput=$('dq').oninput=dk;
    })();
    </script>
    `;

    function buildToolsHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildToolsHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Tools Live — Timer, stopwatch, harga jual, diskon
const { buildToolsHtml } = require('../../lib/cards/tools')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'tools',
  alias: [],
  category: 'rich',
  desc: "Timer, stopwatch, harga jual, diskon",
  run: async ({ sock, m, pushname }) => {
    const html = buildToolsHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Tools Live', '🧰')
  },
}
    }

dioRegister("rich/toolslive", feature, libs)

let handler = (m, ctx) => dioRun("rich/toolslive", m, ctx)

handler.command = ['tools']
handler.help = ['tools']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'toolslive', { subs: false })
