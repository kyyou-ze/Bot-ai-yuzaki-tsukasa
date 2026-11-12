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
    "cards/flappy": (module, exports, require) => {
    // Kartu HTML statis: FLAPPY LIVE (Game Flappy Bird: tap untuk lompat, hindari pipa, skor terbaik tersimpan)
    // Semua jalan di dalam kartu, tanpa fetch. By PIX.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .cv{display:block;width:100%;border-radius:12px;border:1px solid var(--line);background:#70c5ce;touch-action:none;cursor:pointer}
    .bar{display:flex;justify-content:space-between;align-items:center;margin:8px 0}
    .pill{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:800}
    .pill b{color:var(--acc)}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🐤</div><div class="meta"><div class="title">Flappy Live</div><div class="sub" id="who"></div></div></div>
     <canvas id="cv" class="cv" width="320" height="440"></canvas>
     <div class="bar"><span class="pill">Skor <b id="sc">0</b></span><span class="pill">Terbaik <b id="bs">0</b></span><button class="btn alt" id="rs">⟳ Ulang</button></div>
     <div class="muted" style="text-align:center">Tap layar / spasi untuk lompat. Lewati pipa sebanyak mungkin!</div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var cv=document.getElementById('cv'),c=cv.getContext('2d'),W=320,H=440,G=0.42,J=-6.6,GAP=118,SP=2.3;
    var best=0;try{best=+localStorage.getItem('pix_flappy')||0;}catch(e){}
    var b,pipes,score,state,t,gx;
    function reset(){b={x:80,y:200,v:0};pipes=[];score=0;state=0;t=0;gx=0;document.getElementById('sc').textContent=0;document.getElementById('bs').textContent=best;}
    function flap(){if(state===2){reset();return;}if(state===0)state=1;b.v=J;}
    function add(){var top=50+Math.random()*(H-GAP-140);pipes.push({x:W+10,t:top,p:false});}
    function loop(){
     if(state===1){t++;b.v+=G;b.y+=b.v;if(t%88===1)add();
      for(var i=0;i<pipes.length;i++){var p=pipes[i];p.x-=SP;
       if(!p.p&&p.x+46<b.x){p.p=true;score++;document.getElementById('sc').textContent=score;}
       if(b.x+11>p.x&&b.x-11<p.x+46&&(b.y-11<p.t||b.y+11>p.t+GAP))die();}
      if(pipes.length&&pipes[0].x<-60)pipes.shift();
      if(b.y>H-40||b.y<-10)die();gx=(gx+SP)%24;}
     else if(state===0){b.y=200+Math.sin(Date.now()/250)*8;}
     draw();requestAnimationFrame(loop);}
    function die(){if(state!==1)return;state=2;if(score>best){best=score;try{localStorage.setItem('pix_flappy',best);}catch(e){}}document.getElementById('bs').textContent=best;}
    function draw(){
     var g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#4ec0ca');g.addColorStop(1,'#a8e6ef');c.fillStyle=g;c.fillRect(0,0,W,H);
     for(var i=0;i<pipes.length;i++){var p=pipes[i];c.fillStyle='#4caf50';c.fillRect(p.x,0,46,p.t);c.fillRect(p.x,p.t+GAP,46,H);c.fillStyle='#2e7d32';c.fillRect(p.x-3,p.t-18,52,18);c.fillRect(p.x-3,p.t+GAP,52,18);}
     c.fillStyle='#d9c27a';c.fillRect(0,H-40,W,40);c.fillStyle='#7cb342';c.fillRect(0,H-40,W,8);
     c.fillStyle='#b89f55';for(var x=-gx;x<W;x+=24)c.fillRect(x,H-22,12,4);
     c.save();c.translate(b.x,b.y);c.rotate(Math.max(-0.5,Math.min(1.1,b.v/10)));
     c.fillStyle='#ffd23f';c.beginPath();c.arc(0,0,12,0,7);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(5,-4,4.5,0,7);c.fill();c.fillStyle='#000';c.beginPath();c.arc(6.5,-4,2,0,7);c.fill();
     c.fillStyle='#ff7043';c.beginPath();c.moveTo(10,2);c.lineTo(20,5);c.lineTo(10,9);c.fill();c.fillStyle='#f5b800';c.beginPath();c.ellipse(-4,3,6,4,0,0,7);c.fill();c.restore();
     c.textAlign='center';c.fillStyle='#fff';c.strokeStyle='#0008';c.lineWidth=4;c.font='bold 38px sans-serif';
     if(state>0){c.strokeText(score,W/2,70);c.fillText(score,W/2,70);}
     if(state===0){c.font='bold 18px sans-serif';c.strokeText('TAP UNTUK MULAI',W/2,H/2+60);c.fillText('TAP UNTUK MULAI',W/2,H/2+60);}
     if(state===2){c.fillStyle='#000a';c.fillRect(40,150,240,130);c.fillStyle='#fff';c.font='bold 26px sans-serif';c.fillText('GAME OVER',W/2,195);c.font='16px sans-serif';c.fillText('Skor '+score+'  •  Terbaik '+best,W/2,225);c.fillText(score>=20?'🏆 Emas':score>=10?'🥈 Perak':score>=5?'🥉 Perunggu':'Coba lagi!',W/2,253);}
    }
    cv.addEventListener('pointerdown',function(e){e.preventDefault();flap();});
    document.addEventListener('keydown',function(e){if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();flap();}});
    document.getElementById('rs').onclick=reset;
    reset();loop();
    })();
    </script>
    `;

    function buildFlappyHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildFlappyHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Flappy Live — Flappy Bird: tap untuk lompat, skor terbaik tersimpan
const { buildFlappyHtml } = require('../../lib/cards/flappy')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'flappy',
  alias: [],
  category: 'rich',
  desc: "Flappy Bird: tap untuk lompat, skor terbaik tersimpan",
  run: async ({ sock, m, pushname }) => {
    const html = buildFlappyHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Flappy Live', '🐤')
  },
}
    }

dioRegister("rich/flappylive", feature, libs)

let handler = (m, ctx) => dioRun("rich/flappylive", m, ctx)

handler.command = ['flappy']
handler.help = ['flappy']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'flappylive', { subs: false })
