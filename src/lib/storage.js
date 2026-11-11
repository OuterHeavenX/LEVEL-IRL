import { localDateISO, dateFromISO, toast } from './dom.js';
import { BOSSES, appliedActivityDamage } from './bosses.js';

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
// A save that could not be merged is copied here once, so a fresh start never erases it.
const UNREADABLE_KEY = 'fitquest-save-unreadable';
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

// Time of this tab's last backup, seeded from storage on the first autosave so
// a reload still respects the one-per-minute limit without re-reading every save.
let lastBackupAt = null;

// Keep a rolling set of recovery backups, at most one per minute for autosaves.
function saveBackup(json, reason) {
  const now = Date.now();
  if (reason === 'autosave') {
    if (lastBackupAt === null) lastBackupAt = Date.parse(readLocal(BACKUP_KEY)?.[0]?.savedAt || 0) || 0;
    if (now - lastBackupAt < BACKUP_INTERVAL_MS) return;
  }
  try {
    const stored = readLocal(BACKUP_KEY);
    const backups = Array.isArray(stored) ? stored : [];
    backups.unshift({ savedAt: new Date(now).toISOString(), reason, data: JSON.parse(json) });
    const preImport = backups.find((b, i) => i > 0 && b?.reason === 'before-import');
    // On a quota error, fall back to the newest copy plus the last pre-import snapshot.
    for (const set of [backups.slice(0, MAX_BACKUPS), [backups[0], preImport].filter(Boolean)]) {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(set));
        lastBackupAt = now;
        return;
      } catch {}
    }
    throw new Error('Not enough storage for a recovery backup.');
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

const exerciseList = workout =>
  (Array.isArray(workout.exercises) ? workout.exercises : []).filter(e => e && typeof e === 'object');
// Exercises from before ids were added have neither id nor loggedAt.
const exerciseKey = exercise => exercise.id || exercise.loggedAt || JSON.stringify(exercise);

function normalizeWorkouts(workouts = []) {
  const byDate = new Map();
  for (const workout of workouts) {
    if (!workout || typeof workout !== 'object' || workout.transient) continue;
    const date = String(workout.date || '').trim().match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date || Number.isNaN(dateFromISO(date).getTime())) continue;
    const current = byDate.get(date);
    if (!current) {
      byDate.set(date, { ...workout, date, exercises: exerciseList(workout) });
      continue;
    }
    const known = new Set(current.exercises.map(exerciseKey));
    for (const exercise of exerciseList(workout)) {
      const key = exerciseKey(exercise);
      if (!known.has(key)) current.exercises.push(exercise);
      // Identical id-less entries inside one record may be real repeats, so only ids dedupe within it.
      if (exercise.id || exercise.loggedAt) known.add(key);
    }
    current.completed ||= workout.completed;
    current.completedAt ||= workout.completedAt;
    current.completionXp ||= workout.completionXp;
    current.completionSummary ||= workout.completionSummary;
    current.planned ||= workout.planned;
    current.note ||= workout.note;
  }
  return [...byDate.values()]
    .filter(workout => workout.exercises.length || workout.completed || workout.planned)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeSave(saved, seed) {
  const merged = clone(seed);
  if (!saved || typeof saved !== 'object') return merged;
  merged.profile = { ...merged.profile, ...(saved.profile || {}) };
  merged.workouts = normalizeWorkouts(
    Array.isArray(saved.workouts) ? saved.workouts : merged.workouts
  );
  const records = list => (Array.isArray(list) ? list : []).filter(item => item && typeof item === 'object');
  merged.nutrition = records(saved.nutrition);
  merged.checkIns = records(saved.checkIns);
  merged.ui = { ...merged.ui, ...(saved.ui || {}) };
  if (!merged.checkIns.length && saved.profile?.weight) {
    const date = merged.workouts?.[merged.workouts.length - 1]?.date || localDateISO();
    merged.checkIns.push({ id:`migrated-${date}`, date, weight:Number(saved.profile.weight), weightUnit:saved.profile.weightUnit || 'lb', sleepHours:null, waterOz:0, migrated:true });
  }
  recoverDay2Workout(merged);
  const learned = Array.isArray(saved.exerciseLibrary) ? saved.exerciseLibrary : [];
  const fromWorkouts = merged.workouts.flatMap(w => w.exercises).filter(e => typeof e.name === 'string' && e.name.trim()).map(e => ({ id:slugify(e.name), name:e.name, type:e.type || 'strength', icon:e.icon || (e.type === 'cardio' ? '🏃' : '⚔️') }));
  merged.exerciseLibrary = dedupeLibrary([...learned, ...merged.exerciseLibrary, ...fromWorkouts]);
  return merged;
}

