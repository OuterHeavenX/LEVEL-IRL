import { readSave, writeSave } from './lib/storage.js';
import { calculateStats, workoutBattlePower, completedStreakAsOf } from './lib/progression.js';
import { achievementSummary } from './lib/achievements.js';
import { $, localDateISO, reducedMotion, injectStyles, appVisible, whenReady } from './lib/dom.js';


const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60, 100, 180, 365]);

const LOOT_POOL = [
  {
    id: 'embersteel-training-crest',
    name: 'Embersteel Training Crest',
    icon: '🔥',
    rarity: 'Rare',
    description: 'Forged for adventurers who keep showing up when the easy choice is to stop.'
  },
  {
    id: 'moonlit-runner-sigil',
    name: 'Moonlit Runner Sigil',
    icon: '🌙',
    rarity: 'Rare',
    description: 'A quiet mark carried by those who put miles behind them after the world slows down.'
  },
  {
    id: 'iron-temple-token',
    name: 'Iron Temple Token',
    icon: '🪙',
    rarity: 'Common',
    description: 'A battered token from a place where every set becomes part of the story.'
  },
  {
    id: 'stormbound-wrap',
    name: 'Stormbound Training Wrap',
    icon: '⚡',
    rarity: 'Epic',
    description: 'A cosmetic relic said to appear after particularly stubborn adventures.'
  },
  {
    id: 'first-light-banner',
    name: 'Banner of First Light',
    icon: '🌅',
    rarity: 'Epic',
    description: 'Carried by adventurers who turn an ordinary day into a completed mission.'
  },
  {
    id: 'voidwalker-frame',
    name: 'Voidwalker Character Frame',
    icon: '🌀',
    rarity: 'Legendary',
    description: 'A ridiculously rare frame from somewhere the campaign map refuses to acknowledge.'
  }
];

let snapshot = null;
let compareBusy = false;
let compareTimer = null;
let internalWrite = false;
let modalQueue = [];
let modalOpen = false;


