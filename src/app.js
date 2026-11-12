import './styles.css';
import './layout.css';
import { seedData } from './data/defaultData.js';
import {
  loadSave,
  readSave,
  mergeSave,
  writeSave,
  slugify,
  ensureCheckIn,
  sleepMinutesOf
} from './lib/storage.js';
import {
  calculateStats,
  exerciseTotals,
  nextExerciseXP,
  nutritionXP,
  XP_PER_LEVEL
} from './lib/progression.js';
import { quickFoods, findQuickFood, searchOpenFoodFacts } from './lib/nutrition.js';
import { achievementSummary, sketchSVG } from './lib/achievements.js';
import { exerciseIcon, exerciseDetail } from './lib/exercise.js';
import {
  $,
  $$,
  escapeHtml,
  localDateISO,
  dateFromISO,
  addDays,
  weekdayName,
  mondayOf,
  weekDatesOf,
  timeLabel,
  shortDateLabel,
  dayTitle,
  toast
} from './lib/dom.js';

let state = null;
let titleTapCount = 0;
let suppressSave = false;
let draftWorkout = null;
// A past date the player opened (null = today).
let viewDate = null;
// The calendar day of the last render, so a page left open past midnight can catch up.
let renderedToday = localDateISO();
// The logged exercise the dialog is editing: { date, key, index }, or null for a new entry.
let editTarget = null;
let saveFailed = false;

const CHECK_IN_INPUTS = [
  '#dailyWeight',
  '#dailyWeightUnit',
  '#dailySleepHours',
  '#dailySleepMinutes',
  '#dailyWater'
];

// Save right away so other modules never read (and then overwrite) stale data.
function saveState() {
  if (!state || suppressSave) return;
  if (writeSave(state, { source: 'app' })) {
    saveFailed = false;
    return;
  }
  // render() saves every time; warn once per run of failures, not on every action.
  if (saveFailed) return;
  saveFailed = true;
  toast('⚠️ LEVEL IRL could not save. Storage may be full. Use Backup to export your campaign.', {
    tone: 'warn',
    duration: 6000
  });
}

// Another module or tab saved: adopt its copy so the next save doesn't undo it.
async function reloadState() {
  // Never render inside another module's save dispatch.
  await Promise.resolve();
  const stored = readSave();
  if (!stored) return;
  state = mergeSave(stored, seedData);
  suppressSave = true;
  try {
    render();
  } finally {
    suppressSave = false;
  }
}

// Don't clobber a value the player is typing when the screen re-renders.
function setInputValue(input, value) {
  if (input && input.dataset.dirty !== 'true' && document.activeElement !== input) input.value = value;
}

function clearDirty(selectors, { keepFocused = false } = {}) {
  selectors.forEach(selector => {
    const input = $(selector);
    if (input && !(keepFocused && document.activeElement === input)) delete input.dataset.dirty;
  });
}

// The check-in saves itself shortly after typing stops, so closing the app never loses it.
let checkInTimer = null;

function queueCheckInSave() {
  clearTimeout(checkInTimer);
  checkInTimer = setTimeout(() => {
    checkInTimer = null;
    saveCheckIn({ quiet: true });
  }, 900);
}

function flushCheckInSave() {
  if (checkInTimer === null) return;
  clearTimeout(checkInTimer);
  checkInTimer = null;
  saveCheckIn({ quiet: true });
}

// An unfinished move survives a closed dialog, a reload or the app being killed.
const MOVE_DRAFT_KEY = 'fitquest-move-draft';
const MOVE_FIELDS = [
  'Name',
  'Type',
  'Icon',
  'Sets',
  'Reps',
  'Weight',
  'Duration',
  'Distance',
  'DistanceUnit'
];

