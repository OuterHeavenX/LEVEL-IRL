import './navigation.js';
import './dailyActivity.js';
import { readCloudSave, writeSave } from './lib/storage.js';
import { workoutBattlePower } from './lib/progression.js';

const $ = selector => document.querySelector(selector);

const BOSSES = [
  { id:'iron-warden-v1', name:'The Iron Warden', title:'Gatekeeper of the First Forge', icon:'🛡️', maxHp:600, rewardXp:100, loot:{ id:'iron-warden-sigil', name:'Sigil of the First Forge', icon:'🔱', rarity:'Rare', description:'Proof that the First Forge has fallen.' } },
  { id:'marsh-hydra-v1', name:'The Marsh Hydra', title:'Many-Headed Terror of the Lowlands', icon:'🐲', maxHp:850, rewardXp:150, loot:{ id:'hydra-heart', name:'Hydra Heart', icon:'💚', rarity:'Epic', description:'A living ember of relentless endurance.' } },
  { id:'storm-colossus-v1', name:'The Storm Colossus', title:'Titan Above the Thunder Pass', icon:'⚡', maxHp:1150, rewardXp:225, loot:{ id:'storm-core', name:'Storm Core', icon:'💠', rarity:'Epic', description:'Power drawn from every step forward.' } },
  { id:'void-champion-v1', name:'The Void Champion', title:'Final Rival of the First Campaign', icon:'🗡️', maxHp:1500, rewardXp:350, loot:{ id:'void-crown', name:'Crown of Resolve', icon:'👑', rarity:'Legendary', description:'The mark of an unbreakable adventurer.' } }
];

let BOSS = BOSSES[0];

let busy = false;
let strikeBusy = false;

function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function styles() {
  if ($('#fitquestBossStyles')) return;

  const style = document.createElement('style');
  style.id = 'fitquestBossStyles';
  style.textContent = `
    .fitquest-boss-card {
      margin: 22px 0;
      padding: 24px;
      border-radius: 24px;
      border: 1px solid rgba(255,112,112,.18);
      background:
        radial-gradient(circle at 80% 0%,rgba(255,91,91,.13),transparent 38%),
        linear-gradient(145deg,rgba(21,28,52,.97),rgba(11,17,34,.97));
      color: #f6f8ff;
    }

    .fitquest-boss-head {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 18px;
    }

    .fitquest-boss-heading {
      display: flex;
      gap: 14px;
      align-items: center;
    }

    .fitquest-boss-icon {
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      font-size: 30px;
      background: rgba(255,255,255,.055);
      border: 1px solid rgba(255,255,255,.09);
    }

    .fitquest-boss-eyebrow {
      margin: 0 0 5px;
      color: #ff9a9a;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .16em;
    }

    .fitquest-boss-heading h3 {
      margin: 0;
      font-size: 23px;
    }

    .fitquest-boss-heading small {
      color: #8f9bb5;
    }

    .fitquest-boss-status {
      padding: 8px 11px;
      border-radius: 999px;
      background: rgba(255,255,255,.05);
      color: #ffb1b1;
      font-size: 11px;
      font-weight: 900;
      white-space: nowrap;
    }

    .fitquest-boss-hp-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      color: #aeb8cd;
      font-size: 12px;
      font-weight: 800;
    }

    .fitquest-boss-bar {
      height: 13px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.07);
    }

    .fitquest-boss-bar > i {
      display: block;
      height: 100%;
      background: linear-gradient(90deg,#ff6d72,#ffab66);
      transition: width .35s ease;
    }

    .fitquest-boss-grid {
      display: grid;
      grid-template-columns: repeat(3,1fr);
      gap: 10px;
      margin-top: 16px;
    }

    .fitquest-boss-grid > div {
      padding: 12px;
      border-radius: 14px;
      background: rgba(255,255,255,.045);
    }

    .fitquest-boss-grid small,
    .fitquest-boss-grid strong {
      display: block;
    }

    .fitquest-boss-grid small {
      color: #8793ad;
      font-size: 10px;
      text-transform: uppercase;
    }

    .fitquest-boss-actions {
      display: grid;
      gap: 9px;
      margin-top: 14px;
    }

    .fitquest-boss-strike {
      width: 100%;
      min-height: 52px;
      padding: 10px 14px;
      border-radius: 14px;
      border: 1px solid rgba(105,232,177,.25);
      background:
        linear-gradient(135deg,rgba(72,203,156,.14),rgba(87,118,255,.13));
      color: #9ff1ca;
      font: inherit;
      font-weight: 950;
      cursor: pointer;
      box-shadow: 0 10px 28px rgba(0,0,0,.16);
    }

    .fitquest-boss-strike.activity {
      border-color: rgba(91,199,255,.24);
      background: rgba(91,199,255,.07);
      color: #a8ddff;
    }

    .fitquest-boss-strike:disabled {
      opacity: .55;
      cursor: wait;
    }

    .fitquest-boss-callout {
      margin-top: 14px;
      color: #b2bdd2;
      font-size: 13px;
      line-height: 1.5;
    }

    .fitquest-boss-loot {
      margin-top: 14px;
      padding: 13px;
      border-radius: 14px;
      border: 1px solid rgba(172,112,255,.22);
      background: rgba(145,89,255,.08);
      color: #d9c6ff;
    }

    .fitquest-boss-flash {
      animation: fqhit .6s ease;
    }

    @keyframes fqhit {
      20% { transform: translateX(-5px); }
      40% { transform: translateX(5px); }
      60% { transform: translateX(-3px); }
      80% { transform: translateX(3px); }
    }

    @media(max-width:700px) {
      .fitquest-boss-head { flex-direction: column; }
      .fitquest-boss-grid { grid-template-columns: 1fr; }
    }
  `;

  document.head.appendChild(style);
}

