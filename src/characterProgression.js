import { readSave, writeSave } from './lib/storage.js';
import { calculateStats } from './lib/progression.js';
import { achievementSummary } from './lib/achievements.js';
import { $ } from './lib/dom.js';


const CLASSES = [
  {
    id: 'vanguard',
    icon: '🛡️',
    name: 'Vanguard',
    unlockLevel: 1,
    tagline: 'Consistency before spectacle.',
    flavor: 'A durable campaign class built around showing up, stacking sessions, and refusing to disappear.',
    affinity: 'Streaks & completed Adventures'
  },
  {
    id: 'ironborn',
    icon: '⚔️',
    name: 'Ironborn',
    unlockLevel: 1,
    tagline: 'Built in the forge.',
    flavor: 'A strength-focused identity for adventurers who like sets, reps, and making fictional bosses regret clocking in.',
    affinity: 'Strength sets & boss strikes'
  },
  {
    id: 'pathfinder',
    icon: '🥾',
    name: 'Pathfinder',
    unlockLevel: 1,
    tagline: 'Every mile opens the map.',
    flavor: 'A movement-focused class for cardio, distance, steps, and turning ordinary travel into campaign territory.',
    affinity: 'Cardio & distance'
  },
  {
    id: 'sentinel',
    icon: '⌚',
    name: 'Sentinel',
    unlockLevel: 3,
    tagline: 'The day itself becomes training.',
    flavor: 'Unlocked for players who make movement, recovery, and Apple Watch activity part of the campaign.',
    affinity: 'Daily activity & recovery'
  },
  {
    id: 'warlord',
    icon: '👑',
    name: 'Warlord',
    unlockLevel: 5,
    tagline: 'Bosses become weekly paperwork.',
    flavor: 'A later-game class reserved for campaigns with enough XP to prove this is no temporary enthusiasm.',
    affinity: 'Boss victories & high-level play'
  }
];

const TITLES = [
  { id:'first-step', name:'The Initiate', icon:'🌱', requirement:'Log your first Adventure', test:({stats}) => stats.workouts >= 1 },
  { id:'iron-hand', name:'Forge Hand', icon:'⚒️', requirement:'Reach 25 strength sets', test:({stats}) => stats.strengthSets >= 25 },
  { id:'road-walker', name:'Road Walker', icon:'🥾', requirement:'Record 60 cardio minutes', test:({stats}) => stats.cardio >= 60 },
  { id:'streak-keeper', name:'Keeper of the Flame', icon:'🔥', requirement:'Reach a 3-day streak', test:({stats}) => stats.bestStreak >= 3 },
  { id:'bossbreaker', name:'Wardenbreaker', icon:'💥', requirement:'Defeat a campaign boss', test:({bossDefeated}) => bossDefeated },
  { id:'level-three', name:'Veteran of the First Forge', icon:'🏅', requirement:'Reach Level 3', test:({stats}) => stats.level >= 3 },
  { id:'relic-bearer', name:'Relic Bearer', icon:'🔱', requirement:'Own 3 campaign relics', test:({inventory}) => inventory.length >= 3 },
  { id:'centurion', name:'The Centurion', icon:'💯', requirement:'Complete 100 strength sets', test:({stats}) => stats.strengthSets >= 100 }
];