function styles() {
  injectStyles('fitquestJuiceStyles', `
    .fitquest-xp-float {
      position: fixed;
      z-index: 130000;
      pointer-events: none;
      padding: 11px 16px;
      border-radius: 999px;
      border: 1px solid rgba(132, 243, 198, .34);
      background: rgba(7, 20, 28, .95);
      color: #82f4bd;
      font: 950 18px/1 system-ui, sans-serif;
      letter-spacing: .02em;
      text-shadow: 0 0 18px rgba(120, 239, 183, .28);
      box-shadow:
        0 18px 52px rgba(0,0,0,.38),
        0 0 30px rgba(105,232,177,.10);
      animation: fitquestXpFloat 1.45s ease forwards;
    }

    @keyframes fitquestXpFloat {
      0% { opacity: 0; transform: translate(-50%, 14px) scale(.84); }
      15% { opacity: 1; transform: translate(-50%, 0) scale(1.08); }
      72% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -58px) scale(.98); }
    }

    .fitquest-particle {
      position: fixed;
      z-index: 129999;
      pointer-events: none;
      width: 8px;
      height: 8px;
      border-radius: 2px;
      animation: fitquestParticleBurst 1.15s cubic-bezier(.2,.7,.2,1) forwards;
    }

    @keyframes fitquestParticleBurst {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(.3) rotate(0deg);
      }
      10% { opacity: 1; }
      100% {
        opacity: 0;
        transform:
          translate(
            calc(-50% + var(--dx)),
            calc(-50% + var(--dy))
          )
          scale(.8)
          rotate(var(--rot));
      }
    }

    .fitquest-damage-float {
      position: absolute;
      z-index: 10;
      left: 50%;
      top: 36%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      font: 950 clamp(28px, 7vw, 54px)/1 system-ui, sans-serif;
      color: #ff7d83;
      text-shadow: 0 5px 20px rgba(255, 61, 72, .45);
      animation: fitquestDamageFloat 1.05s ease forwards;
    }

    @keyframes fitquestDamageFloat {
      0% { opacity: 0; transform: translate(-50%, 0) scale(.65); }
      18% { opacity: 1; transform: translate(-50%, -10px) scale(1.15); }
      75% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -72px) scale(.95); }
    }

    #fitquestBossBattle.fitquest-critical-hit {
      animation: fitquestCriticalHit .58s ease;
    }

    @keyframes fitquestCriticalHit {
      0%,100% { transform: translateX(0); filter: none; }
      15% { transform: translateX(-8px) rotate(-.4deg); filter: brightness(1.35); }
      30% { transform: translateX(8px) rotate(.4deg); }
      45% { transform: translateX(-5px); filter: brightness(1.18); }
      60% { transform: translateX(4px); }
    }

    .fitquest-juice-overlay {
      position: fixed;
      inset: 0;
      z-index: 140000;
      display: grid;
      place-items: center;
      padding: 22px;
      background:
        radial-gradient(circle at 50% 42%, rgba(104, 94, 255, .18), transparent 36%),
        rgba(2, 5, 14, .82);
      backdrop-filter: blur(16px);
      animation: fitquestOverlayIn .22s ease both;
    }

    @keyframes fitquestOverlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .fitquest-juice-card {
      position: relative;
      width: min(100%, 520px);
      overflow: hidden;
      padding: 30px;
      border-radius: 29px;
      border: 1px solid rgba(255,255,255,.14);
      background:
        radial-gradient(circle at 50% 0%, rgba(172, 83, 244, .23), transparent 44%),
        linear-gradient(155deg, #141d38, #0b1123);
      color: #f7f8ff;
      text-align: center;
      box-shadow:
        0 40px 120px rgba(0,0,0,.58),
        inset 0 1px 0 rgba(255,255,255,.06);
      animation: fitquestCardPop .38s cubic-bezier(.2,.8,.2,1) both;
    }

    @keyframes fitquestCardPop {
      from { opacity: 0; transform: translateY(22px) scale(.92); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .fitquest-juice-icon {
      width: 88px;
      height: 88px;
      display: grid;
      place-items: center;
      margin: 0 auto 18px;
      border-radius: 27px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06);
      font-size: 43px;
      box-shadow: 0 18px 60px rgba(93, 75, 222, .20);
    }

    .fitquest-juice-kicker {
      margin: 0 0 7px;
      color: #9a8cff;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .18em;
      text-transform: uppercase;
    }

    .fitquest-juice-card h2 {
      margin: 0;
      font-size: clamp(29px, 7vw, 45px);
      line-height: 1.05;
    }

    .fitquest-juice-card > p:not(.fitquest-juice-kicker) {
      margin: 14px auto 0;
      max-width: 410px;
      color: #aeb9cf;
      line-height: 1.55;
      font-size: 14px;
    }

    .fitquest-juice-meta {
      display: grid;
      grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
      gap: 9px;
      margin: 21px 0;
    }

    .fitquest-juice-meta > div {
      padding: 12px 8px;
      border-radius: 14px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.075);
    }

    .fitquest-juice-meta small,
    .fitquest-juice-meta strong {
      display: block;
    }

    .fitquest-juice-meta small {
      color: #7d8aa5;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .fitquest-juice-meta strong {
      margin-top: 4px;
      color: #f1f4ff;
      font-size: 14px;
    }

    .fitquest-juice-close {
      width: 100%;
      min-height: 50px;
      border: 0;
      border-radius: 14px;
      background: linear-gradient(135deg, #6e68ff, #ac53ec);
      color: white;
      font: inherit;
      font-weight: 950;
      cursor: pointer;
    }


    .fitquest-action-feed {
      position: fixed;
      z-index: 135000;
      right: 16px;
      top: calc(env(safe-area-inset-top, 0px) + 86px);
      width: min(360px, calc(100vw - 32px));
      display: grid;
      gap: 9px;
      pointer-events: none;
    }

    .fitquest-action-toast {
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 11px;
      align-items: center;
      padding: 12px 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.10);
      background: rgba(8, 14, 29, .94);
      box-shadow: 0 18px 60px rgba(0,0,0,.34);
      backdrop-filter: blur(16px);
      animation: fitquestActionIn 2.8s ease forwards;
    }

    .fitquest-action-toast.damage {
      border-color: rgba(255,111,120,.24);
      background:
        linear-gradient(135deg, rgba(255,80,90,.08), transparent 45%),
        rgba(8,14,29,.95);
    }

    .fitquest-action-toast.xp {
      border-color: rgba(105,232,177,.22);
    }

    .fitquest-action-toast.rare {
      border-color: rgba(172,112,255,.25);
      box-shadow:
        0 18px 60px rgba(0,0,0,.34),
        0 0 35px rgba(155,93,255,.10);
    }

    .fitquest-action-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: rgba(255,255,255,.055);
      font-size: 21px;
    }

    .fitquest-action-copy strong,
    .fitquest-action-copy small {
      display: block;
    }

    .fitquest-action-copy strong {
      color: #f2f5ff;
      font-size: 13px;
      line-height: 1.2;
    }

    .fitquest-action-copy small {
      margin-top: 3px;
      color: #8e9bb5;
      font-size: 10px;
      line-height: 1.3;
    }

    @keyframes fitquestActionIn {
      0% { opacity: 0; transform: translateX(18px) scale(.96); }
      10% { opacity: 1; transform: translateX(0) scale(1); }
      82% { opacity: 1; transform: translateX(0); }
      100% { opacity: 0; transform: translateX(14px); }
    }

    #fitquestBossBattle.fitquest-hp-chunk .fitquest-boss-bar > i {
      filter: brightness(1.55) saturate(1.25);
      box-shadow: 0 0 28px rgba(255,112,112,.42);
    }

    #xpBar.fitquest-xp-pulse {
      filter: brightness(1.45);
      box-shadow: 0 0 20px rgba(218, 103, 255, .28);
      transition: width .35s ease;
    }

    @media (max-width: 720px) {
      .fitquest-action-feed {
        top: calc(env(safe-area-inset-top, 0px) + 72px);
        right: 10px;
        width: min(330px, calc(100vw - 20px));
      }
    }

    .fitquest-rarity-common { color: #bbc5d8; }
    .fitquest-rarity-rare { color: #67cbff; }
    .fitquest-rarity-epic { color: #c585ff; }
    .fitquest-rarity-legendary { color: #ffd36a; }

    .fitquest-loot-vault {
      grid-column: 1 / -1;
      padding: 22px;
      border-radius: 22px;
      border: 1px solid rgba(165, 83, 244, .16);
      background:
        radial-gradient(circle at 92% 0%, rgba(167, 84, 244, .10), transparent 36%),
        rgba(15, 22, 41, .93);
    }

    .fitquest-loot-vault-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 14px;
    }

    .fitquest-loot-vault h3 {
      margin: 3px 0 0;
    }

    .fitquest-loot-count {
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.07);
      color: #8e9ab3;
      font-size: 10px;
      font-weight: 900;
    }

    .fitquest-loot-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .fitquest-loot-item {
      min-width: 0;
      padding: 14px;
      border-radius: 16px;
      background: rgba(255,255,255,.038);
      border: 1px solid rgba(255,255,255,.065);
    }

    .fitquest-loot-item > span {
      display: block;
      margin-bottom: 8px;
      font-size: 28px;
    }

    .fitquest-loot-item strong,
    .fitquest-loot-item small {
      display: block;
    }

    .fitquest-loot-item strong {
      color: #eef2ff;
      font-size: 12px;
      line-height: 1.25;
    }

    .fitquest-loot-item small {
      margin-top: 4px;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .07em;
    }

    .fitquest-loot-empty {
      grid-column: 1 / -1;
      padding: 20px;
      border-radius: 15px;
      border: 1px dashed rgba(255,255,255,.10);
      color: #76839d;
      text-align: center;
      font-size: 12px;
    }

    .fitquest-day-conquered {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 9px;
      padding: 6px 9px;
      border-radius: 999px;
      border: 1px solid rgba(105, 232, 177, .21);
      background: rgba(105, 232, 177, .075);
      color: #75e8b5;
      font-size: 10px;
      font-weight: 950;
      letter-spacing: .07em;
    }

    .fq-level-overlay.fitquest-juiced-overlay .fq-level-card {
      animation: fitquestCardPop .42s cubic-bezier(.2,.8,.2,1) both;
      box-shadow:
        0 40px 130px rgba(0,0,0,.64),
        0 0 70px rgba(135, 93, 255, .16);
    }

    .fq-level-overlay.fitquest-juiced-overlay .fq-level-card b {
      animation: fitquestIconPulse 1.15s ease infinite alternate;
    }

    @keyframes fitquestIconPulse {
      from { transform: translateY(0) scale(1); }
      to { transform: translateY(-4px) scale(1.06); }
    }

    @media (max-width: 720px) {
      .fitquest-juice-card {
        padding: 24px 20px;
      }

      .fitquest-loot-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fitquest-xp-float,
      .fitquest-particle,
      .fitquest-damage-float,
      .fitquest-juice-overlay,
      .fitquest-juice-card,
      #fitquestBossBattle.fitquest-critical-hit,
      .fq-level-overlay.fitquest-juiced-overlay .fq-level-card,
      .fq-level-overlay.fitquest-juiced-overlay .fq-level-card b {
        animation: none !important;
      }
    }
  `);
}