function readStoredSave() {
  let migrated = false;
  try { migrated = localStorage.getItem(FORMAT_KEY) === FORMAT; } catch {}
  const main = readLocal(SAVE_KEY);
  const shadow = readLocal(SHADOW_KEY)?.data;
  // Before the switch to local-only saves, the shadow copy was the newest.
  return migrated ? main || shadow : shadow || main;
}

// A freshly parsed copy of the stored save, or null when there is none.
export function readSave() {
  return readStoredSave() || null;
}

let unreadableReported = false;

function keepUnreadableSave(stored, error) {
  console.error('Saved campaign could not be read:', error);
  try {
    if (!localStorage.getItem(UNREADABLE_KEY)) localStorage.setItem(UNREADABLE_KEY, JSON.stringify(stored));
  } catch {}
  // loadSave runs on every sync, so tell the player only once per page load.
  if (unreadableReported) return;
  unreadableReported = true;
  toast('⚠️ Saved campaign could not be read; a copy was kept.', { tone: 'warn' });
}

export function loadSave(seed) {
  const stored = readStoredSave();
  if (stored) {
    try { return mergeSave(stored, seed); }
    catch (error) { keepUnreadableSave(stored, error); }
  }
  // A brand-new campaign never needs the one-time repair; mark it checked now.
  return recoverDay2Workout(clone(seed));
}

// Saves synchronously and announces it with a `fitquest:saved` event.
// `source` lets a module ignore its own saves. Returns false if the save failed.
export function writeSave(data, { source = 'module' } = {}) {
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

// The check-in for `date`, created and added to the save if there is none yet.
export function ensureCheckIn(data, date) {
  data.checkIns ||= [];
  let checkIn = data.checkIns.find(c => c?.date === date);
  if (!checkIn) {
    checkIn = { id: `checkin-${date}-${Date.now()}`, date, weight: null, weightUnit: 'lb', sleepHours: null, sleepMinutes: null, waterOz: 0 };
    data.checkIns.push(checkIn);
  }
  return checkIn;
}

// Logged sleep in minutes, or null when none is logged.
export function sleepMinutesOf(checkIn) {
  let minutes = null;
  if (checkIn?.sleepMinutes != null) minutes = Number(checkIn.sleepMinutes);
  else if (checkIn?.sleepHours != null) minutes = Math.round(Number(checkIn.sleepHours) * 60);
  return Number.isFinite(minutes) ? minutes : null;
}

// Pull the save object out of an exported backup file. Accepts a plain save
// (the Backup button's format) or a recovery snapshot ({ savedAt, data }).
function parseBackup(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('That file isn’t a LEVEL IRL backup (it isn’t valid JSON).'); }
  const save = parsed && typeof parsed === 'object' && parsed.data && !parsed.workouts ? parsed.data : parsed;
  const looksLikeSave = save && typeof save === 'object' &&
    ['workouts', 'nutrition', 'checkIns'].some(key => Array.isArray(save[key]));
  if (!looksLikeSave) throw new Error('That file doesn’t contain LEVEL IRL workouts, meals or check-ins.');
  return save;
}

const maxCount = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);

const unionById = (primary = [], secondary = []) => {
  const seen = new Set(primary.map(item => item?.id).filter(Boolean));
  return [...primary, ...secondary.filter(item => !item?.id || !seen.has(item.id))];
};

const isFilled = (value, skipZero) => value !== null && value !== undefined && value !== '' && !(skipZero && value === 0);
const filledFields = (obj, skipZero = false) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => isFilled(v, skipZero)));

// Boss records from both saves: attacks are combined by id (ids are derived from
// the workout or check-in and its range, so one strike appears once), and HP is
// recomputed from them.
function mergeBosses(imported = {}, current = {}) {
  const bosses = {};
  for (const id of new Set([...Object.keys(imported), ...Object.keys(current)])) {
    const a = imported[id], b = current[id];
    if (!a || !b) { bosses[id] = a || b; continue; }
    const attacks = unionById(b.attacks || [], a.attacks || []);
    const maxHp = Number(b.maxHp || a.maxHp) || BOSSES.find(boss => boss.id === id)?.maxHp;
    if (!maxHp) { bosses[id] = { ...a, ...b, attacks }; continue; }
    const hp = Math.max(0, maxHp - attacks.reduce((sum, x) => sum + (Number(x?.damage) || 0), 0));
    bosses[id] = {
      ...a, ...b, attacks, hp,
      defeated: Boolean(a.defeated || b.defeated || hp === 0),
      rewardGranted: Boolean(a.rewardGranted || b.rewardGranted)
    };
  }
  return bosses;
}

