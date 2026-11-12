import { readSave, writeSave, ensureCheckIn } from './lib/storage.js';
import { $, localDateISO, activeDateISO, shortDateLabel, weekDatesOf, injectStyles, appVisible, whenReady } from './lib/dom.js';


const DAILY_STEP_BADGES = [
  { id: 'steps-5k', target: 5000, icon: '🥾', name: 'Trail Walker' },
  { id: 'steps-10k', target: 10000, icon: '👟', name: 'Ten Thousand Strong' },
  { id: 'steps-15k', target: 15000, icon: '⚡', name: 'Road Warrior' },
  { id: 'steps-20k', target: 20000, icon: '🪽', name: 'Twenty Thousand Legend' }
];

const ACTIVITY_INPUTS = ['#fitquestSteps', '#fitquestActiveCalories', '#fitquestExerciseMinutes', '#fitquestStandHours'];

let busy = false;

function styles() {
  injectStyles('fitquestActivityStyles', `
    .fitquest-activity-card {
      color: #f7f8ff;
    }

    .fitquest-activity-date {
      background: rgba(255,255,255,.055);
      border: 1px solid rgba(255,255,255,.08);
      color: #a8b3ca;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .fitquest-activity-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .fitquest-activity-grid label {
      display: grid;
      align-content: end;
      gap: 8px;
      color: #b9c3d7;
      font-size: 13px;
      font-weight: 800;
    }

    .fitquest-activity-grid input {
      width: 100%;
      box-sizing: border-box;
      min-height: 50px;
      border-radius: 13px;
      border: 1px solid rgba(255,255,255,.10);
      background: #080d19;
      color: #fff;
      padding: 0 14px;
      font: inherit;
    }

    .fitquest-activity-save {
      width: 100%;
      min-height: 52px;
      margin-top: 16px;
      border: 0;
      border-radius: 14px;
      background: linear-gradient(135deg, #5f83ff, #a356f2);
      color: #fff;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }

    .fitquest-activity-message {
      min-height: 18px;
      margin: 10px 0 0;
      color: #8fa0ba;
      font-size: 12px;
      text-align: center;
    }

    .fitquest-activity-message.success {
      color: #72eab4;
    }

    .fitquest-activity-message.error {
      color: #ff9da7;
    }

    .fitquest-activity-message:empty {
      min-height: 0;
      margin: 0;
    }

    .fitquest-week-totals {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }

    .fitquest-week-totals > div {
      padding: 13px;
      border-radius: 14px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.07);
    }

    .fitquest-week-totals span,
    .fitquest-week-totals strong {
      display: block;
    }

    .fitquest-week-totals span {
      color: #8491aa;
      font-size: 10px;
      text-transform: uppercase;
    }

    .fitquest-week-totals strong {
      margin-top: 4px;
      color: #eef2ff;
    }

    .fitquest-activity-achievements {
      display: grid;
      gap: 9px;
      margin-top: 16px;
    }

    .fitquest-activity-badge {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 13px;
      border-radius: 14px;
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.07);
    }

    .fitquest-activity-badge.locked {
      opacity: .56;
    }

    .fitquest-activity-badge > span {
      font-size: 23px;
    }

    .fitquest-activity-badge strong,
    .fitquest-activity-badge small {
      display: block;
    }

    .fitquest-activity-badge small {
      margin-top: 2px;
      color: #8793aa;
    }

    .fitquest-watch-note {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(91, 199, 255, .15);
      background: rgba(91, 199, 255, .06);
      color: #9eb5cf;
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 760px) {
      .fitquest-activity-grid,
      .fitquest-week-totals {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `);
}

function ensureActivityAchievements(data) {
  data.ui ||= {};
  data.ui.rpg ||= {};
  data.ui.rpg.activityAchievements ||= {};
  return data.ui.rpg.activityAchievements;
}

function evaluateAchievements(data, checkIn) {
  const unlocked = ensureActivityAchievements(data);
  const newlyUnlocked = [];

  DAILY_STEP_BADGES.forEach(badge => {
    if (Number(checkIn.steps) >= badge.target && !unlocked[badge.id]) {
      unlocked[badge.id] = {
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        target: badge.target,
        unlockedAt: new Date().toISOString(),
        date: checkIn.date
      };

      newlyUnlocked.push(badge);
    }
  });

  return newlyUnlocked;
}

function weekEntries(data) {
  const allowed = new Set(weekDatesOf(localDateISO()));
  return (data.checkIns || []).filter(item => allowed.has(item.date));
}

