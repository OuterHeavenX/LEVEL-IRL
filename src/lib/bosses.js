import { localDateISO } from './dom.js';
import { workoutBattlePower, completedStreakAsOf } from './progression.js';

export const BOSSES = [
  { id:'iron-warden-v1', name:'The Iron Warden', title:'Gatekeeper of the First Forge', icon:'🛡️', maxHp:600, rewardXp:100, loot:{ id:'iron-warden-sigil', name:'Sigil of the First Forge', icon:'🔱', rarity:'Rare', description:'Proof that the First Forge has fallen.' } },
  { id:'marsh-hydra-v1', name:'The Marsh Hydra', title:'Many-Headed Terror of the Lowlands', icon:'🐲', maxHp:850, rewardXp:150, loot:{ id:'hydra-heart', name:'Hydra Heart', icon:'💚', rarity:'Epic', description:'A living ember of relentless endurance.' } },
  { id:'storm-colossus-v1', name:'The Storm Colossus', title:'Titan Above the Thunder Pass', icon:'⚡', maxHp:1150, rewardXp:225, loot:{ id:'storm-core', name:'Storm Core', icon:'💠', rarity:'Epic', description:'Power drawn from every step forward.' } },
  { id:'void-champion-v1', name:'The Void Champion', title:'Final Rival of the First Campaign', icon:'🗡️', maxHp:1500, rewardXp:350, loot:{ id:'void-crown', name:'Crown of Resolve', icon:'👑', rarity:'Legendary', description:'The mark of an unbreakable adventurer.' } }
];

const BOSS_IDS = BOSSES.map(boss => boss.id);

export const campaignCleared = data =>
  BOSS_IDS.every(id => data?.ui?.rpg?.bosses?.[id]?.defeated);

// Damage a day's activity can deal, from 0 to 60.
export function activityDamage(checkIn) {
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

// Activity damage already dealt for this check-in. Older saves store the
// applied amount only as bossActivityApplied.damage.
export const appliedActivityDamage = checkIn =>
  Math.max(0, Number(checkIn?.bossActivityDamageApplied) || Number(checkIn?.bossActivityApplied?.damage) || 0);

// Damage waiting to be dealt on `date`: `move` from exercises not yet sent to
// the boss, `activity` from activity not yet struck. Both are 0 once every
// boss has fallen.
export function readyBossDamage(data, date = localDateISO()) {
  const workout = (data?.workouts || []).find(w => w?.date === date);
  const checkIn = (data?.checkIns || []).find(c => c?.date === date);
  const totalActivity = activityDamage(checkIn);
  if (campaignCleared(data)) return { move: 0, activity: 0, totalActivity, workout, checkIn };
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  const submitted = Math.max(0, Number(workout?.bossSubmittedExerciseCount) || 0);
  const move = workoutBattlePower(exercises.slice(submitted), completedStreakAsOf(data, date));
  const activity = Math.max(0, totalActivity - appliedActivityDamage(checkIn));
  return { move, activity, totalActivity, workout, checkIn };
}