function ensureBoss(data) {
  data.ui ||= {};
  data.ui.rpg ||= {};
  data.ui.rpg.inventory ||= [];
  data.ui.rpg.bosses ||= {};

  BOSS = BOSSES.find(definition => !data.ui.rpg.bosses[definition.id]?.defeated)
    || BOSSES[BOSSES.length - 1];

  data.ui.rpg.bosses[BOSS.id] ||= {
    id: BOSS.id,
    name: BOSS.name,
    title: BOSS.title,
    maxHp: BOSS.maxHp,
    hp: BOSS.maxHp,
    attacks: [],
    defeated: false,
    rewardGranted: false
  };

  const boss = data.ui.rpg.bosses[BOSS.id];

  boss.attacks ||= [];
  boss.maxHp = Number(boss.maxHp) || BOSS.maxHp;
  boss.hp = Math.max(0, Math.min(boss.maxHp, Number(boss.hp ?? boss.maxHp)));

  return boss;
}

function streakFor(data, date) {
  const dates = [...new Set(
    (data.workouts || [])
      .filter(w => w.completed && w.date && w.date <= date)
      .map(w => w.date)
  )].sort();

  if (!dates.length) return 0;

  let streak = 1;

  for (let i = dates.length - 1; i > 0; i--) {
    const a = new Date(`${dates[i]}T12:00:00`);
    const b = new Date(`${dates[i - 1]}T12:00:00`);

    if (Math.round((a - b) / 86400000) === 1) streak++;
    else break;
  }

  return streak;
}

function sliceDamage(exercises = [], streak = 0) {
  return workoutBattlePower(exercises, streak);
}

