import { ensureRpg } from './rpgCore.js';
import { calculateStats } from './lib/progression.js';
const REGIONS=[{id:'first-forge',name:'First Forge',icon:'🔥',level:1},{id:'ashen-road',name:'Ashen Road',icon:'🌋',level:2},{id:'ironwood',name:'Ironwood',icon:'🌲',level:3},{id:'ruined-citadel',name:'Ruined Citadel',icon:'🏰',level:4},{id:'wardens-keep',name:"Warden's Keep",icon:'🛡️',level:5}];
export function campaignState(data){ const r=ensureRpg(data); const s=calculateStats(data); const bosses=Object.values(r.bosses||{}); const wins=bosses.filter(b=>b?.defeated).length; return {level:s.level,bossWins:wins,regions:REGIONS.map((x,i)=>({...x,unlocked:s.level>=x.level||(i===1&&wins>0)}))}; }
