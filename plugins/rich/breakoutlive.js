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
    "cards/breakout": (module, exports, require) => {
    // Kartu HTML statis: BREAKOUT LIVE — Breakout: pecahkan bata, 3 nyawa, level makin sulit
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .cv{display:block;width:100%;background:#0b0f1f;border-radius:12px;border:1px solid var(--line);touch-action:none}
    .bar{display:flex;justify-content:space-between;margin:8px 0;gap:6px}
    .pill{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:800}.pill b{color:var(--acc)}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🧱</div><div class="meta"><div class="title">Breakout Live</div><div class="sub" id="who"></div></div></div>
     <canvas id="cv" class="cv" width="320" height="440"></canvas>
     <div class="bar"><span class="pill">Skor <b id="sc">0</b></span><span class="pill">Nyawa <b id="lf">3</b></span><span class="pill">Level <b id="lv">1</b></span><span class="pill">Rekor <b id="bs">0</b></span></div>
     <button class="btn alt" id="rs" style="width:100%">⟳ Ulang</button>
     <div class="muted" style="text-align:center;margin-top:6px">Geser jari / mouse untuk menggerakkan papan. Tap untuk meluncurkan bola.</div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var cv=$('cv'),c=cv.getContext('2d'),W=320,H=440,PW=64,PH=10;
    var best=0;try{best=+localStorage.getItem('pix_breakout')||0;}catch(e){}
    var px,ball,bricks,score,lives,lvl,state,keys={};
    var COLS=['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#a78bfa'];
    function build(){bricks=[];var rows=Math.min(8,4+lvl);for(var r=0;r<rows;r++)for(var i=0;i<8;i++)bricks.push({x:8+i*38,y:50+r*20,w:34,h:14,c:COLS[r%6],hp:r<2&&lvl>2?2:1});}
    function serve(){ball={x:px+PW/2,y:H-50,vx:0,vy:0,r:6};state=0;}
    function reset(){px=W/2-PW/2;score=0;lives=3;lvl=1;build();serve();ui();}
    function ui(){$('sc').textContent=score;$('lf').textContent=lives;$('lv').textContent=lvl;$('bs').textContent=best;}
    function launch(){if(state===0){var s=4.2+lvl*0.35,a=(Math.random()*0.8-0.4);ball.vx=s*Math.sin(a);ball.vy=-s*Math.cos(a);state=1;}else if(state===2){reset();}else if(state===3){lvl++;build();serve();ui();}}
    function move(clientX){var r=cv.getBoundingClientRect();px=Math.max(0,Math.min(W-PW,(clientX-r.left)*W/r.width-PW/2));if(state===0)ball.x=px+PW/2;}
    function over(){state=2;if(score>best){best=score;try{localStorage.setItem('pix_breakout',best);}catch(e){}}ui();}
    function step(){
     if(state===1){ball.x+=ball.vx;ball.y+=ball.vy;
      if(ball.x<ball.r){ball.x=ball.r;ball.vx*=-1;}if(ball.x>W-ball.r){ball.x=W-ball.r;ball.vx*=-1;}if(ball.y<ball.r){ball.y=ball.r;ball.vy*=-1;}
      if(ball.vy>0&&ball.y+ball.r>=H-28&&ball.y+ball.r<=H-28+PH+6&&ball.x>px-4&&ball.x<px+PW+4){var rel=(ball.x-(px+PW/2))/(PW/2),sp=Math.min(9,Math.hypot(ball.vx,ball.vy)*1.01);var an=rel*1.05;ball.vx=sp*Math.sin(an);ball.vy=-sp*Math.cos(an);ball.y=H-28-ball.r;}
      for(var i=bricks.length-1;i>=0;i--){var b=bricks[i];
       if(ball.x+ball.r>b.x&&ball.x-ball.r<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){
        var ox=Math.min(ball.x+ball.r-b.x,b.x+b.w-(ball.x-ball.r)),oy=Math.min(ball.y+ball.r-b.y,b.y+b.h-(ball.y-ball.r));
        if(ox<oy)ball.vx*=-1;else ball.vy*=-1;b.hp--;score+=10*lvl;if(b.hp<=0)bricks.splice(i,1);ui();break;}}
      if(!bricks.length)state=3;
      if(ball.y>H+10){lives--;ui();if(lives<=0)over();else serve();}}
     draw();requestAnimationFrame(step);}
    function draw(){
     c.fillStyle='#0b0f1f';c.fillRect(0,0,W,H);
     bricks.forEach(function(b){c.fillStyle=b.c;c.globalAlpha=b.hp>1?1:.85;c.fillRect(b.x,b.y,b.w,b.h);c.globalAlpha=1;c.fillStyle='rgba(255,255,255,.25)';c.fillRect(b.x,b.y,b.w,3);if(b.hp>1){c.strokeStyle='#fff';c.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);}});
     c.fillStyle='#e5e7eb';c.beginPath();c.roundRect?c.roundRect(px,H-28,PW,PH,5):c.rect(px,H-28,PW,PH);c.fill();
     c.fillStyle='#fde047';c.beginPath();c.arc(ball.x,ball.y,ball.r,0,7);c.fill();
     c.textAlign='center';c.fillStyle='#fff';c.font='bold 16px sans-serif';
     if(state===0)c.fillText('TAP UNTUK MELUNCURKAN',W/2,H/2+40);
     if(state===2){c.fillStyle='#000b';c.fillRect(30,160,260,110);c.fillStyle='#fff';c.font='bold 26px sans-serif';c.fillText('GAME OVER',W/2,205);c.font='15px sans-serif';c.fillText('Skor '+score+' • tap untuk ulang',W/2,238);}
     if(state===3){c.fillStyle='#000b';c.fillRect(30,160,260,110);c.fillStyle='#4ade80';c.font='bold 24px sans-serif';c.fillText('LEVEL '+lvl+' SELESAI',W/2,205);c.fillStyle='#fff';c.font='15px sans-serif';c.fillText('Tap untuk lanjut',W/2,238);}
    }
    cv.addEventListener('pointermove',function(e){move(e.clientX);});
    cv.addEventListener('pointerdown',function(e){e.preventDefault();move(e.clientX);launch();});
    $('rs').onclick=reset;
    document.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'){px=Math.max(0,px-22);if(state===0)ball.x=px+PW/2;}else if(e.key==='ArrowRight'){px=Math.min(W-PW,px+22);if(state===0)ball.x=px+PW/2;}else if(e.key===' '){e.preventDefault();launch();}});
    reset();step();
    })();
    </script>
    `;

    function buildBreakoutHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildBreakoutHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Breakout Live — Breakout: pecahkan bata, 3 nyawa, level makin sulit
const { buildBreakoutHtml } = require('../../lib/cards/breakout')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'breakout',
  alias: [],
  category: 'rich',
  desc: "Breakout: pecahkan bata, 3 nyawa, level makin sulit",
  run: async ({ sock, m, pushname }) => {
    const html = buildBreakoutHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Breakout Live', '🧱')
  },
}
    }

dioRegister("rich/breakoutlive", feature, libs)

let handler = (m, ctx) => dioRun("rich/breakoutlive", m, ctx)

handler.command = ['breakout']
handler.help = ['breakout']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'breakoutlive', { subs: false })