function totals(entries) {
  return entries.reduce((acc, entry) => {
    acc.steps += Number(entry.steps) || 0;
    acc.activeCalories += Number(entry.activeCalories) || 0;
    acc.exerciseMinutes += Number(entry.exerciseMinutes) || 0;
    acc.standHours += Number(entry.standHours) || 0;
    if (
      Number(entry.steps) > 0 ||
      Number(entry.activeCalories) > 0 ||
      Number(entry.exerciseMinutes) > 0 ||
      Number(entry.standHours) > 0
    ) {
      acc.activeDays += 1;
    }
    return acc;
  }, {
    steps: 0,
    activeCalories: 0,
    exerciseMinutes: 0,
    standHours: 0,
    activeDays: 0
  });
}

function install() {
  if ($('#fitquestDailyActivity')) return true;
  const appRoot = $('#appRoot');
  if (!appRoot || appRoot.hidden) return false;

  const section = document.createElement('section');
  section.id = 'fitquestDailyActivity';
  section.className = 'card fitquest-activity-card';

  section.innerHTML = `
    <div class="section-heading fitquest-activity-head">
      <div>
        <p class="eyebrow">APPLE WATCH · MANUAL FIELD LOG</p>
        <h3>Daily Activity</h3>
      </div>
      <span class="pill fitquest-activity-date" id="fitquestActivityDate">Today</span>
    </div>

    <div class="fitquest-activity-grid">
      <label>
        👟 Steps
        <input
          id="fitquestSteps"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          placeholder="e.g. 10428"
        >
      </label>

      <label>
        🔥 Active calories burned
        <input
          id="fitquestActiveCalories"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          placeholder="e.g. 612"
        >
      </label>

      <label>
        🏃 Exercise minutes
        <input
          id="fitquestExerciseMinutes"
          type="number"
          min="0"
          step="1"
          inputmode="numeric"
          placeholder="e.g. 47"
        >
      </label>

      <label>
        🧍 Stand hours
        <input
          id="fitquestStandHours"
          type="number"
          min="0"
          max="24"
          step="1"
          inputmode="numeric"
          placeholder="e.g. 12"
        >
      </label>
    </div>

    <button
      class="fitquest-activity-save"
      id="fitquestSaveActivity"
      type="button"
    >
      Save Daily Activity
    </button>

    <p
      class="fitquest-activity-message"
      id="fitquestActivityMessage"
    ></p>

    <div class="fitquest-watch-note">
      ⌚ Enter the totals shown by Apple Watch / Fitness at the end of the day.
      LEVEL IRL stores them in the same dated check-in used by your recovery data.
    </div>
  `;

  const week = document.createElement('section');
  week.id = 'fitquestWeeklyActivity';
  week.className = 'card fitquest-week-card';
  week.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">WEEKLY MOVEMENT · FIELD TOTALS</p>
        <h3>Activity Campaign</h3>
      </div>
    </div>
    <div class="fitquest-week-totals" id="fitquestWeekTotals"></div>
    <div class="fitquest-activity-achievements" id="fitquestActivityAchievements"></div>
  `;

  const host =
    $('#fitquestScreenGrid-activity') ||
    $('#appRoot main');

  host.appendChild(section);
  host.appendChild(week);

  $('#fitquestSaveActivity').addEventListener('click', () => flushAutosave());
  ACTIVITY_INPUTS.forEach(sel => {
    const input = $(sel);
    input?.addEventListener('input', () => {
      input.dataset.dirty = 'true';
      queueAutosave();
    });
    input?.addEventListener('change', () => flushAutosave(true));
  });
  return true;
}

// Typed-but-unsaved values, and the field being typed in, survive re-renders.
function setInputValue(input, value) {
  if (input && input.dataset.dirty !== 'true' && document.activeElement !== input) input.value = value;
}

function clearDirty({ keepFocused = false } = {}) {
  ACTIVITY_INPUTS.forEach(sel => {
    const input = $(sel);
    if (input && !(keepFocused && document.activeElement === input)) delete input.dataset.dirty;
  });
}

// Activity saves itself shortly after typing stops, so nothing is lost if the app is closed.
let autosaveTimer = null;

function queueAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void save({ quiet: true });
  }, 900);
}

function flushAutosave(quiet = false) {
  const pending = autosaveTimer !== null;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (quiet && !pending && !ACTIVITY_INPUTS.some(sel => $(sel)?.dataset.dirty === 'true')) return;
  void save({ quiet });
}

function renderAchievements(data) {
  const box = $('#fitquestActivityAchievements');
  if (!box) return;

  const unlocked = ensureActivityAchievements(data);

  box.innerHTML = DAILY_STEP_BADGES.map(badge => {
    const earned = unlocked[badge.id];

    return `
      <div class="fitquest-activity-badge ${earned ? '' : 'locked'}">
        <span>${earned ? badge.icon : '🔒'}</span>
        <div>
          <strong>${badge.name}</strong>
          <small>
            ${earned
              ? `Unlocked with ${badge.target.toLocaleString()}+ steps`
              : `Reach ${badge.target.toLocaleString()} steps in one day`}
          </small>
        </div>
      </div>
    `;
  }).join('');
}

async function render() {
  if (!install()) return;

  try {
    const data = readSave();
    if (!data) return;

    const day = activeDateISO();
    const card = $('#fitquestDailyActivity');

    if (card.dataset.date !== day) {
      clearDirty();
      const message = $('#fitquestActivityMessage');
      if (message) {
        message.className = 'fitquest-activity-message';
        message.textContent = '';
      }
    }

    card.dataset.date = day;

    const checkIn = (data.checkIns || []).find(item => item.date === day) || null;

    $('#fitquestActivityDate').textContent = shortDateLabel(day);

    setInputValue($('#fitquestSteps'), checkIn?.steps ?? '');
    setInputValue($('#fitquestActiveCalories'), checkIn?.activeCalories ?? '');
    setInputValue($('#fitquestExerciseMinutes'), checkIn?.exerciseMinutes ?? '');
    setInputValue($('#fitquestStandHours'), checkIn?.standHours ?? '');

    const week = totals(weekEntries(data));

    $('#fitquestWeekTotals').innerHTML = `
      <div><span>Steps</span><strong>${week.steps.toLocaleString()}</strong></div>
      <div><span>Active Calories</span><strong>${Math.round(week.activeCalories).toLocaleString()}</strong></div>
      <div><span>Exercise</span><strong>${Math.round(week.exerciseMinutes)} min</strong></div>
      <div><span>Active Days</span><strong>${week.activeDays} / 7</strong></div>
    `;

    renderAchievements(data);

  } catch (error) {
    console.warn('Daily Activity render failed:', error);
  }
}

async function save({ quiet = false } = {}) {
  if (busy) {
    queueAutosave();
    return;
  }
  busy = true;

  const message = $('#fitquestActivityMessage');

  try {
    const data = readSave();

    if (!data) {
      throw new Error('No LEVEL IRL save is available.');
    }

    const day = $('#fitquestDailyActivity')?.dataset.date || activeDateISO();
    const checkIn = ensureCheckIn(data, day);

    checkIn.steps =
      Math.max(0, Math.round(Number($('#fitquestSteps').value) || 0));

    checkIn.activeCalories =
      Math.max(0, Math.round(Number($('#fitquestActiveCalories').value) || 0));

    checkIn.exerciseMinutes =
      Math.max(0, Math.round(Number($('#fitquestExerciseMinutes').value) || 0));

    checkIn.standHours =
      Math.max(0, Math.min(24, Math.round(Number($('#fitquestStandHours').value) || 0)));

    checkIn.activityUpdatedAt = new Date().toISOString();

    const unlocked = evaluateAchievements(data, checkIn);

    const ok = writeSave(data);
    if (!ok) throw new Error('Unable to save activity.');
    clearDirty({ keepFocused: quiet });
    window.dispatchEvent(new CustomEvent('fitquest:daily-activity-saved'));

    if (message) {
      message.className = 'fitquest-activity-message success';
      message.textContent = unlocked.length
        ? `Saved. Achievement unlocked: ${unlocked.map(item => `${item.icon} ${item.name}`).join(', ')}`
        : quiet ? 'Saved automatically.' : 'Daily activity saved.';
    }

    await render();

  } catch (error) {
    if (message) {
      message.className = 'fitquest-activity-message error';
      message.textContent = error?.message || 'Unable to save activity.';
    }
  } finally {
    busy = false;
  }
}

function boot() {
  styles();

  whenReady(() => appVisible(), () => {
    install();
    void render();
  }, 120);

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'activity') {
      void render();
    }
  });

  window.addEventListener('fitquest:remote-update', () => {
    void render();
  });

  window.addEventListener('fitquest:active-date', () => {
    if (autosaveTimer !== null) flushAutosave(true);
    void render();
  });
  const flushOnLeave = () => {
    if (autosaveTimer !== null) flushAutosave(true);
  };
  window.addEventListener('pagehide', flushOnLeave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnLeave();
  });

  // A card left open overnight would otherwise keep editing yesterday.
  document.addEventListener('visibilitychange', () => {
    const card = $('#fitquestDailyActivity');
    if (document.visibilityState === 'visible' && card && card.dataset.date !== activeDateISO()) {
      void render();
    }
  });
}

boot();
