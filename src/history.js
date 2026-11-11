import './history.css';
import { readSave, writeSave, importBackup } from './lib/storage.js';
import { seedData } from './data/defaultData.js';
import { exerciseTotals } from './lib/progression.js';
import { exerciseIcon, exerciseDetail } from './lib/exercise.js';
import { escapeHtml as esc, localDateISO, weekdayName, timeLabel, dayTitle, toast } from './lib/dom.js';

function load() {
  try { return readSave(); } catch (e) { console.warn('History load failed', e); return null; }
}

function save(data) {
  if (writeSave(data)) return true;
  toast('⚠️ LEVEL IRL couldn’t save — storage may be full.', { tone: 'warn' });
  return false;
}

function exerciseSummary(e) {
  const when = e.loggedAt ? ` · logged ${esc(timeLabel(e.loggedAt))}` : '';
  return `${exerciseDetail(e)}${when}`;
}

function workoutTotals(w) { return exerciseTotals(w.exercises || []); }

function ensureTargetWorkout(data, date) {
  let w = (data.workouts || []).find(x => x.date === date);
  if (w) return w;
  w = { id: `${date}-history-${Date.now()}`, date, day: weekdayName(date), title: 'Transferred Moves', startTime: '', startTimeExact: null, note: 'Created from Workout History.', exercises: [] };
  data.workouts ||= [];
  data.workouts.push(w);
  return w;
}

