import './styles.css';
import { seedData } from './data/defaultData.js';
import {
  loadSave,
  readSave,
  mergeSave,
  writeSave,
  slugify,
  dedupeLibrary
} from './lib/storage.js';
import {
  calculateStats,
  nextExerciseXP,
  nutritionXP
} from './lib/progression.js';
import {
  quickFoods,
  findQuickFood,
  searchOpenFoodFacts
} from './lib/nutrition.js';
import {
  achievementSummary,
  sketchSVG
} from './lib/achievements.js';
import { $, $$, escapeHtml, localDateISO, dateFromISO, addDays, weekdayName, toast } from './lib/dom.js';

let state = null;
let titleTapCount = 0;
let appStarted = false;
let suppressSave = false;
let draftWorkout = null;
// A past date the player opened (null = today).
let viewDate = null;

const exerciseIcon = (name, type = 'strength', fallback = '') => {
  if (fallback && fallback !== '⚔️') return fallback;
  const value = String(name || '').toLowerCase();
  const icons = [
    [/treadmill|run|jog|sprint/, '🏃'], [/walk|hike/, '🥾'], [/bike|cycle|spin/, '🚴'],
    [/row/, '🚣'], [/swim/, '🏊'], [/jump rope|skipping/, '🪢'], [/stair|step/, '🪜'],
    [/bench|chest press|push.?up/, '🏋️'], [/curl|bicep/, '💪'], [/shoulder|overhead press/, '🙆'],
    [/deadlift/, '🏗️'], [/squat|leg press/, '🦵'], [/lunge/, '🤺'], [/calf/, '🦶'],
    [/pull.?up|lat pull/, '🧗'], [/plank|core|crunch|sit.?up/, '🧘'], [/fly|deltoid/, '🪽'],
    [/yoga|stretch|mobility/, '🤸'], [/boxing|punch|kickbox/, '🥊'], [/dance/, '💃']
  ];
  return icons.find(([pattern]) => pattern.test(value))?.[1] || (type === 'cardio' ? '❤️' : '🏋️');
};


// Save right away so other modules never read (and then overwrite) stale data.
function saveState() {
  if (!state || suppressSave) return;
  void writeSave(state, { source: 'app' });
}

// Another module or tab saved: adopt its copy so the next save doesn't undo it.
async function reloadState() {
  const stored = (await readSave())?.save;
  if (!stored) return;
  state = mergeSave(stored, seedData);
  suppressSave = true;
  try { render(); } finally { suppressSave = false; }
}

// Don't clobber a value the player is typing when the screen re-renders.
function setInputValue(input, value) {
  if (input && input.dataset.dirty !== 'true') input.value = value;
}

const activeDate = () => viewDate || localDateISO();

// Switch the screen to another day (or back to today) and tell other modules.
function setViewDate(date) {
  const today = localDateISO();
  viewDate = date && date !== today ? date : null;
  draftWorkout = null;
  document.documentElement.dataset.activeDate = activeDate();
  render();
  window.dispatchEvent(new CustomEvent('fitquest:active-date', { detail: { date: activeDate() } }));
}

function renderViewBanner() {
  const hero = $('.hero.card');
  if (!hero) return;
  let banner = $('#viewDateBanner');
  if (!viewDate) {
    banner?.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'viewDateBanner';
    banner.className = 'view-date-banner';
    hero.prepend(banner);
  }
  banner.innerHTML = `
    <span>📅 Viewing ${escapeHtml(formatDate(viewDate))}</span>
    <button type="button" class="ghost mini" id="backToTodayBtn">Back to Today</button>
  `;
  $('#backToTodayBtn').addEventListener('click', () => setViewDate(null));
}

function activeWorkout() {
  const today = activeDate();

  let workout =
    state.workouts.find(
      w => w.date === today
    );

  if (!workout) {
    const day = weekdayName(today);

    const number =
      state.workouts.length + 1;

    if (draftWorkout?.date === today) return draftWorkout;
    workout = {
      id:
        `${today}-day-${number}-${Date.now()}`,
      date: today,
      day,
      title:
        `Day ${number}: A New Quest`,
      startTime: '',
      startTimeExact:
        new Date().toLocaleTimeString(
          [],
          {
            hour: 'numeric',
            minute: '2-digit'
          }
        ),
      startedAt: new Date().toISOString(),
      note:
        'A new adventure begins.',
      exercises: [],
      transient: true
    };
    draftWorkout = workout;
  }

  return workout;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(
    'en-US',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
  ).format(
    new Date(
      `${dateString}T12:00:00`
    )
  );
}

function calculateAge(dob) {
  if (!dob) return null;

  const birth =
    new Date(`${dob}T12:00:00`);

  if (
    Number.isNaN(
      birth.getTime()
    )
  ) {
    return null;
  }

  const now = new Date();

  let age =
    now.getFullYear() -
    birth.getFullYear();

  const beforeBirthday =
    now.getMonth() <
      birth.getMonth() ||
    (
      now.getMonth() ===
        birth.getMonth() &&
      now.getDate() <
        birth.getDate()
    );

  if (beforeBirthday) {
    age--;
  }

  return age >= 0
    ? age
    : null;
}

// Split total inches into feet and inches, rounding first so 71.97" never shows as 5'12".
function feetAndInches(totalInches) {
  const rounded = Math.round(totalInches * 10) / 10;
  const feet = Math.floor(rounded / 12);
  return { feet, inches: +(rounded - feet * 12).toFixed(1) };
}

