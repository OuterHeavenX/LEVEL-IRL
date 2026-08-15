const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

let audioContext = null;
let muted = localStorage.getItem('fitquest-sound-muted') === 'true';

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function tone(frequency = 440, duration = .08, type = 'sine', volume = .035, delay = 0) {
  if (muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.08, start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  } catch {}
}

function sound(kind) {
  if (kind === 'nav') {
    tone(280, .07, 'triangle', .025);
    tone(520, .11, 'sine', .025, .045);
  } else if (kind === 'success') {
    [392, 523, 659].forEach((note, index) => tone(note, .16, 'triangle', .035, index * .07));
  } else if (kind === 'impact') {
    tone(95, .16, 'sawtooth', .05);
    tone(55, .2, 'square', .025, .025);
  } else {
    tone(360, .055, 'sine', .018);
  }
}

function styles() {
  const style = document.createElement('style');
  style.id = 'fitquestSuperJuiceStyles';
  style.textContent = `
    body{overscroll-behavior:none}
    body::after{content:"";position:fixed;inset:-30%;z-index:-1;pointer-events:none;background:conic-gradient(from 0deg at 50% 50%,transparent,#7f63ff0c,transparent,#42d9bd0b,transparent);animation:fqAurora 24s linear infinite}
    @keyframes fqAurora{to{transform:rotate(360deg)}}
    .card,.fitquest-boss-card,.history-day,.codex-tile{transform:translateZ(0);transition:transform .28s cubic-bezier(.2,.8,.2,1),border-color .25s,box-shadow .25s;will-change:transform}
    @media(hover:hover){.card:hover,.history-day:hover{transform:translateY(-3px);border-color:rgba(139,124,255,.24);box-shadow:0 22px 60px rgba(0,0,0,.36),0 0 25px rgba(139,124,255,.07)}}
    .fq-ripple{position:fixed;z-index:150000;width:12px;height:12px;border:2px solid rgba(151,132,255,.65);border-radius:50%;pointer-events:none;animation:fqRipple .58s ease-out forwards}
    @keyframes fqRipple{to{opacity:0;transform:translate(-50%,-50%) scale(6)}}
    .fq-nav-spark{position:fixed;z-index:149999;width:5px;height:5px;border-radius:50%;pointer-events:none;background:#9b83ff;box-shadow:0 0 10px currentColor;animation:fqNavSpark .62s ease-out forwards}
    @keyframes fqNavSpark{to{opacity:0;transform:translate(var(--x),var(--y)) scale(.2)}}
    .fitquest-screen.active>.fitquest-screen-title{animation:fqTitleSlash .48s cubic-bezier(.18,.85,.2,1) both}
    .fitquest-screen.active>.fitquest-screen-grid>*{animation:fqCardDeal .5s cubic-bezier(.18,.85,.2,1) both;animation-delay:calc(var(--fq-index,0)*55ms)}
    @keyframes fqTitleSlash{from{opacity:0;transform:translateX(-22px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
    @keyframes fqCardDeal{from{opacity:0;transform:translateY(18px) scale(.975)}to{opacity:1;transform:none}}
    .fitquest-score-chart.animate .line{stroke-dasharray:1000;stroke-dashoffset:1000;animation:fqDrawGraph 1.35s cubic-bezier(.2,.75,.2,1) forwards}
    .fitquest-score-chart.animate .area{animation:fqGraphGlow 1.2s .35s ease both}
    .fitquest-score-chart.animate .point{animation:fqPointPop .35s ease both}
    .fitquest-score-chart .point{transform-box:fill-box;transform-origin:center;transition:r .2s,filter .2s}
    .fitquest-score-chart .point:hover{r:7;filter:drop-shadow(0 0 6px #9e6cff)}
    @keyframes fqDrawGraph{to{stroke-dashoffset:0}}@keyframes fqGraphGlow{from{opacity:0}to{opacity:1}}@keyframes fqPointPop{from{transform:scale(0)}to{transform:scale(1)}}
    .stat strong,.fitquest-score-number,#levelValue{display:inline-block;transition:transform .2s,color .2s}.fq-value-pop{animation:fqValuePop .42s cubic-bezier(.2,.9,.2,1.4)}
    @keyframes fqValuePop{50%{transform:scale(1.18);color:#82f4bd;text-shadow:0 0 15px #44d7b666}}
    #fitquestSoundToggle{position:fixed;right:96px;top:calc(max(12px, env(safe-area-inset-top,0px)) + 9px);bottom:auto;z-index:9988;width:40px;height:40px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(8,14,29,.88);color:#dbe2f5;backdrop-filter:blur(14px);box-shadow:0 12px 32px #0006;cursor:pointer;font-size:16px;transition:.2s}
    #fitquestSoundToggle:hover{transform:scale(1.08) rotate(-5deg);border-color:#8b7cff88}
    .primary,.ghost,.new-workout,.fitquest-boss-strike,.finish-adventure-btn,.end-adventure-btn{position:relative;overflow:hidden;transition:transform .16s,filter .16s,box-shadow .16s}
    .primary:active,.ghost:active,.new-workout:active,.fitquest-boss-strike:active,.finish-adventure-btn:active,.end-adventure-btn:active{transform:scale(.96);filter:brightness(1.2)}
    @media(min-width:721px){#fitquestSoundToggle{right:18px;top:auto;bottom:18px}}
    @media(prefers-reduced-motion:reduce){body::after,.fitquest-screen.active>*,.fitquest-score-chart *{animation:none!important}.card,.history-day{transition:none!important}}
  `;
  document.head.appendChild(style);
}

