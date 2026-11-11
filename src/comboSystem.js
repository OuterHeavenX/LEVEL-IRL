import { ensureRpg, dayMetrics, uid } from './rpgCore.js';
import { localDateISO } from './lib/dom.js';
const COMBOS=[
{id:'triple-combo',name:'TRIPLE COMBO',icon:'⚡',test:m=>m.workoutLogged&&m.waterOz>=64&&(m.steps>=6000||m.exerciseMinutes>=20)},
{id:'balanced-build',name:'BALANCED BUILD',icon:'⚖️',test:m=>m.strengthSets>0&&m.cardioMinutes>0&&m.nutritionLogged},
{id:'full-field-day',name:'FULL FIELD DAY',icon:'🛡️',test:m=>m.workoutLogged&&m.activityLogged&&m.checkInLogged},
{id:'perfect-day',name:'PERFECT DAY',icon:'👑',test:m=>m.workoutLogged&&m.activityLogged&&m.nutritionLogged&&m.waterOz>=64&&m.checkInLogged}
];
export function evaluateCombos(data,date=localDateISO()){ const r=ensureRpg(data); r.dailyCombos ||= []; const m=dayMetrics(data,date), earned=[]; for(const c of COMBOS){ const id=uid('combo',date,c.id); if(c.test(m)&&!r.dailyCombos.some(x=>x.id===id)){ const row={id,comboId:c.id,name:c.name,icon:c.icon,date,earnedAt:new Date().toISOString()}; r.dailyCombos.push(row); earned.push(row); } } return earned; }