function hash(text = '') {
  let value = 2166136261;

  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }

  return Math.abs(value >>> 0);
}

function rarityClass(rarity = '') {
  return `fitquest-rarity-${String(rarity).toLowerCase()}`;
}

function particleBurst(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 28) {
  if (reducedMotion()) return;

  const colors = ['#8d79ff', '#de68dd', '#68d8ff', '#75e8b5', '#ffd36a'];

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('i');
    particle.className = 'fitquest-particle';

    const angle = (Math.PI * 2 * i) / count + Math.random() * .35;
    const distance = 70 + Math.random() * 150;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 25;

    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.background = colors[i % colors.length];
    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
    particle.style.animationDelay = `${Math.random() * 110}ms`;

    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 1450);
  }
}

function xpFloat(amount, anchor = $('#xpBar') || $('#totalXpStat')) {
  amount = Math.round(Number(amount) || 0);
  if (amount <= 0) return;

  const rect = anchor?.getBoundingClientRect?.();

  const el = document.createElement('div');
  el.className = 'fitquest-xp-float';
  el.textContent = `+${amount} XP`;

  el.style.left = `${rect ? rect.left + rect.width / 2 : window.innerWidth / 2}px`;
  el.style.top = `${rect ? rect.top + rect.height / 2 : window.innerHeight * .30}px`;

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}


