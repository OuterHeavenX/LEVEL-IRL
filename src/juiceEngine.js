import { readSave, writeSave } from './lib/storage.js';
import { calculateStats } from './lib/progression.js';
import { achievementSummary } from './lib/achievements.js';
import { BOSSES, readyBossDamage } from './lib/bosses.js';
import { $, localDateISO, activeDateISO, escapeHtml, toast, reducedMotion, injectStyles, appVisible, whenReady } from './lib/dom.js';


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
let modalQueue = [];
let modalOpen = false;

// Every unlock this page has already shown or started with, so a stat that dips
// and recovers does not announce the same milestone twice.
const announcedAchievements = new Set();
const announcedStreaks = new Set();

function seedAnnounced(state) {
  state.achievementIds.forEach(id => announcedAchievements.add(id));
  if (STREAK_MILESTONES.has(state.stats.streak)) {
    announcedStreaks.add(`${state.stats.streak}:${localDateISO()}`);
  }
}

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
      font-size: 10px;
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

    #fitquestBossBattle.fitquest-hp-chunk .fitquest-boss-bar > i {
      filter: brightness(1.55) saturate(1.25);
      box-shadow: 0 0 28px rgba(255,112,112,.42);
    }

    #xpBar.fitquest-xp-pulse {
      filter: brightness(1.45);
      box-shadow: 0 0 20px rgba(218, 103, 255, .28);
      transition: width .35s ease;
    }

    .fitquest-rarity-common { color: #bbc5d8; }
    .fitquest-rarity-rare { color: #67cbff; }
    .fitquest-rarity-epic { color: #c585ff; }
    .fitquest-rarity-legendary { color: #ffd36a; }

    .fitquest-loot-vault {
      grid-column: 1 / -1;
    }

    .fitquest-loot-count {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.07);
      color: #8e9ab3;
    }

    .fitquest-loot-grid {
      display: flex;
      gap: 7px;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scrollbar-width: none;
      padding-bottom: 2px;
    }

    .fitquest-loot-grid::-webkit-scrollbar {
      display: none;
    }

    .fitquest-loot-item {
      flex: 0 0 132px;
      min-width: 132px;
      padding: 10px;
      border-radius: 13px;
      background: rgba(255,255,255,.038);
      border: 1px solid rgba(255,255,255,.065);
    }

    .fitquest-loot-item > span {
      display: block;
      margin-bottom: 5px;
      font-size: 22px;
    }

    .fitquest-loot-item strong,
    .fitquest-loot-item small {
      display: block;
    }

    .fitquest-loot-item strong {
      color: #eef2ff;
      font-size: 11px;
      line-height: 1.25;
    }

    .fitquest-loot-item small {
      margin-top: 4px;
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .07em;
    }

    .fitquest-loot-empty {
      flex: 1 1 100%;
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

  return value >>> 0;
}

function rarityClass(rarity = '') {
  return `fitquest-rarity-${String(rarity).toLowerCase().replace(/[^a-z-]/g, '')}`;
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

function xpFloat(amount, anchor = $('#xpBar')) {
  amount = Math.round(Number(amount) || 0);
  if (amount <= 0) return;

  const rect = anchor?.getBoundingClientRect?.();
  // A hidden screen gives a zero rect; an anchor scrolled out of view is no use either.
  const usable = rect && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;

  const el = document.createElement('div');
  el.className = 'fitquest-xp-float';
  el.textContent = `+${amount} XP`;

  el.style.left = `${usable ? rect.left + rect.width / 2 : window.innerWidth / 2}px`;
  el.style.top = `${usable ? rect.top + rect.height / 2 : window.innerHeight * .30}px`;

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1700);
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
      <div class="fitquest-juice-icon">${escapeHtml(config.icon || '✨')}</div>
      <p class="fitquest-juice-kicker">${escapeHtml(config.kicker || 'LEVEL IRL')}</p>
      <h2>${escapeHtml(config.title || 'Campaign Updated')}</h2>
      <p>${escapeHtml(config.message || '')}</p>

      ${
        meta.length
          ? `<div class="fitquest-juice-meta" style="--cols:${Math.min(3, meta.length)}">
              ${meta.map(item => `
                <div>
                  <small>${escapeHtml(item.label)}</small>
                  <strong class="${escapeHtml(item.className || '')}">${escapeHtml(item.value)}</strong>
                </div>
              `).join('')}
            </div>`
          : ''
      }

      <button class="fitquest-juice-close" type="button">
        ${escapeHtml(config.button || 'Continue Campaign')}
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
      name: boss?.name || '',
      defeated: Boolean(boss?.defeated),
      attackIds: new Set((boss?.attacks || []).map(attack => attack.id)),
      lastAttack: boss?.lastAttack || null
    };
  });

  const activityAchievements = data.ui?.rpg?.activityAchievements || {};

  const completedWorkoutIds = new Set(
    (data.workouts || [])
      .filter(workout => workout.completed)
      .map(workout => workout.id)
      .filter(Boolean)
  );

  const ready = readyBossDamage(data);

  return {
    stats,
    readyWorkoutDamage: ready.move,
    readyActivityDamage: ready.activity,
    achievementIds: new Set(achievements.unlocked.map(item => item.id)),
    achievementsById: new Map(achievements.unlocked.map(item => [item.id, item])),
    activityAchievementIds: new Set(Object.keys(activityAchievements)),
    activityAchievements,
    bosses: bossState,
    completedWorkoutIds
  };
}