function ripple(event) {
  if (reducedMotion()) return;
  const node = document.createElement('i');
  node.className = 'fq-ripple';
  node.style.left = `${event.clientX}px`;
  node.style.top = `${event.clientY}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 700);
}

function navSparks(button) {
  if (reducedMotion()) return;
  const box = button.getBoundingClientRect();
  for (let i = 0; i < 9; i++) {
    const spark = document.createElement('i');
    spark.className = 'fq-nav-spark';
    spark.style.left = `${box.left + box.width / 2}px`;
    spark.style.top = `${box.top + box.height / 2}px`;
    spark.style.setProperty('--x', `${Math.cos(i / 9 * Math.PI * 2) * (20 + Math.random() * 22)}px`);
    spark.style.setProperty('--y', `${Math.sin(i / 9 * Math.PI * 2) * (16 + Math.random() * 20)}px`);
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 700);
  }
}

function installSoundToggle() {
  if ($('#fitquestSoundToggle')) return;
  const button = document.createElement('button');
  button.id = 'fitquestSoundToggle';
  button.type = 'button';
  button.title = muted ? 'Turn interface sounds on' : 'Mute interface sounds';
  button.setAttribute('aria-label', button.title);
  button.textContent = muted ? '🔇' : '🔊';
  button.addEventListener('click', event => {
    event.stopPropagation();
    muted = !muted;
    localStorage.setItem('fitquest-sound-muted', String(muted));
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? 'Turn interface sounds on' : 'Mute interface sounds';
    button.setAttribute('aria-label', button.title);
    if (!muted) sound('success');
  });
  document.body.appendChild(button);
}

function staggerCards() {
  $$('.fitquest-screen.active .fitquest-screen-grid > *').forEach((card, index) => {
    card.style.setProperty('--fq-index', index);
  });
}

function stopPinchZoom() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(name =>
    document.addEventListener(name, event => event.preventDefault(), { passive: false })
  );
  document.addEventListener('touchmove', event => {
    if (event.touches?.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('wheel', event => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false });
}

function boot() {
  styles();
  stopPinchZoom();
  installSoundToggle();

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('button,.interactive,.codex-tile,[role="button"]')) return;
    ripple(event);
    sound('tap');
  });

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-fitquest-nav]');
    if (nav) {
      sound('nav');
      navSparks(nav);
    }
  });

  window.addEventListener('fitquest:navigation', staggerCards);
  window.addEventListener('fitquest:boss-hit', () => sound('impact'));
  window.addEventListener('fitquest:adventure-ended', () => sound('success'));

  const observer = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type !== 'characterData') return;
      const parent = record.target.parentElement;
      if (!parent?.matches('.stat strong,#levelValue')) return;
      parent.classList.remove('fq-value-pop');
      requestAnimationFrame(() => parent.classList.add('fq-value-pop'));
    });
  });
  observer.observe(document.body, { subtree: true, characterData: true });
  staggerCards();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
