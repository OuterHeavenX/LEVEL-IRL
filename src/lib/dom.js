// Small helpers shared by every LEVEL IRL module.

export const $ = selector => document.querySelector(selector);

export const $$ = selector => [...document.querySelectorAll(selector)];

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };

export const escapeHtml = value =>
  String(value ?? '').replace(/[&<>'"]/g, c => HTML_ESCAPES[c]);

// Today's date (or the given date) as YYYY-MM-DD in the player's local time zone.
export const localDateISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Parse a YYYY-MM-DD string at local noon so time zones never shift the day.
export const dateFromISO = iso => new Date(`${iso}T12:00:00`);

export function addDays(iso, amount) {
  const d = dateFromISO(iso);
  d.setDate(d.getDate() + amount);
  return localDateISO(d);
}

export const weekdayName = iso =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateFromISO(iso));

// The Monday that starts the week containing `iso`.
export const mondayOf = iso => addDays(iso, -((dateFromISO(iso).getDay() + 6) % 7));

// The seven dates of that week, Monday to Sunday.
export const weekDatesOf = iso => {
  const monday = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

// Accepts a Date, an ISO string or a timestamp.
export const timeLabel = (when = new Date()) =>
  new Date(when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// e.g. 'Wednesday, Nov 11'.
export const shortDateLabel = iso =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(dateFromISO(iso));

// The day the app is showing; app.js sets it when the player opens a past day.
export const activeDateISO = () => document.documentElement.dataset.activeDate || localDateISO();

// Day numbers follow date order, so a backfilled day slots into place. Any
// number already stored in the title is ignored. Returns plain text.
export function dayTitle(workouts, workout) {
  const n = (workouts || []).filter(x => x?.date && x.date < workout.date).length + 1;
  const name = String(workout.title || '').replace(/^Day \d+:\s*/, '') || 'A New Adventure';
  return `Day ${n}: ${name}`;
}

export function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const TOAST_CSS = `
  .fitquest-toast-feed {
    position: fixed;
    z-index: 160000;
    right: calc(env(safe-area-inset-right, 0px) + 20px);
    bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
    width: min(340px, calc(100vw - 40px));
    display: grid;
    gap: 8px;
    pointer-events: none;
  }
  .fitquest-toast {
    display: flex;
    gap: 11px;
    align-items: center;
    padding: 11px 14px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(8,14,29,.95);
    box-shadow: 0 18px 60px rgba(0,0,0,.34);
    backdrop-filter: blur(16px);
    color: #f2f5ff;
    pointer-events: auto;
    animation: fitquestToastIn .22s ease-out;
  }
  .fitquest-toast-icon {
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: rgba(255,255,255,.055);
    font-size: 19px;
  }
  .fitquest-toast-copy { min-width: 0; }
  .fitquest-toast-copy strong,
  .fitquest-toast-copy small { display: block; overflow-wrap: anywhere; }
  .fitquest-toast-copy strong { font-size: 13px; line-height: 1.25; }
  .fitquest-toast-copy small { margin-top: 3px; color: #8e9bb5; font-size: 11px; line-height: 1.3; }
  .fitquest-toast.is-xp { border-color: rgba(105,232,177,.32); }
  .fitquest-toast.is-xp .fitquest-toast-icon { background: rgba(105,232,177,.12); }
  .fitquest-toast.is-rare { border-color: rgba(172,112,255,.36); }
  .fitquest-toast.is-rare .fitquest-toast-icon { background: rgba(172,112,255,.14); }
  .fitquest-toast.is-damage { border-color: rgba(255,111,120,.34); }
  .fitquest-toast.is-damage .fitquest-toast-icon { background: rgba(255,111,120,.13); }
  .fitquest-toast.is-warn { border-color: rgba(255,196,92,.38); }
  .fitquest-toast.is-warn .fitquest-toast-icon { background: rgba(255,196,92,.13); }
  @keyframes fitquestToastIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 720px) {
    .fitquest-toast-feed {
      left: calc(env(safe-area-inset-left, 0px) + 14px);
      right: calc(env(safe-area-inset-right, 0px) + 14px);
      width: auto;
      bottom: calc(var(--fq-nav-height, 74px) + env(safe-area-inset-bottom, 0px) + 12px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fitquest-toast { animation: none; }
  }
`;

const MAX_TOASTS = 3;

// The one notifier for every module. `opts` is a duration in ms or
// { icon, detail, tone: ''|'xp'|'rare'|'damage'|'warn', duration }.
export function toast(message, opts = {}) {
  const { icon = '', detail = '', tone = '', duration = 3000 } =
    typeof opts === 'number' ? { duration: opts } : (opts || {});
  if (!document.body) return;
  injectStyles('fitquestToastStyles', TOAST_CSS);
  let feed = document.getElementById('fitquestToastFeed');
  if (!feed) {
    feed = document.createElement('div');
    feed.id = 'fitquestToastFeed';
    feed.className = 'fitquest-toast-feed';
    feed.setAttribute('role', 'status');
    feed.setAttribute('aria-live', 'polite');
    document.body.appendChild(feed);
  }
  const item = document.createElement('div');
  item.className = tone ? `fitquest-toast is-${tone}` : 'fitquest-toast';
  if (icon) {
    const iconEl = document.createElement('span');
    iconEl.className = 'fitquest-toast-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = icon;
    item.appendChild(iconEl);
  }
  const copy = document.createElement('div');
  copy.className = 'fitquest-toast-copy';
  const title = document.createElement('strong');
  title.textContent = String(message ?? '');
  copy.appendChild(title);
  if (detail) {
    const small = document.createElement('small');
    small.textContent = String(detail);
    copy.appendChild(small);
  }
  item.appendChild(copy);
  feed.prepend(item);
  while (feed.children.length > MAX_TOASTS) feed.lastElementChild.remove();
  setTimeout(() => item.remove(), Number(duration) || 3000);
}

// Add a module's stylesheet to <head> once.
export function injectStyles(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

// True once app.js has loaded the save and revealed the app.
export const appVisible = () => {
  const root = document.getElementById('appRoot');
  return Boolean(root && !root.hidden);
};

// Run `onReady` once `isReady()` passes, checking every 120 ms (up to ~17 s).
// Modules use this to wait for the app or a screen to exist before mounting.
export function whenReady(isReady, onReady, attempts = 140) {
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (isReady()) {
      clearInterval(timer);
      onReady();
    } else if (tries > attempts) {
      clearInterval(timer);
    }
  }, 120);
}