function parseHeight(text) {
  const raw =
    String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[’′]/g, "'")
      .replace(/[“”″]/g, '"');

  if (!raw) {
    return null;
  }

  let m =
    raw.match(
      /^(\d+)\s*'\s*(\d{1,2}(?:\.\d+)?)\s*(?:"|in(?:ches?)?)?$/
    );

  if (m) {
    const feet =
      Number(m[1]);

    const inches =
      Number(m[2]);

    if (
      feet < 2 ||
      feet > 9 ||
      inches < 0 ||
      inches >= 12
    ) {
      return null;
    }

    const total =
      feet * 12 + inches;

    return {
      heightDisplay:
        `${feet}'${
          Number.isInteger(inches)
            ? inches
            : inches.toFixed(1)
        }"`,

      heightInches:
        total,

      heightCm:
        +(total * 2.54)
          .toFixed(1)
    };
  }

  m =
    raw.match(
      /^(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")$/
    );

  if (m) {
    const total =
      Number(m[1]);

    if (
      total < 36 ||
      total > 108
    ) {
      return null;
    }

    const { feet, inches } =
      feetAndInches(total);

    return {
      heightDisplay:
        `${feet}'${inches}"`,

      heightInches:
        total,

      heightCm:
        +(total * 2.54)
          .toFixed(1)
    };
  }

  m =
    raw.match(
      /^(\d+(?:\.\d+)?)\s*(?:cm|centimeters?|centimetres?)$/
    );

  if (m) {
    const cm =
      Number(m[1]);

    if (
      cm < 90 ||
      cm > 275
    ) {
      return null;
    }

    const total =
      cm / 2.54;

    const { feet, inches } =
      feetAndInches(total);

    return {
      heightDisplay:
        `${feet}'${inches}" (${cm} cm)`,

      heightInches:
        +total.toFixed(1),

      heightCm:
        cm
    };
  }

  return null;
}

function getCheckIn(
  date = activeWorkout().date
) {
  state.checkIns ||= [];

  return (
    state.checkIns.find(
      c => c.date === date
    ) || null
  );
}

function upsertCheckIn(
  patch,
  date = activeWorkout().date
) {
  state.checkIns ||= [];

  let item =
    state.checkIns.find(
      c => c.date === date
    );

  if (!item) {
    item = {
      id:
        `checkin-${date}-${Date.now()}`,
      date,
      weight: null,
      weightUnit: 'lb',
      sleepHours: null,
      waterOz: 0
    };

    state.checkIns.push(item);
  }

  Object.assign(
    item,
    patch
  );

  return item;
}

function render() {
  if (!state) return;

  state.exerciseLibrary =
    dedupeLibrary(
      state.exerciseLibrary || []
    );

  state.ui ||= {
    stealthMode: false
  };

  state.checkIns ||= [];

  const stats =
    calculateStats(state);

  const workout =
    activeWorkout();

  const achievements =
    achievementSummary(
      state,
      stats
    );

  state.profile.level =
    stats.level;

  document.body.classList.toggle(
    'stealth-mode',
    !!state.ui.stealthMode
  );

  $('#levelValue').textContent =
    stats.level;

  renderViewBanner();

  $('#heroTitle').textContent =
    workout.title;

  $('#heroDate').textContent =
    `${formatDate(
      workout.date
    )} · ${
      workout.startTimeExact ||
      workout.startTime ||
      'Adventure time'
    }`;

  $('#xpText').textContent =
    `${stats.levelXp} / 500 XP`;

  $('#xpBar').style.width =
    `${stats.levelXp / 500 * 100}%`;

  $('#streakStat').textContent =
    `${stats.streak} day${
      stats.streak === 1
        ? ''
        : 's'
    }`;

  $('#setsStat').textContent =
    stats.strengthSets;

  $('#cardioStat').textContent =
    `${stats.cardio} min`;

  $('#totalXpStat').textContent =
    stats.xp;

  $('#rankTitle').textContent =
    stats.level >= 10
      ? 'Mythic Adventurer'
      : stats.level >= 5
      ? 'Veteran Adventurer'
      : stats.level >= 2
      ? 'Rising Adventurer'
      : 'Novice Adventurer';

  $('#opsStatus span:last-child')
    .textContent =
      state.ui.stealthMode
        ? 'STEALTH INTERFACE · ACTIVE'
        : 'TACTICAL FITNESS ACTION';

  renderWorkout(workout);
  renderLibrary();
  renderProfile();
  renderCheckIn();
  renderNutrition();
  renderWeek();
  renderChronicle();
  renderQuests(stats);
  renderAchievements(
    achievements
  );

  saveState();
}

function renderWorkout(workout) {
  $('#workoutList').innerHTML =
    (
      workout.exercises || []
    )
      .map(
        (e, index) => {
          const distance =
            e.type === 'cardio' &&
            Number(e.distance)
              ? ` · ${Number(
                  e.distance
                ).toFixed(
                  Number(
                    e.distance
                  ) % 1
                    ? 2
                    : 0
                )} ${escapeHtml(
                  e.distanceUnit ||
                  'mi'
                )}`
              : '';

          return `
            <button
              class="workout-item interactive"
              data-edit-exercise="${index}"
            >
              <div class="workout-icon">
                ${escapeHtml(
                  exerciseIcon(e.name, e.type, e.icon)
                )}
              </div>

              <div class="workout-copy">
                <strong>
                  ${escapeHtml(
                    e.name
                  )}
                </strong>

                <small>
                  ${
                    e.type ===
                    'cardio'
                      ? `${e.duration} minutes${distance}`
                      : `${e.sets} sets × ${e.reps} reps${
                          e.weight
                            ? ` · ${escapeHtml(
                                e.weight
                              )}`
                            : ' · weight not recorded'
                        }`
                  }
                </small>
              </div>

              <span class="xp-tag">
                +${e.xp || 0} XP
              </span>
            </button>
          `;
        }
      )
      .join('');

  $$(
    '[data-edit-exercise]'
  ).forEach(btn =>
    btn.addEventListener(
      'click',
      () =>
        openExerciseDialog(
          workout.exercises[
            +btn.dataset
              .editExercise
          ],
          +btn.dataset
            .editExercise
        )
    )
  );
}