function dayConquered(data, date = localDateISO()) {
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

  if (!dayConquered(data, activeDateISO())) return;

  const badge = document.createElement('div');
  badge.className = 'fitquest-day-conquered';
  badge.textContent = '✓ DAY CONQUERED';

  const heroDate = hero.querySelector('#heroDate');
  if (heroDate) heroDate.after(badge);
  else hero.appendChild(badge);
}

function renderLootVault(data) {
  const character = $('#fitquestScreenGrid-character');
  if (!character) return;

  let vault = $('#fitquestLootVault');

  if (!vault) {
    vault = document.createElement('section');
    vault.id = 'fitquestLootVault';
    vault.className = 'card fitquest-loot-vault';
    const dossier = character.querySelector('.character-card');
    if (dossier) dossier.after(vault);
    else character.appendChild(vault);
  }

  const inventory = data.ui?.rpg?.inventory || [];

  vault.innerHTML = `
    <div class="section-heading fitquest-loot-vault-head">
      <div>
        <p class="eyebrow">COSMETIC LOOT</p>
        <h3>Relic Vault</h3>
      </div>
      <span class="pill fitquest-loot-count">${inventory.length} ITEM${inventory.length === 1 ? '' : 'S'}</span>
    </div>

    <div class="fitquest-loot-grid">
      ${
        inventory.length
          ? [...inventory].reverse().map(item => `
              <article class="fitquest-loot-item">
                <span>${escapeHtml(item?.icon || '🎁')}</span>
                <strong>${escapeHtml(item?.name || 'Unknown Relic')}</strong>
                <small class="${rarityClass(item?.rarity)}">${escapeHtml(item?.rarity || 'Relic')}</small>
              </article>
            `).join('')
          : `<div class="fitquest-loot-empty">
              No relics yet. Complete Adventures, defeat bosses, and keep the campaign moving.
            </div>`
      }
    </div>
  `;
}