function readMoveDraft() {
  try {
    return JSON.parse(localStorage.getItem(MOVE_DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
}

function storeMoveDraft() {
  const fields = Object.fromEntries(MOVE_FIELDS.map(f => [f, $(`#exercise${f}`).value]));
  try {
    localStorage.setItem(MOVE_DRAFT_KEY, JSON.stringify({ date: activeDate(), fields }));
  } catch {}
}

function clearMoveDraft() {
  try {
    localStorage.removeItem(MOVE_DRAFT_KEY);
  } catch {}
}

const hasUnsavedEntry = dialog => dialog?.querySelector('form')?.dataset.changed === 'true';

// Closing a dialog that holds a typed entry asks first instead of throwing it away.
function closeDialog(dialog) {
  if (!dialog) return;
  const entry = { exerciseDialog: 'move', foodDialog: 'food' }[dialog.id];
  if (entry && hasUnsavedEntry(dialog)) {
    if (confirm(`Save this ${entry} before closing?\n\nCancel throws it away.`)) {
      dialog.querySelector('form').requestSubmit();
      return;
    }
    if (dialog.id === 'exerciseDialog') clearMoveDraft();
  }
  dialog.close();
}

function activeDate() {
  return viewDate || localDateISO();
}

// Switch the screen to another day (or back to today) and tell other modules.
function setViewDate(date) {
  const today = localDateISO();
  if (date && date > today) {
    toast('📅 Future dates can’t be opened.');
    return;
  }
  // Values still waiting to autosave belong to the day they were typed on.
  flushCheckInSave();
  const previous = viewDate || renderedToday;
  viewDate = date && date !== today ? date : null;
  renderedToday = today;
  draftWorkout = null;
  // Values typed for one day must not be shown or saved on another.
  if (activeDate() !== previous) clearDirty(CHECK_IN_INPUTS);
  document.documentElement.dataset.activeDate = viewDate || '';
  render();
  window.dispatchEvent(new CustomEvent('fitquest:active-date', { detail: { date: activeDate() } }));
}

// Shown above every screen, since Nutrition and Training also log to the viewed day.
function renderViewBanner() {
  const homeTitle = $('#fitquestScreen-home .fitquest-screen-title h2');
  if (homeTitle) homeTitle.textContent = viewDate ? shortDateLabel(viewDate) : 'Today';
  let banner = $('#viewDateBanner');
  if (!viewDate) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'viewDateBanner';
    banner.className = 'view-date-banner';
  }
  const host = $('#fitquestScreenHost');
  if (host) {
    if (banner.nextElementSibling !== host) host.before(banner);
  } else if (banner.parentElement !== $('#appRoot main')) {
    $('#appRoot main')?.prepend(banner);
  }
  banner.innerHTML = `
    <span>📅 Viewing ${escapeHtml(formatDate(viewDate))}</span>
    <button type="button" class="ghost mini" id="backToTodayBtn">Back to Today</button>
  `;
  $('#backToTodayBtn').addEventListener('click', () => setViewDate(null));
}

// The viewed day's workout, or an unsaved draft that the first logged move turns into a record.
function activeWorkout() {
  const date = activeDate();
  const workout = state.workouts.find(w => w.date === date);
  if (workout) return workout;
  if (draftWorkout?.date === date) return draftWorkout;
  draftWorkout = {
    id: `${date}-day-${Date.now()}`,
    date,
    day: weekdayName(date),
    title: 'A New Adventure',
    startTime: '',
    startTimeExact: null,
    note: 'A new adventure begins.',
    exercises: [],
    transient: true
  };
  return draftWorkout;
}

function formatDate(dateString) {
  const date = dateFromISO(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString ?? '');
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function calculateAge(dob) {
  if (!dob) return null;

  const birth = dateFromISO(dob);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const now = new Date();

  let age = now.getFullYear() - birth.getFullYear();

  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());

  if (beforeBirthday) {
    age--;
  }

  return age >= 0 ? age : null;
}

// Split total inches into feet and inches, rounding first so 71.97" never shows as 5'12".
function feetAndInches(totalInches) {
  const rounded = Math.round(totalInches * 10) / 10;
  const feet = Math.floor(rounded / 12);
  return { feet, inches: +(rounded - feet * 12).toFixed(1) };
}

function parseHeight(text) {
  const raw = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[’′]/g, "'")
    .replace(/[“”″]/g, '"');

  if (!raw) {
    return null;
  }

  let m = raw.match(/^(\d+)\s*'\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|in(?:ches?)?)?$/);

  if (m) {
    const feet = Number(m[1]);

    const inches = Number(m[2]);

    if (feet < 2 || feet > 9 || inches < 0 || inches >= 12) {
      return null;
    }

    const total = feet * 12 + inches;

    return {
      heightDisplay: `${feet}'${Number.isInteger(inches) ? inches : inches.toFixed(1)}"`,

      heightInches: total,

      heightCm: +(total * 2.54).toFixed(1)
    };
  }

  m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")$/);

  if (m) {
    const total = Number(m[1]);

    if (total < 36 || total > 108) {
      return null;
    }

    const { feet, inches } = feetAndInches(total);

    return {
      heightDisplay: `${feet}'${inches}"`,

      heightInches: total,

      heightCm: +(total * 2.54).toFixed(1)
    };
  }

  m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:cm|centimeters?|centimetres?)$/);

  if (m) {
    const cm = Number(m[1]);

    if (cm < 90 || cm > 275) {
      return null;
    }

    const total = cm / 2.54;

    const { feet, inches } = feetAndInches(total);

    return {
      heightDisplay: `${feet}'${inches}" (${cm} cm)`,

      heightInches: +total.toFixed(1),

      heightCm: cm
    };
  }

  return null;
}

function getCheckIn(date = activeDate()) {
  return state.checkIns.find(c => c.date === date) || null;
}

function upsertCheckIn(patch, date = activeDate()) {
  return Object.assign(ensureCheckIn(state, date), patch);
}