function renderLibrary() {
  $('#exerciseLibrary')
    .innerHTML =
      state.exerciseLibrary
        .map(
          e => `
            <button
              class="codex-tile"
              data-library-id="${escapeHtml(
                e.id
              )}"
            >
              <span>
                ${escapeHtml(
                  exerciseIcon(e.name, e.type, e.icon)
                )}
              </span>

              <strong>
                ${escapeHtml(
                  e.name
                )}
              </strong>

              <small>
                ${
                  e.type ===
                  'cardio'
                    ? 'Cardio'
                    : 'Strength'
                }
              </small>
            </button>
          `
        )
        .join('') +
      `
        <button
          class="codex-tile add-new"
          id="codexAddNew"
        >
          <span>＋</span>
          <strong>New Move</strong>
          <small>Teach LEVEL IRL</small>
        </button>
      `;

  $$(
    '[data-library-id]'
  ).forEach(btn =>
    btn.addEventListener(
      'click',
      () =>
        openExerciseDialog(
          state.exerciseLibrary
            .find(
              e =>
                e.id ===
                btn.dataset
                  .libraryId
            )
        )
    )
  );

  $('#codexAddNew')
    ?.addEventListener(
      'click',
      () =>
        openExerciseDialog()
    );
}

function renderProfile() {
  const p =
    state.profile;

  const age =
    calculateAge(
      p.dateOfBirth
    );

  $('#dobReadout').textContent =
    p.dateOfBirth
      ? new Intl.DateTimeFormat(
          'en-US',
          {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }
        ).format(
          new Date(
            `${p.dateOfBirth}T12:00:00`
          )
        )
      : 'Not set';

  $('#ageReadout').textContent =
    age ??
    (
      p.age
        ? `${p.age}*`
        : '—'
    );

  $('#heightReadout')
    .textContent =
      p.heightDisplay ||
      (
        p.height
          ? `${p.height} ${
              p.heightUnit ||
              'in'
            }*`
          : 'Not set'
      );

  $('#profileDob').value =
    p.dateOfBirth || '';

  $('#profileHeightText')
    .value =
      p.heightDisplay || '';

  $('#characterGoal')
    .textContent =
      `Goal: ${
        p.goal ||
        'Slim & Tone'
      }`;

  const complete =
    Boolean(
      p.dateOfBirth &&
      p.heightDisplay
    );

  $('#profileCompletion')
    .textContent =
      complete
        ? 'Identity stats locked · age updates automatically'
        : (
            p.age ||
            p.height
          )
        ? 'Legacy stats detected · set DOB and height once to upgrade your dossier'
        : 'Set DOB and height once; daily measurements live below';
}

function renderCheckIn() {
  const date =
    activeWorkout().date;

  const c =
    getCheckIn(date);

  $('#checkInDateLabel')
    .textContent =
      formatDate(date)
        .replace(
          /, \d{4}$/,
          ''
        );

  setInputValue(
    $('#dailyWeight'),
    c?.weight ?? ''
  );

  setInputValue(
    $('#dailyWeightUnit'),
    c?.weightUnit || 'lb'
  );

  const sleepTotal =
    c?.sleepMinutes != null
      ? Number(
          c.sleepMinutes
        )
      : c?.sleepHours != null
      ? Math.round(
          Number(
            c.sleepHours
          ) * 60
        )
      : null;

  setInputValue(
    $('#dailySleepHours'),
    sleepTotal == null
      ? ''
      : Math.floor(sleepTotal / 60)
  );

  setInputValue(
    $('#dailySleepMinutes'),
    sleepTotal == null
      ? ''
      : sleepTotal % 60
  );

  $('#dailyWater').value =
    c?.waterOz ?? 0;

  const bits = [];

  if (c?.weight) {
    bits.push(
      `⚖️ ${c.weight} ${c.weightUnit}`
    );
  }

  if (
    sleepTotal != null
  ) {
    const sh =
      Math.floor(
        sleepTotal / 60
      );

    const sm =
      sleepTotal % 60;

    bits.push(
      `😴 ${sh}h${
        sm
          ? ` ${sm}m`
          : ''
      } sleep`
    );
  }

  bits.push(
    `💧 ${Number(
      c?.waterOz || 0
    )} oz water`
  );

  $('#checkInSummary')
    .innerHTML =
      bits
        .map(
          x =>
            `<span>${escapeHtml(
              x
            )}</span>`
        )
        .join('');
}

