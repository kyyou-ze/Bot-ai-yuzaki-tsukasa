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
    "cards/pomo": (module, exports, require) => {
    // Kartu HTML statis: POMODORO LIVE (timer fokus/istirahat, cincin progres, penghitung sesi, fokus hari ini). Tanpa jaringan.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .ring{position:relative;width:200px;height:200px;margin:6px auto 10px}
    .ring svg{width:200px;height:200px;transform:rotate(-90deg)}
    .ring .bg{fill:none;stroke:#ffffff14;stroke-width:12}
    .ring .fg{fill:none;stroke:var(--acc);stroke-width:12;stroke-linecap:round;transition:stroke-dashoffset .5s linear,stroke .3s}
    .ring .mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .big{font-size:44px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:1px}
    .ph{font-size:12px;font-weight:800;color:var(--soft);letter-spacing:2px;text-transform:uppercase}
    .modes{display:flex;gap:6px;margin-bottom:8px}.modes .chip{flex:1;text-align:center}
    .ctl{display:flex;gap:8px;justify-content:center;margin:6px 0 10px}.ctl .btn{min-width:92px}
    .dots{display:flex;gap:7px;justify-content:center;margin:2px 0 10px}
    .dots i{width:12px;height:12px;border-radius:50%;background:#ffffff1c;border:1px solid #ffffff26}.dots i.on{background:var(--acc);border-color:var(--acc)}
    .st{display:flex;gap:8px}.st .box{flex:1;text-align:center}.st b{display:block;font-size:20px}
    .brk .fg{stroke:#38bdf8}
    </style>
    <div class="stage"><div class="app" id="app">
     <div class="top"><div class="logo"> </div><div class="meta"><div class="title">Pomodoro Live</div><div class="sub" id="who"></div></div></div>
     <div class="modes"><button class="chip on" data-m="25,5">25 / 5</button><button class="chip" data-m="50,10">50 / 10</button><button class="chip" data-m="15,3">15 / 3</button></div>
     <div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" id="fg" cx="50" cy="50" r="44" stroke-dasharray="276.46" stroke-dashoffset="0"/></svg>
      <div class="mid"><div class="big" id="t">25:00</div><div class="ph" id="ph">Fokus</div></div></div>
     <div class="dots" id="dots"><i></i><i></i><i></i><i></i></div>
     <div class="ctl"><button class="btn" id="go">▶ Mulai</button><button class="btn alt" id="rs">↺ Reset</button><button class="btn alt" id="sk">⏭ Lewati</button></div>
     <input class="inp" id="tk" placeholder="Sedang fokus ke apa? (opsional)" maxlength="60" style="margin-bottom:10px">
     <div class="st"><div class="box"><b id="n1">0</b><span class="muted">sesi selesai</span></div><div class="box"><b id="n2">0</b><span class="muted">menit fokus</span></div></div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__,$=function(i){return document.getElementById(i)};
    $('who').textContent='Untuk: '+CFG.nama;
    var F=25*60,B=5*60,phase='f',left=F,total=F,run=false,iv=null,done=0,mins=0,cyc=0,C=2*Math.PI*44;
    function fmt(s){return ('0'+Math.floor(s/60)).slice(-2)+':'+('0'+(s%60)).slice(-2)}
    function beep(){try{var a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.frequency.value=880;g.gain.value=.15;o.start();setTimeout(function(){o.stop()},350)}catch(e){}}
    function draw(){
     $('t').textContent=fmt(left);$('ph').textContent=phase==='f'?'Fokus':'Istirahat';
     $('fg').style.strokeDashoffset=String(C*(1-left/total));$('app').classList.toggle('brk',phase==='b');
     var d=$('dots').children;for(var i=0;i<4;i++)d[i].className=i<cyc?'on':'';
     $('go').textContent=run?'⏸ Jeda':'▶ Mulai';$('n1').textContent=done;$('n2').textContent=mins;
     document.title=fmt(left)+' • '+(phase==='f'?'Fokus':'Istirahat');
    }
    function tick(){
     left--;
     if(left<=0){beep();
      if(phase==='f'){done++;mins+=Math.round(F/60);cyc=Math.min(4,cyc+1);phase='b';total=left=B}
      else{phase='f';total=left=F;if(cyc>=4)cyc=0}
     }
     draw();
    }
    function setRun(v){run=v;clearInterval(iv);if(v)iv=setInterval(tick,1000);draw()}
    $('go').onclick=function(){setRun(!run)};
    $('rs').onclick=function(){setRun(false);phase='f';total=left=F;cyc=0;draw()};
    $('sk').onclick=function(){var was=run;setRun(false);if(phase==='f'){phase='b';total=left=B}else{phase='f';total=left=F}draw();if(was)setRun(true)};
    Array.prototype.forEach.call(document.querySelectorAll('.chip'),function(c){c.onclick=function(){
     Array.prototype.forEach.call(document.querySelectorAll('.chip'),function(x){x.classList.remove('on')});c.classList.add('on');
     var p=c.dataset.m.split(',');F=+p[0]*60;B=+p[1]*60;setRun(false);phase='f';total=left=F;cyc=0;draw()}});
    draw();
    })();
    </script>
    `;

    function buildPomoHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }
    module.exports = { buildPomoHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Pomodoro Live — timer fokus/istirahat dengan cincin progres, penghitung sesi, dan bunyi alarm
const { buildPomoHtml } = require('../../lib/cards/pomo')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'pomox',
  alias: [],
  category: 'rich',
  desc: 'Pomodoro: timer fokus & istirahat dengan cincin progres dan hitungan sesi',
  run: async ({ sock, m, pushname }) => {
    const html = buildPomoHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Pomodoro Live', '')
  },
}
    }

dioRegister("rich/pomolive", feature, libs)

let handler = (m, ctx) => dioRun("rich/pomolive", m, ctx)

handler.command = ['pomox']
handler.help = ['pomox']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'pomolive', { subs: false })
