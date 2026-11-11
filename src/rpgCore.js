import { readSave, writeSave } from './lib/storage.js';
import { calculateStats } from './lib/progression.js';

export const $ = s => document.querySelector(s);
export const localDateISO = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const uid = (...parts) => parts.filter(v=>v!==undefined&&v!==null).join(':').replace(/\s+/g,'-').toLowerCase();
export const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
export function ensureRpg(data){ data.ui ||= {}; data.ui.rpg ||= {}; return data.ui.rpg; }
export function dayWorkout(data,date=localDateISO()){ return (data.workouts||[]).find(w=>w.date===date)||null; }
export function dayCheckIn(data,date=localDateISO()){ return (data.checkIns||[]).find(c=>c.date===date)||null; }
export function dayNutrition(data,date=localDateISO()){ return (data.nutrition||[]).filter(n=>n.date===date); }
export function dayMetrics(data,date=localDateISO()){
  const w=dayWorkout(data,date), c=dayCheckIn(data,date), meals=dayNutrition(data,date), ex=w?.exercises||[];
  const strengthSets=ex.filter(e=>e.type==='strength').reduce((s,e)=>s+num(e.sets),0);
  const cardioMinutes=ex.filter(e=>e.type==='cardio').reduce((s,e)=>s+num(e.duration),0);
  const hydrationFromMeals=meals.reduce((s,m)=>s+num(m.hydration||m.hydrationOz),0);
  return {date,workout:w,checkIn:c,meals,strengthSets,cardioMinutes,steps:num(c?.steps),activeCalories:num(c?.activeCalories),exerciseMinutes:num(c?.exerciseMinutes),standHours:num(c?.standHours),waterOz:num(c?.waterOz)+hydrationFromMeals,sleepHours:num(c?.sleepHours),weight:c?.weight??null,nutritionLogged:meals.length>0,workoutLogged:ex.length>0,activityLogged:Boolean(c&&(num(c.steps)||num(c.activeCalories)||num(c.exerciseMinutes)||num(c.standHours))),checkInLogged:Boolean(c)};
}
export function dispatch(name,detail={}){ window.dispatchEvent(new CustomEvent(`fitquest:${name}`,{detail})); }
export async function mutate(mutator){ const cloud=await readSave(); const data=cloud?.save; if(!data) return null; ensureRpg(data); const changed=await mutator(data); if(changed===false) return data; if(!(await writeSave(data))) throw new Error('LEVEL IRL could not save RPG expansion data.'); dispatch('rpg-updated'); return data; }
export async function read(){ const cloud=await readSave(); return cloud?.save||null; }
export function stats(data){ return calculateStats(data); }
export function addOnce(list,item,key='id'){ if(list.some(x=>x?.[key]===item?.[key])) return false; list.push(item); return true; }
export function toast(title,body,icon='✨'){ dispatch('rpg-toast',{title,body,icon}); }
