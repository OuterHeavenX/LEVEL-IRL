import { ensureRpg, addOnce, uid } from './rpgCore.js';
const LOOT=[
{id:'iron-flask',name:'Iron Flask',icon:'🥤',rarity:'Common',description:'A battered vessel from the First Forge.'},
{id:'pathfinder-compass',name:'Pathfinder Compass',icon:'🧭',rarity:'Rare',description:'Points toward the next honest mile.'}
];
export function grantLoot(data,{lootId,source,at=new Date().toISOString(),eventId}={}){ const r=ensureRpg(data); r.inventory ||= []; r.loot ||= {events:[]}; r.loot.events ||= []; if(eventId&&r.loot.events.some(e=>e.id===eventId)) return null; const item=LOOT.find(x=>x.id===lootId)||LOOT[0]; const earned={...item,earnedAt:at,source:source||'Campaign',eventId:eventId||uid('loot',item.id,at)}; if(!addOnce(r.inventory,earned,'id')) return null; r.loot.events.push({id:earned.eventId,itemId:item.id,at,source:earned.source}); return earned; }
