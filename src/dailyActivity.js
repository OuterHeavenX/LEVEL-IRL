import { readSave, writeSave } from './lib/storage.js';
import { $, localDateISO } from './lib/dom.js';


const DAILY_STEP_BADGES = [
  { id: 'steps-5k', target: 5000, icon: '🥾', name: 'Trail Walker' },
  { id: 'steps-10k', target: 10000, icon: '👟', name: 'Ten Thousand Strong' },
  { id: 'steps-15k', target: 15000, icon: '⚡', name: 'Road Warrior' },
  { id: 'steps-20k', target: 20000, icon: '🪽', name: 'Twenty Thousand Legend' }
];

let busy = false;

function styles() {
  if ($('#fitquestActivityStyles')) return;

  const style = document.createElement('style');
  style.id = 'fitquestActivityStyles';
  style.textContent = `
    .fitquest-activity-card {
      padding: 24px;
      border-radius: 24px;
      border: 1px solid rgba(91, 199, 255, .16);
      background:
        radial-gradient(circle at 100% 0%, rgba(69, 190, 255, .10), transparent 36%),
        rgba(15, 22, 41, .95);
      color: #f7f8ff;
    }

    .fitquest-activity-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 20px;
    }

    .fitquest-activity-head h3 {
      margin: 3px 0 0;
    }

    .fitquest-activity-date {
      padding: 8px 11px;
      border-radius: 999px;
      background: rgba(255,255,255,.055);
      border: 1px solid rgba(255,255,255,.08);
      color: #a8b3ca;
      font-size: 11px;
      font-weight: 800;
    }

    .fitquest-activity-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .fitquest-activity-grid label {
      display: grid;
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

    .fitquest-activity-summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 18px;
    }

    .fitquest-activity-summary > div {
      padding: 13px;
      border-radius: 15px;
      background: rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.07);
    }

    .fitquest-activity-summary small,
    .fitquest-activity-summary strong {
      display: block;
    }

    .fitquest-activity-summary small {
      color: #8491aa;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .07em;
    }

    .fitquest-activity-summary strong {
      margin-top: 5px;
      font-size: 17px;
    }

    .fitquest-week-card {
      padding: 22px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,.09);
      background: rgba(15, 22, 41, .92);
    }

    .fitquest-week-card h3 {
      margin: 3px 0 16px;
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
      .fitquest-activity-summary,
      .fitquest-week-totals {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureCheckIn(data, date) {
  data.checkIns ||= [];

  let item = data.checkIns.find(checkIn => checkIn.date === date);

  if (!item) {
    item = {
      id: `checkin-${date}-${Date.now()}`,
      date,
      weight: null,
      weightUnit: 'lb',
      sleepHours: null,
      sleepMinutes: null,
      waterOz: 0
    };

    data.checkIns.push(item);
  }

  return item;
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

function mondayISO(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const delta = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - delta);
  return localDateISO(d);
}

function weekEntries(data) {
  const start = mondayISO();
  const monday = new Date(`${start}T12:00:00`);
  const allowed = new Set();

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    allowed.add(localDateISO(d));
  }

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
  section.className = 'fitquest-activity-card';

  section.innerHTML = `
    <div class="fitquest-activity-head">
      <div>
        <p class="eyebrow">APPLE WATCH · MANUAL FIELD LOG</p>
        <h3>Daily Activity</h3>
      </div>
      <span class="fitquest-activity-date" id="fitquestActivityDate">Today</span>
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

    <div
      class="fitquest-activity-summary"
      id="fitquestTodayActivitySummary"
    ></div>

    <div class="fitquest-watch-note">
      ⌚ Enter the totals shown by Apple Watch / Fitness at the end of the day.
      LEVEL IRL stores them in the same dated check-in used by your recovery data.
    </div>
  `;

  const week = document.createElement('section');
  week.id = 'fitquestWeeklyActivity';
  week.className = 'fitquest-week-card';
  week.innerHTML = `
    <p class="eyebrow">WEEKLY MOVEMENT · FIELD TOTALS</p>
    <h3>Activity Campaign</h3>
    <div class="fitquest-week-totals" id="fitquestWeekTotals"></div>
    <div class="fitquest-activity-achievements" id="fitquestActivityAchievements"></div>
  `;

  const host =
    $('#fitquestScreenGrid-activity') ||
    $('#appRoot main');

  host.appendChild(section);
  host.appendChild(week);

  $('#fitquestSaveActivity').addEventListener('click', save);
  window.dispatchEvent(new CustomEvent('fitquest:activity-ready'));
  return true;
}

function summaryHTML(checkIn) {
  return `
    <div><small>Steps</small><strong>${(Number(checkIn?.steps) || 0).toLocaleString()}</strong></div>
    <div><small>Active Cal</small><strong>${Math.round(Number(checkIn?.activeCalories) || 0)}</strong></div>
    <div><small>Exercise</small><strong>${Math.round(Number(checkIn?.exerciseMinutes) || 0)} min</strong></div>
    <div><small>Stand</small><strong>${Math.round(Number(checkIn?.standHours) || 0)} hr</strong></div>
  `;
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
    const data = (await readSave())?.save;
    if (!data) return;

    const today = localDateISO();
    const checkIn = (data.checkIns || []).find(item => item.date === today) || null;

    const pretty = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(new Date(`${today}T12:00:00`));

    $('#fitquestActivityDate').textContent = pretty;

    $('#fitquestSteps').value =
      checkIn?.steps ?? '';

    $('#fitquestActiveCalories').value =
      checkIn?.activeCalories ?? '';

    $('#fitquestExerciseMinutes').value =
      checkIn?.exerciseMinutes ?? '';

    $('#fitquestStandHours').value =
      checkIn?.standHours ?? '';

    $('#fitquestTodayActivitySummary').innerHTML =
      summaryHTML(checkIn);

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

async function save() {
  if (busy) return;
  busy = true;

  const button = $('#fitquestSaveActivity');
  const message = $('#fitquestActivityMessage');

  if (button) {
    button.disabled = true;
    button.textContent = 'Saving Activity…';
  }

  if (message) {
    message.className = 'fitquest-activity-message';
    message.textContent = 'Saving your LEVEL IRL campaign…';
  }

  try {
    const data = (await readSave())?.save;

    if (!data) {
      throw new Error('No LEVEL IRL save is available.');
    }

    const today = localDateISO();
    const checkIn = ensureCheckIn(data, today);

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

    const ok = await writeSave(data);
    if (!ok) throw new Error('Unable to save activity.');
    window.dispatchEvent(new CustomEvent('fitquest:daily-activity-saved'));

    if (message) {
      message.className = 'fitquest-activity-message success';
      message.textContent = unlocked.length
        ? `Saved. Achievement unlocked: ${unlocked.map(item => `${item.icon} ${item.name}`).join(', ')}`
        : 'Daily activity saved.';
    }

    await render();

  } catch (error) {
    if (message) {
      message.className = 'fitquest-activity-message error';
      message.textContent = error?.message || 'Unable to save activity.';
    }
  } finally {
    busy = false;

    if (button) {
      button.disabled = false;
      button.textContent = 'Save Daily Activity';
    }
  }
}

function boot() {
  styles();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;

    if ($('#appRoot') && !$('#appRoot').hidden) {
      clearInterval(timer);
      install();
      void render();
    } else if (attempts > 120) {
      clearInterval(timer);
    }
  }, 120);

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'activity') {
      void render();
    }
  });

  window.addEventListener('fitquest:remote-update', () => {
    void render();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