function actionToast(icon, title, detail = '', tone = '') {
  let feed = $('#fitquestActionFeed');

  if (!feed) {
    feed = document.createElement('div');
    feed.id = 'fitquestActionFeed';
    feed.className = 'fitquest-action-feed';
    document.body.appendChild(feed);
  }

  const toast = document.createElement('div');
  toast.className = `fitquest-action-toast ${tone}`.trim();
  toast.innerHTML = `
    <div class="fitquest-action-icon">${icon}</div>
    <div class="fitquest-action-copy">
      <strong>${title}</strong>
      ${detail ? `<small>${detail}</small>` : ''}
    </div>
  `;

  feed.prepend(toast);

  while (feed.children.length > 3) {
    feed.lastElementChild?.remove();
  }

  setTimeout(() => toast.remove(), 3000);
}

function pulseXpBar() {
  const bar = $('#xpBar');
  if (!bar) return;

  bar.classList.remove('fitquest-xp-pulse');
  void bar.offsetWidth;
  bar.classList.add('fitquest-xp-pulse');

  setTimeout(
    () => bar.classList.remove('fitquest-xp-pulse'),
    700
  );
}

function chunkBossHealth() {
  const card = $('#fitquestBossBattle');
  if (!card) return;

  card.classList.remove('fitquest-hp-chunk');
  void card.offsetWidth;
  card.classList.add('fitquest-hp-chunk');

  setTimeout(
    () => card.classList.remove('fitquest-hp-chunk'),
    800
  );
}

function estimatedActivityDamage(checkIn) {
  if (!checkIn) return 0;

  return Math.max(
    0,
    Math.min(
      60,
      Math.floor((Number(checkIn.steps) || 0) / 1000) * 2 +
      Math.floor((Number(checkIn.activeCalories) || 0) / 100) * 2 +
      Math.floor((Number(checkIn.exerciseMinutes) || 0) / 15) * 3 +
      ((Number(checkIn.standHours) || 0) >= 10 ? 5 : 0)
    )
  );
}

function readyDamageSnapshot(data) {
  const date = localDateISO();
  const workout =
    (data.workouts || []).find(item => item.date === date);

  const exercises =
    Array.isArray(workout?.exercises)
      ? workout.exercises
      : [];

  const submitted =
    Math.max(
      0,
      Number(workout?.bossSubmittedExerciseCount) || 0
    );

  const pendingExercises = exercises.slice(submitted);

  const streak = completedStreakAsOf(data, date);

  const workoutDamage =
    workoutBattlePower(pendingExercises, streak);

  const checkIn =
    (data.checkIns || []).find(item => item.date === date);

  const totalActivity =
    estimatedActivityDamage(checkIn);

  const appliedActivity =
    Math.max(
      0,
      Number(checkIn?.bossActivityDamageApplied) ||
      Number(checkIn?.bossActivityApplied?.damage) ||
      0
    );

  return {
    workoutDamage,
    activityDamage:
      Math.max(0, totalActivity - appliedActivity)
  };
}

function queueModal(config) {
  modalQueue.push(config);
  pumpModalQueue();
}

