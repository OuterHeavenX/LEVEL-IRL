import './rpgExpansion.js';
import './progressOverview.js';
import './juiceEngine.js';
import './superJuice.js';
import './restCamp.js';
import './characterProgression.js';
import { $, $$, injectStyles, appVisible, whenReady } from './lib/dom.js';

const SCREENS = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'training', label: 'Training', icon: '⚔️' },
  { id: 'nutrition', label: 'Nutrition', icon: '🍎' },
  { id: 'activity', label: 'Activity', icon: '⌚' },
  { id: 'progress', label: 'Progress', icon: '🏆' },
  { id: 'character', label: 'Character', icon: '🧙' },
  { id: 'camp', label: 'Camp', icon: '🔥' }
];

let observer = null;
let arrangeTimer = null;

function styles() {
  injectStyles('fitquestNavigationStyles', `
    :root {
      --fq-nav-height: 74px;
    }

    #fitquestAppNav {
      position: sticky;
      top: 10px;
      z-index: 900;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 7px;
      margin: 14px 0 22px;
      padding: 7px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,.09);
      background: rgba(9, 15, 31, .88);
      box-shadow: 0 16px 44px rgba(0,0,0,.24);
      backdrop-filter: blur(18px);
    }

    .fitquest-nav-btn {
      position: relative;
      overflow: hidden;
      min-width: 0;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 10px;
      border: 0;
      border-radius: 13px;
      background: transparent;
      color: #8f9bb5;
      font: inherit;
      font-size: 12px;
      font-weight: 850;
      cursor: pointer;
      transition: .18s ease;
    }

    .fitquest-nav-btn:hover {
      background: rgba(255,255,255,.045);
      color: #e9edff;
    }

    .fitquest-nav-btn.active {
      color: #fff;
      background:
        linear-gradient(
          135deg,
          rgba(102, 111, 255, .30),
          rgba(165, 83, 244, .24)
        );
      box-shadow:
        inset 0 0 0 1px rgba(149, 124, 255, .22),
        0 8px 24px rgba(80, 60, 180, .16);
    }

    .fitquest-nav-btn.active::after {
      content: "";
      position: absolute;
      left: 18%; right: 18%; bottom: 2px;
      height: 3px;
      border-radius: 99px;
      background: linear-gradient(90deg,#68e6d2,#9e75ff,#ff78d7);
      box-shadow: 0 0 14px #8b7cff;
      animation: fqNavBeam .35s cubic-bezier(.2,.8,.2,1) both;
    }

    .fitquest-nav-icon {
      font-size: 16px;
      line-height: 1;
      transition: transform .3s cubic-bezier(.2,.9,.25,1.35), filter .3s ease;
    }

    .fitquest-nav-btn:hover .fitquest-nav-icon { transform: translateY(-2px) rotate(-5deg) scale(1.12); }
    .fitquest-nav-btn.active .fitquest-nav-icon { transform: translateY(-2px) scale(1.2); filter: drop-shadow(0 0 9px rgba(160,130,255,.8)); animation: fqNavIconPop .42s cubic-bezier(.2,.9,.2,1.35); }

    @keyframes fqNavBeam { from{transform:scaleX(0);opacity:0} to{transform:scaleX(1);opacity:1} }
    @keyframes fqNavIconPop { 0%{transform:scale(.7) rotate(-12deg)} 65%{transform:scale(1.3) rotate(5deg)} 100%{transform:translateY(-2px) scale(1.2)} }

    #fitquestScreenHost {
      min-height: 58vh;
      min-width: 0;
      max-width: 100%;
    }

    .fitquest-screen {
      display: none;
      min-width: 0;
      max-width: 100%;
      overflow-x: clip;
      animation: fqScreenIn .18s ease;
    }

    .fitquest-screen.active {
      display: grid;
      gap: 22px;
    }

    .fitquest-screen-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 22px;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    .fitquest-screen-grid > * { min-width:0!important;max-width:100%!important;width:100%; }

    .fitquest-screen > .card,
    .fitquest-screen > article,
    .fitquest-screen > section,
    .fitquest-screen-grid > .card,
    .fitquest-screen-grid > article,
    .fitquest-screen-grid > section {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
    }

    .fitquest-screen .fitquest-boss-card {
      margin: 0 !important;
    }

    .fitquest-screen-title {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 18px;
      margin: 4px 2px -4px;
    }

    .fitquest-screen-title p {
      margin: 0 0 4px;
      color: #7f8ba5;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: .16em;
      text-transform: uppercase;
    }

    .fitquest-screen-title h2 {
      margin: 0;
      font-size: clamp(22px, 3vw, 30px);
    }

    .fitquest-screen-title small {
      max-width: 420px;
      color: #8793ac;
      line-height: 1.45;
      text-align: right;
    }

    .fitquest-screen-empty {
      padding: 34px 22px;
      border-radius: 20px;
      border: 1px dashed rgba(255,255,255,.12);
      color: #7f8ba5;
      text-align: center;
    }

    .fitquest-mobile-actions {
      display: none;
    }

    .fitquest-mobile-actions:empty {
      display: none !important;
    }

    @keyframes fqScreenIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 900px) {
      .fitquest-screen-grid {
        grid-template-columns: 1fr;
      }

      .fitquest-screen-title {
        align-items: flex-start;
        flex-direction: column;
        gap: 6px;
      }

      .fitquest-screen-title small {
        text-align: left;
      }
    }

    @media (max-width: 720px) {
      body {
        padding-bottom: calc(var(--fq-nav-height) + env(safe-area-inset-bottom, 0px));
      }

      .app-shell {
        width: 100%;
        max-width: 100%;
        padding-top: calc(max(18px, env(safe-area-inset-top, 0px)) + 10px) !important;
        padding-left: max(12px, env(safe-area-inset-left, 0px)) !important;
        padding-right: max(12px, env(safe-area-inset-right, 0px)) !important;
        overflow-x: clip;
      }

      /* Compact native-app-style header */
      .topbar {
        min-height: 64px;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        margin: 0 0 12px !important;
        padding: 10px 2px 8px !important;
      }

      .topbar > div:first-child {
        min-width: 0;
      }

      .topbar > div:first-child .eyebrow {
        display: none !important;
      }

      .topbar > div:first-child h1 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 !important;
        font-size: 25px !important;
        line-height: 1 !important;
        white-space: nowrap;
      }

      .topbar .beta {
        font-size: 9px !important;
        padding: 5px 7px !important;
      }

      .header-actions {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 0 !important;
        margin: 0 !important;
        min-width: auto !important;
      }

      /* Hide global utilities on mobile. Their replacements live in tabs. */
      .header-actions #opsStatus,
      .header-actions #newWorkoutBtn {
        display: none !important;
      }

      .header-actions #levelChip {
        display: inline-flex !important;
        min-width: 70px !important;
        min-height: 48px !important;
        padding: 8px 13px !important;
        border-radius: 17px !important;
      }

      #fitquestAppNav {
        position: fixed;
        left: 10px;
        right: 10px;
        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        top: auto;
        z-index: 9990;
        margin: 0;
        grid-template-columns: repeat(7, minmax(44px, 1fr));
        gap: 3px;
        padding: 6px;
        border-radius: 19px;
        background: rgba(7, 12, 25, .94);
      }

      .fitquest-nav-btn {
        min-height: 52px;
        padding: 6px 2px;
        gap: 3px;
        flex-direction: column;
        font-size: 0;
      }

      .fitquest-nav-icon {
        font-size: 20px;
      }

      .fitquest-nav-btn.active { min-width: 62px; }
      .fitquest-nav-btn.active > span:last-child { display:block;font-size:8px;line-height:1;animation:fqLabelIn .25s ease both; }
      @keyframes fqLabelIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }

      #fitquestScreenHost {
        min-height: 72vh;
      }

      .fitquest-screen.active {
        gap: 16px;
      }

      .fitquest-screen-title {
        gap: 3px;
        margin: 0 2px -2px;
      }

      .fitquest-screen-title p {
        font-size: 9px;
      }

      .fitquest-screen-title h2 {
        font-size: 24px;
      }

      .fitquest-screen-title small {
        font-size: 12px;
        line-height: 1.4;
      }

      .fitquest-mobile-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
        gap: 9px;
        margin-top: 3px;
      }

      .fitquest-mobile-action {
        width: 100%;
        height: 64px;
        min-height: 64px;
        margin: 0 !important;
        padding: 0 14px !important;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1.15;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.045);
        color: #dce3f5;
        font: inherit;
        font-size: 12px;
        font-weight: 850;
        cursor: pointer;
      }

      .fitquest-mobile-action.is-primary {
        border-color: rgba(91, 213, 220, .24);
        background:
          linear-gradient(
            135deg,
            rgba(76, 195, 212, .16),
            rgba(108, 100, 255, .18)
          );
        color: #e8ffff;
      }

      .fitquest-mobile-action.danger {
        color: #ff9ca7;
        border-color: rgba(255, 110, 120, .20);
      }
    }

    @media (max-width: 420px) {
      #fitquestAppNav {
        left: 6px;
        right: 6px;
      }

      #fitquestAppNav { overflow-x:auto;scrollbar-width:none; }
      #fitquestAppNav::-webkit-scrollbar{display:none}

      .topbar > div:first-child h1 {
        font-size: 23px !important;
      }

      .header-actions #levelChip {
        min-width: 64px !important;
      }
    }
  `);
}