function render() {
  if (!state) return;

  const stats = calculateStats(state);

  const workout = activeWorkout();

  const achievements = achievementSummary(state, stats);

  document.body.classList.toggle('stealth-mode', !!state.ui.stealthMode);

  $('#levelValue').textContent = stats.level;

  renderViewBanner();

  $('#heroTitle').textContent = dayTitle(state.workouts, workout);

  $('#heroDate').textContent = `${formatDate(workout.date)} · ${
    workout.startTimeExact || workout.startTime || 'Adventure time'
  }`;

  $('#xpText').textContent = `${stats.levelXp} / ${XP_PER_LEVEL} XP`;

  $('#xpBar').style.width = `${(stats.levelXp / XP_PER_LEVEL) * 100}%`;

  $('#streakStat').textContent = `${stats.streak} day${stats.streak === 1 ? '' : 's'}`;

  $('#setsStat').textContent = stats.strengthSets;

  $('#cardioStat').textContent = `${stats.cardio} min`;

  $('#totalXpStat').textContent = stats.xp;

  $('#opsStatus span:last-child').textContent = state.ui.stealthMode
    ? 'STEALTH INTERFACE · ACTIVE'
    : 'TACTICAL FITNESS ACTION';

  renderWorkout(workout);
  renderLibrary();
  renderProfile();
  renderCheckIn();
  renderNutrition();
  renderWeek();
  renderQuests();
  renderAchievements(achievements);

  saveState();
}

function renderWorkout(workout) {
  $('#workoutList').innerHTML = (workout.exercises || [])
    .map((e, index) => {
      return `
            <button
              class="workout-item interactive"
              data-edit-exercise="${index}"
            >
              <div class="workout-icon">
                ${escapeHtml(exerciseIcon(e.name, e.type, e.icon))}
              </div>

              <div class="workout-copy">
                <strong>
                  ${escapeHtml(e.name)}
                </strong>

                <small>
                  ${exerciseDetail(e)}
                </small>
              </div>

              <span class="xp-tag">
                +${Number(e.xp) || 0} XP
              </span>
            </button>
          `;
    })
    .join('');

  $$('[data-edit-exercise]').forEach(btn =>
    btn.addEventListener('click', () =>
      openExerciseDialog(workout.exercises[+btn.dataset.editExercise], +btn.dataset.editExercise)
    )
  );
}

function renderLibrary() {
  $('#exerciseLibrary').innerHTML =
    state.exerciseLibrary
      .map(
        (e, index) => `
            <button
              class="codex-tile"
              data-library-index="${index}"
            >
              <span>
                ${escapeHtml(exerciseIcon(e.name, e.type, e.icon))}
              </span>

              <strong>
                ${escapeHtml(e.name)}
              </strong>

              <small>
                ${e.type === 'cardio' ? 'Cardio' : 'Strength'}
              </small>
            </button>
          `
      )
      .join('') +
    `
        <button
          class="codex-tile add-new"
          id="codexAddNew"
        >
          <span>＋</span>
          <strong>New Move</strong>
          <small>Teach LEVEL IRL</small>
        </button>
      `;

  $$('[data-library-index]').forEach(btn =>
    btn.addEventListener('click', () => openExerciseDialog(state.exerciseLibrary[+btn.dataset.libraryIndex]))
  );

  $('#codexAddNew')?.addEventListener('click', () => openExerciseDialog());
}

function renderProfile() {
  const p = state.profile;

  const age = calculateAge(p.dateOfBirth);

  const dob = p.dateOfBirth ? dateFromISO(p.dateOfBirth) : null;

  $('#dobReadout').textContent =
    dob && !Number.isNaN(dob.getTime())
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(dob)
      : 'Not set';

  $('#ageReadout').textContent = age ?? (p.age ? `${p.age}*` : '—');

  $('#heightReadout').textContent =
    p.heightDisplay || (p.height ? `${p.height} ${p.heightUnit || 'in'}*` : 'Not set');

  $('#profileDob').value = p.dateOfBirth || '';

  // parseHeight can't read back the cm display form (5'10.1" (178 cm)), so offer the cm value.
  $('#profileHeightText').value =
    p.heightCm && String(p.heightDisplay || '').endsWith('cm)') ? `${p.heightCm} cm` : p.heightDisplay || '';

  const complete = Boolean(p.dateOfBirth && p.heightDisplay);

  $('#profileCompletion').textContent = complete
    ? 'Identity stats locked · age updates automatically'
    : p.age || p.height
      ? 'Older stats found · set DOB and height once to upgrade your dossier'
      : 'Set DOB and height once; daily measurements live below';
}

function renderCheckIn() {
  const date = activeDate();

  const c = getCheckIn(date);

  $('#checkInDateLabel').textContent = shortDateLabel(date);

  setInputValue($('#dailyWeight'), c?.weight ?? '');

  setInputValue($('#dailyWeightUnit'), c?.weightUnit || 'lb');

  const sleepTotal = sleepMinutesOf(c);

  setInputValue($('#dailySleepHours'), sleepTotal == null ? '' : Math.floor(sleepTotal / 60));

  setInputValue($('#dailySleepMinutes'), sleepTotal == null ? '' : sleepTotal % 60);

  setInputValue($('#dailyWater'), c?.waterOz ?? 0);

  const bits = [];

  if (c?.weight) {
    bits.push(`⚖️ ${c.weight} ${c.weightUnit}`);
  }

  if (sleepTotal != null) {
    const sh = Math.floor(sleepTotal / 60);

    const sm = sleepTotal % 60;

    bits.push(`😴 ${sh}h${sm ? ` ${sm}m` : ''} sleep`);
  }

  bits.push(`💧 ${Number(c?.waterOz || 0)} oz water`);

  $('#checkInSummary').innerHTML = bits.map(x => `<span>${escapeHtml(x)}</span>`).join('');
}

