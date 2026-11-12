import { rpgPlugin } from '../../lib/rpg/bridge.js'
import { getDatabase } from '../../lib/rpg/bridge.js';
import { oneCommand } from '../../lib/engine/plugins.js'

const pluginConfig = {
  name: ["achievement","titles"],
  alias: ["achieve","prestasi","title","gelar"],
  category: "rpg",
  description: "Achievement dan gelar RPG tambahan berbasis data.",
  usage: ".achievement | .titles",
  example: ".achievement",
  isOwner: false,
  isPremium: false,
  isGroup: false,
  isPrivate: false,
  cooldown: 5,
  energi: 0,
  isEnabled: true,
};

const TITLES=[
  [1,"Pemula","Mulai perjalananmu."],
  [5,"Petualang","Mencapai level 5."],
  [10,"Veteran","Mencapai level 10."],
  [20,"Elite","Mencapai level 20."],
  [30,"Legenda","Mencapai level 30."],
  [50,"Master","Mencapai level 50."],
];

async function handler(m){
  const db=getDatabase(),u=db.getUser(m.sender)||{};
  const level=Number(u.level||u.rpg?.level||0),exp=Number(u.exp||0),money=Number(u.koin||u.money||0);
  const inv=u.inventory||{};
  const items=Object.values(inv).reduce((s,v)=>s+(Number(v)||0),0);
  if((m.command||"").toLowerCase()==="titles"){
    const unlocked=TITLES.filter(([lv])=>level>=lv);
    return m.reply(`🏷️ *GELAR*\n\n${TITLES.map(([lv,name,desc])=>`${level>=lv?"✅":"🔒"} ${name} — Lv.${lv} — ${desc}`).join("\n")}\n\nGelar tertinggi: *${unlocked.at(-1)?.[1]||"Pemula"}*`);
  }
  const ach=[
    [level>=5,"🌱","Naik level","Mencapai level 5"],
    [level>=10,"⚔️","Veteran","Mencapai level 10"],
    [level>=20,"👑","Elite","Mencapai level 20"],
    [exp>=100000,"","Seratus Ribu EXP","Mengumpulkan 100.000 EXP"],
    [money>=100000,"💰","Kaya","Memiliki 100.000 koin"],
    [items>=20,"🎒","Kolektor","Memiliki total 20 item"],
  ];
  return m.reply(`🏆 *ACHIEVEMENT*\n\n${ach.map(([ok,e,n,d])=>`${ok?"✅":"🔒"} ${e} *${n}*\n> ${d}`).join("\n\n")}`);
}
const __plugin = rpgPlugin(pluginConfig, handler);

// satu command = nama file; command lama jadi sub-command
export default oneCommand(__plugin, 'extra')