function juiceLevelOverlay(node) {
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
      50
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
    message: item.description || 'A cosmetic relic has been added to your Relic Vault.',
    meta: [
      {
        label: 'Rarity',
        value: item.rarity || 'Relic',
        className: rarityClass(item.rarity)
      },
      {
        label: 'Collection',
        value: 'Relic Vault'
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

function announceBossDefeat(id, storedName) {
  const def = BOSSES.find(boss => boss.id === id);
  const name = storedName || def?.name;

  queueModal({
    icon: '💥',
    kicker: 'BOSS DEFEATED',
    title: name ? `${name} Has Fallen` : 'Boss Defeated',
    message: 'The battlefield is quiet. Victory rewards have been added to your campaign.',
    meta: [
      { label: 'Result', value: 'VICTORY', className: 'fitquest-rarity-legendary' },
      { label: 'Reward', value: def?.loot ? `${def.loot.icon} ${def.loot.name}` : 'LOOT UNLOCKED' }
    ],
    particles: 70
  });
}

function chooseLoot(workout, existingInventory) {
  const seed = hash(`${workout.id}|${workout.completedAt || workout.date}|juice-v1`);
  const existingJuice = existingInventory.filter(item => item?.source === 'Adventure Drop');

  // The first Adventure Drop is always guaranteed.
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
    item => !existingInventory.some(existing => existing?.id === item.id)
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

function processLootRoll(data, newlyCompletedIds) {
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

  if (changed) writeSave(data);

  return { changed, dropped };
}

function compareNow() {
  if (compareBusy) return;
  if (!appVisible()) return;

  compareBusy = true;

  try {
    const data = readSave();
    if (!data) return;

    const next = summary(data);

    if (!snapshot) {
      snapshot = next;
      seedAnnounced(next);
      renderLootVault(data);
      renderDayConquered(data);
      return;
    }

    const xpDelta = next.stats.xp - snapshot.stats.xp;

    if (xpDelta > 0) {
      xpFloat(xpDelta);
      pulseXpBar();
    }

    const streakKey = `${next.stats.streak}:${localDateISO()}`;

    if (
      next.stats.streak > snapshot.stats.streak &&
      STREAK_MILESTONES.has(next.stats.streak) &&
      !announcedStreaks.has(streakKey)
    ) {
      announcedStreaks.add(streakKey);
      toast(`${next.stats.streak}-day streak`, {
        icon: '🔥',
        detail: 'Momentum maintained.',
        tone: 'rare'
      });
      announceStreak(next.stats.streak);
    }

    const newAchievements = [...next.achievementIds]
      .filter(id => !snapshot.achievementIds.has(id) && !announcedAchievements.has(id))
      .map(id => next.achievementsById.get(id))
      .filter(Boolean);

    next.achievementIds.forEach(id => announcedAchievements.add(id));

    newAchievements.slice(0, 2).forEach(item => {
      toast('Achievement unlocked', {
        icon: item.icon || '🏆',
        detail: item.name || 'New campaign milestone.',
        tone: 'rare'
      });
      // rpgExpansion runs its own LEVEL UP ceremony for level milestones.
      if (item.kind !== 'level') announceAchievement(item);
    });

    const newActivityAchievements =
      [...next.activityAchievementIds]
        .filter(id => !snapshot.activityAchievementIds.has(id))
        .map(id => next.activityAchievements[id])
        .filter(Boolean);

    newActivityAchievements.forEach(item => {
      toast('Activity achievement', {
        icon: item.icon || '⌚',
        detail: item.name || 'Movement milestone reached.',
        tone: 'rare'
      });
    });

    const topActivity = newActivityAchievements.reduce(
      (best, item) => (Number(item.target) || 0) > (Number(best?.target) || 0) ? item : best,
      null
    );

    if (topActivity) {
      announceAchievement({
        ...topActivity,
        kind: 'activity'
      });
    }

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

        toast(`Boss −${Math.round(Number(boss.lastAttack.damage) || 0)} HP`, {
          icon: boss.lastAttack.source === 'activity' ? '⌚' : '⚔️',
          detail: boss.lastAttack.source === 'activity'
            ? 'Field Strike landed.'
            : 'Boss Strike landed.',
          tone: 'damage'
        });
      }

      if (boss.defeated && !previousBoss?.defeated) {
        announceBossDefeat(bossId, boss.name);
      }
    });

    if (
      next.readyWorkoutDamage > snapshot.readyWorkoutDamage &&
      next.readyWorkoutDamage > 0
    ) {
      toast(`${next.readyWorkoutDamage} boss damage ready`, {
        icon: '⚔️',
        detail: 'New workout power is charged. Strike when ready.',
        tone: 'xp'
      });
    }

    if (
      next.readyActivityDamage > snapshot.readyActivityDamage &&
      next.readyActivityDamage > 0
    ) {
      toast(`Field Strike ready · ${next.readyActivityDamage} damage`, {
        icon: '⌚',
        detail: 'New Apple Watch activity can hit the boss.',
        tone: 'xp'
      });
    }

    const newlyCompletedIds =
      [...next.completedWorkoutIds]
        .filter(id => !snapshot.completedWorkoutIds.has(id));

    const lootResult = processLootRoll(data, newlyCompletedIds);

    if (lootResult.changed) {
      snapshot = summary(data);

      lootResult.dropped.forEach(item => {
        toast(`${item.rarity || 'Rare'} loot drop`, {
          icon: item.icon || '🎁',
          detail: item.name || 'New relic added to your Relic Vault.',
          tone: 'rare'
        });
        announceLoot(item);
      });
    } else {
      snapshot = next;
    }

    renderLootVault(data);
    renderDayConquered(data);

    const today = localDateISO();
    const todayNewlyCompleted = (data.workouts || []).some(
      workout => workout.date === today && workout.completed && newlyCompletedIds.includes(workout.id)
    );

    if (todayNewlyCompleted && dayConquered(data)) {
      toast('DAY CONQUERED', {
        icon: '🏁',
        detail: 'Training and daily systems aligned.',
        tone: 'rare'
      });

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
  }
}

function scheduleCompare(delay = 280) {
  clearTimeout(compareTimer);
  compareTimer = setTimeout(() => void compareNow(), delay);
}

function watchLevelOverlay() {
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(juiceLevelOverlay);
    });
  });

  // The overlay is appended directly to <body>, so no subtree watching is needed.
  observer.observe(document.body, { childList: true });
}

function boot() {
  styles();
  watchLevelOverlay();

  whenReady(() => appVisible() && $('#fitquestScreenHost'), () => scheduleCompare(0));

  window.addEventListener('fitquest:saved', event => {
    // An imported save is a new baseline, not a run of fresh unlocks.
    if (event.detail?.source === 'import') snapshot = null;
    scheduleCompare(350);
  });

  window.addEventListener('fitquest:remote-update', () => {
    scheduleCompare(180);
  });

  window.addEventListener('fitquest:active-date', () => {
    scheduleCompare(80);
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

boot();