function renderNutrition() {
  const workoutDate =
    activeWorkout().date;

  const entries =
    (
      state.nutrition ||
      []
    ).filter(
      n =>
        n.date ===
        workoutDate
    );

  const totals =
    entries.reduce(
      (acc, e) => {
        [
          'calories',
          'protein',
          'carbs',
          'fat'
        ].forEach(
          key =>
            acc[key] +=
              Number(
                e[key]
              ) || 0
        );

        return acc;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      }
    );

  $('#calorieTotal')
    .textContent =
      Math.round(
        totals.calories
      );

  $('#proteinTotal')
    .textContent =
      `${Math.round(
        totals.protein
      )}g`;

  $('#carbTotal')
    .textContent =
      `${Math.round(
        totals.carbs
      )}g`;

  $('#fatTotal')
    .textContent =
      `${Math.round(
        totals.fat
      )}g`;

  $('#foodLog').innerHTML =
    entries.length
      ? entries
          .map(
            e => `
              <div class="food-row">
                <span>
                  ${escapeHtml(
                    e.icon ||
                    '🍽️'
                  )}
                </span>

                <div>
                  <strong>
                    ${escapeHtml(
                      e.name
                    )}
                  </strong>

                  <small>
                    ${escapeHtml(
                      e.serving ||
                      '1 serving'
                    )}
                    · ${Math.round(
                      Number(
                        e.calories
                      ) || 0
                    )} cal
                    ${
                      e.source
                        ? ` · ${escapeHtml(
                            e.source
                          )}`
                        : ''
                    }
                    ${
                      Number(
                        e.hydrationOz
                      )
                        ? ` · 💧 ${Number(
                            e.hydrationOz
                          )} oz`
                        : ''
                    }
                  </small>
                </div>

                <b>
                  ${Math.round(
                    Number(
                      e.protein
                    ) || 0
                  )}g P
                </b>
              </div>
            `
          )
          .join('')
      : `
          <div class="empty-state">
            No provisions logged yet.
            Add your first meal when you’re ready.
          </div>
        `;
}

function mondayOf(iso) {
  const jsDay = dateFromISO(iso).getDay();
  return addDays(iso, -((jsDay + 6) % 7));
}

function renderWeek() {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monday = mondayOf(localDateISO());
  const weekDates = labels.map((_, index) => addDays(monday, index));
  const weekSet = new Set(weekDates);

  const loggedWorkouts = state.workouts.filter(
    w => Array.isArray(w.exercises) && w.exercises.length > 0
  );
  const workoutDates = new Set(loggedWorkouts.map(w => w.date));

  $('#weekGrid').innerHTML = labels
    .map((label, index) => {
      const active = workoutDates.has(weekDates[index]);
      return `
        <div class="day ${active ? 'active' : ''}">
          <strong>${label}</strong>
          ${active ? '✓' : '·'}
        </div>
      `;
    })
    .join('');

  // Campaign week number, counted from the Monday of the first logged workout.
  const firstDate = loggedWorkouts.map(w => w.date).sort()[0];
  const weekNumber = firstDate
    ? Math.max(1, Math.round((dateFromISO(monday) - dateFromISO(mondayOf(firstDate))) / (7 * 86400000)) + 1)
    : 1;
  const rangeFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  $('#weekLabel').textContent =
    `Week ${weekNumber} · ${rangeFormat.format(dateFromISO(weekDates[0]))}–${rangeFormat.format(dateFromISO(weekDates[6]))}`;

  const thisWeek = loggedWorkouts.filter(w => weekSet.has(w.date));
  const exercises = thisWeek.flatMap(w => w.exercises);
  const sets = exercises
    .filter(e => e.type === 'strength')
    .reduce((n, e) => n + (Number(e.sets) || 0), 0);
  const cardio = exercises
    .filter(e => e.type === 'cardio')
    .reduce((n, e) => n + (Number(e.duration) || 0), 0);
  const days = new Set(thisWeek.map(w => w.date)).size;

  $('#weeklySummary').textContent =
    `This week: ${days} adventure${days === 1 ? '' : 's'} · ${sets} strength sets · ${cardio} cardio minutes.`;
}

function renderChronicle() {
  const workouts =
    [...(
      state.workouts ||
      []
    )]
      .filter(
        w =>
          (
            w.exercises ||
            []
          ).length
      )
      .sort(
        (a, b) =>
          String(
            b.date || ''
          ).localeCompare(
            String(
              a.date || ''
            )
          )
      )
      .slice(0, 8);

  $('#chronicle')
    .innerHTML =
      workouts.length
        ? workouts
            .map(
              workout => {
                const exercises =
                  workout
                    .exercises ||
                  [];

                const xp =
                  exercises
                    .reduce(
                      (
                        total,
                        exercise
                      ) =>
                        total +
                        (
                          Number(
                            exercise.xp
                          ) ||
                          0
                        ),
                      0
                    );

                return `
                  <div class="chronicle-entry">
                    <span>
                      ${escapeHtml(
                        workout.day ||
                        ''
                      )}
                    </span>

                    <div>
                      <strong>
                        ${escapeHtml(
                          workout.title ||
                          'Adventure'
                        )}
                      </strong>

                      <small>
                        ${escapeHtml(
                          formatDate(
                            workout.date
                          )
                        )}
                        · ${
                          exercises.length
                        } move${
                          exercises.length ===
                          1
                            ? ''
                            : 's'
                        }
                        · ${xp} XP
                      </small>
                    </div>
                  </div>
                `;
              }
            )
            .join('')
        : `
            <div class="empty-state">
              Your campaign story will appear here.
            </div>
          `;
}