const PATHS = [
  {
    id:'discipline',
    icon:'🔥',
    name:'Discipline',
    description:'Your consistency path.',
    nodes:[
      {name:'Spark', requirement:'1 Adventure', unlocked: c => c.stats.workouts >= 1},
      {name:'Ember', requirement:'3-day streak', unlocked: c => c.stats.bestStreak >= 3},
      {name:'Inferno', requirement:'7-day streak', unlocked: c => c.stats.bestStreak >= 7}
    ]
  },
  {
    id:'might',
    icon:'⚔️',
    name:'Might',
    description:'Your strength path.',
    nodes:[
      {name:'Grip', requirement:'10 sets', unlocked: c => c.stats.strengthSets >= 10},
      {name:'Forge', requirement:'50 sets', unlocked: c => c.stats.strengthSets >= 50},
      {name:'Titan', requirement:'150 sets', unlocked: c => c.stats.strengthSets >= 150}
    ]
  },
  {
    id:'exploration',
    icon:'🗺️',
    name:'Exploration',
    description:'Your movement path.',
    nodes:[
      {name:'Trailhead', requirement:'30 cardio min', unlocked: c => c.stats.cardio >= 30},
      {name:'Wayfinder', requirement:'120 cardio min', unlocked: c => c.stats.cardio >= 120},
      {name:'Horizon', requirement:'300 cardio min', unlocked: c => c.stats.cardio >= 300}
    ]
  }
];

let busy = false;
let activeTab = 'classes';
let rewardsExpanded = false;

