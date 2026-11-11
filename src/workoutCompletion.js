import { seedData } from './data/defaultData.js';
import { loadSave, writeSave } from './lib/storage.js';
import { calculateStats } from './lib/progression.js';
import { $, localDateISO } from './lib/dom.js';


let busy = false;

function styles() {
  if ($('#fitquestCompletionStyles')) return;

  const style = document.createElement('style');
  style.id = 'fitquestCompletionStyles';
  style.textContent = `
    .fitquest-adventure-actions {
      display: flex;
      gap: 9px;
      align-items: stretch;
      min-width: 0;
    }

    .finish-adventure-btn,
    .end-adventure-btn {
      min-height: 42px;
      border-radius: 13px;
      padding: 0 16px;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }

    .finish-adventure-btn {
      border: 1px solid rgba(109,232,177,.28);
      background: linear-gradient(135deg,rgba(73,202,159,.17),rgba(93,119,255,.17));
      color: #b9ffe2;
    }

    .end-adventure-btn {
      border: 1px solid rgba(172,112,255,.25);
      background: rgba(145,89,255,.08);
      color: #d9c6ff;
    }

    .finish-adventure-btn:disabled,
    .end-adventure-btn:disabled {
      opacity: .55;
      cursor: default;
    }

    .finish-adventure-btn.adventure-ended {
      min-width: 200px;
      border-color: rgba(105,232,177,.28);
      background: rgba(105,232,177,.09);
      color: #78eab7;
    }

    .fitquest-strike-note {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(105,232,177,.20);
      background: rgba(105,232,177,.07);
      color: #9eeec9;
      font-size: 13px;
      line-height: 1.45;
    }

    @media (max-width: 700px) {
      .quest-card .section-heading {
        display: grid !important;
        grid-template-columns: minmax(0,1fr) auto;
        align-items: start !important;
        gap: 12px !important;
      }

      .quest-card .section-heading > div:first-child {
        min-width: 0;
      }

      .quest-card #addExerciseBtn {
        grid-column: 2;
        grid-row: 1;
        align-self: start;
        margin: 0 !important;
      }

      .quest-card .fitquest-adventure-actions {
        grid-column: 1 / -1;
        grid-row: 2;
        display: grid;
        grid-template-columns: repeat(2,minmax(0,1fr));
        width: 100%;
        gap: 8px;
      }

      .quest-card .finish-adventure-btn,
      .quest-card .end-adventure-btn {
        width: 100%;
        min-width: 0;
        min-height: 48px;
        padding: 8px 10px;
        white-space: normal;
        line-height: 1.2;
        font-size: 12px;
      }

      .quest-card .fitquest-adventure-actions.ended {
        grid-template-columns: 1fr;
      }

      .quest-card .fitquest-adventure-actions.ended .finish-adventure-btn {
        min-width: 0;
      }
    }
  `;

  document.head.appendChild(style);
}

function currentWorkout(data) {
  return (data.workouts || []).find(w => w.date === localDateISO()) || null;
}

function exerciseCount(workout) {
  return Array.isArray(workout?.exercises) ? workout.exercises.length : 0;
}

function submittedCount(workout) {
  return Math.max(0, Number(workout?.bossSubmittedExerciseCount) || 0);
}

function pendingCount(workout) {
  return Math.max(0, exerciseCount(workout) - submittedCount(workout));
}

function getWorkoutBonus(workout) {
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  const sets = exercises
    .filter(e => e.type === 'strength')
    .reduce((n,e) => n + (Number(e.sets)||0), 0);

  const cardio = exercises
    .filter(e => e.type === 'cardio')
    .reduce((n,e) => n + (Number(e.duration)||0), 0);

  return Math.max(
    50,
    Math.min(
      150,
      Math.round(35 + exercises.length * 8 + sets * 2 + Math.floor(cardio / 5) * 3)
    )
  );
}

function controls() {
  return {
    strike: $('#finishAdventureBtn'),
    end: $('#endAdventureBtn'),
    add: $('#addExerciseBtn'),
    wrap: $('.fitquest-adventure-actions')
  };
}

function setState(workout) {
  const { strike, end, add, wrap } = controls();
  if (!strike || !end || !wrap) return;

  const total = exerciseCount(workout);
  const pending = pendingCount(workout);

  wrap.classList.toggle('ended', Boolean(workout?.completed));
  strike.classList.toggle('adventure-ended', Boolean(workout?.completed));

  if (workout?.completed) {
    // Legacy completed Adventures may still contain unsubmitted moves.
    if (pending > 0) {
      strike.hidden = false;
      strike.disabled = false;
      strike.textContent = `⚔️ Final Strike · ${pending} ${pending === 1 ? 'move' : 'moves'}`;
    } else {
      strike.hidden = false;
      strike.disabled = true;
      strike.textContent = `✓ Adventure Ended · +${Number(workout.completionXp) || 0} XP`;
    }

    end.hidden = true;
    if (add) add.hidden = true;
    return;
  }

  end.hidden = false;
  if (add) add.hidden = false;

  strike.disabled = pending <= 0;
  strike.textContent = pending > 0
    ? `⚔️ Submit Strike · ${pending} new ${pending === 1 ? 'move' : 'moves'}`
    : total > 0
      ? '⚔️ All Moves Submitted'
      : '⚔️ Log a Move First';

  end.disabled = total <= 0;
  end.textContent = total > 0
    ? `🏁 End Adventure · +${getWorkoutBonus(workout)} XP`
    : '🏁 End Adventure';
}