function pumpModalQueue() {
  if (modalOpen || !modalQueue.length) return;

  modalOpen = true;
  const config = modalQueue.shift();

  const overlay = document.createElement('div');
  overlay.className = 'fitquest-juice-overlay';

  const meta = Array.isArray(config.meta) ? config.meta : [];

  overlay.innerHTML = `
    <div class="fitquest-juice-card" role="dialog" aria-modal="true">
      <div class="fitquest-juice-icon">${config.icon || '✨'}</div>
      <p class="fitquest-juice-kicker">${config.kicker || 'LEVEL IRL'}</p>
      <h2>${config.title || 'Campaign Updated'}</h2>
      <p>${config.message || ''}</p>

      ${
        meta.length
          ? `<div class="fitquest-juice-meta" style="--cols:${Math.min(3, meta.length)}">
              ${meta.map(item => `
                <div>
                  <small>${item.label}</small>
                  <strong class="${item.className || ''}">${item.value}</strong>
                </div>
              `).join('')}
            </div>`
          : ''
      }

      <button class="fitquest-juice-close" type="button">
        ${config.button || 'Continue Campaign'}
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const card = overlay.querySelector('.fitquest-juice-card');
  const rect = card.getBoundingClientRect();

  particleBurst(
    rect.left + rect.width / 2,
    rect.top + rect.height * .36,
    config.particles || 32
  );

  const close = () => {
    overlay.remove();
    modalOpen = false;
    setTimeout(pumpModalQueue, 100);
  };

  overlay.querySelector('.fitquest-juice-close')?.addEventListener('click', close);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
}

function summary(data) {
  const stats = calculateStats(data);
  const achievements = achievementSummary(data, stats);

  const bosses = data.ui?.rpg?.bosses || {};
  const bossState = {};

  Object.entries(bosses).forEach(([id, boss]) => {
    bossState[id] = {
      defeated: Boolean(boss?.defeated),
      attackIds: new Set((boss?.attacks || []).map(attack => attack.id)),
      lastAttack: boss?.lastAttack || null
    };
  });

  const inventory = data.ui?.rpg?.inventory || [];
  const activityAchievements = data.ui?.rpg?.activityAchievements || {};

  const completedWorkoutIds = new Set(
    (data.workouts || [])
      .filter(workout => workout.completed)
      .map(workout => workout.id)
      .filter(Boolean)
  );

  const readyDamage = readyDamageSnapshot(data);

  return {
    stats,
    readyWorkoutDamage: readyDamage.workoutDamage,
    readyActivityDamage: readyDamage.activityDamage,
    achievementIds: new Set(achievements.unlocked.map(item => item.id)),
    achievementsById: new Map(achievements.unlocked.map(item => [item.id, item])),
    inventoryIds: new Set(inventory.map(item => item.id)),
    inventoryById: new Map(inventory.map(item => [item.id, item])),
    activityAchievementIds: new Set(Object.keys(activityAchievements)),
    activityAchievements,
    bosses: bossState,
    completedWorkoutIds
  };
}


function dayConquered(data) {
  const date = localDateISO();
  const workout = (data.workouts || []).find(item => item.date === date && item.completed);

  if (!workout) return false;

  const checkIn = (data.checkIns || []).find(item => item.date === date);
  const nutrition = (data.nutrition || []).filter(item => item.date === date);

  let categories = 1; // completed adventure

  if (
    Number(checkIn?.steps) > 0 ||
    Number(checkIn?.activeCalories) > 0 ||
    Number(checkIn?.exerciseMinutes) > 0
  ) categories++;

  if (
    Number(checkIn?.waterOz) > 0 ||
    Number(checkIn?.sleepMinutes) > 0 ||
    Number(checkIn?.sleepHours) > 0
  ) categories++;

  if (nutrition.length > 0) categories++;

  return categories >= 3;
}

function renderDayConquered(data) {
  const hero = $('.hero.card');
  if (!hero) return;

  hero.querySelector('.fitquest-day-conquered')?.remove();

  if (!dayConquered(data)) return;

  const first = hero.firstElementChild || hero;

  const badge = document.createElement('div');
  badge.className = 'fitquest-day-conquered';
  badge.innerHTML = '✓ DAY CONQUERED';

  first.appendChild(badge);
}

function renderLootVault(data) {
  const character = $('#fitquestScreenGrid-character');
  if (!character) return;

  let vault = $('#fitquestLootVault');

  if (!vault) {
    vault = document.createElement('section');
    vault.id = 'fitquestLootVault';
    vault.className = 'fitquest-loot-vault';
    character.appendChild(vault);
  }

  const inventory = data.ui?.rpg?.inventory || [];

  vault.innerHTML = `
    <div class="fitquest-loot-vault-head">
      <div>
        <p class="eyebrow">RELIC VAULT · COSMETIC LOOT</p>
        <h3>Campaign Inventory</h3>
      </div>
      <span class="fitquest-loot-count">${inventory.length} ITEM${inventory.length === 1 ? '' : 'S'}</span>
    </div>

    <div class="fitquest-loot-grid">
      ${
        inventory.length
          ? [...inventory].reverse().map(item => `
              <article class="fitquest-loot-item">
                <span>${item.icon || '🎁'}</span>
                <strong>${item.name || 'Unknown Relic'}</strong>
                <small class="${rarityClass(item.rarity)}">${item.rarity || 'Relic'}</small>
              </article>
            `).join('')
          : `<div class="fitquest-loot-empty">
              No relics yet. Complete Adventures, defeat bosses, and keep the campaign moving.
            </div>`
      }
    </div>
  `;
}

function juiceExistingCompletionOverlay(node) {
  if (!(node instanceof Element)) return;

  // The level-up ceremony overlay is created by rpgExpansion.js.
  const overlay = node.classList.contains('fq-level-overlay') ? node : null;

  if (!overlay || overlay.classList.contains('fitquest-juiced-overlay')) return;

  overlay.classList.add('fitquest-juiced-overlay');

  setTimeout(() => {
    const card = overlay.querySelector('.fq-level-card');
    if (!card) return;

    const rect = card.getBoundingClientRect();

    particleBurst(
      rect.left + rect.width / 2,
      rect.top + rect.height * .32,
      overlay.textContent.includes('LEVEL UP') ? 50 : 30
    );
  }, 80);
}

function damageFloat(attack, defeatedNow = false) {
  const card = $('#fitquestBossBattle');
  if (!card || !attack?.damage) return;

  const el = document.createElement('div');
  el.className = 'fitquest-damage-float';
  el.textContent = `−${Math.round(Number(attack.damage))} HP`;

  card.style.position = 'relative';
  card.appendChild(el);

  card.classList.remove('fitquest-critical-hit');
  void card.offsetWidth;
  card.classList.add('fitquest-critical-hit');

  const rect = card.getBoundingClientRect();
  particleBurst(
    rect.left + rect.width / 2,
    Math.max(80, rect.top + rect.height * .33),
    defeatedNow ? 48 : 18
  );

  setTimeout(() => {
    el.remove();
    card.classList.remove('fitquest-critical-hit');
  }, 1250);
}

function announceAchievement(item) {
  queueModal({
    icon: item.icon || '🏆',
    kicker: 'ACHIEVEMENT UNLOCKED',
    title: item.name || 'New Achievement',
    message: item.flavor || 'Another mark has been carved into your campaign.',
    meta: [
      {
        label: 'Type',
        value: String(item.kind || 'Achievement').replace('-', ' ')
      },
      {
        label: 'Status',
        value: 'UNLOCKED',
        className: 'fitquest-rarity-rare'
      }
    ],
    particles: 30
  });
}

function announceLoot(item) {
  queueModal({
    icon: item.icon || '🎁',
    kicker: `${String(item.rarity || 'RARE').toUpperCase()} DROP`,
    title: item.name || 'Mystery Relic',
    message: item.description || 'A cosmetic relic has been added to your Campaign Inventory.',
    meta: [
      {
        label: 'Rarity',
        value: item.rarity || 'Relic',
        className: rarityClass(item.rarity)
      },
      {
        label: 'Collection',
        value: 'Campaign Vault'
      }
    ],
    button: 'Claim Relic',
    particles: item.rarity === 'Legendary' ? 65 : item.rarity === 'Epic' ? 48 : 34
  });
}

function announceStreak(streak) {
  queueModal({
    icon: streak >= 30 ? '🔥' : '⚡',
    kicker: 'STREAK MILESTONE',
    title: `${streak} Days Strong`,
    message:
      streak >= 30
        ? 'This is no longer “trying to be consistent.” This is what consistency looks like.'
        : 'Momentum has become part of the campaign. Keep the chain alive.',
    meta: [
      { label: 'Streak', value: `${streak} DAYS`, className: 'fitquest-rarity-epic' },
      { label: 'Status', value: 'ACTIVE' }
    ],
    particles: streak >= 30 ? 60 : 38
  });
}

function announceBossDefeat(bossId) {
  const title =
    bossId === 'iron-warden-v1'
      ? 'The Iron Warden Has Fallen'
      : 'Boss Defeated';

  queueModal({
    icon: '💥',
    kicker: 'BOSS DEFEATED',
    title,
    message: 'The battlefield is quiet. Victory rewards have been added to your campaign.',
    meta: [
      { label: 'Result', value: 'VICTORY', className: 'fitquest-rarity-legendary' },
      { label: 'Reward', value: 'LOOT UNLOCKED' }
    ],
    particles: 70
  });
}

function chooseLoot(workout, existingInventory) {
  const seed = hash(`${workout.id}|${workout.completedAt || workout.date}|juice-v1`);
  const existingJuice = existingInventory.filter(item => item?.source === 'Adventure Drop');

  // Guaranteed first adventure drop after Juice Pack installation.
  const shouldDrop = existingJuice.length === 0 || seed % 100 < 42;
  if (!shouldDrop) return null;

  // Independent rolls so the drop check doesn't skew rarity or the item picked.
  const roll = hash(`${workout.id}|rarity|juice-v1`) % 100;

  let rarity;
  if (roll < 4) rarity = 'Legendary';
  else if (roll < 19) rarity = 'Epic';
  else if (roll < 54) rarity = 'Rare';
  else rarity = 'Common';

  let pool = LOOT_POOL.filter(item => item.rarity === rarity);

  if (!pool.length) pool = LOOT_POOL;

  const unseen = pool.filter(
    item => !existingInventory.some(existing => existing.id === item.id)
  );

  const choices = unseen.length ? unseen : pool;
  const selected = choices[hash(`${workout.id}|pick|juice-v1`) % choices.length];

  return {
    ...selected,
    id: `${selected.id}-${workout.id}`,
    baseId: selected.id,
    earnedAt: new Date().toISOString(),
    source: 'Adventure Drop',
    workoutId: workout.id
  };
}

async function processLootRoll(data, newlyCompletedIds) {
  if (!newlyCompletedIds.length) return { changed: false, dropped: [] };

  data.ui ||= {};
  data.ui.rpg ||= {};
  data.ui.rpg.inventory ||= [];
  data.ui.rpg.juiceLootRolls ||= {};

  const dropped = [];
  let changed = false;

  for (const workoutId of newlyCompletedIds) {
    if (data.ui.rpg.juiceLootRolls[workoutId]) continue;

    const workout = (data.workouts || []).find(item => item.id === workoutId);
    if (!workout) continue;

    const loot = chooseLoot(workout, data.ui.rpg.inventory);

    data.ui.rpg.juiceLootRolls[workoutId] = {
      rolledAt: new Date().toISOString(),
      dropId: loot?.id || null
    };

    changed = true;

    if (loot) {
      data.ui.rpg.inventory.push(loot);
      dropped.push(loot);
    }
  }

  if (changed) {
    internalWrite = true;
    await writeSave(data);
    internalWrite = false;
  }

  return { changed, dropped };
}

async function compareNow() {
  if (compareBusy || internalWrite) return;
  if (!$('#appRoot') || $('#appRoot').hidden) return;

  compareBusy = true;

  try {
    const data = (await readSave())?.save;
    if (!data) return;

    const next = summary(data);

    if (!snapshot) {
      snapshot = next;
      renderLootVault(data);
      renderDayConquered(data);
      return;
    }

    const xpDelta = next.stats.xp - snapshot.stats.xp;

    if (xpDelta > 0) {
      xpFloat(xpDelta);
      pulseXpBar();
      actionToast(
        '✨',
        `+${xpDelta} XP`,
        'Campaign experience increased.',
        'xp'
      );
    }

    if (
      next.stats.streak > snapshot.stats.streak &&
      STREAK_MILESTONES.has(next.stats.streak)
    ) {
      actionToast(
        '🔥',
        `${next.stats.streak}-day streak`,
        'Momentum maintained.',
        'rare'
      );
      announceStreak(next.stats.streak);
    }

    const newAchievements = [...next.achievementIds]
      .filter(id => !snapshot.achievementIds.has(id))
      .map(id => next.achievementsById.get(id))
      .filter(Boolean);

    newAchievements.slice(0, 2).forEach(item => {
      actionToast(
        item.icon || '🏆',
        'Achievement unlocked',
        item.name || 'New campaign milestone.',
        'rare'
      );
      announceAchievement(item);
    });

    const newActivityAchievements =
      [...next.activityAchievementIds]
        .filter(id => !snapshot.activityAchievementIds.has(id))
        .map(id => next.activityAchievements[id])
        .filter(Boolean);

    newActivityAchievements.forEach(item => {
      actionToast(
        item.icon || '⌚',
        'Activity achievement',
        item.name || 'Movement milestone reached.',
        'rare'
      );

      announceAchievement({
        ...item,
        kind: 'activity'
      });
    });

    Object.entries(next.bosses).forEach(([bossId, boss]) => {
      const previousBoss = snapshot.bosses[bossId];

      const newAttacks = [...boss.attackIds].filter(
        id => !previousBoss?.attackIds?.has(id)
      );

      if (newAttacks.length && boss.lastAttack) {
        damageFloat(
          boss.lastAttack,
          boss.defeated && !previousBoss?.defeated
        );

        chunkBossHealth();

        actionToast(
          boss.lastAttack.source === 'activity' ? '⌚' : '⚔️',
          `Boss −${Math.round(Number(boss.lastAttack.damage) || 0)} HP`,
          boss.lastAttack.source === 'activity'
            ? 'Field Strike landed.'
            : 'Adventure Strike landed.',
          'damage'
        );
      }

      if (boss.defeated && !previousBoss?.defeated) {
        announceBossDefeat(bossId);
      }
    });


    if (
      next.readyWorkoutDamage > snapshot.readyWorkoutDamage &&
      next.readyWorkoutDamage > 0
    ) {
      actionToast(
        '⚔️',
        `${next.readyWorkoutDamage} boss damage ready`,
        'New workout power is charged. Strike when ready.',
        'xp'
      );
    }

    if (
      next.readyActivityDamage > snapshot.readyActivityDamage &&
      next.readyActivityDamage > 0
    ) {
      actionToast(
        '⌚',
        `Field Strike ready · ${next.readyActivityDamage} damage`,
        'New Apple Watch activity can hit the boss.',
        'xp'
      );
    }

    const newlyCompletedIds =
      [...next.completedWorkoutIds]
        .filter(id => !snapshot.completedWorkoutIds.has(id));

    const lootResult =
      await processLootRoll(data, newlyCompletedIds);

    if (lootResult.changed) {
      const afterLoot = summary(data);
      snapshot = afterLoot;

      lootResult.dropped.forEach(item => {
        actionToast(
          item.icon || '🎁',
          `${item.rarity || 'Rare'} loot drop`,
          item.name || 'New relic added to your vault.',
          'rare'
        );
        announceLoot(item);
      });
    } else {
      snapshot = next;
    }

    renderLootVault(data);
    renderDayConquered(data);

    if (
      dayConquered(data) &&
      newlyCompletedIds.length
    ) {
      actionToast(
        '🏁',
        'DAY CONQUERED',
        'Training and daily systems aligned.',
        'rare'
      );

      queueModal({
        icon: '🏁',
        kicker: 'DAY CONQUERED',
        title: 'Mission Complete',
        message: 'Training and daily systems aligned. Today is officially written into the campaign.',
        meta: [
          { label: 'Adventure', value: 'COMPLETE' },
          { label: 'Campaign', value: 'ADVANCED', className: 'fitquest-rarity-rare' }
        ],
        particles: 34
      });
    }

  } catch (error) {
    console.warn('Juice Engine comparison failed:', error);
  } finally {
    compareBusy = false;
    internalWrite = false;
  }
}

function scheduleCompare(delay = 280) {
  clearTimeout(compareTimer);
  compareTimer = setTimeout(() => void compareNow(), delay);
}

function watchCompletionOverlay() {
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(juiceExistingCompletionOverlay);
    });
  });

  // The overlay is appended directly to <body>, so no subtree watching is needed.
  observer.observe(document.body, { childList: true });
}

async function baseline() {
  try {
    const data = (await readSave())?.save;

    if (!data) return;

    snapshot = summary(data);
    renderLootVault(data);
    renderDayConquered(data);
  } catch (error) {
    console.warn('Juice Engine baseline failed:', error);
  }
}

function boot() {
  styles();
  watchCompletionOverlay();

  whenReady(() => appVisible() && $('#fitquestScreenHost'), () => {
    void baseline();
  });

  window.addEventListener('fitquest:saved', () => {
    scheduleCompare(350);
  });

  window.addEventListener('fitquest:remote-update', () => {
    scheduleCompare(180);
  });

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'character') {
      scheduleCompare(80);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      scheduleCompare(180);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