function styles() {
  if ($('#fitquestCharacterProgressionStyles')) return;

  const style = document.createElement('style');
  style.id = 'fitquestCharacterProgressionStyles';
  style.textContent = `
    /* =========================================================
       CHARACTER HUB
       Presentation only. Existing progression/save rules stay put.
       ========================================================= */

    .fq-progression-card {
      grid-column: 1 / -1;
      min-width: 0;
      padding: 20px;
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,.08);
      background:
        radial-gradient(circle at 86% -10%, rgba(139,93,255,.14), transparent 38%),
        linear-gradient(150deg, rgba(18,27,52,.97), rgba(10,17,34,.97));
      color: #f4f6ff;
      overflow: hidden;
    }

    .fq-character-hero {
      display: grid;
      grid-template-columns: 78px minmax(0,1fr) auto;
      gap: 15px;
      align-items: center;
    }

    .fq-character-avatar {
      width: 78px;
      height: 78px;
      display: grid;
      place-items: center;
      border-radius: 23px;
      border: 1px solid rgba(153,126,255,.22);
      background:
        radial-gradient(circle at 35% 25%, rgba(130,208,255,.12), transparent 42%),
        linear-gradient(145deg, rgba(100,84,255,.17), rgba(166,73,231,.10));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
      font-size: 38px;
    }

    .fq-character-kicker {
      margin: 0 0 4px;
      color: #9988ff;
      font-size: 9px;
      font-weight: 950;
      letter-spacing: .15em;
    }

    .fq-character-name {
      margin: 0;
      font-size: clamp(22px, 4vw, 29px);
      line-height: 1.05;
    }

    .fq-character-title {
      margin-top: 6px;
      color: #d8ccff;
      font-size: 12px;
      font-weight: 850;
    }

    .fq-character-flavor {
      margin: 7px 0 0;
      max-width: 680px;
      color: #8e9ab3;
      font-size: 11px;
      line-height: 1.45;
    }

    .fq-character-level {
      min-width: 112px;
      padding: 11px 12px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      text-align: right;
    }

    .fq-character-level small,
    .fq-character-level strong {
      display: block;
    }

    .fq-character-level small {
      color: #8c98b0;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: .12em;
    }

    .fq-character-level strong {
      margin-top: 3px;
      font-size: 18px;
    }

    .fq-character-xp {
      margin-top: 16px;
    }

    .fq-character-xp-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 7px;
      color: #9aa6bc;
      font-size: 10px;
    }

    .fq-character-xp-row strong {
      color: #e7ebf7;
    }

    .fq-character-xp-track {
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,.07);
    }

    .fq-character-xp-track > i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #716cff, #d968e8);
    }

    .fq-character-identity-chips {
      display: flex;
      gap: 7px;
      overflow-x: auto;
      scrollbar-width: none;
      margin-top: 12px;
      padding-bottom: 1px;
    }

    .fq-character-identity-chips::-webkit-scrollbar {
      display: none;
    }

    .fq-identity-chip {
      flex: 0 0 auto;
      padding: 7px 9px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.035);
      color: #8996ae;
      font-size: 9px;
      white-space: nowrap;
    }

    .fq-character-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 5px;
      margin-top: 18px;
      padding: 5px;
      border-radius: 15px;
      background: rgba(4,9,22,.42);
      border: 1px solid rgba(255,255,255,.055);
    }

    .fq-character-tab {
      min-width: 0;
      min-height: 42px;
      padding: 7px 8px;
      border: 0;
      border-radius: 11px;
      background: transparent;
      color: #7f8ca6;
      font: inherit;
      font-size: 9px;
      font-weight: 950;
      letter-spacing: .05em;
      cursor: pointer;
    }

    .fq-character-tab.active {
      color: #f3efff;
      background: linear-gradient(135deg, rgba(110,104,255,.22), rgba(172,83,236,.16));
      box-shadow: inset 0 0 0 1px rgba(150,124,255,.16);
    }

    .fq-character-panel {
      margin-top: 11px;
      min-width: 0;
    }

    .fq-class-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 8px;
    }

    .fq-class-row {
      position: relative;
      min-width: 0;
      display: grid;
      grid-template-columns: 43px minmax(0,1fr);
      gap: 10px;
      align-items: center;
      min-height: 68px;
      padding: 10px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.065);
      background: rgba(255,255,255,.032);
      color: #dce3f2;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .fq-class-row.active {
      border-color: rgba(108,226,188,.22);
      background: rgba(86,199,163,.065);
    }

    .fq-class-row.locked {
      opacity: .48;
      cursor: default;
    }

    .fq-class-row-icon {
      width: 43px;
      height: 43px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: rgba(255,255,255,.045);
      font-size: 23px;
    }

    .fq-class-row strong,
    .fq-class-row small {
      display: block;
      overflow-wrap: anywhere;
    }

    .fq-class-row strong {
      font-size: 11px;
    }

    .fq-class-row small {
      margin-top: 3px;
      color: #77849d;
      font-size: 8px;
      line-height: 1.35;
    }

    .fq-class-lock {
      position: absolute;
      right: 9px;
      top: 8px;
      font-size: 10px;
    }

    .fq-title-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 7px;
    }

    .fq-title-btn {
      min-width: 0;
      min-height: 88px;
      padding: 10px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.065);
      background: rgba(255,255,255,.032);
      color: #dce2f2;
      text-align: left;
      font: inherit;
      cursor: pointer;
    }

    .fq-title-btn.locked {
      opacity: .42;
      cursor: default;
    }

    .fq-title-btn.active {
      border-color: rgba(105,232,177,.27);
      background: rgba(105,232,177,.065);
    }

    .fq-title-btn > span {
      font-size: 20px;
    }

    .fq-title-btn strong,
    .fq-title-btn small {
      display: block;
      overflow-wrap: anywhere;
    }

    .fq-title-btn strong {
      margin-top: 6px;
      font-size: 10px;
      line-height: 1.2;
    }

    .fq-title-btn small {
      margin-top: 4px;
      color: #758198;
      font-size: 7px;
      line-height: 1.3;
    }

    .fq-path-list {
      display: grid;
      gap: 8px;
    }

    .fq-path {
      padding: 11px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.06);
      background: rgba(255,255,255,.028);
    }

    .fq-path-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .fq-path-name {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }

    .fq-path-name > span {
      font-size: 21px;
    }

    .fq-path-name strong,
    .fq-path-name small {
      display: block;
    }

    .fq-path-name strong {
      font-size: 11px;
    }

    .fq-path-name small {
      margin-top: 2px;
      color: #77849d;
      font-size: 8px;
    }

    .fq-path-tier {
      flex: 0 0 auto;
      color: #a9b5ca;
      font-size: 8px;
      font-weight: 900;
    }

    .fq-node-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap: 5px;
      margin-top: 9px;
    }

    .fq-node {
      min-width: 0;
      padding: 7px;
      border-radius: 9px;
      background: rgba(255,255,255,.03);
      color: #6f7b93;
      font-size: 7px;
      line-height: 1.3;
    }

    .fq-node.unlocked {
      color: #92e7c1;
      background: rgba(105,232,177,.055);
    }

    .fq-node strong,
    .fq-node small {
      display: block;
    }

    .fq-node small {
      margin-top: 2px;
      opacity: .78;
    }

    .fq-rewards-wrap {
      margin-top: 17px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,.055);
    }

    .fq-rewards-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 9px;
    }

    .fq-rewards-head strong {
      color: #929fb6;
      font-size: 9px;
      letter-spacing: .12em;
    }

    .fq-rewards-toggle {
      min-height: 34px;
      padding: 0 9px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.07);
      background: rgba(255,255,255,.035);
      color: #a9b4c9;
      font: inherit;
      font-size: 8px;
      font-weight: 850;
      cursor: pointer;
    }

    .fq-reward-strip {
      display: flex;
      gap: 7px;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scrollbar-width: none;
      padding-bottom: 2px;
    }

    .fq-reward-strip::-webkit-scrollbar {
      display: none;
    }

    .fq-reward {
      flex: 0 0 116px;
      min-width: 0;
      padding: 10px;
      border-radius: 13px;
      border: 1px solid rgba(255,255,255,.06);
      background: rgba(255,255,255,.03);
    }

    .fq-reward span {
      display: block;
      font-size: 21px;
    }

    .fq-reward strong {
      display: block;
      margin-top: 5px;
      color: #dfe5f2;
      font-size: 8px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .fq-reward small {
      display: block;
      margin-top: 3px;
      color: #707d96;
      font-size: 7px;
      line-height: 1.25;
    }

    .fq-empty {
      width: 100%;
      padding: 13px;
      border-radius: 12px;
      border: 1px dashed rgba(255,255,255,.09);
      color: #748198;
      text-align: center;
      font-size: 9px;
    }

    /* Compact the existing permanent-stat card without touching its events/IDs. */
    #fitquestScreenGrid-character > .character-card.fq-identity-compact {
      grid-column: 1 / -1;
      padding: 14px !important;
      border-radius: 18px;
    }

    .fq-identity-compact .section-heading {
      margin-bottom: 8px !important;
    }

    .fq-identity-compact .section-heading .eyebrow {
      margin: 0 !important;
      font-size: 8px !important;
    }

    .fq-identity-compact .avatar,
    .fq-identity-compact #rankTitle,
    .fq-identity-compact #characterGoal {
      display: none !important;
    }

    .fq-identity-compact .identity-readout {
      margin-top: 7px !important;
      gap: 6px !important;
    }

    .fq-identity-compact .identity-readout > div {
      min-height: 54px !important;
      padding: 9px !important;
      border-radius: 12px !important;
    }

    .fq-identity-compact .identity-readout small {
      font-size: 7px !important;
    }

    .fq-identity-compact .identity-readout strong {
      font-size: 10px !important;
    }

    .fq-identity-compact #profileCompletion {
      margin-top: 6px !important;
      font-size: 8px !important;
    }

    /* Existing Juice Engine vault: preserve it, but make it a compact carousel. */
    #fitquestScreenGrid-character > #fitquestLootVault {
      grid-column: 1 / -1;
      padding: 14px !important;
      border-radius: 18px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-vault-head {
      margin-bottom: 9px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-vault-head .eyebrow {
      font-size: 8px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-vault-head h3 {
      font-size: 14px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-grid {
      display: flex !important;
      gap: 7px !important;
      overflow-x: auto !important;
      overscroll-behavior-inline: contain;
      scrollbar-width: none;
      padding-bottom: 2px;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-grid::-webkit-scrollbar {
      display: none;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-item {
      flex: 0 0 132px !important;
      min-width: 132px !important;
      padding: 10px !important;
      border-radius: 13px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-item > span {
      margin-bottom: 5px !important;
      font-size: 22px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-item strong {
      font-size: 9px !important;
    }

    #fitquestScreenGrid-character > #fitquestLootVault .fitquest-loot-item small {
      font-size: 7px !important;
    }

    @media (max-width: 720px) {
      .fq-progression-card {
        padding: 15px;
        border-radius: 18px;
      }

      .fq-character-hero {
        grid-template-columns: 60px minmax(0,1fr) auto;
        gap: 10px;
      }

      .fq-character-avatar {
        width: 60px;
        height: 60px;
        border-radius: 18px;
        font-size: 30px;
      }

      .fq-character-name {
        font-size: 21px;
      }

      .fq-character-flavor {
        display: none;
      }

      .fq-character-level {
        min-width: 68px;
        padding: 8px;
      }

      .fq-character-level strong {
        font-size: 15px;
      }

      .fq-character-tabs {
        margin-top: 14px;
      }

      .fq-character-tab {
        min-height: 40px;
        padding: 6px 4px;
        font-size: 8px;
      }

      .fq-class-list {
        grid-template-columns: 1fr;
      }

      .fq-class-row {
        min-height: 58px;
        grid-template-columns: 38px minmax(0,1fr);
        padding: 8px 9px;
      }

      .fq-class-row-icon {
        width: 38px;
        height: 38px;
        font-size: 20px;
      }

      .fq-title-grid {
        display: flex;
        gap: 7px;
        overflow-x: auto;
        overscroll-behavior-inline: contain;
        scrollbar-width: none;
        padding-bottom: 2px;
      }

      .fq-title-grid::-webkit-scrollbar {
        display: none;
      }

      .fq-title-btn {
        flex: 0 0 132px;
        min-width: 132px;
        min-height: 82px;
      }

      .fq-node-row {
        grid-template-columns: repeat(3, minmax(0,1fr));
      }

      #fitquestScreenGrid-character {
        padding-bottom: 10px;
      }
    }

    @media (max-width: 390px) {
      .fq-character-hero {
        grid-template-columns: 54px minmax(0,1fr) 62px;
      }

      .fq-character-avatar {
        width: 54px;
        height: 54px;
        font-size: 27px;
      }

      .fq-character-name {
        font-size: 19px;
      }

      .fq-character-title {
        font-size: 10px;
      }

      .fq-character-level {
        min-width: 62px;
      }

      .fq-character-tab {
        font-size: 7px;
      }

      .fq-node {
        padding: 6px 5px;
      }
    }

    @media (max-width: 375px) {
      .fq-progression-card {
        padding: 13px;
      }

      .fq-character-hero {
        grid-template-columns: 50px minmax(0,1fr) 58px;
        gap: 8px;
      }

      .fq-character-avatar {
        width: 50px;
        height: 50px;
        border-radius: 15px;
        font-size: 25px;
      }

      .fq-character-level {
        min-width: 58px;
        padding: 7px 5px;
      }

      .fq-character-level small {
        font-size: 7px;
      }

      .fq-character-level strong {
        font-size: 14px;
      }
    }
  `;

  document.head.appendChild(style);
}