function note(workout) {
  $('#fitquestCompletionNote')?.remove();

  const list = $('#workoutList');
  if (!list || !workout) return;

  const el = document.createElement('div');
  el.id = 'fitquestCompletionNote';
  el.className = 'fitquest-strike-note';

  const pending = pendingCount(workout);

  if (workout.completed) {
    const time = workout.completedAt
      ? new Date(workout.completedAt).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit'
        })
      : '';

    el.textContent = pending > 0
      ? `⚔️ Adventure ended${time ? ` at ${time}` : ''}, but ${pending} legacy ${pending === 1 ? 'move still needs' : 'moves still need'} one final boss strike.`
      : `✓ Adventure ended${time ? ` at ${time}` : ''} · +${Number(workout.completionXp) || 0} completion XP`;
  } else {
    el.textContent = pending > 0
      ? `⚔️ ${pending} new ${pending === 1 ? 'move is' : 'moves are'} ready. Strike now, keep training, then strike again later.`
      : exerciseCount(workout) > 0
        ? '✓ All current moves have hit the boss. Keep training to charge another strike.'
        : 'Log exercises throughout the day. Submit them to the boss whenever you want.';
  }

  list.insertAdjacentElement('afterend', el);
}

async function submitStrike() {
  if (busy) return;
  busy = true;

  const { strike } = controls();

  try {
    if (strike) {
      strike.disabled = true;
      strike.textContent = 'Charging Strike…';
    }

    await new Promise(resolve => setTimeout(resolve, 400));

    const data = await loadSave(seedData);
    const workout = currentWorkout(data);
    const pending = pendingCount(workout);

    if (!workout || pending <= 0) {
      throw new Error('No new exercises are waiting to hit the boss.');
    }

    workout.bossStrikeRequestedCount = exerciseCount(workout);
    workout.bossStrikeRequestedAt = new Date().toISOString();

    const ok = await writeSave(data);
    if (!ok) throw new Error('LEVEL IRL could not save this strike.');

    window.dispatchEvent(new CustomEvent('fitquest:boss-strike-requested'));

    await new Promise(resolve => setTimeout(resolve, 500));
    await sync();

  } catch (error) {
    window.alert(error?.message || 'Unable to submit strike.');
  } finally {
    busy = false;
    void sync();
  }
}

async function endAdventure() {
  if (busy) return;
  busy = true;

  const { end } = controls();

  try {
    if (end) {
      end.disabled = true;
      end.textContent = 'Ending Adventure…';
    }

    await new Promise(resolve => setTimeout(resolve, 400));

    const data = await loadSave(seedData);
    const workout = currentWorkout(data);

    if (!workout || exerciseCount(workout) === 0) {
      throw new Error('Log at least one exercise first.');
    }

    if (workout.completed) return;

    // Final boss strike is always queued BEFORE the Adventure is closed.
    if (pendingCount(workout) > 0) {
      workout.bossStrikeRequestedCount = exerciseCount(workout);
      workout.bossStrikeRequestedAt = new Date().toISOString();
    }

    const oldStats = calculateStats(data);

    workout.completed = true;
    workout.completedAt = new Date().toISOString();
    workout.completionXp = getWorkoutBonus(workout);
    workout.completionSummary =
      `${exerciseCount(workout)} moves completed · +${workout.completionXp} completion XP`;

    const ok = await writeSave(data);
    if (!ok) throw new Error('LEVEL IRL could not end this Adventure.');

    const newStats = calculateStats(data);

    window.dispatchEvent(new CustomEvent('fitquest:boss-strike-requested'));
    window.dispatchEvent(new CustomEvent('fitquest:adventure-ended', {
      detail: {
        oldLevel: oldStats.level,
        newLevel: newStats.level
      }
    }));

    await new Promise(resolve => setTimeout(resolve, 550));
    await sync();

  } catch (error) {
    window.alert(error?.message || 'Unable to end Adventure.');
  } finally {
    busy = false;
    void sync();
  }
}

function inject() {
  if ($('#finishAdventureBtn') && $('#endAdventureBtn')) return true;

  const add = $('#addExerciseBtn');
  if (!add) return false;

  $('#finishAdventureBtn')?.remove();
  $('.fitquest-adventure-actions')?.remove();

  const wrap = document.createElement('div');
  wrap.className = 'fitquest-adventure-actions';

  const strike = document.createElement('button');
  strike.id = 'finishAdventureBtn';
  strike.type = 'button';
  strike.className = 'finish-adventure-btn';
  strike.textContent = '⚔️ Submit Strike';

  const end = document.createElement('button');
  end.id = 'endAdventureBtn';
  end.type = 'button';
  end.className = 'end-adventure-btn';
  end.textContent = '🏁 End Adventure';

  wrap.append(strike, end);
  add.insertAdjacentElement('beforebegin', wrap);

  strike.addEventListener('click', submitStrike);
  end.addEventListener('click', endAdventure);

  return true;
}

async function sync() {
  try {
    const data = await loadSave(seedData);
    const workout = currentWorkout(data);
    setState(workout);
    note(workout);
  } catch (error) {
    console.warn('Adventure strike UI sync failed:', error);
  }
}

function boot() {
  styles();

  let tries = 0;

  const timer = setInterval(() => {
    tries++;

    if ($('#appRoot') && !$('#appRoot').hidden && inject()) {
      clearInterval(timer);
      void sync();
    } else if (tries > 120) {
      clearInterval(timer);
    }
  }, 120);

  window.addEventListener('fitquest:remote-update', () => void sync());
  window.addEventListener('fitquest:boss-hit', () => void sync());

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'training' || event.detail?.screen === 'home') {
      void sync();
    }
  });

  let syncTimer = null;
  window.addEventListener('fitquest:saved', () => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => void sync(), 100);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
