import { localDateISO } from './dom.js';

// The main save keeps the original key so saves from before the rename still load.
const SAVE_KEY = 'fitquest-save-v1';
// Written by older versions on every save; read only as a fallback for migration.
const SHADOW_KEY = 'fitquest-save-shadow-v2';
const BACKUP_KEY = 'fitquest-save-backups-v2';
// Set once SAVE_KEY becomes the authoritative copy.
const FORMAT_KEY = 'fitquest-save-format';
const FORMAT = 'local-v1';
const MAX_BACKUPS = 8;
const BACKUP_INTERVAL_MS = 60000;
const clone = value => JSON.parse(JSON.stringify(value));

function readLocal(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn(`LEVEL IRL could not read ${key}:`, error);
    return null;
  }
}

// Keep a rolling set of recovery backups, at most one per minute for autosaves.
function saveBackup(json, reason) {
  try {
    const backups = readLocal(BACKUP_KEY) || [];
    const latest = backups[0];
    const recent = latest && Date.now() - Date.parse(latest.savedAt || 0) < BACKUP_INTERVAL_MS;
    if (recent && reason === 'autosave') return;
    backups.unshift({ savedAt: new Date().toISOString(), reason, data: JSON.parse(json) });
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
  } catch (error) {
    // Backups are best-effort; drop them rather than block the real save.
    console.warn('LEVEL IRL recovery backup failed:', error);
    try { localStorage.removeItem(BACKUP_KEY); } catch {}
  }
}

const DAY_1_DATE = '2026-07-31';
const DAY_2_DATE = '2026-08-01';
const DAY_1_EXERCISES = ['treadmill','bicep curl','shoulder press','vertical row','seated leg curl','deltoid fly'];

function recoverDay2Workout(data) {
  data.ui ||= {};
  data.ui.migrations ||= {};
  if (data.ui.migrations.day2RecoveryV1) return data;
  // One-time repair for an early save. Mark it checked either way so it never
  // touches workouts logged on these dates later (e.g. via a past-date adventure).
  data.ui.migrations.day2RecoveryV1 = { applied: false };
  const friday = (data.workouts || []).find(w => w.date === DAY_1_DATE);
  if (!friday || !Array.isArray(friday.exercises)) return data;
  const unmatched = new Set(DAY_1_EXERCISES);
  const keep = [], move = [];
  for (const exercise of friday.exercises) {
    const name = String(exercise?.name || '').trim().toLowerCase();
    if (unmatched.has(name)) { keep.push(exercise); unmatched.delete(name); }
    else move.push(exercise);
  }
  if (!move.length) return data;
  friday.exercises = keep;
  let saturday = (data.workouts || []).find(w => w.date === DAY_2_DATE);
  if (!saturday) {
    saturday = { id:'2026-08-01-day-2-recovered', date:DAY_2_DATE, day:'Saturday', title:'Day 2: Building Momentum', startTime:'', startTimeExact:null, note:'Recovered from the original Day 1 record after the date-tracking repair.', exercises:[] };
    data.workouts.push(saturday);
  }
  saturday.exercises ||= [];
  saturday.exercises.push(...move.map(exercise => ({ ...exercise, recoveredFromDate: DAY_1_DATE })));
  data.workouts.sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));
  data.ui.migrations.day2RecoveryV1 = { applied:true, movedExercises:move.length, from:DAY_1_DATE, to:DAY_2_DATE };
  return data;
}