function activityDamage(checkIn) {
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

function strike(boss, { id, date, damage, at, source }) {
  const before = boss.hp;
  const after = Math.max(0, before - damage);

  const attack = {
    id,
    date,
    damage,
    hpBefore: before,
    hpAfter: after,
    source,
    at
  };

  boss.hp = after;
  boss.attacks.push(attack);
  boss.lastAttack = attack;

  return after === 0 && !boss.defeated;
}

function grantVictory(data, boss, at) {
  if (boss.rewardGranted) return;

  boss.rewardGranted = true;
  data.ui.rpg.bossVictoryXp =
    (Number(data.ui.rpg.bossVictoryXp) || 0) + BOSS.rewardXp;

  if (!data.ui.rpg.inventory.some(item => item.id === BOSS.loot.id)) {
    data.ui.rpg.inventory.push({
      ...BOSS.loot,
      earnedAt: at,
      source: BOSS.name
    });
  }
}

function applyPending(data) {
  const boss = ensureBoss(data);

  let changed = false;
  let last = null;

  for (const workout of (data.workouts || [])) {
    if (boss.defeated) break;

    const exercises = Array.isArray(workout.exercises)
      ? workout.exercises
      : [];

    const submitted =
      Math.max(0, Number(workout.bossSubmittedExerciseCount) || 0);

    // Migration/failsafe:
    // An Adventure that is already ended must never retain orphaned damage.
    const requestedRaw = workout.completed
      ? exercises.length
      : Math.max(
          submitted,
          Number(workout.bossStrikeRequestedCount) || 0
        );

    const requested =
      Math.min(exercises.length, requestedRaw);

    if (requested <= submitted) continue;

    const chunk = exercises.slice(submitted, requested);
    const damage = sliceDamage(chunk, streakFor(data, workout.date));
    const at =
      workout.bossStrikeRequestedAt ||
      workout.completedAt ||
      new Date().toISOString();

    if (damage <= 0) continue;

    const defeated = strike(boss, {
      id: `boss-move-${workout.id || workout.date}-${submitted}-${requested}`,
      date: workout.date,
      damage,
      at,
      source: 'adventure'
    });

    workout.bossSubmittedExerciseCount = requested;
    workout.bossStrikeRequestedCount = requested;
    workout.bossLastStrikeDamage = damage;
    workout.bossLastStrikeAt = at;

    changed = true;
    last = boss.lastAttack;

    if (defeated) {
      boss.defeated = true;
      boss.defeatedAt = at;
      grantVictory(data, boss, at);
    }
  }

  // Activity only lands when the player presses FIELD STRIKE.
  for (const checkIn of (data.checkIns || [])) {
    if (boss.defeated) break;

    const total = activityDamage(checkIn);

    // Support data previously auto-applied by v2.
    const applied = Math.max(
      0,
      Number(checkIn.bossActivityDamageApplied) ||
      Number(checkIn.bossActivityApplied?.damage) ||
      0
    );

    const requested = Math.max(
      applied,
      Math.min(
        total,
        Number(checkIn.bossActivityStrikeRequestedDamage) || applied
      )
    );

    const delta = Math.max(0, requested - applied);

    if (delta <= 0) continue;

    const at =
      checkIn.bossActivityStrikeRequestedAt ||
      checkIn.activityUpdatedAt ||
      new Date().toISOString();

    const defeated = strike(boss, {
      id: `boss-activity-${checkIn.id || checkIn.date}-${applied}-${requested}`,
      date: checkIn.date,
      damage: delta,
      at,
      source: 'activity'
    });

    checkIn.bossActivityDamageApplied = requested;
    checkIn.bossActivityApplied = {
      bossId: BOSS.id,
      damage: requested,
      at
    };

    changed = true;
    last = boss.lastAttack;

    if (defeated) {
      boss.defeated = true;
      boss.defeatedAt = at;
      grantVictory(data, boss, at);
    }
  }

  return { boss, changed, last };
}

function readyDamage(data) {
  const today = localDateISO();

  const workout =
    (data.workouts || []).find(item => item.date === today);

  const exercises =
    Array.isArray(workout?.exercises)
      ? workout.exercises
      : [];

  const submitted =
    Math.max(0, Number(workout?.bossSubmittedExerciseCount) || 0);

  const move =
    sliceDamage(
      exercises.slice(submitted),
      streakFor(data, today)
    );

  const checkIn =
    (data.checkIns || []).find(item => item.date === today);

  const totalActivity =
    activityDamage(checkIn);

  const appliedActivity =
    Math.max(
      0,
      Number(checkIn?.bossActivityDamageApplied) ||
      Number(checkIn?.bossActivityApplied?.damage) ||
      0
    );

  return {
    move,
    activity: Math.max(0, totalActivity - appliedActivity),
    workout,
    checkIn,
    totalActivity
  };
}

async function requestWorkoutStrike() {
  if (strikeBusy) return;
  strikeBusy = true;

  try {
    const cloud = await readCloudSave();
    const data = cloud?.save;
    if (!data) throw new Error('No cloud save is available.');

    const ready = readyDamage(data);
    const workout = ready.workout;

    if (!workout || ready.move <= 0) {
      throw new Error('No workout damage is ready.');
    }

    workout.bossStrikeRequestedCount =
      Array.isArray(workout.exercises)
        ? workout.exercises.length
        : 0;

    workout.bossStrikeRequestedAt =
      new Date().toISOString();

    const ok = await writeSave(data);
    if (!ok) throw new Error('FitQuest could not submit this strike.');

    await refresh();

  } catch (error) {
    window.alert(error?.message || 'Unable to strike the boss.');
  } finally {
    strikeBusy = false;
  }
}

async function requestActivityStrike() {
  if (strikeBusy) return;
  strikeBusy = true;

  try {
    const cloud = await readCloudSave();
    const data = cloud?.save;
    if (!data) throw new Error('No cloud save is available.');

    const ready = readyDamage(data);
    const checkIn = ready.checkIn;

    if (!checkIn || ready.activity <= 0) {
      throw new Error('No Apple Watch damage is ready.');
    }

    checkIn.bossActivityStrikeRequestedDamage =
      ready.totalActivity;

    checkIn.bossActivityStrikeRequestedAt =
      new Date().toISOString();

    const ok = await writeSave(data);
    if (!ok) throw new Error('FitQuest could not submit this field strike.');

    await refresh();

  } catch (error) {
    window.alert(error?.message || 'Unable to submit field strike.');
  } finally {
    strikeBusy = false;
  }
}

function wireStrikeButtons() {
  $('#fitquestBossWorkoutStrike')?.addEventListener(
    'click',
    requestWorkoutStrike
  );

  $('#fitquestBossActivityStrike')?.addEventListener(
    'click',
    requestActivityStrike
  );
}

function render(data) {
  const grid = $('.stats-grid');
  if (!grid) return;

  let card = $('#fitquestBossBattle');

  if (!card) {
    card = document.createElement('section');
    card.id = 'fitquestBossBattle';
    card.className = 'fitquest-boss-card';
    grid.insertAdjacentElement('afterend', card);

    window.dispatchEvent(
      new CustomEvent('fitquest:boss-ready')
    );
  }

  const boss = ensureBoss(data);
  const percent =
    boss.maxHp
      ? boss.hp / boss.maxHp * 100
      : 0;

  const totalDamage =
    boss.attacks.reduce(
      (sum, attack) =>
        sum + (Number(attack.damage) || 0),
      0
    );

  const ready = readyDamage(data);

  const lastHit =
    boss.lastAttack?.damage
      ? `${boss.lastAttack.damage} damage · ${
          boss.lastAttack.source === 'activity'
            ? '⌚ Activity'
            : '⚔️ Adventure'
        }`
      : 'No strikes yet';

  const loot =
    data.ui.rpg.inventory.find(
      item => item.id === BOSS.loot.id
    );

  card.innerHTML = `
    <div class="fitquest-boss-head">
      <div class="fitquest-boss-heading">
        <div class="fitquest-boss-icon">${BOSS.icon}</div>

        <div>
          <p class="fitquest-boss-eyebrow">
            CAMPAIGN BOSS ${BOSSES.findIndex(item => item.id === BOSS.id) + 1} / ${BOSSES.length}
          </p>

          <h3>${BOSS.name}</h3>
          <small>${BOSS.title}</small>
        </div>
      </div>

      <span class="fitquest-boss-status">
        ${boss.defeated ? '✓ DEFEATED' : '⚔️ ACTIVE BATTLE'}
      </span>
    </div>

    <div class="fitquest-boss-hp-row">
      <span>Boss Health</span>
      <strong>${boss.hp} / ${boss.maxHp} HP</strong>
    </div>

    <div class="fitquest-boss-bar">
      <i style="width:${percent}%"></i>
    </div>

    <div class="fitquest-boss-grid">
      <div>
        <small>Strikes Landed</small>
        <strong>${boss.attacks.length}</strong>
      </div>

      <div>
        <small>Total Damage</small>
        <strong>${totalDamage}</strong>
      </div>

      <div>
        <small>Last Strike</small>
        <strong>${lastHit}</strong>
      </div>
    </div>

    ${
      !boss.defeated && (ready.move > 0 || ready.activity > 0)
        ? `
          <div class="fitquest-boss-actions">
            ${
              ready.move > 0
                ? `
                  <button
                    id="fitquestBossWorkoutStrike"
                    class="fitquest-boss-strike"
                    type="button"
                  >
                    ⚔️ STRIKE BOSS · ${ready.move} DAMAGE
                  </button>
                `
                : ''
            }

            ${
              ready.activity > 0
                ? `
                  <button
                    id="fitquestBossActivityStrike"
                    class="fitquest-boss-strike activity"
                    type="button"
                  >
                    ⌚ FIELD STRIKE · ${ready.activity} DAMAGE
                  </button>
                `
                : ''
            }
          </div>
        `
        : ''
    }

    <p class="fitquest-boss-callout">
      ${
        boss.defeated
          ? BOSS.id === BOSSES[BOSSES.length - 1].id
            ? 'Campaign cleared. Your next chapter is waiting.'
            : 'Victory secured. The next boss will appear automatically.'
          : 'Log moves all day, then strike whenever you want. Saving new Apple Watch totals can charge a separate Field Strike.'
      }
    </p>

    <div class="fitquest-boss-loot">
      ${
        loot
          ? `${loot.icon} Victory Reward Earned: ${loot.name} + ${BOSS.rewardXp} XP`
          : `🔒 Victory Reward: ${BOSS.loot.name} + ${BOSS.rewardXp} XP`
      }
    </div>
  `;

  wireStrikeButtons();
}

async function refresh() {
  if (busy) return;
  busy = true;

  try {
    const cloud = await readCloudSave();
    const data = cloud?.save;
    if (!data) return;

    const result = applyPending(data);

    if (result.changed) {
      await writeSave(data);
    }

    render(data);

    if (result.last) {
      const card = $('#fitquestBossBattle');

      card?.classList.add('fitquest-boss-flash');

      setTimeout(
        () => card?.classList.remove('fitquest-boss-flash'),
        700
      );

      window.dispatchEvent(
        new CustomEvent('fitquest:boss-hit', {
          detail: result.last
        })
      );
    }

  } catch (error) {
    console.warn('Boss refresh failed:', error);
  } finally {
    busy = false;
  }
}

function boot() {
  styles();

  let attempts = 0;

  const timer = setInterval(() => {
    attempts++;

    if (
      $('#appRoot') &&
      !$('#appRoot').hidden &&
      $('.stats-grid')
    ) {
      clearInterval(timer);
      void refresh();
    } else if (attempts > 120) {
      clearInterval(timer);
    }
  }, 120);

  [
    'fitquest:boss-strike-requested',
    'fitquest:remote-update'
  ].forEach(name => {
    window.addEventListener(
      name,
      () => setTimeout(() => void refresh(), 160)
    );
  });

  window.addEventListener(
    'fitquest:navigation',
    event => {
      if (event.detail?.screen === 'home') {
        void refresh();
      }
    }
  );

  setInterval(() => void refresh(), 5000);
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    boot,
    { once: true }
  );
} else {
  boot();
}
