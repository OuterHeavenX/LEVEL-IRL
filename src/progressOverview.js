import { readSave } from './lib/storage.js';
import { $, localDateISO, addDays } from './lib/dom.js';


let selectedRange = 30;
let busy = false;
let renderTimer = null;
let chartAnimationPlayed = false;


function enumerateDates(start, end) {
  const dates = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function number(value) {
  return Number(value) || 0;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function formatNumber(value) {
  return Math.round(number(value)).toLocaleString();
}

function styles() {
  if ($('#fitquestProgressOverviewStyles')) return;

  const style = document.createElement('style');
  style.id = 'fitquestProgressOverviewStyles';
  style.textContent = `
    .fitquest-overview {
      grid-column: 1 / -1;
      padding: 24px;
      border-radius: 25px;
      border: 1px solid rgba(128, 105, 255, .20);
      background:
        radial-gradient(circle at 82% 0%, rgba(170, 84, 244, .13), transparent 34%),
        radial-gradient(circle at 10% 15%, rgba(69, 190, 255, .08), transparent 28%),
        linear-gradient(145deg, rgba(18, 27, 52, .97), rgba(10, 16, 32, .98));
      box-shadow: 0 24px 70px rgba(0,0,0,.25);
      color: #f7f8ff;
    }

    .fitquest-overview-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
    }

    .fitquest-overview-head h3 {
      margin: 4px 0 5px;
      font-size: clamp(24px, 4vw, 34px);
    }

    .fitquest-overview-head p {
      margin: 0;
      max-width: 660px;
      color: #8f9bb5;
      line-height: 1.5;
      font-size: 13px;
    }

    .fitquest-range-tabs {
      display: inline-grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      padding: 4px;
      border-radius: 13px;
      background: rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.07);
    }

    .fitquest-range-tabs button {
      min-width: 48px;
      min-height: 36px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #8390aa;
      font: inherit;
      font-size: 11px;
      font-weight: 900;
      cursor: pointer;
    }

    .fitquest-range-tabs button.active {
      color: white;
      background: rgba(119, 101, 255, .24);
      box-shadow: inset 0 0 0 1px rgba(144, 126, 255, .18);
    }

    .fitquest-score-row {
      display: grid;
      grid-template-columns: 178px minmax(0, 1fr);
      gap: 18px;
      margin-top: 22px;
      align-items: stretch;
    }

    .fitquest-score-card {
      display: grid;
      place-items: center;
      align-content: center;
      padding: 18px;
      border-radius: 20px;
      background:
        radial-gradient(circle at 50% 20%, rgba(169, 86, 244, .18), transparent 55%),
        rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.08);
      text-align: center;
    }

    .fitquest-score-card small {
      color: #8e9ab4;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .10em;
      text-transform: uppercase;
    }

    .fitquest-score-number {
      margin-top: 3px;
      font-size: 50px;
      line-height: 1;
      font-weight: 950;
      letter-spacing: -.04em;
    }

    .fitquest-score-number span {
      font-size: 18px;
      color: #8e9ab4;
      letter-spacing: 0;
    }

    .fitquest-score-trend {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 850;
      color: #9da9c1;
    }

    .fitquest-score-trend.up {
      color: #6fe4ae;
    }

    .fitquest-score-trend.down {
      color: #ff9da7;
    }

    .fitquest-trend-panel {
      min-width: 0;
      padding: 16px 16px 10px;
      border-radius: 20px;
      background: rgba(255,255,255,.035);
      border: 1px solid rgba(255,255,255,.07);
    }

    .fitquest-trend-top {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
    }

    .fitquest-trend-top strong {
      font-size: 13px;
    }

    .fitquest-trend-top small {
      color: #7f8ca7;
      font-size: 10px;
    }

    .fitquest-score-chart {
      width: 100%;
      height: 145px;
      display: block;
      overflow: visible;
    }

    .fitquest-score-chart .gridline {
      stroke: rgba(255,255,255,.06);
      stroke-width: 1;
    }

    .fitquest-score-chart .area {
      fill: url(#fitquestScoreAreaGradient);
    }

    .fitquest-score-chart .line {
      fill: none;
      stroke: #aa71ff;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .fitquest-score-chart .point {
      fill: #f1d5ff;
      stroke: #7a66ff;
      stroke-width: 2;
    }

    .fitquest-metric-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }

    .fitquest-metric {
      padding: 13px;
      border-radius: 15px;
      background: rgba(255,255,255,.038);
      border: 1px solid rgba(255,255,255,.065);
      min-width: 0;
    }

    .fitquest-metric small,
    .fitquest-metric strong,
    .fitquest-metric em {
      display: block;
    }

    .fitquest-metric small {
      color: #7f8da7;
      font-size: 9px;
      font-style: normal;
      font-weight: 900;
      letter-spacing: .07em;
      text-transform: uppercase;
    }

    .fitquest-metric strong {
      margin-top: 5px;
      color: #f1f4ff;
      font-size: 17px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .fitquest-metric em {
      margin-top: 3px;
      color: #74829c;
      font-size: 10px;
      font-style: normal;
    }

    .fitquest-overview-lower {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 14px;
      margin-top: 16px;
    }

    .fitquest-overview-subcard {
      padding: 16px;
      border-radius: 18px;
      background: rgba(255,255,255,.033);
      border: 1px solid rgba(255,255,255,.065);
    }

    .fitquest-overview-subcard h4 {
      margin: 0;
      font-size: 14px;
    }

    .fitquest-overview-subcard > p {
      margin: 5px 0 12px;
      color: #7f8da7;
      font-size: 11px;
      line-height: 1.45;
    }

    .fitquest-breakdown {
      display: grid;
      gap: 9px;
    }

    .fitquest-breakdown-row {
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr) 54px;
      align-items: center;
      gap: 9px;
      color: #aab5ca;
      font-size: 11px;
    }

    .fitquest-breakdown-row b {
      color: #e8edfb;
      text-align: right;
      font-size: 10px;
    }

    .fitquest-breakdown-track {
      height: 7px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
    }

    .fitquest-breakdown-track i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #716cff, #e365d0);
    }

    .fitquest-heatmap {
      display: grid;
      grid-template-columns: repeat(10, minmax(0, 1fr));
      gap: 5px;
      margin-top: 8px;
    }

    .fitquest-heat-day {
      aspect-ratio: 1;
      min-width: 0;
      border-radius: 5px;
      background: rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.035);
    }

    .fitquest-weight-line {
      margin-top: 12px;
      color: #95a2bb;
      font-size: 11px;
    }

    .fitquest-weight-line strong {
      color: #eef2ff;
    }

    .fitquest-score-note {
      margin-top: 14px;
      color: #687791;
      font-size: 10px;
      line-height: 1.5;
    }

    @media (max-width: 900px) {
      .fitquest-metric-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .fitquest-overview-lower {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .fitquest-overview {
        padding: 18px;
        border-radius: 21px;
      }

      .fitquest-overview-head {
        align-items: stretch;
        flex-direction: column;
        gap: 12px;
      }

      .fitquest-range-tabs {
        align-self: flex-start;
      }

      .fitquest-score-row {
        grid-template-columns: 1fr;
      }

      .fitquest-score-card {
        grid-template-columns: auto auto;
        justify-content: center;
        column-gap: 12px;
        padding: 14px;
      }

      .fitquest-score-card small {
        grid-column: 1 / -1;
      }

      .fitquest-score-number {
        font-size: 42px;
      }

      .fitquest-score-trend {
        margin: 0;
        align-self: center;
      }

      .fitquest-metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .fitquest-heatmap {
        grid-template-columns: repeat(10, minmax(0, 1fr));
        gap: 4px;
      }

      .fitquest-score-chart {
        height: 125px;
      }
    }
  `;

  document.head.appendChild(style);
}

function install() {
  const grid = $('#fitquestScreenGrid-progress');
  if (!grid) return false;

  let overview = $('#fitquestCampaignOverview');

  if (!overview) {
    overview = document.createElement('section');
    overview.id = 'fitquestCampaignOverview';
    overview.className = 'fitquest-overview';
    grid.insertBefore(overview, grid.firstChild);
  } else if (overview.parentElement !== grid || grid.firstElementChild !== overview) {
    grid.insertBefore(overview, grid.firstChild);
  }

  return true;
}

function dataDates(data) {
  const dates = new Set();

  (data.workouts || []).forEach(item => {
    if (item?.date) dates.add(item.date);
  });

  (data.checkIns || []).forEach(item => {
    if (item?.date) dates.add(item.date);
  });

  (data.nutrition || []).forEach(item => {
    if (item?.date) dates.add(item.date);
  });

  return [...dates].sort();
}

function dailyContext(data, date) {
  const workouts = (data.workouts || []).filter(item => item.date === date);
  const workout = workouts.find(item => item.completed) || workouts[0] || null;
  const checkIn = (data.checkIns || []).find(item => item.date === date) || null;
  const nutrition = (data.nutrition || []).filter(item => item.date === date);

  const exercises = workouts.flatMap(item =>
    Array.isArray(item.exercises) ? item.exercises : []
  );

  return {
    date,
    workouts,
    workout,
    checkIn,
    nutrition,
    exercises
  };
}

function sleepMinutes(checkIn) {
  if (!checkIn) return 0;

  if (checkIn.sleepMinutes != null) {
    return number(checkIn.sleepMinutes);
  }

  if (checkIn.sleepHours != null) {
    return Math.round(number(checkIn.sleepHours) * 60);
  }

  return 0;
}

function scoreDay(data, date) {
  const ctx = dailyContext(data, date);
  const { workout, checkIn, nutrition, exercises } = ctx;

  // TRAINING · 25
  let training = 0;
  if (workout?.completed) training = 25;
  else if (exercises.length) training = 15;

  // MOVEMENT · 25
  const steps = number(checkIn?.steps);
  const activeCalories = number(checkIn?.activeCalories);
  const exerciseMinutes = number(checkIn?.exerciseMinutes);
  const standHours = number(checkIn?.standHours);

  const movement =
    clamp((steps / 10000) * 12, 0, 12) +
    clamp((activeCalories / 500) * 5, 0, 5) +
    clamp((exerciseMinutes / 30) * 6, 0, 6) +
    clamp((standHours / 12) * 2, 0, 2);

  // RECOVERY · 20
  const sleep = sleepMinutes(checkIn);
  const water = number(checkIn?.waterOz);
  const weightLogged = checkIn?.weight != null && number(checkIn.weight) > 0;

  let sleepScore = 0;
  if (sleep > 0) {
    const hours = sleep / 60;
    if (hours >= 7 && hours <= 9) {
      sleepScore = 10;
    } else if (hours < 7) {
      sleepScore = clamp(10 - (7 - hours) * 2.5, 2, 10);
    } else {
      sleepScore = clamp(10 - (hours - 9) * 2, 2, 10);
    }
  }

  const recovery =
    sleepScore +
    clamp((water / 64) * 8, 0, 8) +
    (weightLogged ? 2 : 0);

  // NUTRITION · 15 — rewards logging/consistency, not a particular diet.
  const protein = nutrition.reduce((sum, item) => sum + number(item.protein), 0);
  const nutritionScore = nutrition.length
    ? clamp(5 + Math.min(6, nutrition.length * 2) + (protein > 0 ? 4 : 0), 0, 15)
    : 0;

  // CONSISTENCY · 15
  const categories = [
    workout?.completed || exercises.length > 0,
    steps > 0 || activeCalories > 0 || exerciseMinutes > 0 || standHours > 0,
    sleep > 0 || water > 0,
    nutrition.length > 0,
    weightLogged
  ].filter(Boolean).length;

  const consistency = categories * 3;

  const total = clamp(
    training + movement + recovery + nutritionScore + consistency,
    0,
    100
  );

  return {
    total: round(total),
    training: round(training, 1),
    movement: round(movement, 1),
    recovery: round(recovery, 1),
    nutrition: round(nutritionScore, 1),
    consistency: round(consistency, 1),
    ctx
  };
}

function rangeDates(data, days, endDate = localDateISO()) {
  const all = dataDates(data);
  if (!all.length) return [endDate];

  const requestedStart = addDays(endDate, -(days - 1));
  const campaignStart = all[0];
  const start = campaignStart > requestedStart ? campaignStart : requestedStart;

  return enumerateDates(start, endDate);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + number(value), 0) / values.length;
}

function periodScores(data, days, endDate = localDateISO()) {
  const dates = rangeDates(data, days, endDate);

  return dates.map(date => ({
    date,
    ...scoreDay(data, date)
  }));
}

function periodMetrics(data, dates) {
  const dateSet = new Set(dates);

  const workouts = (data.workouts || []).filter(item => dateSet.has(item.date));
  const checkIns = (data.checkIns || []).filter(item => dateSet.has(item.date));
  const nutrition = (data.nutrition || []).filter(item => dateSet.has(item.date));

  const exercises = workouts.flatMap(item =>
    Array.isArray(item.exercises) ? item.exercises : []
  );

  const completed = workouts.filter(item => item.completed).length;

  const steps = checkIns.reduce((sum, item) => sum + number(item.steps), 0);
  const activeCalories = checkIns.reduce((sum, item) => sum + number(item.activeCalories), 0);
  const watchExercise = checkIns.reduce((sum, item) => sum + number(item.exerciseMinutes), 0);

  const strengthSets = exercises
    .filter(item => item.type === 'strength')
    .reduce((sum, item) => sum + number(item.sets), 0);

  const cardioMinutes = exercises
    .filter(item => item.type === 'cardio')
    .reduce((sum, item) => sum + number(item.duration), 0);

  const sleepValues = checkIns
    .map(item => sleepMinutes(item))
    .filter(value => value > 0);

  const waterValues = checkIns
    .map(item => number(item.waterOz))
    .filter(value => value > 0);

  const exerciseXp = exercises.reduce((sum, item) => sum + number(item.xp), 0);
  const completionXp = workouts.reduce((sum, item) => sum + number(item.completionXp), 0);
  const nutritionXp = nutrition.reduce((sum, item) => sum + number(item.xp), 0);

  const bossDamage =
    data.ui?.rpg?.bosses
      ? Object.values(data.ui.rpg.bosses).flatMap(boss => boss?.attacks || [])
          .filter(attack => dateSet.has(attack.date))
          .reduce((sum, attack) => sum + number(attack.damage), 0)
      : 0;

  const weights = checkIns
    .filter(item => item.weight != null && number(item.weight) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const nutritionDays = new Set(nutrition.map(item => item.date)).size;

  return {
    completed,
    steps,
    avgSteps: dates.length ? steps / dates.length : 0,
    activeCalories,
    watchExercise,
    strengthSets,
    cardioMinutes,
    avgSleepMinutes: average(sleepValues),
    avgWater: average(waterValues),
    nutritionDays,
    xp: exerciseXp + completionXp + nutritionXp,
    bossDamage,
    weights
  };
}

function metricCards(metrics) {
  const sleepHours = metrics.avgSleepMinutes / 60;
  const weightChange =
    metrics.weights.length >= 2
      ? number(metrics.weights[metrics.weights.length - 1].weight) -
        number(metrics.weights[0].weight)
      : null;

  const weightUnit = metrics.weights.at(-1)?.weightUnit || 'lb';

  const items = [
    ['⚔️ Adventures', formatNumber(metrics.completed), 'completed'],
    ['👟 Steps', formatNumber(metrics.steps), `${formatNumber(metrics.avgSteps)} / day`],
    ['🔥 Active Calories', formatNumber(metrics.activeCalories), 'Apple Watch'],
    ['⌚ Exercise', `${formatNumber(metrics.watchExercise)} min`, 'Apple Watch'],
    ['😴 Avg Sleep', metrics.avgSleepMinutes ? `${round(sleepHours, 1)} hr` : '—', 'logged nights'],
    ['💧 Avg Water', metrics.avgWater ? `${formatNumber(metrics.avgWater)} oz` : '—', 'logged days'],
    ['⚔️ Strength Sets', formatNumber(metrics.strengthSets), 'training'],
    ['🏃 Cardio', `${formatNumber(metrics.cardioMinutes)} min`, 'training'],
    ['🍎 Nutrition', `${formatNumber(metrics.nutritionDays)} days`, 'logged'],
    ['✨ XP Earned', formatNumber(metrics.xp), 'campaign'],
    ['🛡️ Boss Damage', formatNumber(metrics.bossDamage), 'all strikes'],
    [
      '⚖️ Weight Trend',
      weightChange == null
        ? '—'
        : `${weightChange > 0 ? '+' : ''}${round(weightChange, 1)} ${weightUnit}`,
      metrics.weights.length ? `${metrics.weights.length} entries` : 'not enough data'
    ]
  ];

  return items.map(([label, value, note]) => `
    <div class="fitquest-metric">
      <small>${label}</small>
      <strong>${value}</strong>
      <em>${note}</em>
    </div>
  `).join('');
}

function chartSVG(scores) {
  const width = 720;
  const height = 145;
  const padX = 8;
  const padY = 12;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  if (!scores.length) {
    return `<div style="color:#7f8da7;font-size:12px;padding:42px 0;text-align:center">Log a few days to reveal your campaign trend.</div>`;
  }

  const points = scores.map((item, index) => {
    const x = scores.length === 1
      ? width / 2
      : padX + (index / (scores.length - 1)) * usableW;

    const y = padY + (1 - clamp(item.total, 0, 100) / 100) * usableH;

    return { x, y, ...item };
  });

  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const area = [
    `${points[0].x},${height - padY}`,
    ...points.map(point => `${point.x},${point.y}`),
    `${points.at(-1).x},${height - padY}`
  ].join(' ');

  const showDots = scores.length <= 14;

  return `
    <svg
      class="fitquest-score-chart ${chartAnimationPlayed ? '' : 'animate'}"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="none"
      role="img"
      aria-label="Overall progress score trend"
    >
      <defs>
        <linearGradient id="fitquestScoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9e6cff" stop-opacity=".25"></stop>
          <stop offset="100%" stop-color="#9e6cff" stop-opacity="0"></stop>
        </linearGradient>
      </defs>

      <line class="gridline" x1="0" x2="${width}" y1="${padY + usableH * .25}" y2="${padY + usableH * .25}"></line>
      <line class="gridline" x1="0" x2="${width}" y1="${padY + usableH * .50}" y2="${padY + usableH * .50}"></line>
      <line class="gridline" x1="0" x2="${width}" y1="${padY + usableH * .75}" y2="${padY + usableH * .75}"></line>

      <polygon class="area" points="${area}"></polygon>
      <polyline class="line" points="${line}"></polyline>

      ${
        showDots
          ? points.map(point => `
              <circle class="point" cx="${point.x}" cy="${point.y}" r="4">
                <title>${point.date}: ${point.total}/100</title>
              </circle>
            `).join('')
          : ''
      }
    </svg>
  `;
}

function heatmapHTML(data) {
  const end = localDateISO();
  const start = addDays(end, -29);
  const dates = enumerateDates(start, end);

  return dates.map(date => {
    const score = scoreDay(data, date);
    const alpha = score.total === 0
      ? .035
      : .12 + (score.total / 100) * .72;

    return `
      <div
        class="fitquest-heat-day"
        style="background:rgba(129, 105, 255, ${alpha.toFixed(2)})"
        title="${date} · ${score.total}/100"
        aria-label="${date}: ${score.total} out of 100"
      ></div>
    `;
  }).join('');
}

function breakdownHTML(scores) {
  const components = [
    ['Training', 'training', 25],
    ['Movement', 'movement', 25],
    ['Recovery', 'recovery', 20],
    ['Nutrition', 'nutrition', 15],
    ['Consistency', 'consistency', 15]
  ];

  return components.map(([label, key, max]) => {
    const avg = average(scores.map(item => item[key]));
    const pct = clamp((avg / max) * 100, 0, 100);

    return `
      <div class="fitquest-breakdown-row">
        <span>${label}</span>
        <div class="fitquest-breakdown-track">
          <i style="width:${pct}%"></i>
        </div>
        <b>${round(avg)}/${max}</b>
      </div>
    `;
  }).join('');
}

function weightSummary(metrics) {
  if (!metrics.weights.length) {
    return 'No weight entries in this range. Weight is shown separately and does not raise or lower your progress score.';
  }

  const first = metrics.weights[0];
  const last = metrics.weights.at(-1);
  const unit = last.weightUnit || first.weightUnit || 'lb';

  if (metrics.weights.length === 1) {
    return `Latest logged weight: <strong>${round(last.weight, 1)} ${unit}</strong>. Weight is tracked separately from the score.`;
  }

  const change = number(last.weight) - number(first.weight);

  return `
    ${round(first.weight, 1)} ${unit} → <strong>${round(last.weight, 1)} ${unit}</strong>
    (${change > 0 ? '+' : ''}${round(change, 1)} ${unit}).
    Weight direction is informational only — it never automatically counts as “good” or “bad.”
  `;
}

function trendInfo(currentScore, previousScore, hasPreviousData) {
  if (!hasPreviousData) {
    return {
      className: '',
      text: 'Building baseline'
    };
  }

  const delta = round(currentScore - previousScore);

  if (delta > 0) {
    return {
      className: 'up',
      text: `↑ ${delta} vs previous period`
    };
  }

  if (delta < 0) {
    return {
      className: 'down',
      text: `↓ ${Math.abs(delta)} vs previous period`
    };
  }

  return {
    className: '',
    text: '→ Even with previous period'
  };
}

function renderRangeButtons() {
  return [7, 30, 90].map(days => `
    <button
      type="button"
      data-fitquest-overview-range="${days}"
      class="${selectedRange === days ? 'active' : ''}"
    >
      ${days}D
    </button>
  `).join('');
}

function wireRangeButtons() {
  document.querySelectorAll('[data-fitquest-overview-range]').forEach(button => {
    button.addEventListener('click', () => {
      selectedRange = Number(button.dataset.fitquestOverviewRange) || 30;
      chartAnimationPlayed = false;
      void refresh();
    });
  });
}

async function refresh() {
  if (busy) return;
  if (!install()) return;

  busy = true;

  try {
    const data = (await readSave())?.save;
    if (!data) return;

    const today = localDateISO();
    const scores = periodScores(data, selectedRange, today);
    const currentAverage = round(average(scores.map(item => item.total)));

    const previousEnd = addDays(scores[0]?.date || today, -1);
    const previousScores = periodScores(data, selectedRange, previousEnd);
    const previousDatesWithData = new Set(dataDates(data));
    const hasPreviousData = previousScores.some(item =>
      previousDatesWithData.has(item.date)
    );
    const previousAverage = round(average(previousScores.map(item => item.total)));

    const trend = trendInfo(currentAverage, previousAverage, hasPreviousData);
    const dates = scores.map(item => item.date);
    const metrics = periodMetrics(data, dates);

    const overview = $('#fitquestCampaignOverview');

    overview.innerHTML = `
      <div class="fitquest-overview-head">
        <div>
          <p class="eyebrow">CAMPAIGN OVERVIEW · ALL SYSTEMS</p>
          <h3>Overall Progress</h3>
          <p>
            One glance across training, Apple Watch activity, recovery, nutrition,
            consistency, XP, boss battles, and your logged measurements.
          </p>
        </div>

        <div class="fitquest-range-tabs" aria-label="Progress range">
          ${renderRangeButtons()}
        </div>
      </div>

      <div class="fitquest-score-row">
        <div class="fitquest-score-card">
          <small>${selectedRange}-day campaign score</small>
          <div class="fitquest-score-number">
            ${currentAverage}<span>/100</span>
          </div>
          <div class="fitquest-score-trend ${trend.className}">
            ${trend.text}
          </div>
        </div>

        <div class="fitquest-trend-panel">
          <div class="fitquest-trend-top">
            <strong>Daily progress trend</strong>
            <small>${scores[0]?.date || today} → ${scores.at(-1)?.date || today}</small>
          </div>
          ${chartSVG(scores)}
        </div>
      </div>

      <div class="fitquest-metric-grid">
        ${metricCards(metrics)}
      </div>

      <div class="fitquest-overview-lower">
        <div class="fitquest-overview-subcard">
          <h4>Why ${currentAverage}?</h4>
          <p>
            The score rewards behaviors and consistency — not whether your body weight
            moved in a particular direction.
          </p>

          <div class="fitquest-breakdown">
            ${breakdownHTML(scores)}
          </div>
        </div>

        <div class="fitquest-overview-subcard">
          <h4>30-day consistency map</h4>
          <p>
            Brighter days mean more of your LEVEL IRL systems were completed and logged.
          </p>

          <div class="fitquest-heatmap">
            ${heatmapHTML(data)}
          </div>

          <div class="fitquest-weight-line">
            ⚖️ ${weightSummary(metrics)}
          </div>
        </div>
      </div>

      <div class="fitquest-score-note">
        Score weighting: Training 25 · Movement 25 · Recovery 20 · Nutrition logging 15 ·
        Consistency 15. Movement uses steps, active calories, exercise minutes and stand
        hours when entered. Recovery uses sleep, hydration and measurement logging.
      </div>
    `;

    chartAnimationPlayed = true;

    wireRangeButtons();

  } catch (error) {
    console.warn('Campaign Overview failed:', error);

    const overview = $('#fitquestCampaignOverview');
    if (overview) {
      overview.innerHTML = `
        <p class="eyebrow">CAMPAIGN OVERVIEW</p>
        <h3 style="margin:6px 0">Overall Progress</h3>
        <p style="color:#8f9bb5">
          Progress data is temporarily unavailable. Your underlying LEVEL IRL save was not changed.
        </p>
      `;
    }
  } finally {
    busy = false;
  }
}

function scheduleRefresh(delay = 180) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => void refresh(), delay);
}

function boot() {
  styles();

  let attempts = 0;

  const timer = setInterval(() => {
    attempts++;

    if (
      $('#appRoot') &&
      !$('#appRoot').hidden &&
      $('#fitquestScreenGrid-progress')
    ) {
      clearInterval(timer);
      install();
      void refresh();
    } else if (attempts > 140) {
      clearInterval(timer);
    }
  }, 120);

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'progress') {
      scheduleRefresh(80);
    }
  });

  window.addEventListener('fitquest:saved', () => {
    scheduleRefresh(250);
  });

  window.addEventListener('fitquest:remote-update', () => {
    scheduleRefresh(120);
  });

  window.addEventListener('fitquest:activity-ready', () => {
    scheduleRefresh(120);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
