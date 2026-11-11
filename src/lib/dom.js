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

export function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Show a message in the shared #toast element.
export function toast(message, duration = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__fitquestToast);
  window.__fitquestToast = setTimeout(() => el.classList.remove('show'), duration);
}
