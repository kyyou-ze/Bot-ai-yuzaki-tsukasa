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
    "cards/paint": (module, exports, require) => {
    // Kartu HTML statis: PAINT LIVE (Papan gambar: pensil, penghapus, isi warna, undo)
    // Semua jalan di dalam kartu, tanpa fetch. By PIX.
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .cv{display:block;width:100%;background:#fff;border-radius:12px;border:1px solid var(--line);touch-action:none}
    .pal{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
    .sl{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);cursor:pointer}.sl.on{border-color:#fff;transform:scale(1.18)}
    .tl{display:flex;gap:6px;flex-wrap:wrap}.tl .btn{padding:8px 10px;font-size:12px}.tl .btn.sel{background:var(--acc);color:#04130a}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">🎨</div><div class="meta"><div class="title">Paint Live</div><div class="sub" id="who"></div></div></div>
     <canvas id="cv" class="cv" width="640" height="640"></canvas>
     <div class="pal" id="pal"></div>
     <div class="row" style="margin-bottom:8px"><span class="muted">Tebal</span><input type="range" id="sz" min="1" max="40" value="6" style="flex:1"><span class="muted" id="szv">6</span></div>
     <div class="tl"><button class="btn alt sel" id="t_p">✏️ Pensil</button><button class="btn alt" id="t_e">🧽 Hapus</button><button class="btn alt" id="t_f">🪣 Isi</button><button class="btn alt" id="t_u">↩ Undo</button><button class="btn red" id="t_c">🗑 Bersih</button></div>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var cv=$('cv'),c=cv.getContext('2d'),col='#111',tool='p',hist=[],drawing=false,lx=0,ly=0;
    c.fillStyle='#fff';c.fillRect(0,0,640,640);c.lineCap='round';c.lineJoin='round';
    var COLS=['#111111','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#92400e','#6b7280'];
    COLS.forEach(function(x,i){var d=document.createElement('div');d.className='sl'+(i?'':' on');d.style.background=x;d.onclick=function(){col=x;[].forEach.call($('pal').children,function(n){n.classList.remove('on')});d.classList.add('on');if(tool==='e')sel('p');};$('pal').appendChild(d);});
    function sel(t){tool=t;['p','e','f'].forEach(function(k){$('t_'+k).classList.toggle('sel',k===t)});}
    $('t_p').onclick=function(){sel('p')};$('t_e').onclick=function(){sel('e')};$('t_f').onclick=function(){sel('f')};
    $('sz').oninput=function(){$('szv').textContent=this.value;};
    function snap(){if(hist.length>15)hist.shift();hist.push(c.getImageData(0,0,640,640));}
    $('t_u').onclick=function(){if(hist.length)c.putImageData(hist.pop(),0,0);};
    $('t_c').onclick=function(){snap();c.fillStyle='#fff';c.fillRect(0,0,640,640);};
    function pos(e){var r=cv.getBoundingClientRect();return [(e.clientX-r.left)*640/r.width,(e.clientY-r.top)*640/r.height];}
    function hex(h){return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];}
    function fill(x,y){x|=0;y|=0;var im=c.getImageData(0,0,640,640),d=im.data,i=(y*640+x)*4,tr=d[i],tg=d[i+1],tb=d[i+2],n=hex(col);
     if(tr===n[0]&&tg===n[1]&&tb===n[2])return;var st=[[x,y]];
     function ok(p){return Math.abs(d[p]-tr)<24&&Math.abs(d[p+1]-tg)<24&&Math.abs(d[p+2]-tb)<24;}
     while(st.length){var q=st.pop(),px=q[0],py=q[1];while(py>=0&&ok((py*640+px)*4))py--;py++;var l=false,r=false;
      while(py<640&&ok((py*640+px)*4)){var p=(py*640+px)*4;d[p]=n[0];d[p+1]=n[1];d[p+2]=n[2];d[p+3]=255;
       if(px>0){if(ok(p-4)){if(!l){st.push([px-1,py]);l=true;}}else l=false;}
       if(px<639){if(ok(p+4)){if(!r){st.push([px+1,py]);r=true;}}else r=false;}py++;}}
     c.putImageData(im,0,0);}
    cv.addEventListener('pointerdown',function(e){e.preventDefault();var p=pos(e);snap();if(tool==='f'){fill(p[0],p[1]);return;}drawing=true;lx=p[0];ly=p[1];try{cv.setPointerCapture(e.pointerId);}catch(x){}dot(p[0],p[1]);});
    function dot(x,y){c.fillStyle=tool==='e'?'#fff':col;c.beginPath();c.arc(x,y,$('sz').value/2,0,7);c.fill();}
    cv.addEventListener('pointermove',function(e){if(!drawing)return;var p=pos(e);c.strokeStyle=tool==='e'?'#fff':col;c.lineWidth=$('sz').value;c.beginPath();c.moveTo(lx,ly);c.lineTo(p[0],p[1]);c.stroke();lx=p[0];ly=p[1];});
    function end(){drawing=false;}cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
    })();
    </script>
    `;

    function buildPaintHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildPaintHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Paint Live — Papan gambar: pensil, hapus, isi warna, undo
const { buildPaintHtml } = require('../../lib/cards/paint')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'paint',
  alias: [],
  category: 'rich',
  desc: "Papan gambar: pensil, hapus, isi warna, undo",
  run: async ({ sock, m, pushname }) => {
    const html = buildPaintHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Paint Live', '🎨')
  },
}
    }

dioRegister("rich/paintlive", feature, libs)

let handler = (m, ctx) => dioRun("rich/paintlive", m, ctx)

handler.command = ['paint']
handler.help = ['paint']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'paintlive', { subs: false })
