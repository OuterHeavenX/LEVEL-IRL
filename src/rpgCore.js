import { readSave, writeSave } from './lib/storage.js';
import { exerciseTotals } from './lib/progression.js';
import { localDateISO } from './lib/dom.js';

export const uid = (...parts) => parts.filter(v=>v!==undefined&&v!==null).join(':').replace(/\s+/g,'-').toLowerCase();
export const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
export function ensureRpg(data){ data.ui ||= {}; data.ui.rpg ||= {}; return data.ui.rpg; }
function dayWorkout(data,date=localDateISO()){ return (data.workouts||[]).find(w=>w?.date===date)||null; }
function dayCheckIn(data,date=localDateISO()){ return (data.checkIns||[]).find(c=>c?.date===date)||null; }
function dayNutrition(data,date=localDateISO()){ return (data.nutrition||[]).filter(n=>n?.date===date); }
export function dayMetrics(data,date=localDateISO()){
  const w=dayWorkout(data,date), c=dayCheckIn(data,date), meals=dayNutrition(data,date), ex=w?.exercises||[];
  const { strengthSets, cardio: cardioMinutes } = exerciseTotals(ex);
  // Meal hydration is already added to checkIn.waterOz when the meal is saved.
  return {date,workout:w,checkIn:c,meals,strengthSets,cardioMinutes,steps:num(c?.steps),activeCalories:num(c?.activeCalories),exerciseMinutes:num(c?.exerciseMinutes),standHours:num(c?.standHours),waterOz:num(c?.waterOz),sleepHours:num(c?.sleepHours),weight:c?.weight??null,nutritionLogged:meals.length>0,workoutLogged:ex.length>0,activityLogged:Boolean(c&&(num(c.steps)||num(c.activeCalories)||num(c.exerciseMinutes)||num(c.standHours))),checkInLogged:Boolean(c)};
}
export async function mutate(mutator){ const data=readSave(); if(!data) return null; ensureRpg(data); const changed=await mutator(data); if(changed===false) return data; if(!writeSave(data)) throw new Error('LEVEL IRL could not save RPG expansion data.'); return data; }
export function addOnce(list,item,key='id'){ if(list.some(x=>x?.[key]===item?.[key])) return false; list.push(item); return true; }