function normalizeWorkouts(workouts = []) {
  const byDate = new Map();
  for (const workout of workouts) {
    if (!workout || workout.transient) continue;
    const date = String(workout.date || '').trim();
    if (!date) continue;
    const current = byDate.get(date);
    if (!current) {
      byDate.set(date, { ...workout, exercises: [...(workout.exercises || [])] });
      continue;
    }
    const known = new Set(current.exercises.map(item => item.id || item.loggedAt).filter(Boolean));
    for (const exercise of (workout.exercises || [])) {
      const key = exercise.id || exercise.loggedAt;
      if (!key || !known.has(key)) current.exercises.push(exercise);
      if (key) known.add(key);
    }
    current.completed ||= workout.completed;
    current.completedAt ||= workout.completedAt;
    current.note ||= workout.note;
  }
  return [...byDate.values()]
    .filter(workout => workout.exercises.length || workout.completed)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeSave(saved, seed) {
  const merged = clone(seed);
  if (!saved || typeof saved !== 'object') return merged;
  merged.version = 4;
  merged.profile = { ...merged.profile, ...(saved.profile || {}) };
  merged.profile.dateOfBirth ||= null;
  merged.profile.heightDisplay ||= saved.profile?.heightDisplay || null;
  merged.profile.heightInches ||= saved.profile?.heightInches || null;
  merged.profile.heightCm ||= saved.profile?.heightCm || null;
  merged.workouts = normalizeWorkouts(
    Array.isArray(saved.workouts) ? saved.workouts : merged.workouts
  );
  merged.nutrition = Array.isArray(saved.nutrition) ? saved.nutrition : [];
  merged.checkIns = Array.isArray(saved.checkIns) ? saved.checkIns : [];
  merged.ui = { ...merged.ui, ...(saved.ui || {}) };
  if (!merged.checkIns.length && saved.profile?.weight) {
    const date = merged.workouts?.[merged.workouts.length - 1]?.date || localDateISO();
    merged.checkIns.push({ id:`migrated-${date}`, date, weight:Number(saved.profile.weight), weightUnit:saved.profile.weightUnit || 'lb', sleepHours:null, waterOz:0, migrated:true });
  }
  recoverDay2Workout(merged);
  const learned = Array.isArray(saved.exerciseLibrary) ? saved.exerciseLibrary : [];
  const fromWorkouts = merged.workouts.flatMap(w => w.exercises || []).map(e => ({ id:slugify(e.name), name:e.name, type:e.type || 'strength', icon:e.icon || (e.type === 'cardio' ? '🏃' : '⚔️') }));
  merged.exerciseLibrary = dedupeLibrary([...merged.exerciseLibrary, ...learned, ...fromWorkouts]);
  return merged;
}

function readStoredSave() {
  const migrated = localStorage.getItem(FORMAT_KEY) === FORMAT;
  const main = readLocal(SAVE_KEY);
  const shadow = readLocal(SHADOW_KEY)?.data;
  // Before the switch to local-only saves, the shadow copy was the newest.
  return migrated ? main || shadow : shadow || main;
}

export async function readSave() {
  return { save: readStoredSave() };
}

export async function loadSave(seed) {
  const stored = readStoredSave();
  if (stored) {
    try { return mergeSave(stored, seed); }
    catch (error) { console.error('Saved campaign could not be read:', error); }
  }
  // A brand-new campaign never needs the one-time repair; mark it checked now.
  return recoverDay2Workout(clone(seed));
}

// Saves synchronously and announces it with a `fitquest:saved` event.
// `source` lets a module ignore its own saves.
export async function writeSave(data, { source = 'module' } = {}) {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(SAVE_KEY, json);
    localStorage.setItem(FORMAT_KEY, FORMAT);
    saveBackup(json, 'autosave');
  } catch (error) {
    console.error('Save failed:', error);
    return false;
  }
  window.dispatchEvent(new CustomEvent('fitquest:saved', { detail: { source } }));
  return true;
}

// Keep other open tabs in step when one of them saves.
window.addEventListener('storage', event => {
  if (event.key === SAVE_KEY) window.dispatchEvent(new CustomEvent('fitquest:remote-update'));
});

export function slugify(text='') { return text.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || `exercise-${Date.now()}`; }
export function dedupeLibrary(items=[]) {
  const seen = new Map();
  items.forEach(item => {
    if (!item?.name) return;
    const key = item.name.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...item, id:item.id || slugify(item.name) });
  });
  return [...seen.values()];
}