function renderQuests(stats) {
  const workout =
    activeWorkout();

  const exerciseCount =
    (
      workout.exercises ||
      []
    ).length;

  const checkIn =
    getCheckIn(
      workout.date
    );

  const nutritionCount =
    (
      state.nutrition ||
      []
    ).filter(
      item =>
        item.date ===
        workout.date
    ).length;

  const quests = [
    {
      name:
        'Complete one training move',
      complete:
        exerciseCount > 0
    },
    {
      name:
        'Log your daily recovery intel',
      complete:
        Boolean(
          checkIn &&
          (
            checkIn.weight ||
            checkIn.sleepMinutes != null ||
            checkIn.waterOz
          )
        )
    },
    {
      name:
        'Log today’s provisions',
      complete:
        nutritionCount > 0
    }
  ];

  const complete =
    quests.filter(
      quest =>
        quest.complete
    ).length;

  $('#questCount')
    .textContent =
      `${complete}/${quests.length}`;

  $('#questList')
    .innerHTML =
      quests
        .map(
          quest => `
            <div class="quest-item ${
              quest.complete
                ? 'complete'
                : ''
            }">
              <span>
                ${
                  quest.complete
                    ? '✓'
                    : '○'
                }
              </span>

              <strong>
                ${escapeHtml(
                  quest.name
                )}
              </strong>
            </div>
          `
        )
        .join('');
}

function renderAchievements(
  summary
) {
  $('#achievementCount')
    .textContent =
      `${
        summary.unlocked.length
      } / ${
        summary.total
          .toLocaleString()
      }`;

  const unlocked =
    summary.unlocked
      .slice(-3)
      .reverse();

  const upcoming =
    summary.archive
      .filter(
        a =>
          !a.unlocked &&
          a.kind !==
            'landmark' &&
          a.kind !==
            'secret'
      )
      .slice(0, 2);

  const cards =
    [
      ...unlocked,
      ...upcoming
    ].slice(0, 5);

  $('#achievementPreview')
    .innerHTML =
      cards
        .map(
          a => `
            <div class="achievement ${
              a.unlocked
                ? 'unlocked'
                : 'locked'
            }">
              <span>
                ${
                  a.unlocked
                    ? a.icon
                    : '🔒'
                }
              </span>

              <div>
                <strong>
                  ${escapeHtml(
                    a.name
                  )}
                </strong>

                <small>
                  ${
                    a.unlocked
                      ? (
                          a.flavor ||
                          'Achievement unlocked'
                        )
                      : `Target: ${a.target.toLocaleString()}`
                  }
                </small>
              </div>
            </div>
          `
        )
        .join('');

  $('#distanceTotal')
    .textContent =
      `${summary.distance.toFixed(
        2
      )} mi`;

  const next =
    summary.nextLandmark;

  $('#nextLandmarkName')
    .textContent =
      next.unlocked
        ? 'Atlas Campaign Complete'
        : next.name;

  $('#nextLandmarkProgress')
    .textContent =
      next.unlocked
        ? 'Legendary distance achieved.'
        : `${next.remaining.toFixed(
            2
          )} mi remaining · ${
            next.place
          }`;

  const prevIndex =
    summary.landmarks
      .findIndex(
        l =>
          l.id ===
          next.id
      ) - 1;

  const prevMiles =
    prevIndex >= 0
      ? summary.landmarks[
          prevIndex
        ].miles
      : 0;

  const pct =
    next.unlocked
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            (
              (
                summary.distance -
                prevMiles
              ) /
              (
                next.miles -
                prevMiles
              )
            ) * 100
          )
        );

  $('#landmarkBar')
    .style.width =
      `${pct}%`;

  const unlockedLandmarks =
    summary.landmarks.filter(
      l => l.unlocked
    );

  const visible = [
    ...unlockedLandmarks
      .slice(-3),

    ...summary.landmarks
      .filter(
        l =>
          !l.unlocked
      )
      .slice(0, 4)
  ];

  $('#landmarkGrid')
    .innerHTML =
      visible
        .map(
          l => `
            <article
              class="landmark ${
                l.unlocked
                  ? 'unlocked'
                  : 'locked'
              }"
            >
              <div class="sketch">
                ${sketchSVG(
                  l.sketch
                )}
              </div>

              <div class="landmark-copy">
                <span>
                  ${
                    l.unlocked
                      ? 'FIELD STAMPED'
                      : 'DISTANCE TARGET'
                  }
                </span>

                <strong>
                  ${escapeHtml(
                    l.name
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    l.place
                  )}
                  · ${
                    l.miles
                      .toLocaleString()
                  } mi
                </small>

                <p>
                  ${
                    l.unlocked
                      ? escapeHtml(
                          l.flavor
                        )
                      : `${l.remaining.toFixed(
                          2
                        )} mi to unlock`
                  }
                </p>
              </div>
            </article>
          `
        )
        .join('');
}

function openExerciseDialog(
  exercise = null,
  editIndex = null
) {
  const isLoggedExercise =
    editIndex !== null;

  $('#exerciseDialogTitle')
    .textContent =
      isLoggedExercise
        ? 'Edit Exercise'
        : exercise
        ? `Log ${exercise.name}`
        : 'Teach LEVEL IRL a Move';

  $('#exerciseEditIndex')
    .value =
      editIndex ?? '';

  $('#exerciseName').value =
    exercise?.name || '';

  $('#exerciseType').value =
    exercise?.type ||
    'strength';

  $('#exerciseIcon').value =
    exercise?.icon ||
    (
      exercise?.type ===
      'cardio'
        ? '🏃'
        : '⚔️'
    );

  $('#exerciseSets').value =
    exercise?.sets || 3;

  $('#exerciseReps').value =
    exercise?.reps || 10;

  $('#exerciseWeight')
    .value =
      exercise?.weight ||
      '';

  $('#exerciseDuration')
    .value =
      exercise?.duration ||
      20;

  $('#exerciseDistance')
    .value =
      exercise?.distance ??
      '';

  $('#exerciseDistanceUnit')
    .value =
      exercise?.distanceUnit ||
      'mi';

  updateExerciseFields();

  $('#exerciseDialog')
    .showModal();
}

