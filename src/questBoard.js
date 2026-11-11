import { ensureRpg, dayMetrics, localDateISO } from './rpgCore.js';
import { addDays } from './lib/dom.js';
// Targets scale from the previous day so today's progress can't set (and instantly meet) them.
function generate(data,date){ const m=dayMetrics(data,addDays(date,-1)); return [
{id:'movement',icon:'🥾',name:'Walk the Road',target:Math.max(5000,Math.min(10000,Math.ceil((m.steps||6500)/500)*500)),unit:'steps',value:x=>x.steps},
{id:'hydration',icon:'💧',name:'Fill the Flask',target:64,unit:'oz water',value:x=>x.waterOz},
{id:'training',icon:'⚔️',name:'Answer the Forge',target:Math.max(8,Math.min(16,m.strengthSets||10)),unit:'strength sets',value:x=>x.strengthSets}
]; }
export function ensureQuestBoard(data,date=localDateISO()){ const r=ensureRpg(data); r.questBoard ||= {}; if(!r.questBoard[date]) r.questBoard[date]={date,quests:generate(data,date).map(q=>({...q,value:undefined,selected:false,completed:false}))}; return r.questBoard[date]; }
export function updateQuestBoard(data,date=localDateISO()){ const board=ensureQuestBoard(data,date), m=dayMetrics(data,date); const defs=generate(data,date); for(const q of board.quests){ const def=defs.find(x=>x.id===q.id); const current=def?def.value(m):0; q.current=current; if(q.selected&&current>=q.target) q.completed=true; } return board; }
export function selectQuest(data,questId,date=localDateISO()){ const b=ensureQuestBoard(data,date); const q=b.quests.find(x=>x.id===questId); if(q) q.selected=!q.selected; return b; }