function sortWorkouts(data) {
  data.workouts = [...(data.workouts || [])].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

// bossBattle treats the first bossSubmittedExerciseCount exercises of a day as
// already struck, so struck moves must land inside the target's struck prefix.
const strikeCount = (w, key) => Math.max(0, Number(w?.[key]) || 0);

function insertStruck(target, items) {
  if (!items.length) return;
  target.exercises ||= [];
  const n = Math.min(strikeCount(target, 'bossSubmittedExerciseCount'), target.exercises.length);
  target.exercises.splice(n, 0, ...items);
  target.bossSubmittedExerciseCount = n + items.length;
  target.bossStrikeRequestedCount = Math.max(strikeCount(target, 'bossStrikeRequestedCount'), n) + items.length;
}

function installUI() {
  if (document.getElementById('workoutHistorySection')) return;
  const main = document.querySelector('#appRoot main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = 'workoutHistorySection';
  section.className = 'card history-panel';
  section.innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">TRAINING RECORDS</p><h3>Workout History</h3></div><div class="history-head-actions"><button class="ghost mini" id="historyBackupBtn" type="button">⬇ Backup</button><button class="ghost mini" id="historyImportBtn" type="button">⬆ Import</button><input type="file" id="historyImportFile" accept="application/json,.json" hidden><span class="pill" id="historyCount">0 days</span></div></div>
    <p class="muted history-help">Every set, rep, weight and cardio session is saved here. Move records between dates, download a backup, or import one from another device.</p>
    <div id="historyList" class="history-list"></div>`;
  main.appendChild(section);
  const dialog = document.createElement('dialog');
  dialog.id = 'moveExerciseDialog';
  dialog.innerHTML = `<form id="moveExerciseForm"><div class="dialog-head"><div><p class="eyebrow">FIELD TRANSFER</p><h3>Move Exercise</h3></div><button type="button" class="icon-btn dialog-close" aria-label="Close">×</button></div><p class="muted" id="moveExerciseLabel"></p><input type="hidden" id="moveSourceWorkoutId"><input type="hidden" id="moveExerciseIndex"><label>Move to date<input id="moveExerciseDate" type="date" required></label><button class="primary" type="submit">Transfer Exercise</button><p class="dialog-tip">If that date has no adventure yet, LEVEL IRL creates one automatically.</p></form>`;
  document.body.appendChild(dialog);
  document.getElementById('moveExerciseForm').addEventListener('submit', moveExercise);
  document.getElementById('historyBackupBtn').addEventListener('click', exportBackup);
  document.getElementById('historyImportBtn').addEventListener('click', () => document.getElementById('historyImportFile').click());
  document.getElementById('historyImportFile').addEventListener('change', importFromFile);
  renderHistory();
}

function renderHistory() {
  const data = load(), list = document.getElementById('historyList');
  if (!list) return;
  if (!data) { list.innerHTML = '<div class="empty-state">No Workout History saved yet.</div>'; return; }
  const workouts = [...(data.workouts || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const active = workouts.filter(w => (w.exercises || []).length).length;
  document.getElementById('historyCount').textContent = `${active} active day${active === 1 ? '' : 's'}`;
  if (!workouts.length) { list.innerHTML = '<div class="empty-state">No adventures recorded yet.</div>'; return; }
  const today = localDateISO();
  list.innerHTML = workouts.map(w => {
    const ex = w.exercises || [], t = workoutTotals(w), empty = !ex.length;
    const day = w.day || (w.date ? weekdayName(w.date) : '');
    return `<article class="history-day ${empty ? 'history-empty' : ''}" data-history-id="${esc(w.id)}"><div class="history-day-head"><div><span class="history-date">${esc(w.date || 'Unknown date')} · ${esc(day)}</span><strong>${esc(dayTitle(data.workouts, w))}</strong><small>${ex.length} move${ex.length === 1 ? '' : 's'} · ${t.strengthSets} sets · ${t.cardio} cardio min · ${t.xp} XP</small></div><span class="history-status">${empty ? 'EMPTY RECORD' : '✓ LOGGED'}</span></div><div class="history-date-editor"><label>Workout date<input type="date" value="${esc(w.date || '')}" max="${today}" data-workout-date="${esc(w.id)}"></label><button type="button" class="ghost mini" data-open-date="${esc(w.date || '')}">Open Day</button><button type="button" class="ghost mini" data-change-workout-date="${esc(w.id)}">Move Whole Day</button>${empty ? `<button type="button" class="ghost mini danger-ghost" data-delete-empty="${esc(w.id)}">Remove Empty</button>` : ''}</div><div class="history-exercises">${ex.length ? ex.map((e, i) => `<div class="history-exercise"><span class="history-exercise-icon">${esc(exerciseIcon(e.name, e.type, e.icon))}</span><div><strong>${esc(e.name || 'Exercise')}</strong><small>${exerciseSummary(e)} · +${Number(e.xp) || 0} XP</small></div><button type="button" class="history-move-btn" data-move-exercise data-workout-id="${esc(w.id)}" data-exercise-index="${i}">↪ Move</button></div>`).join('') : '<div class="history-no-exercises">No exercises attached to this day.</div>'}</div></article>`;
  }).join('');
  list.querySelectorAll('[data-open-date]').forEach(b => b.addEventListener('click', () => openDay(b.dataset.openDate)));
  list.querySelectorAll('[data-change-workout-date]').forEach(b => b.addEventListener('click', () => changeWorkoutDate(b.dataset.changeWorkoutDate)));
  list.querySelectorAll('[data-move-exercise]').forEach(b => b.addEventListener('click', () => openMoveExercise(b.dataset.workoutId, Number(b.dataset.exerciseIndex))));
  list.querySelectorAll('[data-delete-empty]').forEach(b => b.addEventListener('click', () => deleteEmptyWorkout(b.dataset.deleteEmpty)));
}

// Show this day on the Home screen so it can be viewed and added to.
function openDay(date) {
  if (!date) return;
  window.dispatchEvent(new CustomEvent('fitquest:open-date', { detail: { date } }));
  const home = [...document.querySelectorAll('[data-fitquest-nav="home"]')].find(b => b.offsetParent !== null);
  home?.click();
}

function changeWorkoutDate(id) {
  const data = load(), source = (data?.workouts || []).find(w => w.id === id);
  const input = document.querySelector(`[data-workout-date="${CSS.escape(id)}"]`), target = input?.value;
  if (!source || !target || target === source.date) { toast('📅 Choose a different date first.'); return; }
  if (target > localDateISO()) { toast('📅 Adventures can’t be moved to future dates.'); return; }
  const existing = (data.workouts || []).find(w => w.date === target && w.id !== id);
  let msg;
  if (existing) {
    const ex = source.exercises || [], struck = Math.min(strikeCount(source, 'bossSubmittedExerciseCount'), ex.length);
    insertStruck(existing, ex.slice(0, struck));
    existing.exercises ||= [];
    existing.exercises.push(...ex.slice(struck));
    existing.note = existing.note || source.note;
    if (source.completed) {
      existing.completed = true;
      existing.completedAt ||= source.completedAt;
      // Both days' XP was already earned, so keep the sum.
      existing.completionXp = (Number(existing.completionXp) || 0) + (Number(source.completionXp) || 0);
    }
    data.workouts = data.workouts.filter(w => w.id !== id);
    msg = `🗂️ Adventure merged into ${target}.`;
  } else {
    source.date = target;
    source.day = weekdayName(target);
    msg = `📅 Adventure moved to ${target}.`;
  }
  sortWorkouts(data);
  if (!save(data)) return;
  toast(msg);
  renderHistory();
}

function openMoveExercise(id, index) {
  const data = load(), w = (data?.workouts || []).find(x => x.id === id), e = w?.exercises?.[index];
  if (!w || !e) return;
  document.getElementById('moveSourceWorkoutId').value = id;
  document.getElementById('moveExerciseIndex').value = String(index);
  const dateInput = document.getElementById('moveExerciseDate');
  dateInput.max = localDateISO();
  dateInput.value = w.date || localDateISO();
  document.getElementById('moveExerciseLabel').textContent = `${e.name} · currently ${w.date}`;
  document.getElementById('moveExerciseDialog').showModal();
}

function moveExercise(ev) {
  ev.preventDefault();
  const data = load(), id = document.getElementById('moveSourceWorkoutId').value, index = Number(document.getElementById('moveExerciseIndex').value);
  const targetDate = document.getElementById('moveExerciseDate').value, source = (data?.workouts || []).find(w => w.id === id);
  if (!source || !targetDate || !source.exercises?.[index]) return;
  if (targetDate === source.date) { toast('📅 That exercise is already on that date.'); return; }
  if (targetDate > localDateISO()) { toast('📅 Adventures can’t be moved to future dates.'); return; }
  const sub = strikeCount(source, 'bossSubmittedExerciseCount'), req = strikeCount(source, 'bossStrikeRequestedCount');
  const struck = index < Math.min(sub, source.exercises.length);
  const [exercise] = source.exercises.splice(index, 1);
  if (index < sub) source.bossSubmittedExerciseCount = sub - 1;
  if (index < req) source.bossStrikeRequestedCount = req - 1;
  const target = ensureTargetWorkout(data, targetDate), moved = { ...exercise, movedFromDate: source.date, movedAt: new Date().toISOString() };
  target.exercises ||= [];
  if (struck) insertStruck(target, [moved]); else target.exercises.push(moved);
  sortWorkouts(data);
  if (!save(data)) return;
  document.getElementById('moveExerciseDialog').close();
  toast(`↪ ${exercise.name} moved to ${targetDate}.`);
  renderHistory();
}

function deleteEmptyWorkout(id) {
  const data = load(), w = (data?.workouts || []).find(x => x.id === id);
  if (!w || (w.exercises || []).length) return;
  data.workouts = data.workouts.filter(x => x.id !== id);
  if (!save(data)) return;
  toast('🧹 Empty adventure record removed.');
  renderHistory();
}

// Merge a backup file into this device's campaign (nothing is deleted).
async function importFromFile(ev) {
  const input = ev.target, file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!confirm(`Import “${file.name}”?\n\nIts workouts, meals, check-ins and campaign progress will be merged into this device. This can’t be undone, so tap ⬇ Backup first if you want a copy of the current data.`)) return;
  try {
    const merged = importBackup(await file.text(), seedData);
    const n = (merged.workouts || []).length;
    toast(`⬆ Campaign imported · ${n} adventure${n === 1 ? '' : 's'} on record.`);
  } catch (e) {
    alert(e?.message || 'Import failed.');
  }
}

function exportBackup() {
  const data = load();
  if (!data) { toast('No LEVEL IRL save found to back up.'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url;
  a.download = `level-irl-backup-${localDateISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('⬇ LEVEL IRL backup exported.');
}

// Keep the list current when any part of the app saves.
let refreshTimer = null;
function scheduleHistoryRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (document.getElementById('historyList')?.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    renderHistory();
  }, 200);
}
window.addEventListener('fitquest:saved', scheduleHistoryRefresh);
window.addEventListener('fitquest:remote-update', scheduleHistoryRefresh);

installUI();