function context(data) {
  const stats = calculateStats(data);
  const achievements = achievementSummary(data, stats);
  const inventory = data.ui?.rpg?.inventory || [];
  const bosses = data.ui?.rpg?.bosses || {};
  const bossDefeated = Object.values(bosses).some(boss => boss?.defeated);

  return {
    stats,
    achievements,
    inventory,
    bossDefeated
  };
}

function unlockedTitles(ctx) {
  return TITLES.filter(title => title.test(ctx));
}

function activeClass(data, ctx) {
  const selected = data.ui?.rpg?.character?.classId;
  const usable = CLASSES.find(
    item => item.id === selected && ctx.stats.level >= item.unlockLevel
  );

  return usable || CLASSES[0];
}

function activeTitle(data, ctx) {
  const available = unlockedTitles(ctx);
  const selected = data.ui?.rpg?.character?.titleId;

  return available.find(item => item.id === selected) || available[0] || null;
}

function xpIntoLevel(stats) {
  const raw = Math.max(0, Number(stats?.xp) || 0);
  return raw % 500;
}

function identityChips(data) {
  const profile = data.profile || {};
  const chips = [];

  if (profile.dateOfBirth) {
    chips.push(`DOB ${profile.dateOfBirth}`);
  }

  if (profile.heightDisplay) {
    chips.push(`Height ${profile.heightDisplay}`);
  }

  return chips;
}