function titleFor(id) {
  const map = {
    home: [
      'COMMAND CENTER',
      'Today',
      'Your current quest, boss battle, recovery intel, and daily objectives.'
    ],
    training: [
      'TRAINING HALL',
      'Training',
      'Log moves, use your Exercise Codex, and review your workout history.'
    ],
    nutrition: [
      'PROVISIONS',
      'Nutrition',
      'Meals, macros, hydration, and food intelligence live here.'
    ],
    activity: [
      'FIELD ACTIVITY',
      'Activity',
      'Enter Apple Watch totals and turn everyday movement into campaign progress.'
    ],
    progress: [
      'CAMPAIGN ARCHIVE',
      'Progress',
      'Weekly maps, achievements, distance milestones, and your Chronicle.'
    ],
    character: [
      'PLAYER DOSSIER',
      'Character',
      'Identity, permanent stats, and the future home of classes, loot, and skill trees.'
    ],
    camp: [
      'REST CAMP',
      'Camp',
      'Between-set downtime: personal trivia, Verse of the Day, and a quiet place to reset.'
    ]
  };

  return map[id];
}

function screenTemplate(id) {
  const [eyebrow, title, help] = titleFor(id);

  const section = document.createElement('section');
  section.id = `fitquestScreen-${id}`;
  section.className = 'fitquest-screen';
  section.dataset.fitquestScreen = id;

  section.innerHTML = `
    <div class="fitquest-screen-title">
      <div>
        <p>${eyebrow}</p>
        <h2>${title}</h2>
      </div>
      <small>${help}</small>
    </div>

    <div
      class="fitquest-mobile-actions"
      id="fitquestMobileActions-${id}"
    ></div>

    <div
      class="fitquest-screen-grid"
      id="fitquestScreenGrid-${id}"
    ></div>
  `;

  return section;
}

