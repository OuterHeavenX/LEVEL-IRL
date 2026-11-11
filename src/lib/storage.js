const LEGACY_KEY = 'fitquest-save-v1';
const SHADOW_KEY = 'fitquest-save-shadow-v2';
const BACKUP_KEY = 'fitquest-save-backups-v2';
const MAX_BACKUPS = 8;
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

function saveLocalSnapshot(data, reason = 'autosave') {
  try {
    const snapshot = {
      savedAt: new Date().toISOString(),
      reason,
      data: clone(data)
    };
    localStorage.setItem(SHADOW_KEY, JSON.stringify(snapshot));

    const backups = readLocal(BACKUP_KEY) || [];
    const latest = backups[0];
    const lastMinute = latest &&
      Date.now() - Date.parse(latest.savedAt || 0) < 60000;
    if (!lastMinute || reason !== 'autosave') {
      backups.unshift(snapshot);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
    }
  } catch (error) {
    console.warn('LEVEL IRL local recovery snapshot failed:', error);
  }
}

const DAY_1_DATE = '2026-07-31';
const DAY_2_DATE = '2026-08-01';
const DAY_1_EXERCISES = ['treadmill','bicep curl','shoulder press','vertical row','seated leg curl','deltoid fly'];

function notifySync(status, detail = {}) {
  window.dispatchEvent(new CustomEvent('fitquest:sync', { detail: { status, ...detail } }));
}

function recoverDay2Workout(data) {
  data.ui ||= {};
  data.ui.migrations ||= {};
  if (data.ui.migrations.day2RecoveryV1) return data;
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
    Array.isArray(saved.workouts) && saved.workouts.length ? saved.workouts : merged.workouts
  );
  merged.nutrition = Array.isArray(saved.nutrition) ? saved.nutrition : [];
  merged.checkIns = Array.isArray(saved.checkIns) ? saved.checkIns : [];
  merged.ui = { ...merged.ui, ...(saved.ui || {}) };
  if (!merged.checkIns.length && saved.profile?.weight) {
    const date = merged.workouts?.[merged.workouts.length - 1]?.date || new Date().toISOString().slice(0,10);
    merged.checkIns.push({ id:`migrated-${date}`, date, weight:Number(saved.profile.weight), weightUnit:saved.profile.weightUnit || 'lb', sleepHours:null, waterOz:0, migrated:true });
  }
  recoverDay2Workout(merged);
  const learned = Array.isArray(saved.exerciseLibrary) ? saved.exerciseLibrary : [];
  const fromWorkouts = merged.workouts.flatMap(w => w.exercises || []).map(e => ({ id:slugify(e.name), name:e.name, type:e.type || 'strength', icon:e.icon || (e.type === 'cardio' ? '🏃' : '⚔️') }));
  merged.exerciseLibrary = dedupeLibrary([...merged.exerciseLibrary, ...learned, ...fromWorkouts]);
  return merged;
}

function readStoredSave() {
  // The shadow snapshot is written on every save, so it is always the newest
  // copy. The legacy key is kept in step and used as a fallback.
  return readLocal(SHADOW_KEY)?.data || readLocal(LEGACY_KEY);
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
  const fresh = clone(seed);
  saveLocalSnapshot(fresh, 'new-campaign');
  return fresh;
}

export async function writeSave(data) {
  try {
    saveLocalSnapshot(data, 'autosave');
    localStorage.setItem(LEGACY_KEY, JSON.stringify(data));
    notifySync('synced');
    return true;
  } catch (error) {
    console.error('Save failed:', error);
    notifySync('error', { error: error.message || String(error) });
    return false;
  }
}

// Keep other open tabs in step when one of them saves.
window.addEventListener('storage', event => {
  if (event.key === SHADOW_KEY) window.dispatchEvent(new CustomEvent('fitquest:remote-update'));
});

export function getLocalRecoveryInfo() {
  const shadow = readLocal(SHADOW_KEY);
  const backups = readLocal(BACKUP_KEY) || [];
  return { savedAt: shadow?.savedAt || null, backupCount: backups.length };
}

export function resetSave() {
  localStorage.removeItem(LEGACY_KEY);
  localStorage.removeItem(SHADOW_KEY);
}
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
