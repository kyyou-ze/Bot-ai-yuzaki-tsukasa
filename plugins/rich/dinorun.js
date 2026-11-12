/**

* Kaguya Multi Device — WhatsApp & Tele Bot
* 
* Library      : whiskeysockets baileys
* Type         : Plugins | ESM Modules
* Creator      : YannRzy Tech
* Recode       : (Your Name)
* 
* Official Channels:
* • https://whatsapp.com/channel/0029VaoMGuLA89MbfGh62V16
* 
* Copyright © YannRzy Tech 2026
* All Rights Reserved.
  */


import { dioRun, dioRegister } from '../../lib/engine/plugins.js'

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
    "cards/dino": (module, exports, require) => {
    // Kartu HTML statis: DINO RUN LIVE — Dino Run: lompati kaktus dan burung, makin lama makin cepat
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .cv{display:block;width:100%;background:#f7f7f7;border-radius:12px;border:1px solid var(--line);touch-action:none;cursor:pointer}
    .bar{display:flex;justify-content:space-between;margin:8px 0}
    .pill{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:800}.pill b{color:var(--acc)}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🦖</div><div class="meta"><div class="title">Dino Run Live</div><div class="sub" id="who"></div></div></div>
     <canvas id="cv" class="cv" width="480" height="180"></canvas>
     <div class="bar"><span class="pill">Skor <b id="sc">0</b></span><span class="pill">Rekor <b id="bs">0</b></span><button class="btn alt" id="rs">⟳ Ulang</button></div>
     <div class="muted" style="text-align:center">Tap layar / spasi untuk lompat. Hindari kaktus dan burung!</div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var cv=$('cv'),c=cv.getContext('2d'),W=480,H=180,GY=150;
    var best=0;try{best=+localStorage.getItem('pix_dino')||0;}catch(e){}
    var d,obs,score,sp,state,fr,cl,gx;
    function reset(){d={y:GY-30,v:0,on:true};obs=[];score=0;sp=5.2;state=0;fr=0;gx=0;cl=[{x:120,y:40},{x:330,y:28},{x:440,y:55}];$('sc').textContent=0;$('bs').textContent=best;}
    function jump(){if(state===2){reset();return;}if(state===0)state=1;if(d.on){d.v=-11.2;d.on=false;}}
    function spawn(){var bird=score>300&&Math.random()<0.3;
     if(bird)obs.push({x:W+10,y:GY-52-(Math.random()<.5?0:22),w:30,h:18,b:1});
     else{var n=Math.random()<.35?2:1,h=26+Math.floor(Math.random()*18);obs.push({x:W+10,y:GY-h,w:14*n+4,h:h,n:n});}}
    function step(){
     fr++;
     if(state===1){score+=sp/10;sp=Math.min(11,sp+0.0016);gx=(gx+sp)%40;
      d.v+=0.62;d.y+=d.v;if(d.y>=GY-30){d.y=GY-30;d.v=0;d.on=true;}
      if(!obs.length||obs[obs.length-1].x<W-(220+Math.random()*220+sp*14))spawn();
      for(var i=obs.length-1;i>=0;i--){var o=obs[i];o.x-=sp+(o.b?1.5:0);if(o.x<-60){obs.splice(i,1);continue;}
       if(d.y+28>o.y+3&&d.y+4<o.y+o.h&&60>o.x&&32<o.x+o.w-4&&o.x<60-4)die();}
      for(var k=0;k<cl.length;k++){cl[k].x-=0.5;if(cl[k].x<-40)cl[k].x=W+20;}
      $('sc').textContent=Math.floor(score);}
     draw();requestAnimationFrame(step);}
    function die(){state=2;var s=Math.floor(score);if(s>best){best=s;try{localStorage.setItem('pix_dino',best);}catch(e){}}$('bs').textContent=best;}
    function draw(){
     c.fillStyle='#f7f7f7';c.fillRect(0,0,W,H);c.fillStyle='#e5e7eb';
     for(var k=0;k<cl.length;k++){var q=cl[k];c.beginPath();c.arc(q.x,q.y,10,0,7);c.arc(q.x+14,q.y+2,13,0,7);c.arc(q.x+28,q.y,9,0,7);c.fill();}
     c.fillStyle='#535353';c.fillRect(0,GY,W,2);for(var x=-gx;x<W;x+=40)c.fillRect(x,GY+6,12,2);
     c.fillStyle='#535353';var i;
     for(i=0;i<obs.length;i++){var o=obs[i];
      if(o.b){var f=Math.floor(fr/8)%2;c.fillRect(o.x+6,o.y+6,18,8);c.fillRect(o.x+20,o.y+3,10,5);c.fillRect(o.x+(f?4:8),o.y+(f?-2:12),10,6);}
      else{for(var j=0;j<o.n;j++){var cx=o.x+j*14;c.fillRect(cx+4,o.y,8,o.h);c.fillRect(cx,o.y+8,5,10);c.fillRect(cx,o.y+14,10,4);c.fillRect(cx+11,o.y+4,5,12);c.fillRect(cx+6,o.y+12,10,4);}}}
     // dino
     var dx=36,dy=d.y;c.fillRect(dx,dy+6,22,14);c.fillRect(dx+12,dy,16,12);c.fillRect(dx+26,dy+2,4,5);c.fillRect(dx-6,dy+8,8,6);c.fillRect(dx+4,dy+18,6,10);
     var lf=d.on&&state===1&&Math.floor(fr/5)%2;c.fillRect(dx+(lf?4:14),dy+20,6,10);c.fillStyle='#f7f7f7';c.fillRect(dx+22,dy+3,3,3);
     c.fillStyle='#535353';c.textAlign='right';c.font='bold 16px monospace';c.fillText(String(Math.floor(score)).padStart(5,'0'),W-12,24);
     c.textAlign='center';
     if(state===0){c.font='bold 16px sans-serif';c.fillText('TAP UNTUK MULAI',W/2,70);}
     if(state===2){c.font='bold 22px sans-serif';c.fillText('GAME OVER',W/2,66);c.font='14px sans-serif';c.fillText('Tap untuk main lagi',W/2,90);}
    }
    cv.addEventListener('pointerdown',function(e){e.preventDefault();jump();});
    document.addEventListener('keydown',function(e){if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();jump();}});
    $('rs').onclick=reset;reset();step();
    })();
    </script>
    `;

    function buildDinoHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildDinoHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Dino Run Live — Dino Run: lompati kaktus dan burung, makin lama makin cepat
const { buildDinoHtml } = require('../../lib/cards/dino')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'dinorun',
  alias: [],
  category: 'rich',
  desc: "Dino Run: lompati kaktus dan burung, makin lama makin cepat",
  run: async ({ sock, m, pushname }) => {
    const html = buildDinoHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Dino Run Live', '🦖')
  },
}
    }

dioRegister("rich/dinorun", feature, libs)

let handler = (m, ctx) => dioRun("rich/dinorun", m, ctx)

handler.command = ['dinorun']
handler.help = ['dinorun']
handler.tags = ['rich']

export default handler