function makeShell() {
  const main = $('#appRoot main');
  if (!main || $('#fitquestAppNav')) return false;

  const nav = document.createElement('nav');
  nav.id = 'fitquestAppNav';
  nav.setAttribute('aria-label', 'LEVEL IRL sections');

  nav.innerHTML = SCREENS.map(screen => `
    <button
      class="fitquest-nav-btn"
      type="button"
      data-fitquest-nav="${screen.id}"
      aria-controls="fitquestScreen-${screen.id}"
    >
      <span class="fitquest-nav-icon">${screen.icon}</span>
      <span>${screen.label}</span>
    </button>
  `).join('');

  const host = document.createElement('div');
  host.id = 'fitquestScreenHost';

  SCREENS.forEach(screen => {
    host.appendChild(screenTemplate(screen.id));
  });

  main.insertBefore(nav, main.firstChild);
  nav.insertAdjacentElement('afterend', host);

  $$('[data-fitquest-nav]').forEach(button => {
    button.addEventListener('click', () => {
      showScreen(button.dataset.fitquestNav);
    });
  });

  installMobileActions();

  return true;
}

function mobileActionButton({
  label,
  className = '',
  onClick
}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `fitquest-mobile-action ${className}`.trim();
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function installMobileActions() {
  const home = $('#fitquestMobileActions-home');
  const training = $('#fitquestMobileActions-training');

  if (home && !home.children.length) {
    home.appendChild(
      mobileActionButton({
        label: '⚔️ New Adventure',
        className: 'is-primary',
        onClick: () => $('#newWorkoutBtn')?.click()
      })
    );
  }

  if (training && !training.children.length) {
    training.appendChild(
      mobileActionButton({
        label: '⚔️ New Adventure',
        className: 'is-primary',
        onClick: () => $('#newWorkoutBtn')?.click()
      })
    );

    training.appendChild(
      mobileActionButton({
        label: '＋ Exercise',
        onClick: () => $('#addExerciseBtn')?.click()
      })
    );
  }
}

function grid(id) {
  return $(`#fitquestScreenGrid-${id}`);
}

function moveIfPresent(node, destination) {
  if (!node || !destination) return;
  if (node.closest('.fitquest-screen') === destination.closest('.fitquest-screen')) return;
  destination.appendChild(node);
}

function findOriginalTwoCols() {
  return [...document.querySelectorAll(
    '#appRoot main > .two-col, #fitquestScreenHost .two-col'
  )];
}

function arrange() {
  if (!$('#fitquestScreenHost')) return;

  const home = grid('home');
  const training = grid('training');
  const nutrition = grid('nutrition');
  const activity = grid('activity');
  const progress = grid('progress');
  const character = grid('character');

  // Home
  moveIfPresent($('.hero.card'), home);
  moveIfPresent($('.stats-grid'), home);
  moveIfPresent($('#fitquestBossBattle'), home);
  moveIfPresent($('.quest-card'), home);
  moveIfPresent($('.daily-checkin'), home);
  moveIfPresent($('.quest-board'), home);

  // Training
  moveIfPresent($('#exerciseCodexSection'), training);
  moveIfPresent($('#workoutHistorySection'), training);

  // Nutrition
  moveIfPresent($('.nutrition-card'), nutrition);

  // Activity
  moveIfPresent($('#fitquestDailyActivity'), activity);
  moveIfPresent($('#fitquestWeeklyActivity'), activity);

  // Character
  moveIfPresent($('.character-card'), character);

  // Progress
  const weekGrid = $('#weekGrid');
  moveIfPresent(weekGrid?.closest('.card'), progress);
  moveIfPresent($('.achievement-panel'), progress);
  moveIfPresent($('.atlas-card'), progress);
  moveIfPresent($('.mission-dossier'), progress);
  moveIfPresent($('.chronicle'), progress);

  findOriginalTwoCols().forEach(wrapper => {
    if (!wrapper.children.length) wrapper.remove();
  });

  if (
    $('#fitquestBossBattle') &&
    $('#fitquestBossBattle').parentElement !== home
  ) {
    home.appendChild($('#fitquestBossBattle'));
  }

  if (activity && !activity.querySelector('#fitquestDailyActivity')) {
    if (!activity.querySelector('.fitquest-screen-empty')) {
      const empty = document.createElement('div');
      empty.className = 'fitquest-screen-empty';
      empty.textContent = 'Loading Daily Activity…';
      activity.appendChild(empty);
    }
  } else {
    activity?.querySelector('.fitquest-screen-empty')?.remove();
  }

  installMobileActions();
}

function showScreen(id, options = {}) {
  if (!SCREENS.some(screen => screen.id === id)) id = 'home';


  $$('.fitquest-screen').forEach(screen => {
    const active = screen.dataset.fitquestScreen === id;
    screen.classList.toggle('active', active);
    screen.hidden = !active;
  });

  $$('[data-fitquest-nav]').forEach(button => {
    const active = button.dataset.fitquestNav === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });

  try {
    sessionStorage.setItem('fitquest-active-screen', id);
  } catch {}

  if (!options.noScroll) {
    if (window.innerWidth > 720) {
      $('#fitquestAppNav')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  window.dispatchEvent(new CustomEvent('fitquest:navigation', {
    detail: { screen: id }
  }));
}

function scheduleArrange() {
  clearTimeout(arrangeTimer);
  arrangeTimer = setTimeout(arrange, 80);
}

function boot() {
  styles();

  whenReady(() => appVisible() && $('#appRoot main'), () => {
    makeShell();
    arrange();

    let saved = 'home';

    try {
      saved =
        sessionStorage.getItem('fitquest-active-screen') ||
        'home';
    } catch {}

    showScreen(saved, { noScroll: true });

    observer = new MutationObserver(scheduleArrange);

    observer.observe($('#appRoot'), {
      childList: true,
      subtree: true,
      characterData: true
    });

    window.addEventListener(
      'fitquest:activity-ready',
      scheduleArrange
    );

    window.addEventListener(
      'fitquest:boss-ready',
      scheduleArrange
    );

    window.addEventListener(
      'fitquest:history-ready',
      scheduleArrange
    );
  }, 120);
}

export function navigateFitQuest(screen) {
  showScreen(screen);
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