function updateExerciseFields() {
  const cardio =
    $('#exerciseType')
      .value === 'cardio';

  $('#strengthFields')
    .hidden =
      cardio;

  $('#cardioFields')
    .hidden =
      !cardio;
}

const TYPE_FIELDS = ['sets', 'reps', 'weight', 'duration', 'distance', 'distanceUnit'];

// Keep an edited exercise's identity and log time, and drop fields from its old type.
function mergeEditedExercise(previous = {}, entry) {
  const kept = { ...previous };
  TYPE_FIELDS.forEach(field => delete kept[field]);
  return {
    ...kept,
    ...entry,
    id: previous.id || entry.id,
    loggedAt: previous.loggedAt || entry.loggedAt
  };
}

function saveExercise(ev) {
  ev.preventDefault();

  const name =
    $('#exerciseName')
      .value
      .trim();

  if (!name) return;

  const type =
    $('#exerciseType')
      .value;

  const icon =
    $('#exerciseIcon')
      .value
      .trim() || exerciseIcon(name, type);

  const duration =
    +$('#exerciseDuration')
      .value || 1;

  const distance =
    +$('#exerciseDistance')
      .value || 0;

  const loggedAt = new Date().toISOString();
  const entry =
    type === 'cardio'
      ? {
          id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          name,
          duration,
          distance:
            distance || null,
          distanceUnit:
            $('#exerciseDistanceUnit')
              .value,
          icon,
          loggedAt,
          xp:
            nextExerciseXP(
              type,
              0,
              duration,
              distance
            )
        }
      : {
          id: `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          name,
          sets:
            +$('#exerciseSets')
              .value || 1,
          reps:
            +$('#exerciseReps')
              .value || 1,
          weight:
            $('#exerciseWeight')
              .value
              .trim() ||
            null,
          icon,
          loggedAt,
          xp:
            nextExerciseXP(
              type,
              +$('#exerciseSets')
                .value
            )
        };

  const editIndex =
    $('#exerciseEditIndex')
      .value;

  const targetWorkout = activeWorkout();
  if (targetWorkout.transient) {
    delete targetWorkout.transient;
    state.workouts.push(targetWorkout);
    draftWorkout = null;
  }

  if (editIndex !== '') {
    targetWorkout
      .exercises[
        +editIndex
      ] = mergeEditedExercise(
        targetWorkout.exercises[+editIndex],
        entry
      );
  } else {
    targetWorkout
      .exercises.push(
        entry
      );
  }

  const existing =
    state.exerciseLibrary
      .find(
        e =>
          e.name
            .toLowerCase() ===
          name.toLowerCase()
      );

  if (!existing) {
    state.exerciseLibrary.push({
      id: slugify(name),
      name,
      type,
      icon
    });

    toast(
      `📖 ${name} learned by the Exercise Codex!`
    );
  } else {
    existing.type =
      type;

    existing.icon =
      icon;

    toast(
      `⚔️ ${name} logged!`
    );
  }

  $('#exerciseDialog')
    .close();

  render();
}

function fillFood(food) {
  $('#foodName').value =
    food?.name || '';

  $('#foodServing')
    .value =
      food?.serving ||
      '1 serving';

  $('#foodCalories')
    .value =
      Number.isFinite(
        Number(
          food?.calories
        )
      )
        ? Number(
            food.calories
          ).toFixed(0)
        : '';

  $('#foodProtein')
    .value =
      food?.protein ?? '';

  $('#foodCarbs')
    .value =
      food?.carbs ?? '';

  $('#foodFat').value =
    food?.fat ?? '';

  $('#foodHydration')
    .value =
      food?.hydrationOz ??
      '';

  $('#foodIcon').value =
    food?.icon || '🍽️';

  $('#foodSource').value =
    food?.source || '';
}

function openFoodDialog(
  food = null
) {
  fillFood(
    food || {}
  );

  $('#onlineFoodResults')
    .hidden = true;

  $('#onlineFoodResults')
    .innerHTML = '';

  $('#foodDialog')
    .showModal();
}

function saveFood(ev) {
  ev.preventDefault();

  const name =
    $('#foodName')
      .value
      .trim();

  if (!name) return;

  const hydrationOz =
    +$('#foodHydration')
      .value || 0;

  const entry = {
    id:
      `food-${Date.now()}`,

    date:
      activeWorkout().date,

    name,

    serving:
      $('#foodServing')
        .value
        .trim(),

    calories:
      +$('#foodCalories')
        .value || 0,

    protein:
      +$('#foodProtein')
        .value || 0,

    carbs:
      +$('#foodCarbs')
        .value || 0,

    fat:
      +$('#foodFat')
        .value || 0,

    hydrationOz,

    icon:
      $('#foodIcon')
        .value
        .trim() ||
      '🍽️',

    source:
      $('#foodSource')
        .value ||
      null
  };

  entry.xp =
    nutritionXP(entry);

  state.nutrition.push(
    entry
  );

  if (hydrationOz) {
    const c =
      getCheckIn(
        entry.date
      );

    upsertCheckIn(
      {
        waterOz:
          Number(
            c?.waterOz ||
            0
          ) +
          hydrationOz
      },
      entry.date
    );
  }

  $('#foodDialog')
    .close();

  toast(
    `🍎 Provisions logged · +${entry.xp} XP`
  );

  render();
  window.dispatchEvent(new CustomEvent('fitquest:nutrition-updated'));
}

async function lookupFood() {
  const term =
    $('#foodName')
      .value
      .trim();

  if (
    term.length < 2
  ) {
    toast(
      '🔎 Type at least 2 letters first'
    );

    return;
  }

  const btn =
    $('#foodLookupBtn');

  const resultBox =
    $('#onlineFoodResults');

  btn.disabled = true;

  btn.textContent =
    'Searching…';

  resultBox.hidden =
    false;

  resultBox.innerHTML =
    '<div class="search-status">Contacting Open Food Facts…</div>';

  try {
    const results =
      await searchOpenFoodFacts(
        term
      );

    if (
      !results.length
    ) {
      resultBox.innerHTML =
        '<div class="search-status">No matching products found. Try a brand or a more specific name.</div>';

      return;
    }

    resultBox.innerHTML =
      results
        .map(
          (f, i) => `
            <button
              type="button"
              class="online-food-result"
              data-online-index="${i}"
            >
              <span>🔎</span>

              <div>
                <strong>
                  ${escapeHtml(
                    f.name
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    f.brand ||
                    'Open Food Facts'
                  )}
                  · ${escapeHtml(
                    f.serving
                  )}
                </small>
              </div>

              <b>
                ${Math.round(
                  f.calories ||
                  0
                )} cal
              </b>
            </button>
          `
        )
        .join('');

    $$(
      '[data-online-index]'
    ).forEach(
      el =>
        el.addEventListener(
          'click',
          () => {
            fillFood(
              results[
                +el.dataset
                  .onlineIndex
              ]
            );

            resultBox.hidden =
              true;

            toast(
              '🔎 Nutrition data loaded — verify the serving size'
            );
          }
        )
    );

  } catch (err) {
    resultBox.innerHTML =
      '<div class="search-status error">Online lookup is unavailable right now. Built-in foods and manual entry still work.</div>';

    console.warn(err);

  } finally {
    btn.disabled =
      false;

    btn.textContent =
      '🔎 Search Online';
  }
}

function saveIdentity() {
  const dob =
    $('#profileDob')
      .value;

  const parsed =
    parseHeight(
      $('#profileHeightText')
        .value
    );

  if (!dob) {
    toast(
      '🎂 Add your date of birth first'
    );

    return;
  }

  if (!parsed) {
    toast(
      '📏 Try height like 5\'10", 70 in, or 178 cm'
    );

    return;
  }

  state.profile
    .dateOfBirth =
      dob;

  Object.assign(
    state.profile,
    parsed
  );

  delete state.profile.age;
  delete state.profile.height;
  delete state.profile.heightUnit;

  $('#identityEditor')
    .hidden = true;

  toast(
    '🧙 Identity stats locked into your dossier'
  );

  render();
}

function saveCheckIn() {
  const hRaw =
    $('#dailySleepHours')
      .value;

  const mRaw =
    $('#dailySleepMinutes')
      .value;

  const hasSleep =
    hRaw !== '' ||
    mRaw !== '';

  const h =
    Math.max(
      0,
      Math.min(
        24,
        parseInt(
          hRaw || '0',
          10
        ) || 0
      )
    );

  const m =
    Math.max(
      0,
      Math.min(
        59,
        parseInt(
          mRaw || '0',
          10
        ) || 0
      )
    );

  const sleepMinutes =
    hasSleep
      ? h * 60 + m
      : null;

  const patch = {
    weight:
      +$('#dailyWeight')
        .value ||
      null,

    weightUnit:
      $('#dailyWeightUnit')
        .value,

    sleepMinutes,

    sleepHours:
      sleepMinutes == null
        ? null
        : Number(
            (
              sleepMinutes /
              60
            ).toFixed(2)
          ),

    waterOz:
      +$('#dailyWater')
        .value || 0
  };

  upsertCheckIn(
    patch
  );

  toast(
    '📡 Daily recovery intel saved'
  );

  ['#dailyWeight', '#dailyWeightUnit', '#dailySleepHours', '#dailySleepMinutes']
    .forEach(selector => {
      const input = $(selector);
      if (input) delete input.dataset.dirty;
    });

  render();
  window.dispatchEvent(new CustomEvent('fitquest:checkin-saved'));
}

function addWater(amount) {
  const next =
    (
      +$('#dailyWater')
        .value ||
      0
    ) +
    amount;

  $('#dailyWater').value =
    next;

  upsertCheckIn({
    waterOz: next
  });

  toast(
    `💧 +${amount} oz water`
  );

  render();
  window.dispatchEvent(new CustomEvent('fitquest:checkin-saved'));
}

function createNewWorkout(ev) {
  ev.preventDefault();

  const dateValue =
    $('#newWorkoutDate')
      .value ||
    localDateISO();

  if (dateValue > localDateISO()) {
    toast('📅 Adventures can’t be logged for future dates.');
    return;
  }

  const day = weekdayName(dateValue);

  const time =
    $('#newWorkoutTime')
      .value ||
    new Date()
      .toLocaleTimeString(
        [],
        {
          hour: 'numeric',
          minute: '2-digit'
        }
      );

  const number =
    state.workouts
      .length + 1;

  const existingWorkout = state.workouts.find(workout => workout.date === dateValue);
  if (existingWorkout) {
    $('#newWorkoutDialog').close();
    toast(`📅 ${dateValue} already has a workout. Opening that record instead.`);
    setViewDate(dateValue);
    return;
  }

  state.workouts.push({
    id:
      `${dateValue}-day-${number}-${Date.now()}`,

    date:
      dateValue,

    day,

    title:
      `Day ${number}: ${
        $('#newWorkoutTitle')
          .value
          .trim() ||
        'A New Quest'
      }`,

    startTime: '',

    startTimeExact:
      time,

    startedAt:
      new Date().toISOString(),

    note:
      $('#newWorkoutNote')
        .value
        .trim() ||
      'A new adventure begins.',

    exercises: []
  });

  $('#newWorkoutDialog')
    .close();

  toast(
    '🗺️ New adventure started!'
  );

  setViewDate(dateValue);

  setTimeout(
    () =>
      $('#exerciseCodexSection')
        ?.scrollIntoView({
          behavior:
            'smooth'
        }),
    150
  );
}


function bindAppEvents() {
  $('#addExerciseBtn')
    .addEventListener(
      'click',
      () =>
        openExerciseDialog()
    );

  $('#exerciseType')
    .addEventListener(
      'change',
      updateExerciseFields
    );

  $('#exerciseForm')
    .addEventListener(
      'submit',
      saveExercise
    );

  $('#editIdentityBtn')
    .addEventListener(
      'click',
      () => {
        $('#identityEditor')
          .hidden =
            !$('#identityEditor')
              .hidden;
      }
    );

  $('#saveIdentityBtn')
    .addEventListener(
      'click',
      saveIdentity
    );

  $('#saveCheckInBtn')
    .addEventListener(
      'click',
      saveCheckIn
    );

  $$(
    '[data-water-add]'
  ).forEach(
    b =>
      b.addEventListener(
        'click',
        () =>
          addWater(
            +b.dataset
              .waterAdd
          )
      )
  );

  $('#addFoodBtn')
    .addEventListener(
      'click',
      () =>
        openFoodDialog()
    );

  $('#foodForm')
    .addEventListener(
      'submit',
      saveFood
    );

  $('#foodLookupBtn')
    .addEventListener(
      'click',
      lookupFood
    );

  $('#foodName')
    .addEventListener(
      'change',
      () => {
        const match =
          findQuickFood(
            $('#foodName')
              .value
          );

        if (match) {
          fillFood(
            match
          );
        }
      }
    );

  $('#quickFoods')
    .innerHTML =
      quickFoods
        .slice(0, 18)
        .map(
          (f, i) =>
            `<button class="food-chip" data-food-index="${i}">${f.icon} ${f.name}</button>`
        )
        .join('');

  $$(
    '[data-food-index]'
  ).forEach(
    btn =>
      btn.addEventListener(
        'click',
        () =>
          openFoodDialog(
            quickFoods[
              +btn.dataset
                .foodIndex
            ]
          )
      )
  );

  $('#foodSuggestions')
    .innerHTML =
      quickFoods
        .map(
          f =>
            `<option value="${escapeHtml(
              f.name
            )}"></option>`
        )
        .join('');

  $('#newWorkoutBtn')
    .addEventListener(
      'click',
      () => {
        const now =
          new Date();

        $('#newWorkoutDate')
          .value =
            localDateISO(
              now
            );

        // Adventures can be backfilled, but not scheduled in the future.
        $('#newWorkoutDate').max = localDateISO(now);

        $('#newWorkoutTime')
          .value =
            now.toLocaleTimeString(
              [],
              {
                hour:
                  'numeric',
                minute:
                  '2-digit'
              }
            );

        $('#newWorkoutTitle')
          .value = '';

        $('#newWorkoutNote')
          .value = '';

        $('#newWorkoutDialog')
          .showModal();
      }
    );

  $('#newWorkoutForm')
    .addEventListener(
      'submit',
      createNewWorkout
    );

  $$(
    '.dialog-close'
  ).forEach(
    btn =>
      btn.addEventListener(
        'click',
        () => {
          const id =
            btn.dataset
              .closeDialog;

          const dialog =
            id
              ? document
                  .getElementById(
                    id
                  )
              : btn.closest(
                  'dialog'
                );

          dialog?.close();
        }
      )
  );

  $$('dialog')
    .forEach(
      dialog =>
        dialog.addEventListener(
          'click',
          ev => {
            if (
              ev.target ===
              dialog
            ) {
              dialog.close();
            }
          }
        )
    );

  $('#classifiedBtn')
    .addEventListener(
      'click',
      () => {
        const m =
          $('#classifiedMessage');

        m.hidden =
          !m.hidden;

        toast(
          m.hidden
            ? '📡 Field channel closed'
            : '📡 Encrypted field note decoded'
        );
      }
    );

  $('#levelChip')
    .addEventListener(
      'click',
      () => {
        titleTapCount++;

        if (
          titleTapCount >=
          5
        ) {
          titleTapCount =
            0;

          state.ui
            .stealthMode =
              !state.ui
                .stealthMode;

          toast(
            state.ui
              .stealthMode
              ? '❗ Stealth Interface engaged. Keep a low profile.'
              : '📡 Standard interface restored.'
          );

          render();
        }
      }
    );
}

export async function startFitQuest() {
  if (appStarted) {
    return true;
  }

  state =
    await loadSave(
      seedData
    );

  bindAppEvents();

  ['#dailyWeight', '#dailyWeightUnit', '#dailySleepHours', '#dailySleepMinutes']
    .forEach(selector =>
      $(selector)?.addEventListener('input', event => {
        event.target.dataset.dirty = 'true';
      })
    );

  window.addEventListener('fitquest:saved', event => {
    if (event.detail?.source !== 'app') void reloadState();
  });
  window.addEventListener('fitquest:remote-update', () => void reloadState());
  // Workout History can ask to open a specific day.
  window.addEventListener('fitquest:open-date', event => {
    setViewDate(event.detail?.date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.documentElement.dataset.activeDate = activeDate();

  appStarted = true;

  render();

  const appRoot = $('#appRoot');
  if (appRoot) appRoot.hidden = false;

  return true;
}

void startFitQuest();