function renderNutrition() {
  const workoutDate = activeDate();

  const entries = (state.nutrition || []).filter(n => n.date === workoutDate);

  const totals = entries.reduce(
    (acc, e) => {
      ['calories', 'protein', 'carbs', 'fat'].forEach(key => (acc[key] += Number(e[key]) || 0));

      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  $('#calorieTotal').textContent = Math.round(totals.calories);

  $('#proteinTotal').textContent = `${Math.round(totals.protein)}g`;

  $('#carbTotal').textContent = `${Math.round(totals.carbs)}g`;

  $('#fatTotal').textContent = `${Math.round(totals.fat)}g`;

  $('#foodLog').innerHTML = entries.length
    ? entries
        .map(
          e => `
              <div class="food-row">
                <span>
                  ${escapeHtml(e.icon || '🍽️')}
                </span>

                <div>
                  <strong>
                    ${escapeHtml(e.name)}
                  </strong>

                  <small>
                    ${escapeHtml(e.serving || '1 serving')}
                    · ${Math.round(Number(e.calories) || 0)} cal
                    ${e.source ? ` · ${escapeHtml(e.source)}` : ''}
                    ${Number(e.hydrationOz) ? ` · 💧 ${Number(e.hydrationOz)} oz` : ''}
                  </small>
                </div>

                <b>
                  ${Math.round(Number(e.protein) || 0)}g P
                </b>
              </div>
            `
        )
        .join('')
    : `
          <div class="empty-state">
            No provisions logged yet.
            Add your first meal when you’re ready.
          </div>
        `;
}

function renderWeek() {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDates = weekDatesOf(localDateISO());
  const monday = weekDates[0];
  const weekSet = new Set(weekDates);

  const loggedWorkouts = state.workouts.filter(w => Array.isArray(w.exercises) && w.exercises.length > 0);
  const workoutDates = new Set(loggedWorkouts.map(w => w.date));

  $('#weekGrid').innerHTML = labels
    .map((label, index) => {
      const active = workoutDates.has(weekDates[index]);
      return `
        <div class="day ${active ? 'active' : ''}">
          <strong>${label}</strong>
          ${active ? '✓' : '·'}
        </div>
      `;
    })
    .join('');

  // Campaign week number, counted from the Monday of the first logged workout.
  const firstDate = loggedWorkouts.map(w => w.date).sort()[0];
  const weekNumber = firstDate
    ? Math.max(1, Math.round((dateFromISO(monday) - dateFromISO(mondayOf(firstDate))) / (7 * 86400000)) + 1)
    : 1;
  const rangeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  $('#weekLabel').textContent =
    `Week ${weekNumber} · ${rangeFormat.format(dateFromISO(weekDates[0]))}–${rangeFormat.format(dateFromISO(weekDates[6]))}`;

  const thisWeek = loggedWorkouts.filter(w => weekSet.has(w.date));
  const exercises = thisWeek.flatMap(w => w.exercises);
  const { strengthSets: sets, cardio } = exerciseTotals(exercises);
  const days = new Set(thisWeek.map(w => w.date)).size;

  $('#weeklySummary').textContent =
    `This week: ${days} adventure${days === 1 ? '' : 's'} · ${sets} strength sets · ${cardio} cardio minutes.`;
}

function renderQuests() {
  const workout = activeWorkout();

  const exerciseCount = (workout.exercises || []).length;

  const checkIn = getCheckIn(workout.date);

  const nutritionCount = (state.nutrition || []).filter(item => item.date === workout.date).length;

  const quests = [
    { name: 'Complete one training move', complete: exerciseCount > 0 },
    {
      name: 'Log your daily recovery intel',
      complete: Boolean(checkIn && (checkIn.weight || checkIn.sleepMinutes != null || checkIn.waterOz))
    },
    { name: 'Log today’s provisions', complete: nutritionCount > 0 }
  ];

  const complete = quests.filter(quest => quest.complete).length;

  $('#questCount').textContent = `${complete}/${quests.length}`;

  $('#questList').innerHTML = quests
    .map(
      quest => `
            <div class="mini-quest ${quest.complete ? 'done' : ''}">
              <span>
                ${quest.complete ? '✓' : '○'}
              </span>

              <strong>
                ${escapeHtml(quest.name)}
              </strong>
            </div>
          `
    )
    .join('');
}

function renderAchievements(summary) {
  $('#achievementCount').textContent = `${summary.unlocked.length} / ${summary.total.toLocaleString()}`;

  const unlocked = summary.unlocked.slice(-3).reverse();

  const upcoming = summary.archive
    .filter(a => !a.unlocked && a.kind !== 'landmark' && a.kind !== 'secret')
    .slice(0, 2);

  const cards = [...unlocked, ...upcoming].slice(0, 5);

  $('#achievementPreview').innerHTML = cards
    .map(
      a => `
            <div class="achievement ${a.unlocked ? 'unlocked' : 'locked'}">
              <span>
                ${a.unlocked ? a.icon : '🔒'}
              </span>

              <div>
                <strong>
                  ${escapeHtml(a.name)}
                </strong>

                <small>
                  ${a.unlocked ? a.flavor || 'Achievement unlocked' : `Target: ${a.target.toLocaleString()}`}
                </small>
              </div>
            </div>
          `
    )
    .join('');

  $('#distanceTotal').textContent = `${summary.distance.toFixed(2)} mi`;

  const next = summary.nextLandmark;

  $('#nextLandmarkName').textContent = next.unlocked ? 'Atlas Campaign Complete' : next.name;

  $('#nextLandmarkProgress').textContent = next.unlocked
    ? 'Legendary distance achieved.'
    : `${next.remaining.toFixed(2)} mi remaining · ${next.place}`;

  const prevIndex = summary.landmarks.findIndex(l => l.id === next.id) - 1;

  const prevMiles = prevIndex >= 0 ? summary.landmarks[prevIndex].miles : 0;

  const pct = next.unlocked
    ? 100
    : Math.max(0, Math.min(100, ((summary.distance - prevMiles) / (next.miles - prevMiles)) * 100));

  $('#landmarkBar').style.width = `${pct}%`;

  const unlockedLandmarks = summary.landmarks.filter(l => l.unlocked);

  const visible = [...unlockedLandmarks.slice(-3), ...summary.landmarks.filter(l => !l.unlocked).slice(0, 4)];

  $('#landmarkGrid').innerHTML = visible
    .map(
      l => `
            <article
              class="landmark ${l.unlocked ? 'unlocked' : 'locked'}"
            >
              <div class="sketch">
                ${sketchSVG(l.sketch)}
              </div>

              <div class="landmark-copy">
                <span>
                  ${l.unlocked ? 'FIELD STAMPED' : 'DISTANCE TARGET'}
                </span>

                <strong>
                  ${escapeHtml(l.name)}
                </strong>

                <small>
                  ${escapeHtml(l.place)}
                  · ${l.miles.toLocaleString()} mi
                </small>

                <p>
                  ${l.unlocked ? escapeHtml(l.flavor) : `${l.remaining.toFixed(2)} mi to unlock`}
                </p>
              </div>
            </article>
          `
    )
    .join('');
}

function openExerciseDialog(exercise = null, editIndex = null) {
  const isLoggedExercise = editIndex !== null;

  if (!isLoggedExercise && activeWorkout().completed) {
    toast('🏁 This adventure has ended. Its moves can still be edited, but new ones can’t be added.');
    return;
  }

  // Remember which record is being edited, so a date change or another
  // module's save while the dialog is open can't redirect the edit.
  editTarget = isLoggedExercise
    ? { date: activeDate(), key: exercise?.id || exercise?.loggedAt || null, index: editIndex }
    : null;

  $('#exerciseDialogTitle').textContent = isLoggedExercise
    ? 'Edit Exercise'
    : exercise
      ? `Log ${exercise.name}`
      : 'Teach LEVEL IRL a Move';

  $('#exerciseSubmitBtn').textContent = isLoggedExercise ? 'Save Changes' : 'Log the Move';

  $('#exerciseName').value = exercise?.name || '';

  $('#exerciseType').value = exercise?.type || 'strength';

  $('#exerciseIcon').value = exercise?.icon || (exercise?.type === 'cardio' ? '🏃' : '⚔️');

  $('#exerciseSets').value = exercise?.sets || 3;

  $('#exerciseReps').value = exercise?.reps || 10;

  $('#exerciseWeight').value = exercise?.weight || '';

  $('#exerciseDuration').value = exercise?.duration || 20;

  $('#exerciseDistance').value = exercise?.distance ?? '';

  $('#exerciseDistanceUnit').value = exercise?.distanceUnit || 'mi';

  const form = $('#exerciseForm');
  form.dataset.changed = '';
  const draft = !isLoggedExercise && !exercise ? readMoveDraft() : null;
  if (draft?.date === activeDate() && draft.fields?.Name) {
    MOVE_FIELDS.forEach(f => {
      if (draft.fields[f] != null) $(`#exercise${f}`).value = draft.fields[f];
    });
    form.dataset.changed = 'true';
    $('#exerciseDialogTitle').textContent = 'Finish Your Move';
  }

  updateExerciseFields();

  $('#exerciseDialog').showModal();
}

function updateExerciseFields() {
  const cardio = $('#exerciseType').value === 'cardio';

  $('#strengthFields').hidden = cardio;

  $('#cardioFields').hidden = !cardio;
}

const TYPE_FIELDS = ['sets', 'reps', 'weight', 'duration', 'distance', 'distanceUnit'];

// Keep an edited exercise's identity and log time, and drop fields from its old type.
function mergeEditedExercise(previous = {}, entry) {
  const kept = { ...previous };
  TYPE_FIELDS.forEach(field => delete kept[field]);
  return { ...kept, ...entry, id: previous.id || entry.id, loggedAt: previous.loggedAt || entry.loggedAt };
}

function saveExercise(ev) {
  ev.preventDefault();

  const name = $('#exerciseName').value.trim();

  if (!name) return;

  const type = $('#exerciseType').value;

  const icon = $('#exerciseIcon').value.trim() || exerciseIcon(name, type);

  const duration = +$('#exerciseDuration').value || 1;

  const distance = +$('#exerciseDistance').value || 0;

  const loggedAt = new Date().toISOString();
  const entry =
    type === 'cardio'
      ? {
          id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          name,
          duration,
          distance: distance || null,
          distanceUnit: $('#exerciseDistanceUnit').value,
          icon,
          loggedAt,
          xp: nextExerciseXP(type, 0, duration, distance)
        }
      : {
          id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          name,
          sets: +$('#exerciseSets').value || 1,
          reps: +$('#exerciseReps').value || 1,
          weight: $('#exerciseWeight').value.trim() || null,
          icon,
          loggedAt,
          xp: nextExerciseXP(type, +$('#exerciseSets').value)
        };

  const editing = Boolean(editTarget);

  if (editTarget) {
    const { date, key, index } = editTarget;
    const workout = state.workouts.find(w => w.date === date);
    const list = workout?.exercises || [];
    let slot = key ? list.findIndex(e => (e?.id || e?.loggedAt) === key) : -1;
    if (slot < 0 && !key && list[index]) slot = index;
    editTarget = null;
    if (slot < 0) {
      $('#exerciseDialog').close();
      toast('That exercise changed elsewhere. Reopen it to edit.');
      render();
      return;
    }
    list[slot] = mergeEditedExercise(list[slot], entry);
  } else {
    const targetWorkout = activeWorkout();
    if (targetWorkout.completed) {
      $('#exerciseDialog').close();
      toast('🏁 This adventure has ended. New moves can’t be added.');
      return;
    }
    if (targetWorkout.transient) {
      delete targetWorkout.transient;
      targetWorkout.startedAt = loggedAt;
      targetWorkout.startTimeExact = viewDate ? null : timeLabel(loggedAt);
      state.workouts.push(targetWorkout);
      draftWorkout = null;
    }
    targetWorkout.exercises.push(entry);
  }

  const existing = state.exerciseLibrary.find(e => e.name.trim().toLowerCase() === name.toLowerCase());

  if (!existing) {
    state.exerciseLibrary.push({ id: slugify(name), name, type, icon });

    toast(`📖 ${name} learned by the Exercise Codex!`);
  } else {
    existing.type = type;

    existing.icon = icon;

    toast(editing ? `✎ ${name} updated` : `⚔️ ${name} logged!`);
  }

  if (!editing) clearMoveDraft();
  $('#exerciseDialog').close();

  render();
}

function fillFood(food) {
  $('#foodName').value = food?.name || '';

  $('#foodServing').value = food?.serving || '1 serving';

  $('#foodCalories').value = Number.isFinite(Number(food?.calories)) ? Number(food.calories).toFixed(0) : '';

  $('#foodProtein').value = food?.protein ?? '';

  $('#foodCarbs').value = food?.carbs ?? '';

  $('#foodFat').value = food?.fat ?? '';

  $('#foodHydration').value = food?.hydrationOz ?? '';

  $('#foodIcon').value = food?.icon || '🍽️';

  $('#foodSource').value = food?.source || '';
}

function openFoodDialog(food = null) {
  fillFood(food || {});

  $('#onlineFoodResults').hidden = true;

  $('#onlineFoodResults').innerHTML = '';

  $('#foodDialog').showModal();
}

function saveFood(ev) {
  ev.preventDefault();

  const name = $('#foodName').value.trim();

  if (!name) return;

  const hydrationOz = +$('#foodHydration').value || 0;

  const entry = {
    id: `food-${Date.now()}`,

    date: activeDate(),

    name,

    serving: $('#foodServing').value.trim(),

    calories: +$('#foodCalories').value || 0,

    protein: +$('#foodProtein').value || 0,

    carbs: +$('#foodCarbs').value || 0,

    fat: +$('#foodFat').value || 0,

    hydrationOz,

    icon: $('#foodIcon').value.trim() || '🍽️',

    source: $('#foodSource').value || null
  };

  entry.xp = nutritionXP(entry);

  state.nutrition.push(entry);

  if (hydrationOz) {
    const c = getCheckIn(entry.date);

    upsertCheckIn({ waterOz: Number(c?.waterOz || 0) + hydrationOz }, entry.date);
  }

  $('#foodDialog').close();

  toast(`🍎 Provisions logged · +${entry.xp} XP`);

  render();
  window.dispatchEvent(new CustomEvent('fitquest:nutrition-updated'));
}

async function lookupFood() {
  const term = $('#foodName').value.trim();

  if (term.length < 2) {
    toast('🔎 Type at least 2 letters first');

    return;
  }

  const btn = $('#foodLookupBtn');

  const resultBox = $('#onlineFoodResults');

  btn.disabled = true;

  btn.textContent = 'Searching…';

  resultBox.hidden = false;

  resultBox.innerHTML = '<div class="search-status">Contacting Open Food Facts…</div>';

  try {
    const results = await searchOpenFoodFacts(term);

    if (!results.length) {
      resultBox.innerHTML =
        '<div class="search-status">No matching products found. Try a brand or a more specific name.</div>';

      return;
    }

    resultBox.innerHTML = results
      .map(
        (f, i) => `
            <button
              type="button"
              class="online-food-result"
              data-online-index="${i}"
            >
              <span>🔎</span>

              <div>
                <strong>
                  ${escapeHtml(f.name)}
                </strong>

                <small>
                  ${escapeHtml(f.brand || 'Open Food Facts')}
                  · ${escapeHtml(f.serving)}
                </small>
              </div>

              <b>
                ${Math.round(f.calories || 0)} cal
              </b>
            </button>
          `
      )
      .join('');

    $$('[data-online-index]').forEach(el =>
      el.addEventListener('click', () => {
        fillFood(results[+el.dataset.onlineIndex]);

        resultBox.hidden = true;

        toast('🔎 Nutrition data loaded — verify the serving size');
      })
    );
  } catch (err) {
    resultBox.innerHTML =
      '<div class="search-status error">Online lookup is unavailable right now. Built-in foods and manual entry still work.</div>';

    console.warn(err);
  } finally {
    btn.disabled = false;

    btn.textContent = '🔎 Search Online';
  }
}

function saveIdentity() {
  const dob = $('#profileDob').value;

  const parsed = parseHeight($('#profileHeightText').value);

  if (!dob) {
    toast('🎂 Add your date of birth first');

    return;
  }

  if (!parsed) {
    toast('📏 Try height like 5\'10", 70 in, or 178 cm');

    return;
  }

  state.profile.dateOfBirth = dob;

  Object.assign(state.profile, parsed);

  delete state.profile.age;
  delete state.profile.height;
  delete state.profile.heightUnit;

  $('#identityEditor').hidden = true;

  toast('🧙 Identity stats locked into your dossier');

  render();
}

function saveCheckIn({ quiet = false } = {}) {
  const hRaw = $('#dailySleepHours').value;

  const mRaw = $('#dailySleepMinutes').value;

  const hasSleep = hRaw !== '' || mRaw !== '';

  const h = Math.max(0, Math.min(24, parseInt(hRaw || '0', 10) || 0));

  const m = Math.max(0, Math.min(59, parseInt(mRaw || '0', 10) || 0));

  const sleepMinutes = hasSleep ? h * 60 + m : null;

  const patch = {
    weight: +$('#dailyWeight').value || null,

    weightUnit: $('#dailyWeightUnit').value,

    sleepMinutes,

    sleepHours: sleepMinutes == null ? null : Number((sleepMinutes / 60).toFixed(2)),

    waterOz: +$('#dailyWater').value || 0
  };

  upsertCheckIn(patch);

  if (!quiet) toast('📡 Daily recovery intel saved');

  clearDirty(CHECK_IN_INPUTS, { keepFocused: quiet });

  render();
  window.dispatchEvent(new CustomEvent('fitquest:checkin-saved'));
}

function addWater(amount) {
  const next = (+$('#dailyWater').value || 0) + amount;

  $('#dailyWater').value = next;

  upsertCheckIn({ waterOz: next });

  clearDirty(['#dailyWater']);

  toast(`💧 +${amount} oz water`);

  render();
  window.dispatchEvent(new CustomEvent('fitquest:checkin-saved'));
}

function createNewWorkout(ev) {
  ev.preventDefault();

  const dateValue = $('#newWorkoutDate').value || localDateISO();

  if (dateValue > localDateISO()) {
    toast('📅 Adventures can’t be logged for future dates.');
    return;
  }

  const day = weekdayName(dateValue);

  const time = $('#newWorkoutTime').value || timeLabel();

  const existingWorkout = state.workouts.find(workout => workout.date === dateValue);
  if (existingWorkout) {
    $('#newWorkoutDialog').close();
    toast(`📅 ${dateValue} already has a workout. Opening that record instead.`);
    setViewDate(dateValue);
    return;
  }

  state.workouts.push({
    id: `${dateValue}-day-${Date.now()}`,

    date: dateValue,

    day,

    title: $('#newWorkoutTitle').value.trim() || 'A New Adventure',

    startTime: '',

    startTimeExact: time,

    startedAt: new Date().toISOString(),

    note: $('#newWorkoutNote').value.trim() || 'A new adventure begins.',

    exercises: [],

    // Kept as a record even before its first move.
    planned: true
  });

  $('#newWorkoutDialog').close();

  toast('🗺️ New adventure started!');

  setViewDate(dateValue);

  // The codex lives on the Training screen, which is hidden unless active.
  $('[data-fitquest-nav="training"]')?.click();

  setTimeout(() => $('#exerciseCodexSection')?.scrollIntoView({ behavior: 'smooth' }), 150);
}

function bindAppEvents() {
  $('#addExerciseBtn').addEventListener('click', () => openExerciseDialog());

  $('#exerciseType').addEventListener('change', updateExerciseFields);

  $('#exerciseForm').addEventListener('submit', saveExercise);

  $('#editIdentityBtn').addEventListener('click', () => {
    $('#identityEditor').hidden = !$('#identityEditor').hidden;
  });

  $('#saveIdentityBtn').addEventListener('click', saveIdentity);

  $('#saveCheckInBtn').addEventListener('click', () => {
    clearTimeout(checkInTimer);
    checkInTimer = null;
    saveCheckIn();
  });

  $$('[data-water-add]').forEach(b => b.addEventListener('click', () => addWater(+b.dataset.waterAdd)));

  $('#addFoodBtn').addEventListener('click', () => openFoodDialog());

  $('#foodForm').addEventListener('submit', saveFood);

  $('#foodLookupBtn').addEventListener('click', lookupFood);

  $('#foodName').addEventListener('change', () => {
    const match = findQuickFood($('#foodName').value);

    if (match) {
      fillFood(match);
    }
  });

  $('#quickFoods').innerHTML = quickFoods
    .slice(0, 18)
    .map((f, i) => `<button class="food-chip" data-food-index="${i}">${f.icon} ${f.name}</button>`)
    .join('');

  $$('[data-food-index]').forEach(btn =>
    btn.addEventListener('click', () => openFoodDialog(quickFoods[+btn.dataset.foodIndex]))
  );

  $('#foodSuggestions').innerHTML = quickFoods
    .map(f => `<option value="${escapeHtml(f.name)}"></option>`)
    .join('');

  $('#newWorkoutBtn').addEventListener('click', () => {
    const now = new Date();

    $('#newWorkoutDate').value = localDateISO(now);

    // Adventures can be backfilled, but not scheduled in the future.
    $('#newWorkoutDate').max = localDateISO(now);

    $('#newWorkoutTime').value = timeLabel(now);

    $('#newWorkoutTitle').value = '';

    $('#newWorkoutNote').value = '';

    $('#newWorkoutDialog').showModal();
  });

  $('#newWorkoutForm').addEventListener('submit', createNewWorkout);

  // One listener closes every dialog, including ones other modules add later.
  document.addEventListener('click', ev => {
    const closeBtn = ev.target.closest?.('.dialog-close');
    if (closeBtn) {
      closeDialog(closeBtn.closest('dialog'));
      return;
    }
    if (ev.target instanceof HTMLDialogElement) {
      // A tap beside a half-filled form (often just to hide the keyboard) must not discard it.
      if (hasUnsavedEntry(ev.target)) document.activeElement?.blur?.();
      else ev.target.close();
    }
  });

  ['#exerciseDialog', '#foodDialog'].forEach(selector => {
    const dialog = $(selector);
    dialog.addEventListener('cancel', ev => {
      if (!hasUnsavedEntry(dialog)) return;
      ev.preventDefault();
      closeDialog(dialog);
    });
    dialog.querySelector('form').addEventListener('input', () => {
      dialog.querySelector('form').dataset.changed = 'true';
      if (selector === '#exerciseDialog' && !editTarget) storeMoveDraft();
    });
  });

  $('#exerciseDialog').addEventListener('close', () => {
    editTarget = null;
    $('#exerciseForm').dataset.changed = '';
  });
  $('#foodDialog').addEventListener('close', () => {
    $('#foodForm').dataset.changed = '';
  });

  $('#classifiedBtn').addEventListener('click', () => {
    const m = $('#classifiedMessage');

    m.hidden = !m.hidden;

    toast(m.hidden ? '📡 Field channel closed' : '📡 Encrypted field note decoded');
  });

  $('#levelChip').addEventListener('click', () => {
    titleTapCount++;

    if (titleTapCount >= 5) {
      titleTapCount = 0;

      state.ui.stealthMode = !state.ui.stealthMode;

      toast(
        state.ui.stealthMode
          ? '❗ Stealth Interface engaged. Keep a low profile.'
          : '📡 Standard interface restored.'
      );

      render();
    }
  });
}

async function start() {
  state = loadSave(seedData);

  bindAppEvents();

  CHECK_IN_INPUTS.forEach(selector => {
    const input = $(selector);
    input?.addEventListener('input', () => {
      input.dataset.dirty = 'true';
      queueCheckInSave();
    });
    input?.addEventListener('change', flushCheckInSave);
  });

  window.addEventListener('fitquest:saved', event => {
    if (event.detail?.source !== 'app') void reloadState();
  });
  window.addEventListener('fitquest:remote-update', () => void reloadState());
  // Workout History can ask to open a specific day.
  window.addEventListener('fitquest:open-date', event => {
    setViewDate(event.detail?.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  // A page left open overnight moves on to the new day when it is shown again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushCheckInSave();
    else if (localDateISO() !== renderedToday) setViewDate(viewDate);
  });
  window.addEventListener('pagehide', flushCheckInSave);
  document.documentElement.dataset.activeDate = viewDate || '';

  try {
    render();
  } catch (error) {
    console.error('Render failed:', error);
    toast('⚠️ Some saved data could not be shown.', { tone: 'warn' });
  } finally {
    const appRoot = $('#appRoot');
    if (appRoot) appRoot.hidden = false;
  }

  resumeMoveDraft();
}

// Reopen a move that was being typed when the app closed, on the day it belongs to.
function resumeMoveDraft() {
  const draft = readMoveDraft();
  if (!draft?.fields?.Name) return;
  const today = localDateISO();
  if (!draft.date || draft.date > today || draft.date < addDays(today, -2)) {
    clearMoveDraft();
    return;
  }
  if (draft.date !== activeDate()) setViewDate(draft.date);
  openExerciseDialog();
  toast('↩︎ Your unsaved move is back. Log it or close it.');
}

void start();
