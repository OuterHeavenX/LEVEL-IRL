import { readSave, writeSave } from './lib/storage.js';
import { workoutBattlePower, completedStreakAsOf } from './lib/progression.js';
import { BOSSES, campaignCleared, activityDamage, appliedActivityDamage, readyBossDamage } from './lib/bosses.js';
import { $, injectStyles, appVisible, whenReady } from './lib/dom.js';

let BOSS = BOSSES[0];

let busy = false;
let strikeBusy = false;

function styles() {
  injectStyles('fitquestBossStyles', `
    .fitquest-boss-card {
      color: #f6f8ff;
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

    .fitquest-boss-heading small {
      color: #8f9bb5;
    }

    .fitquest-boss-status {
      background: rgba(255,255,255,.05);
      color: #ffb1b1;
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

    @media(max-width:700px) {
      .fitquest-boss-head { flex-direction: column; }
    }
  `);
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

  return after === 0;
}

function grantVictory(data, boss, at) {
  if (boss.rewardGranted) return;

  boss.rewardGranted = true;
  data.ui.rpg.bossVictoryXp =
    (Number(data.ui.rpg.bossVictoryXp) || 0) + BOSS.rewardXp;

  if (!data.ui.rpg.inventory.some(item => item?.id === BOSS.loot.id)) {
    data.ui.rpg.inventory.push({
      ...BOSS.loot,
      earnedAt: at,
      source: BOSS.name
    });
  }
}

function applyPending(data) {
  const boss = ensureBoss(data);
  const cleared = campaignCleared(data);

  let changed = false;
  let last = null;

  for (const workout of (data.workouts || [])) {
    if (boss.defeated && !cleared) break;

    const exercises = Array.isArray(workout.exercises)
      ? workout.exercises
      : [];

    const submitted =
      Math.max(0, Number(workout.bossSubmittedExerciseCount) || 0);

    // An ended Adventure always sends every move it holds.
    const requestedRaw = workout.completed
      ? exercises.length
      : Math.max(
          submitted,
          Number(workout.bossStrikeRequestedCount) || 0
        );

    const requested =
      Math.min(exercises.length, requestedRaw);

    if (requested <= submitted) continue;

    // With every boss down there is nothing left to hit, so the request is used up.
    if (cleared) {
      workout.bossSubmittedExerciseCount = requested;
      workout.bossStrikeRequestedCount = requested;
      changed = true;
      continue;
    }

    const chunk = exercises.slice(submitted, requested);
    const damage = workoutBattlePower(chunk, completedStreakAsOf(data, workout.date));
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
    if (boss.defeated && !cleared) break;

    const total = activityDamage(checkIn);
    const applied = appliedActivityDamage(checkIn);

    const requested = Math.max(
      applied,
      Math.min(
        total,
        Number(checkIn.bossActivityStrikeRequestedDamage) || applied
      )
    );

    const delta = Math.max(0, requested - applied);

    if (delta <= 0) continue;

    if (cleared) {
      checkIn.bossActivityDamageApplied = requested;
      changed = true;
      continue;
    }

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

async function requestActivityStrike() {
  if (strikeBusy) return;
  strikeBusy = true;

  try {
    const data = readSave();
    if (!data) throw new Error('No save is available.');

    const ready = readyBossDamage(data);
    const checkIn = ready.checkIn;

    if (!checkIn || ready.activity <= 0) {
      throw new Error('No Apple Watch damage is ready.');
    }

    checkIn.bossActivityStrikeRequestedDamage =
      ready.totalActivity;

    checkIn.bossActivityStrikeRequestedAt =
      new Date().toISOString();

    if (!writeSave(data)) throw new Error('LEVEL IRL could not submit this field strike.');

    await refresh();

  } catch (error) {
    window.alert(error?.message || 'Unable to submit field strike.');
    void refresh();
  } finally {
    strikeBusy = false;
  }
}

function wireStrikeButtons() {
  $('#fitquestBossActivityStrike')?.addEventListener(
    'click',
    requestActivityStrike
  );
}

let lastCardHtml = '';

function render(data) {
  const grid = $('.stats-grid');
  if (!grid) return;

  let card = $('#fitquestBossBattle');

  if (!card) {
    lastCardHtml = '';
    card = document.createElement('section');
    card.id = 'fitquestBossBattle';
    card.className = 'card fitquest-boss-card';
    grid.insertAdjacentElement('afterend', card);
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

  const ready = readyBossDamage(data);

  const lastDamage = Math.round(Number(boss.lastAttack?.damage) || 0);
  const lastHit =
    lastDamage
      ? `${lastDamage} damage · ${
          boss.lastAttack.source === 'activity'
            ? '⌚ Activity'
            : '⚔️ Adventure'
        }`
      : 'No strikes yet';

  const looted =
    data.ui.rpg.inventory.some(
      item => item?.id === BOSS.loot.id
    );

  const html = `
    <div class="section-heading fitquest-boss-head">
      <div class="fitquest-boss-heading">
        <div class="fitquest-boss-icon">${BOSS.icon}</div>

        <div>
          <p class="eyebrow">
            CAMPAIGN BOSS ${BOSSES.findIndex(item => item.id === BOSS.id) + 1} / ${BOSSES.length}
          </p>

          <h3>${BOSS.name}</h3>
          <small>${BOSS.title}</small>
        </div>
      </div>

      <span class="pill fitquest-boss-status">
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
      !boss.defeated && ready.activity > 0
        ? `
          <div class="fitquest-boss-actions">
            <button
              id="fitquestBossActivityStrike"
              class="fitquest-boss-strike activity"
              type="button"
            >
              ⌚ FIELD STRIKE · ${ready.activity} DAMAGE
            </button>
          </div>
        `
        : ''
    }

    <p class="fitquest-boss-callout">
      ${
        boss.defeated
          ? 'Campaign cleared. Your next chapter is waiting.'
          : 'Log moves all day, then strike whenever you want. Saving new Apple Watch totals can charge a separate Field Strike.'
      }
    </p>

    <div class="fitquest-boss-loot">
      ${
        looted
          ? `${BOSS.loot.icon} Victory Reward Earned: ${BOSS.loot.name} + ${BOSS.rewardXp} XP`
          : `🔒 Victory Reward: ${BOSS.loot.name} + ${BOSS.rewardXp} XP`
      }
    </div>
  `;

  // Only rebuild when something changed, so clicks aren't lost mid-render.
  if (html === lastCardHtml) return;
  lastCardHtml = html;
  card.innerHTML = html;
  wireStrikeButtons();
}

async function refresh() {
  if (busy) return;
  busy = true;

  try {
    const data = readSave();
    if (!data) return;

    const result = applyPending(data);

    if (result.changed) {
      writeSave(data);
    }

    render(data);

    if (result.last) {
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

  whenReady(() => appVisible() && $('.stats-grid'), () => {
    void refresh();
  }, 120);

  [
    'fitquest:remote-update',
    'fitquest:saved'
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
}

boot();