function mergeUi(importedUi = {}, currentUi = {}) {
  const ir = importedUi.rpg || {}, cr = currentUi.rpg || {};
  return {
    ...importedUi,
    ...currentUi,
    migrations: { ...importedUi.migrations, ...currentUi.migrations },
    rpg: {
      ...ir,
      ...cr,
      inventory: unionById(cr.inventory || [], ir.inventory || []),
      bossVictoryXp: maxCount(cr.bossVictoryXp, ir.bossVictoryXp),
      bosses: mergeBosses(ir.bosses, cr.bosses),
      activityAchievements: { ...ir.activityAchievements, ...cr.activityAchievements },
      juiceLootRolls: { ...ir.juiceLootRolls, ...cr.juiceLootRolls },
      levelCeremonies: { ...ir.levelCeremonies, ...cr.levelCeremonies },
      // A level already reached on either device is not celebrated again after the import.
      lastObservedLevel: maxCount(cr.lastObservedLevel, ir.lastObservedLevel)
    }
  };
}

// Combine an imported backup with the current save without losing either:
// workouts on the same date are merged, meals are combined by id, check-ins on
// the same date are merged field by field (imported values win where they are
// set), and campaign state (bosses, loot, records, class) from both is merged.
function mergeImportedSave(imported, stored, seed) {
  const base = mergeSave(imported, seed);
  if (!stored) return base;
  const current = mergeSave(stored, seed);
  const currentWorkouts = new Map(current.workouts.map(w => [w.date, w]));
  const currentCheckIns = new Map(current.checkIns.map(c => [c.date, c]));
  const importedDates = new Set((base.checkIns || []).map(c => c.date));
  // Keep the higher strike counters so damage already dealt on either device is not dealt again.
  const workouts = (base.workouts || []).map(w => {
    const cur = currentWorkouts.get(w.date);
    if (!cur) return w;
    return { ...w, bossSubmittedExerciseCount: maxCount(w.bossSubmittedExerciseCount, cur.bossSubmittedExerciseCount), bossStrikeRequestedCount: maxCount(w.bossStrikeRequestedCount, cur.bossStrikeRequestedCount) };
  });
  const checkIns = (base.checkIns || []).map(c => {
    const cur = currentCheckIns.get(c.date);
    if (!cur) return c;
    // A 0 in the import is usually a default (e.g. waterOz), so it never overwrites a logged value.
    const merged = { ...cur, ...filledFields(c, true), id: cur.id };
    const applied = Math.max(appliedActivityDamage(cur), appliedActivityDamage(c));
    if (applied) merged.bossActivityDamageApplied = applied;
    return merged;
  });
  return mergeSave({
    ...base,
    profile: { ...current.profile, ...filledFields(base.profile) },
    ui: mergeUi(base.ui, current.ui),
    workouts: [...workouts, ...current.workouts],
    nutrition: unionById(base.nutrition, current.nutrition),
    checkIns: unionById(checkIns, current.checkIns.filter(c => !importedDates.has(c.date))),
    exerciseLibrary: [...base.exerciseLibrary, ...current.exerciseLibrary]
  }, seed);
}

// Import a backup file's text: keep a recovery copy of the current save, then
// save the merged result. Returns the merged save.
export function importBackup(text, seed) {
  const imported = parseBackup(text);
  const current = readStoredSave();
  if (current) saveBackup(JSON.stringify(current), 'before-import');
  const merged = mergeImportedSave(imported, current, seed);
  if (!writeSave(merged, { source: 'import' })) throw new Error('LEVEL IRL couldn’t save the imported campaign.');
  return merged;
}

// Keep other open tabs in step when one of them saves.
window.addEventListener('storage', event => {
  if (event.key === SAVE_KEY) window.dispatchEvent(new CustomEvent('fitquest:remote-update'));
});

export function slugify(text='') { return text.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || `exercise-${Date.now()}`; }
function dedupeLibrary(items=[]) {
  const seen = new Map();
  items.forEach(item => {
    if (typeof item?.name !== 'string' || !item.name.trim()) return;
    const key = item.name.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...item, id:item.id || slugify(item.name) });
  });
  return [...seen.values()];
}
