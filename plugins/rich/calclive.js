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
    "cards/kalkulator": (module, exports, require) => {
    // Kartu HTML statis: KALKULATOR LIVE (dasar + sains, hasil langsung saat mengetik, memori, riwayat, salin)
    // Evaluator buatan sendiri (tanpa eval). Semua jalan di dalam kartu, tanpa fetch.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .disp{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:8px;}
    .dtop{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--soft);min-height:16px;}
    .dtop b{color:var(--acc);margin-right:8px;}
    .ex{text-align:right;font-size:15px;color:var(--soft);white-space:nowrap;overflow-x:auto;scrollbar-width:none;min-height:22px;margin-top:2px;}
    .ex::-webkit-scrollbar{display:none;}
    .rs{text-align:right;font-size:32px;font-weight:800;white-space:nowrap;overflow-x:auto;scrollbar-width:none;min-height:42px;line-height:42px;}
    .rs::-webkit-scrollbar{display:none;}
    .rs.err{color:var(--red);font-size:16px;}
    .cp{border:0;background:none;color:var(--soft);font-size:15px;cursor:pointer;padding:0 2px;}
    .pad{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px;}
    .pad button{padding:13px 0;border-radius:11px;border:1px solid var(--line);background:var(--card2);color:var(--ink);font-size:17px;font-weight:700;cursor:pointer;user-select:none;-webkit-user-select:none;}
    .pad button:active{transform:scale(.95);filter:brightness(1.25);}
    .pad .op{background:#2a3350;color:#9db4ff;}
    .pad .fn{background:#1d222c;color:#c5cbd8;font-size:13.5px;}
    .pad .cl{background:#3a2226;color:#ff8a8a;}
    .pad .eq{background:var(--acc);color:#04130a;grid-column:1/-1;font-size:20px;}
    .pad .mm{background:#262033;color:#d3b8ff;font-size:12.5px;}
    .hs{max-height:300px;overflow:auto;display:grid;gap:6px;}
    .hi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 10px;cursor:pointer;}
    .hi small{display:block;color:var(--soft);font-size:11px;word-break:break-all;}
    .hi b{display:block;font-size:16px;margin-top:2px;word-break:break-all;}
    .toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#000c;color:#fff;padding:8px 14px;border-radius:20px;font-size:12px;opacity:0;transition:opacity .2s;pointer-events:none;}
    .toast.on{opacity:1;}
    </style>
    <div class="stage"><div class="app">
      <div class="top"><div class="logo">🧮</div><div class="meta"><div class="title">Kalkulator Live</div><div class="sub" id="who"></div></div></div>
      <div class="disp">
        <div class="dtop"><span><b id="mi"></b><span id="am">DEG</span></span><button class="cp" id="cp" title="Salin hasil">📋</button></div>
        <div class="ex" id="ex"></div>
        <div class="rs" id="rs">0</div>
      </div>
      <div class="chips" id="tabs"></div>
      <div id="sci" style="display:none"><div class="pad" id="padS"></div></div>
      <div id="bas"><div class="pad" id="padB"></div></div>
      <div id="his" style="display:none"><div class="hs" id="hl"></div><div class="row" style="margin-top:8px"><button class="btn red" id="hc" style="flex:1">Hapus Riwayat</button></div></div>
      <div class="toast" id="ts"></div>
    </div></div>
    <script>
    (function(){
    var C=__CFG__;var $=function(i){return document.getElementById(i);};
    /*CORE*/
    function tokenize(str){
      var s=str.replace(/\s/g,'').replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'pi').replace(/√/g,'sqrt').replace(/Ans/g,'ans');
      var t=[],i=0,m;
      while(i<s.length){
        var r=s.slice(i);
        if((m=/^(\d+\.?\d*|\.\d+)/.exec(r))){t.push({k:'n',v:parseFloat(m[1])});i+=m[1].length;}
        else if((m=/^[a-z]+/.exec(r))){t.push({k:'i',v:m[0]});i+=m[0].length;}
        else if('+-*/^%!()'.indexOf(s[i])>=0){t.push({k:'o',v:s[i]});i++;}
        else throw new Error('x');
      }
      return t;
    }
    var FN={sin:1,cos:1,tan:1,asin:1,acos:1,atan:1,log:1,ln:1,sqrt:1,abs:1};
    function calc(str,deg,ans){
      var t=tokenize(str),p=0;
      if(!t.length)throw new Error('kosong');
      function pk(){return t[p];}
      function isO(v){return t[p]&&t[p].k==='o'&&t[p].v===v;}
      function expr(){
        var l=term().v;
        while(isO('+')||isO('-')){
          var op=t[p++].v,r=term();
          var rv=r.p?l*r.v:r.v;
          l=op==='+'?l+rv:l-rv;
        }
        return l;
      }
      function startsFactor(){var x=pk();return x&&(x.k==='n'||x.k==='i'||(x.k==='o'&&x.v==='('));}
      function term(){
        var a=unary(),multi=false;
        for(;;){
          if(isO('*')||isO('/')){var op=t[p++].v,b=unary();a={v:op==='*'?a.v*b.v:a.v/b.v,p:false};multi=true;}
          else if(startsFactor()){var c=unary();a={v:a.v*c.v,p:false};multi=true;}
          else break;
        }
        return a;
      }
      function unary(){
        if(isO('-')){p++;var u=unary();return {v:-u.v,p:u.p};}
        if(isO('+')){p++;return unary();}
        return power();
      }
      function power(){
        var b=postfix();
        if(isO('^')){p++;var e=unary();return {v:Math.pow(b.v,e.v),p:false};}
        return b;
      }
      function postfix(){
        var a=primary(),pc=false;
        for(;;){
          if(isO('!')){p++;var n=a.v;if(n<0||n!==Math.floor(n)||n>170)throw new Error('fak');var f=1;for(var i=2;i<=n;i++)f*=i;a={v:f};pc=false;}
          else if(isO('%')){p++;a={v:a.v/100};pc=true;}
          else break;
        }
        return {v:a.v,p:pc};
      }
      function primary(){
        var x=t[p++];
        if(!x)throw new Error('akhir');
        if(x.k==='n')return {v:x.v};
        if(x.k==='o'&&x.v==='('){var v=expr();if(isO(')'))p++;else throw new Error('kurung');return {v:v};}
        if(x.k==='i'){
          if(x.v==='pi')return {v:Math.PI};
          if(x.v==='e')return {v:Math.E};
          if(x.v==='ans')return {v:ans||0};
          if(FN[x.v]){
            if(!isO('('))throw new Error('fungsi');
            p++;var a=expr();if(isO(')'))p++;else throw new Error('kurung');
            var d=deg?Math.PI/180:1,r;
            switch(x.v){
              case 'sin':r=Math.sin(a*d);break;case 'cos':r=Math.cos(a*d);break;case 'tan':r=Math.tan(a*d);break;
              case 'asin':r=Math.asin(a)/d;break;case 'acos':r=Math.acos(a)/d;break;case 'atan':r=Math.atan(a)/d;break;
              case 'log':r=Math.log10(a);break;case 'ln':r=Math.log(a);break;case 'sqrt':r=Math.sqrt(a);break;default:r=Math.abs(a);
            }
            return {v:r};
          }
        }
        throw new Error('token');
      }
      var res=expr();
      if(p<t.length)throw new Error('sisa');
      if(!isFinite(res))throw new Error(isNaN(res)?'nan':'inf');
      res=parseFloat(res.toPrecision(12));
      if(Math.abs(res)<1e-13)res=0;
      return res;
    }
    function fmt(n){
      var a=Math.abs(n);
      if(a>=1e15||(a<1e-6&&a!==0)){var e=n.toExponential(6).split('e'),m=e[0];if(m.indexOf('.')>=0)m=m.replace(/0+$/,'').replace(/\.$/,'');return m.replace('.',',')+'E'+(+e[1]);}
      var s=String(parseFloat(n.toPrecision(12))).split('.'),ip=s[0],neg='';
      if(ip[0]==='-'){neg='-';ip=ip.slice(1);}
      ip=ip.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
      return neg+ip+(s[1]?','+s[1]:'');
    }
    function plain(n){
      var v=parseFloat(n.toPrecision(12)),a=Math.abs(v);
      if(a>=1e15||(a<1e-6&&a!==0)){var e=v.toExponential(6).split('e'),m=e[0];if(m.indexOf('.')>=0)m=m.replace(/0+$/,'').replace(/\.$/,'');return m.replace('.',',')+'×10^('+(+e[1])+')';}
      return String(v).replace('.',',');
    }
    /*ENDCORE*/
    var K='kalklive_v1',S={h:[],mem:0,deg:true},ex='',ans=0,fresh=false,lastE='';
    try{var raw=localStorage.getItem(K);if(raw){var o=JSON.parse(raw);if(o&&o.h)S=o;}}catch(e){}
    function save(){try{localStorage.setItem(K,JSON.stringify(S));}catch(e){}}
    function toast(m){var t=$('ts');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(function(){t.classList.remove('on');},1500);}
    $('who').textContent='Halo, '+C.nama;
    
    /* tombol */
    var BAS=[['AC','cl'],['⌫','cl'],['(','op'],[')','op'],['7'],['8'],['9'],['÷','op'],['4'],['5'],['6'],['×','op'],['1'],['2'],['3'],['−','op'],['0'],[',',''],['%','op'],['+','op'],['=','eq']];
    var SCI=[['DEG','mm'],['sin','fn'],['cos','fn'],['tan','fn'],['π','fn'],['e','fn'],['log','fn'],['ln','fn'],['√','fn'],['x²','fn'],['^','fn'],['n!','fn'],['MC','mm'],['MR','mm'],['M+','mm'],['M−','mm'],['Ans','fn'],['asin','fn'],['acos','fn'],['atan','fn']];
    function mk(a){return a.map(function(b){return '<button class="'+(b[1]||'')+'" data-k="'+b[0]+'">'+b[0]+'</button>';}).join('');}
    $('padB').innerHTML=mk(BAS);$('padS').innerHTML=mk(SCI);
    
    function ac(s){var o=0;for(var i=0;i<s.length;i++){if(s[i]==='(')o++;else if(s[i]===')')o--;}var r=s;while(o-->0)r+=')';return r;}
    function cur(){var s=ex.replace(/[+−×÷^(]$/,'');if(!s)return null;try{return calc(ac(s),S.deg,ans);}catch(e){return null;}}
    function paint(err){
      var r=$('rs');r.className='rs';
      if(fresh&&!err){$('ex').textContent=lastE+' =';r.textContent=fmt(ans);}
      else{
        $('ex').textContent=ex;
        if(err){r.textContent=err;r.className='rs err';}
        else{var v=cur();r.textContent=v===null?(ex?'':'0'):fmt(v);if(v!==null&&/^[\d,]+$/.test(ex)&&plain(v)===ex)r.textContent=ex;}
      }
      $('ex').scrollLeft=1e6;r.scrollLeft=1e6;
      $('mi').textContent=S.mem?'M ':'';$('am').textContent=S.deg?'DEG':'RAD';
      if($('padS').firstChild)$('padS').firstChild.textContent=S.deg?'DEG':'RAD';
    }
    function add(s){
      if(fresh){if(/^[\d,πe(]|^[a-zA-Z√]/.test(s)&&!/^[+−×÷^%!]/.test(s))ex='';fresh=false;}
      ex+=s;paint();
    }
    function back(){fresh=false;ex=ex.replace(/(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|log\(|ln\(|√\(|Ans|.)$/,'');paint();}
    function sameOp(s){ // ganti operator terakhir bila menumpuk
      if(/[+−×÷^]$/.test(ex)&&/^[+×÷^]$/.test(s)){ex=ex.slice(0,-1);}
    }
    function equal(){
      if(!ex)return;
      var s=ac(ex.replace(/[+−×÷^]$/,''));
      try{var v=calc(s,S.deg,ans);
        S.h.unshift({e:ex,r:fmt(v),p:plain(v)});if(S.h.length>40)S.h.pop();save();
        lastE=ex;ans=v;ex=plain(v);fresh=true;paint();hist();
      }catch(e){paint(e.message==='inf'?'Tidak bisa dibagi nol':'Format salah');}
    }
    function memVal(){var v=cur();return v===null?(fresh?ans:null):v;}
    function press(k){
      if(k==='AC'){ex='';fresh=false;paint();return;}
      if(k==='⌫'){back();return;}
      if(k==='='){equal();return;}
      if(k==='DEG'||k==='RAD'){S.deg=!S.deg;save();paint();return;}
      if(k==='MC'){S.mem=0;save();paint();toast('Memori dihapus');return;}
      if(k==='MR'){add(plain(S.mem));return;}
      if(k==='M+'||k==='M−'){var v=memVal();if(v===null){toast('Hitung dulu angkanya');return;}S.mem=parseFloat((S.mem+(k==='M+'?v:-v)).toPrecision(12));save();paint();toast('Memori: '+fmt(S.mem));return;}
      if(k==='x²'){add('^2');return;}
      if(k==='n!'){add('!');return;}
      if(k==='sin'||k==='cos'||k==='tan'||k==='asin'||k==='acos'||k==='atan'||k==='log'||k==='ln'||k==='√'){add(k+'(');return;}
      if(/^[+×÷^]$/.test(k)||k==='−'){sameOp(k);}
      add(k);
    }
    function wire(id){$(id).onclick=function(e){var k=e.target.getAttribute('data-k');if(k!==null)press(k);};}
    wire('padB');wire('padS');
    
    /* tab */
    var TB=['Dasar','Sains','Riwayat'];
    $('tabs').innerHTML=TB.map(function(n,i){return '<button class="chip'+(i?'':' on')+'" data-i="'+i+'">'+n+'</button>';}).join('');
    $('tabs').onclick=function(e){var i=e.target.getAttribute('data-i');if(i===null)return;i=+i;
      var b=$('tabs').children;for(var k=0;k<b.length;k++)b[k].classList.toggle('on',k===i);
      $('sci').style.display=i===1?'block':'none';$('bas').style.display=i===2?'none':'block';$('his').style.display=i===2?'block':'none';if(i===2)hist();};
    
    /* riwayat */
    function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
    function hist(){
      $('hl').innerHTML=S.h.length?S.h.map(function(h,i){return '<div class="hi" data-i="'+i+'"><small>'+esc(h.e)+' =</small><b>'+esc(h.r)+'</b></div>';}).join(''):'<div class="muted" style="text-align:center;padding:16px">Belum ada riwayat</div>';
    }
    $('hl').onclick=function(e){var n=e.target;while(n&&n!==this&&!n.getAttribute('data-i'))n=n.parentNode;if(!n||n===this)return;
      var h=S.h[+n.getAttribute('data-i')];if(!h)return;ex=h.p;ans=cur()||0;fresh=true;
      $('tabs').onclick({target:$('tabs').children[0]});lastE=h.e;paint();toast('Hasil dimuat');};
    $('hc').onclick=function(){S.h=[];save();hist();toast('Riwayat dihapus');};
    
    /* salin */
    $('cp').onclick=function(){
      var v=cur();if(v===null&&fresh)v=ans;if(v===null){toast('Belum ada hasil');return;}
      var t=plain(v).replace(',','.');
      function fb(){var a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();var ok=false;try{ok=document.execCommand('copy');}catch(e){}document.body.removeChild(a);toast(ok?'Disalin: '+t:'Tahan angka hasil untuk menyalin');}
      try{navigator.clipboard.writeText(t).then(function(){toast('Disalin: '+t);},fb);}catch(e){fb();}
    };
    
    /* keyboard */
    document.addEventListener('keydown',function(e){
      var k=e.key,m={'*':'×','/':'÷','-':'−','.':',',Enter:'=','=':'=',Backspace:'⌫',Escape:'AC',Delete:'AC'};
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      if(/^[0-9]$/.test(k)||k==='+'||k==='('||k===')'||k==='%'||k==='^'||k==='!'||k===','){e.preventDefault();press(k);}
      else if(m[k]){e.preventDefault();press(m[k]);}
    });
    paint();hist();
    })();
    </script>
    `;

    function buildKalkulatorHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildKalkulatorHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Kalkulator Live — Kalkulator dasar & sains, hasil langsung, memori, riwayat
const { buildKalkulatorHtml } = require('../../lib/cards/kalkulator')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'calcx',
  alias: [],
  category: 'rich',
  desc: "Kalkulator dasar & sains, hasil langsung, memori, riwayat",
  run: async ({ sock, m, pushname }) => {
    const html = buildKalkulatorHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Kalkulator Live', '🧮')
  },
}
    }

dioRegister("rich/calclive", feature, libs)

let handler = (m, ctx) => dioRun("rich/calclive", m, ctx)

handler.command = ['calcx']
handler.help = ['calcx']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'calclive', { subs: false })
