import { localDateISO, addDays, dateFromISO } from './dom.js';

export const XP_PER_LEVEL = 500;

// Strength sets, cardio minutes and exercise XP for a list of exercises.
export function exerciseTotals(exercises = []) {
  let strengthSets = 0, cardio = 0, xp = 0;
  for (const e of exercises) {
    if (!e) continue;
    if (e.type === 'strength') strengthSets += Number(e.sets) || 0;
    if (e.type === 'cardio') cardio += Number(e.duration) || 0;
    xp += Number(e.xp) || 0;
  }
  return { strengthSets, cardio, xp };
}

export function calculateStats(data) {
  const workouts = data.workouts || [];
  const exercises = workouts.flatMap(w => w.exercises || []);

  const { strengthSets, cardio, xp: exerciseXp } = exerciseTotals(exercises);

  const nutritionXp = (data.nutrition || [])
    .reduce((n, e) => n + (Number(e.xp) || 0), 0);

  const completionXp = workouts
    .reduce((n, w) => n + (Number(w.completionXp) || 0), 0);

  const bossVictoryXp =
    Number(data.ui?.rpg?.bossVictoryXp) || 0;

  const xp =
    exerciseXp +
    nutritionXp +
    completionXp +
    bossVictoryXp;

  const distinctDates = [...new Set(
    workouts
      .filter(w =>
        (Array.isArray(w.exercises) && w.exercises.length > 0) ||
        w.completed === true
      )
      .map(w => w.date)
      .filter(Boolean)
  )].sort();

  // The current streak only counts if the last workout was today or yesterday.
  const lastDate = distinctDates[distinctDates.length - 1];
  const streak = lastDate && lastDate >= addDays(localDateISO(), -1)
    ? streakEndingAt(distinctDates)
    : 0;
  const bestStreak = longestStreak(distinctDates);
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const levelXp = xp % XP_PER_LEVEL;

  return {
    workouts: distinctDates.length,
    strengthSets,
    cardio,
    xp,
    streak,
    bestStreak,
    level,
    levelXp,
    completionXp,
    bossVictoryXp
  };
}

const dayGap = (later, earlier) =>
  Math.round((dateFromISO(later) - dateFromISO(earlier)) / 86400000);

// Consecutive days ending at the last date in a sorted list of YYYY-MM-DD strings.
function streakEndingAt(sortedDates) {
  if (!sortedDates.length) return 0;
  let streak = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    if (dayGap(sortedDates[i], sortedDates[i - 1]) === 1) streak++;
    else break;
  }
  return streak;
}

function longestStreak(sortedDates) {
  let best = 0, run = 0;
  sortedDates.forEach((date, i) => {
    run = i && dayGap(date, sortedDates[i - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

// Streak of completed adventures ending on `date` or the day before (used for
// boss damage). An older run that has since lapsed counts as no streak.
export function completedStreakAsOf(data, date) {
  const dates = [...new Set(
    (data.workouts || [])
      .filter(w => w.completed && w.date && w.date <= date)
      .map(w => w.date)
  )].sort();
  const last = dates.at(-1);
  return last && last >= addDays(date, -1) ? streakEndingAt(dates) : 0;
}

/*
  FAIR XP ECONOMY
  Strength XP scales mainly with sets rather than a flat per-entry reward.

  Examples:
    1 set  = 15 XP
    2 sets = 24 XP
    3 sets = 33 XP
    4 sets = 42 XP
    5 sets = 51 XP

  This makes splitting one 3-set exercise into three separate 1-set
  entries much less attractive than simply logging the real work.
*/
export function nextExerciseXP(
  type,
  sets = 3,
  duration = 0,
  distance = 0
) {
  if (type === 'cardio') {
    const minutes = Math.max(0, Number(duration) || 0);
    const milesOrKm = Math.max(0, Number(distance) || 0);

    return Math.max(
      12,
      Math.min(
        100,
        Math.round(
          minutes * 1.2 +
          milesOrKm * 4
        )
      )
    );
  }

  const workingSets =
    Math.max(1, Math.min(10, Number(sets) || 1));

  return Math.min(
    90,
    6 + workingSets * 9
  );
}

/*
  BATTLE POWER
  Boss damage uses actual work volume, including reps from the exercise record.

  Strength examples at 12 reps/set:
    1 x 12 ≈ 14 damage
    2 x 12 ≈ 24 damage
    3 x 12 ≈ 35 damage

  A streak adds a percentage bonus instead of a flat bonus, preventing
  players from gaining extra damage simply by splitting one workout into
  lots of tiny submissions.
*/
function exerciseBattlePower(exercise = {}) {
  if (exercise.type === 'cardio') {
    const minutes = Math.max(0, Number(exercise.duration) || 0);
    const distance = Math.max(0, Number(exercise.distance) || 0);

    return Math.max(
      8,
      Math.round(
        minutes * 1.2 +
        distance * 4
      )
    );
  }

  const sets =
    Math.max(1, Number(exercise.sets) || 1);

  const reps =
    Math.max(1, Number(exercise.reps) || 1);

  const totalReps = sets * reps;

  return Math.max(
    8,
    Math.round(
      4 +
      sets * 6 +
      totalReps * 0.35
    )
  );
}

export function workoutBattlePower(
  exercises = [],
  streak = 0
) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return 0;
  }

  const raw = exercises.reduce(
    (sum, exercise) =>
      sum + exerciseBattlePower(exercise),
    0
  );

  const streakMultiplier =
    1 + Math.min(
      0.20,
      Math.max(0, Number(streak) || 0) * 0.03
    );

  return Math.max(
    8,
    Math.min(
      220,
      Math.round(raw * streakMultiplier)
    )
  );
}

export function nutritionXP(entry) {
  const macroCount = ['protein', 'carbs', 'fat']
    .filter(k => Number(entry[k]) > 0)
    .length;

  return 4 + macroCount * 2;
}
