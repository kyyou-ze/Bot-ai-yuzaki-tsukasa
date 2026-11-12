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
    "cards/typing": (module, exports, require) => {
    // Kartu HTML statis: TYPING TEST LIVE — Tes kecepatan mengetik (WPM & akurasi), mode 30/60 detik
    const { BASE_CSS, safeJson } = require("../htmlcard");

    const BODY = String.raw`
    <style>
    __BASECSS__
    .tx{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;font-size:16px;line-height:1.7;font-family:ui-monospace,Menlo,Consolas,monospace;word-break:break-word;min-height:120px;margin:10px 0}
    .tx span.ok{color:#4ade80}.tx span.bad{color:#f87171;background:#7f1d1d55;border-radius:3px}.tx span.cur{border-bottom:2px solid var(--acc);color:#fff}
    .st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .pill{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:7px 4px;font-size:10px;color:var(--soft);text-align:center}.pill b{display:block;font-size:18px;color:var(--ink)}
    .res{text-align:center;padding:10px;font-weight:800;color:var(--acc);min-height:22px}
    </style>
    <div class="stage"><div class="app">
     <div class="top"><div class="logo">⌨️</div><div class="meta"><div class="title">Typing Test Live</div><div class="sub" id="who"></div></div></div>
     <div class="chips" id="md"><button class="chip on" data-s="30">30 detik</button><button class="chip" data-s="60">60 detik</button></div>
     <div class="st"><div class="pill">WPM<b id="wp">0</b></div><div class="pill">Akurasi<b id="ac">100%</b></div><div class="pill">Waktu<b id="tm">30</b></div><div class="pill">Rekor<b id="bs">0</b></div></div>
     <div class="tx" id="tx"></div>
     <textarea class="inp" id="in" rows="2" placeholder="Ketik di sini untuk mulai..." autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></textarea>
     <div class="res" id="rs"></div>
     <button class="btn" style="width:100%" id="rt">⟳ Ulang</button>
    </div></div>
    <script>
    (function(){
    var CFG=__CFG__;document.getElementById('who').textContent='Pemain: '+CFG.nama;
    var $=function(i){return document.getElementById(i)};
    var P='yang dan untuk dengan tidak ini itu dari pada ada akan bisa saya kamu kita mereka rumah makan minum belajar bermain bekerja sekolah teman pagi siang malam hari bulan tahun cepat lambat besar kecil indah cantik tampan baik buruk senang sedih marah takut berani sabar rajin malas pintar bodoh kuat lemah tinggi rendah jauh dekat panas dingin basah kering baru lama muda tua air api tanah angin hujan matahari bintang laut gunung hutan sungai jalan kota desa pasar toko buku kertas pensil meja kursi pintu jendela lampu mobil motor sepeda kereta pesawat kapal'.split(' ');
    var T,typed,sec=30,left,iv,started,done,best={};
    try{best=JSON.parse(localStorage.getItem('pix_typing')||'{}');}catch(e){}
    function gen(){var a=[];for(var i=0;i<70;i++)a.push(P[Math.floor(Math.random()*P.length)]);return a.join(' ');}
    function reset(){clearInterval(iv);T=gen();typed='';started=false;done=false;left=sec;$('in').value='';$('in').disabled=false;$('rs').textContent='';$('wp').textContent=0;$('ac').textContent='100%';$('tm').textContent=sec;$('bs').textContent=best[sec]||0;render();}
    function render(){var h='';for(var i=0;i<T.length;i++){var ch=T[i]===' '?'&nbsp;':T[i],cls='';if(i<typed.length)cls=typed[i]===T[i]?'ok':'bad';else if(i===typed.length)cls='cur';h+='<span class="'+cls+'">'+ch+'</span>';}$('tx').innerHTML=h;}
    function stats(){var ok=0;for(var i=0;i<typed.length;i++)if(typed[i]===T[i])ok++;var el=Math.max(1,sec-left),w=Math.round((ok/5)/(el/60)),a=typed.length?Math.round(ok*100/typed.length):100;return {w:w,a:a};}
    function end(){clearInterval(iv);done=true;$('in').disabled=true;var s=stats();$('wp').textContent=s.w;$('ac').textContent=s.a+'%';
     var nb=s.w>(best[sec]||0);if(nb){best[sec]=s.w;try{localStorage.setItem('pix_typing',JSON.stringify(best));}catch(e){}$('bs').textContent=s.w;}
     var rank=s.w>=80?'Dewa Ketik':s.w>=60?'Jago':s.w>=40?'Lumayan':s.w>=25?'Pemula':'Santai dulu';
     $('rs').textContent=s.w+' WPM • akurasi '+s.a+'% • '+rank+(nb?' • REKOR BARU!':'');}
    $('in').addEventListener('input',function(){if(done)return;typed=this.value;if(!started){started=true;iv=setInterval(function(){left--;$('tm').textContent=left;var s=stats();$('wp').textContent=s.w;$('ac').textContent=s.a+'%';if(left<=0)end();},1000);}
     if(typed.length>=T.length)end();else{var s=stats();$('wp').textContent=s.w;$('ac').textContent=s.a+'%';}render();});
    $('rt').onclick=reset;
    $('md').onclick=function(e){var s=e.target.dataset&&e.target.dataset.s;if(!s)return;sec=+s;[].forEach.call($('md').children,function(x){x.classList.toggle('on',x===e.target)});reset();};
    reset();
    })();
    </script>
    `;

    function buildTypingHtml({ playerName = "Kamu" } = {}) {
      return BODY.replace("__BASECSS__", () => BASE_CSS).replace("__CFG__", () => safeJson({ nama: String(playerName) }));
    }

    module.exports = { buildTypingHtml };
        }
}

const feature = (module, exports, require) => {
// KARTU LIVE: Typing Test Live — Tes kecepatan mengetik (WPM & akurasi), mode 30/60 detik
const { buildTypingHtml } = require('../../lib/cards/typing')
const { sendHtmlCard } = require('../../lib/htmlcard')

module.exports = {
  name: 'typing',
  alias: [],
  category: 'rich',
  desc: "Tes kecepatan mengetik (WPM & akurasi), mode 30/60 detik",
  run: async ({ sock, m, pushname }) => {
    const html = buildTypingHtml({ playerName: pushname || String(m.sender).split('@')[0] })
    await sendHtmlCard(sock, m, html, 'Typing Test Live', '⌨️')
  },
}
    }

dioRegister("rich/typinglive", feature, libs)

let handler = (m, ctx) => dioRun("rich/typinglive", m, ctx)

handler.command = ['typing']
handler.help = ['typing']
handler.tags = ['rich']

const __plugin = handler

// satu command = nama file; command lama dibuang (alias)
export default oneCommand(__plugin, 'typinglive', { subs: false })
