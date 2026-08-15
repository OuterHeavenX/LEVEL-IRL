export const seedData = {
  version: 4,
  profile: {
    name: 'Adventurer',
    goal: 'Slim & Tone',
    level: 1,
    nextLevelXp: 500,
    dateOfBirth: null,
    heightDisplay: null,
    heightInches: null,
    heightCm: null
  },
  exerciseLibrary: [
    { id: 'treadmill', name: 'Treadmill', type: 'cardio', icon: '🏃' },
    { id: 'bicep-curl', name: 'Bicep Curl', type: 'strength', icon: '💪' },
    { id: 'shoulder-press', name: 'Shoulder Press', type: 'strength', icon: '🏋️' },
    { id: 'vertical-row', name: 'Vertical Row', type: 'strength', icon: '🛡️' },
    { id: 'seated-leg-curl', name: 'Seated Leg Curl', type: 'strength', icon: '🦵' },
    { id: 'deltoid-fly', name: 'Deltoid Fly', type: 'strength', icon: '🪽' },
    { id: 'bench-press', name: 'Bench Press', type: 'strength', icon: '🏋️' },
    { id: 'squat', name: 'Squat', type: 'strength', icon: '🦵' },
    { id: 'deadlift', name: 'Deadlift', type: 'strength', icon: '🏗️' },
    { id: 'lat-pulldown', name: 'Lat Pulldown', type: 'strength', icon: '🧗' },
    { id: 'cycling', name: 'Cycling', type: 'cardio', icon: '🚴' },
    { id: 'rowing', name: 'Rowing', type: 'cardio', icon: '🚣' },
    { id: 'swimming', name: 'Swimming', type: 'cardio', icon: '🏊' },
    { id: 'plank', name: 'Plank', type: 'strength', icon: '🧘' }
  ],
  nutrition: [],
  checkIns: [],
  ui: { stealthMode: false },
  workouts: [
    {
      id: '2026-07-31-day-1',
      date: '2026-07-31',
      day: 'Friday',
      title: 'Day 1: The Journey Begins',
      startTime: 'Evening',
      startTimeExact: null,
      note: 'First workout of the campaign. Felt active and alive after cardio.',
      exercises: [
        { type: 'cardio', name: 'Treadmill', duration: 20, icon: '🏃', xp: 40 },
        { type: 'strength', name: 'Bicep Curl', sets: 3, reps: 10, weight: null, icon: '💪', xp: 28 },
        { type: 'strength', name: 'Shoulder Press', sets: 3, reps: 10, weight: null, icon: '🏋️', xp: 28 },
        { type: 'strength', name: 'Vertical Row', sets: 3, reps: 10, weight: null, icon: '🛡️', xp: 28 },
        { type: 'strength', name: 'Seated Leg Curl', sets: 3, reps: 10, weight: null, icon: '🦵', xp: 28 },
        { type: 'strength', name: 'Deltoid Fly', sets: 3, reps: 10, weight: null, icon: '🪽', xp: 28 }
      ]
    }
  ]
};