function recentRewards(ctx) {
  const loot = [...ctx.inventory]
    .reverse()
    .map(item => ({
      id: `loot:${item.id || item.name}`,
      icon: item.icon || '🎁',
      name: item.name || 'Campaign Relic',
      detail: item.rarity || item.source || 'Relic'
    }));

  const medals = [...ctx.achievements.unlocked]
    .reverse()
    .map(item => ({
      id: `medal:${item.id || item.name}`,
      icon: item.icon || '🏆',
      name: item.name || 'Achievement',
      detail: 'Achievement'
    }));

  const seen = new Set();
  return [...loot, ...medals].filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function currentPathTier(path, ctx) {
  const unlocked = path.nodes.filter(node => node.unlocked(ctx));

  if (!unlocked.length) return 'Not started';
  return unlocked[unlocked.length - 1].name;
}

async function saveCharacterSetting(key, value) {
  if (busy) return;
  busy = true;

  try {
    const data = (await readSave())?.save;

    if (!data) {
      throw new Error('No save is available.');
    }

    data.ui ||= {};
    data.ui.rpg ||= {};
    data.ui.rpg.character ||= {};

    // Existing Character behavior only:
    // selecting a class or title writes that existing setting.
    data.ui.rpg.character[key] = value;
    data.ui.rpg.character.updatedAt = new Date().toISOString();

    const ok = await writeSave(data);

    if (!ok) {
      throw new Error('Unable to save character progression.');
    }

    await renderFromSave();

    window.dispatchEvent(
      new CustomEvent('fitquest:character-updated')
    );
  } catch (error) {
    window.alert(
      error?.message || 'Unable to update your character.'
    );
  } finally {
    busy = false;
  }
}

function classesPanel(ctx, cls) {
  return `
    <div class="fq-class-list">
      ${CLASSES.map(option => {
        const unlocked = ctx.stats.level >= option.unlockLevel;

        return `
          <button
            class="fq-class-row
              ${option.id === cls.id ? 'active' : ''}
              ${unlocked ? '' : 'locked'}"
            type="button"
            data-class="${option.id}"
            ${unlocked ? '' : 'disabled'}
          >
            ${unlocked ? '' : '<span class="fq-class-lock">🔒</span>'}

            <span class="fq-class-row-icon">${option.icon}</span>

            <span>
              <strong>
                ${option.name}
                ${option.id === cls.id ? ' · EQUIPPED' : ''}
              </strong>
              <small>
                ${unlocked
                  ? `${option.tagline} · ${option.affinity}`
                  : `Unlocks at Level ${option.unlockLevel}`}
              </small>
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function titlesPanel(ctx, title) {
  return `
    <div class="fq-title-grid">
      ${TITLES.map(item => {
        const unlocked = item.test(ctx);

        return `
          <button
            class="fq-title-btn
              ${title?.id === item.id ? 'active' : ''}
              ${unlocked ? '' : 'locked'}"
            type="button"
            data-title="${item.id}"
            ${unlocked ? '' : 'disabled'}
          >
            <span>${unlocked ? item.icon : '🔒'}</span>
            <strong>
              ${item.name}
              ${title?.id === item.id ? ' · EQUIPPED' : ''}
            </strong>
            <small>
              ${unlocked ? 'Tap to equip' : item.requirement}
            </small>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function pathsPanel(ctx) {
  return `
    <div class="fq-path-list">
      ${PATHS.map(path => `
        <div class="fq-path">
          <div class="fq-path-summary">
            <div class="fq-path-name">
              <span>${path.icon}</span>

              <div>
                <strong>${path.name}</strong>
                <small>${path.description}</small>
              </div>
            </div>

            <span class="fq-path-tier">
              ${currentPathTier(path, ctx)}
            </span>
          </div>

          <div class="fq-node-row">
            ${path.nodes.map(node => {
              const unlocked = node.unlocked(ctx);

              return `
                <div class="fq-node ${unlocked ? 'unlocked' : ''}">
                  <strong>${unlocked ? '✓' : '🔒'} ${node.name}</strong>
                  <small>${node.requirement}</small>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function activePanel(ctx, cls, title) {
  if (activeTab === 'titles') {
    return titlesPanel(ctx, title);
  }

  if (activeTab === 'paths') {
    return pathsPanel(ctx);
  }

  return classesPanel(ctx, cls);
}

function organizeExistingCharacterSections(card) {
  const grid = $('#fitquestScreenGrid-character');
  if (!grid || !card) return;

  // Original identity card retains all original controls and event listeners.
  const dossier = grid.querySelector('.character-card');
  if (dossier) {
    dossier.classList.add('fq-identity-compact');

    if (card.nextElementSibling !== dossier) {
      card.insertAdjacentElement('afterend', dossier);
    }
  }

  // Juice Engine owns this vault. We only reposition/style its existing DOM.
  const vault = $('#fitquestLootVault');

  if (vault && dossier && dossier.nextElementSibling !== vault) {
    dossier.insertAdjacentElement('afterend', vault);
  } else if (vault && !dossier && card.nextElementSibling !== vault) {
    card.insertAdjacentElement('afterend', vault);
  }
}

function render(data) {
  const grid = $('#fitquestScreenGrid-character');
  if (!grid) return;

  let card = $('#fitquestCharacterProgression');

  if (!card) {
    card = document.createElement('section');
    card.id = 'fitquestCharacterProgression';
    card.className = 'fq-progression-card';
    grid.prepend(card);
  } else if (grid.firstElementChild !== card) {
    grid.prepend(card);
  }

  const ctx = context(data);
  const cls = activeClass(data, ctx);
  const title = activeTitle(data, ctx);
  const xp = xpIntoLevel(ctx.stats);
  const rewards = recentRewards(ctx);
  const visibleRewards = rewardsExpanded ? rewards : rewards.slice(0, 6);
  const identity = identityChips(data);

  card.innerHTML = `
    <div class="fq-character-hero">
      <div class="fq-character-avatar">${cls.icon}</div>

      <div>
        <p class="fq-character-kicker">ACTIVE CHARACTER</p>
        <h3 class="fq-character-name">${cls.name}</h3>

        <div class="fq-character-title">
          ${title
            ? `${title.icon} ${title.name}`
            : 'No title equipped yet'}
        </div>

        <p class="fq-character-flavor">
          ${cls.tagline} ${cls.flavor}
        </p>
      </div>

      <div class="fq-character-level">
        <small>LEVEL</small>
        <strong>${ctx.stats.level}</strong>
      </div>
    </div>

    <div class="fq-character-xp">
      <div class="fq-character-xp-row">
        <span>Experience</span>
        <strong>${xp.toLocaleString()} / 500 XP</strong>
      </div>

      <div class="fq-character-xp-track" aria-hidden="true">
        <i style="width:${Math.max(0, Math.min(100, (xp / 500) * 100))}%"></i>
      </div>
    </div>

    ${identity.length
      ? `
        <div class="fq-character-identity-chips">
          ${identity.map(item => `
            <span class="fq-identity-chip">${item}</span>
          `).join('')}
        </div>
      `
      : ''
    }

    <div
      class="fq-character-tabs"
      role="tablist"
      aria-label="Character progression"
    >
      <button
        class="fq-character-tab ${activeTab === 'classes' ? 'active' : ''}"
        type="button"
        data-character-tab="classes"
      >
        ⚔️ CLASSES
      </button>

      <button
        class="fq-character-tab ${activeTab === 'titles' ? 'active' : ''}"
        type="button"
        data-character-tab="titles"
      >
        🏷️ TITLES
      </button>

      <button
        class="fq-character-tab ${activeTab === 'paths' ? 'active' : ''}"
        type="button"
        data-character-tab="paths"
      >
        ✨ SKILL PATHS
      </button>
    </div>

    <div class="fq-character-panel">
      ${activePanel(ctx, cls, title)}
    </div>

    <div class="fq-rewards-wrap">
      <div class="fq-rewards-head">
        <strong>RECENT REWARDS</strong>

        ${rewards.length > 6
          ? `
            <button
              class="fq-rewards-toggle"
              type="button"
              id="fqRewardsToggle"
            >
              ${rewardsExpanded ? 'Recent Only' : `View All · ${rewards.length}`}
            </button>
          `
          : ''
        }
      </div>

      <div class="fq-reward-strip">
        ${visibleRewards.length
          ? visibleRewards.map(item => `
            <div class="fq-reward">
              <span>${item.icon}</span>
              <strong>${item.name}</strong>
              <small>${item.detail}</small>
            </div>
          `).join('')
          : '<div class="fq-empty">Rewards appear here as the campaign grows.</div>'
        }
      </div>
    </div>
  `;

  card.querySelectorAll('[data-character-tab]').forEach(button => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.characterTab || 'classes';

      // Presentation-only tab switch: no save write.
      render(data);
    });
  });

  card.querySelectorAll('[data-class]').forEach(button => {
    button.addEventListener('click', () => {
      void saveCharacterSetting(
        'classId',
        button.dataset.class
      );
    });
  });

  card.querySelectorAll('[data-title]').forEach(button => {
    button.addEventListener('click', () => {
      void saveCharacterSetting(
        'titleId',
        button.dataset.title
      );
    });
  });

  $('#fqRewardsToggle')?.addEventListener('click', () => {
    rewardsExpanded = !rewardsExpanded;

    // Presentation-only expansion: no save write.
    render(data);
  });

  // Preserve the original dossier's class/title mirror.
  const rank = $('#rankTitle');
  if (rank) {
    rank.textContent = `${cls.icon} ${cls.name}`;
  }

  const goal = $('#characterGoal');
  if (goal && title) {
    goal.textContent =
      `${title.icon} ${title.name} · ${cls.affinity}`;
  }

  organizeExistingCharacterSections(card);

  // Juice Engine can inject its vault after this renderer runs.
  requestAnimationFrame(() => {
    organizeExistingCharacterSections(card);
  });

  setTimeout(() => {
    organizeExistingCharacterSections(card);
  }, 350);
}

async function renderFromSave() {
  try {
    const data = (await readSave())?.save;

    if (data) {
      render(data);
    }
  } catch (error) {
    console.warn(
      'Character progression refresh failed:',
      error
    );
  }
}

function boot() {
  styles();

  let attempts = 0;

  const timer = setInterval(() => {
    attempts++;

    if ($('#fitquestScreenGrid-character')) {
      clearInterval(timer);
      void renderFromSave();
    } else if (attempts > 140) {
      clearInterval(timer);
    }
  }, 120);

  // Any save (app, loot, boss hits, RPG updates) or another tab can change the sheet.
  let refreshTimer = null;
  ['fitquest:saved', 'fitquest:remote-update'].forEach(eventName => {
    window.addEventListener(eventName, () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void renderFromSave(), 200);
    });
  });

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'character') {
      void renderFromSave();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    boot,
    { once:true }
  );
} else {
  boot();
}
