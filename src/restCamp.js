const $ = selector => document.querySelector(selector);

const TRIVIA = [
  { category:'Metal Gear Solid', q:'What is the codename of the operative sent to Shadow Moses Island?', a:['Solid Snake','Raiden','Gray Fox','Liquid Ocelot'], correct:0, note:'Solid Snake is pulled out of retirement for the Shadow Moses mission.' },
  { category:'Metal Gear Solid', q:'What organization seizes Shadow Moses at the beginning of Metal Gear Solid?', a:['FOXHOUND','Cipher','The Patriots','Diamond Dogs'], correct:0, note:'The rogue FOXHOUND unit takes control of the nuclear disposal facility.' },
  { category:'Metal Gear Solid', q:'Which character is known as the cyborg ninja in the original Metal Gear Solid?', a:['Gray Fox','Vulcan Raven','Psycho Mantis','Decoy Octopus'], correct:0, note:'Gray Fox returns as the mysterious cyborg ninja.' },
  { category:'Metal Gear Solid', q:'What is the name of the bipedal nuclear-capable weapon central to the Shadow Moses crisis?', a:['Metal Gear REX','Metal Gear RAY','Shagohod','Sahelanthropus'], correct:0, note:'REX is the nuclear-capable Metal Gear developed at Shadow Moses.' },
  { category:'Metal Gear Solid', q:'Which FOXHOUND member is famous for psychic abilities?', a:['Psycho Mantis','Sniper Wolf','Vulcan Raven','Revolver Ocelot'], correct:0, note:'Psycho Mantis is the psychic specialist of FOXHOUND.' },

  { category:'The Godfather', q:'Who is the youngest son of Vito Corleone?', a:['Michael','Sonny','Fredo','Tom'], correct:0, note:'Michael begins the story as the son who appears least involved in the family business.' },
  { category:'The Godfather', q:'What is the Corleone family business front associated with Vito?', a:['Genco Pura Olive Oil','Corleone Shipping','Sicilian Imports','Empire Produce'], correct:0, note:'Genco Pura Olive Oil is the legitimate company associated with the Corleone family.' },
  { category:'The Godfather', q:'Who serves as Vito Corleone’s consigliere?', a:['Tom Hagen','Peter Clemenza','Sal Tessio','Luca Brasi'], correct:0, note:'Tom Hagen is the family lawyer and consigliere.' },
  { category:'The Godfather', q:'Which Corleone brother is known for his explosive temper?', a:['Sonny','Fredo','Michael','Tom'], correct:0, note:'Sonny’s temper is one of his defining characteristics.' },
  { category:'The Godfather', q:'Where does Michael hide after the restaurant killings?', a:['Sicily','Las Vegas','Havana','New York'], correct:0, note:'Michael is sent to Sicily while the heat dies down in America.' },

  { category:'Fight Club', q:'What is the narrator’s job connected to?', a:['Automobile recall investigations','Advertising','Insurance sales','Restaurant management'], correct:0, note:'His work involves evaluating automobile accidents and recall costs.' },
  { category:'Fight Club', q:'What underground activity gives the story its title?', a:['Bare-knuckle fighting','Boxing tournaments','Street racing','Wrestling'], correct:0, note:'The secret bare-knuckle fights become the foundation of the club.' },
  { category:'Fight Club', q:'What larger movement grows out of the fight clubs?', a:['Project Mayhem','Operation Chaos','Project Tyler','Mayhem Protocol'], correct:0, note:'Project Mayhem grows into a highly organized anti-establishment campaign.' },
  { category:'Fight Club', q:'What product do Tyler and the narrator famously make together?', a:['Soap','Candles','Leather goods','Coffee'], correct:0, note:'Soap-making becomes both a business and a recurring symbol in the story.' },
  { category:'Fight Club', q:'Who is the woman central to both the narrator and Tyler’s lives?', a:['Marla Singer','Chloe','Angel Face','Liz'], correct:0, note:'Marla Singer becomes entangled with both sides of the central relationship.' },

  { category:'Movies', q:'In The Matrix, which pill does Neo take to learn the truth?', a:['Red','Blue','White','Black'], correct:0, note:'The red pill commits Neo to discovering the reality behind the Matrix.' },
  { category:'Movies', q:'In Terminator 2, what model is the protector sent back for John Connor?', a:['T-800','T-1000','T-X','Rev-9'], correct:0, note:'A reprogrammed T-800 is sent to protect John.' },
  { category:'Games', q:'Which company created the original PlayStation?', a:['Sony','Nintendo','Sega','Atari'], correct:0, note:'Sony launched the original PlayStation in Japan in 1994.' },
  { category:'Games', q:'What is the name of the main protagonist of the first Halo trilogy?', a:['Master Chief','Marcus Fenix','Commander Shepard','Sam Fisher'], correct:0, note:'Master Chief John-117 is the central Spartan protagonist.' },
  { category:'Games', q:'Which stealth series stars Sam Fisher?', a:['Splinter Cell','Hitman','Syphon Filter','Thief'], correct:0, note:'Sam Fisher is the lead operative of the Splinter Cell series.' }
];

let state = {
  question: null,
  answered: false,
  correct: 0,
  total: 0,
  category: 'All'
};

function styles() {
  if ($('#fitquestRestCampStyles')) return;
  const s = document.createElement('style');
  s.id = 'fitquestRestCampStyles';
  s.textContent = `
    .fq-camp-card{width:100%;min-width:0;max-width:100%;overflow:hidden;padding:22px;border-radius:22px;border:1px solid rgba(255,255,255,.08);background:rgba(15,22,41,.94)}
    .fq-camp-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px}
    .fq-camp-head h3{margin:3px 0 0}.fq-camp-head p{margin:0;color:#8c98b2;font-size:11px;font-weight:900;letter-spacing:.13em}
    .fq-camp-score{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.05);color:#9ba8c0;font-size:10px;font-weight:900;white-space:nowrap}
    .fq-categories{display:flex;width:100%;max-width:100%;gap:7px;overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:none;padding-bottom:5px;margin-bottom:15px}.fq-categories::-webkit-scrollbar{display:none}
    .fq-category{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:#9ca8bf;border-radius:999px;padding:7px 10px;font:inherit;font-size:10px;font-weight:850;white-space:nowrap;cursor:pointer}
    .fq-category.active{color:#fff;border-color:rgba(142,116,255,.3);background:rgba(122,94,255,.16)}
    .fq-question{max-width:100%;overflow-wrap:anywhere;font-size:clamp(20px,4vw,28px);line-height:1.25;margin:5px 0 17px}
    .fq-answers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
    .fq-answer{width:100%;min-width:0;min-height:52px;overflow-wrap:anywhere;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:#e9edfa;font:inherit;font-weight:800;text-align:left;cursor:pointer}
    .fq-answer.correct{border-color:rgba(105,232,177,.34);background:rgba(105,232,177,.12);color:#a8f3d1}.fq-answer.wrong{border-color:rgba(255,104,115,.32);background:rgba(255,104,115,.1);color:#ffb4ba}
    .fq-trivia-note{margin-top:13px;color:#9ba7bd;font-size:12px;line-height:1.5}
    .fq-next{width:100%;min-height:46px;margin-top:13px;border:0;border-radius:13px;background:linear-gradient(135deg,#676bff,#a954ec);color:white;font:inherit;font-weight:950;cursor:pointer}
    .fq-verse-shell{display:grid;gap:14px}.fq-verse-ref{color:#a992ff;font-size:12px;font-weight:950;letter-spacing:.08em}.fq-verse-text{font-family:Georgia,serif;font-size:clamp(21px,4vw,29px);line-height:1.55;color:#f3f1ff}
    .fq-bible-state{padding:15px;border-radius:15px;background:rgba(255,255,255,.04);color:#9ba7bd;font-size:12px;line-height:1.55}
    .fq-bible-actions{display:flex;gap:9px;flex-wrap:wrap}.fq-bible-btn{min-height:44px;padding:0 14px;border-radius:13px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.045);color:#e6eafa;font:inherit;font-weight:850;cursor:pointer}
    .fq-bible-btn.primary{border:0;background:linear-gradient(135deg,#676bff,#a954ec);color:white}.fq-bible-reader{max-height:55vh;overflow:auto;padding:16px;border-radius:16px;background:rgba(5,10,22,.55);color:#dce2ef;line-height:1.75;white-space:pre-wrap}
    .fq-attribution{font-size:9px;color:#68758e;line-height:1.4}
    @media(max-width:720px){.fq-answers{grid-template-columns:minmax(0,1fr)}.fq-camp-card{padding:16px}.fq-camp-head{min-width:0}.fq-camp-head>div{min-width:0}}
  `;
  document.head.appendChild(s);
}

function categories() {
  return ['All', ...new Set(TRIVIA.map(q => q.category))];
}

function chooseQuestion() {
  const pool = state.category === 'All'
    ? TRIVIA
    : TRIVIA.filter(q => q.category === state.category);
  const candidates = pool.filter(q => q !== state.question);
  state.question = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  state.answered = false;
}

function shuffleAnswers(q) {
  return q.a.map((text, i) => ({text, correct:i === q.correct}))
    .sort(() => Math.random() - .5);
}

function renderTrivia() {
  const host = $('#fqTriviaBody');
  if (!host) return;
  if (!state.question) chooseQuestion();
  const q = state.question;
  const answers = shuffleAnswers(q);

  host.innerHTML = `
    <div class="fq-categories">
      ${categories().map(c => `<button class="fq-category ${c===state.category?'active':''}" data-cat="${c}" type="button">${c}</button>`).join('')}
    </div>
    <div class="fq-verse-ref">${q.category.toUpperCase()}</div>
    <div class="fq-question">${q.q}</div>
    <div class="fq-answers">
      ${answers.map(a => `<button class="fq-answer" type="button" data-correct="${a.correct}">${a.text}</button>`).join('')}
    </div>
    <div id="fqTriviaResult"></div>
  `;

  host.querySelectorAll('[data-cat]').forEach(btn => btn.addEventListener('click', () => {
    state.category = btn.dataset.cat;
    chooseQuestion();
    renderTrivia();
  }));

  host.querySelectorAll('.fq-answer').forEach(btn => btn.addEventListener('click', () => {
    if (state.answered) return;
    state.answered = true;
    state.total++;
    const correct = btn.dataset.correct === 'true';
    if (correct) state.correct++;

    host.querySelectorAll('.fq-answer').forEach(b => {
      if (b.dataset.correct === 'true') b.classList.add('correct');
    });
    if (!correct) btn.classList.add('wrong');

    $('#fqTriviaScore').textContent = `${state.correct} / ${state.total}`;
    $('#fqTriviaResult').innerHTML = `
      <div class="fq-trivia-note"><strong>${correct ? '✓ Correct.' : 'Not this time.'}</strong> ${q.note}</div>
      <button class="fq-next" id="fqNextTrivia" type="button">Next Question →</button>
    `;
    $('#fqNextTrivia')?.addEventListener('click', () => {
      chooseQuestion();
      renderTrivia();
    });
  }));
}

async function loadVerse() {
  const stateEl = $('#fqBibleState');
  const content = $('#fqBibleContent');
  if (!stateEl || !content) return;

  stateEl.textContent = 'Loading today’s YouVersion selection…';
  content.hidden = true;

  try {
    const response = await fetch('/api/youversion/votd', { credentials:'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    $('#fqVerseRef').textContent = data.reference || data.passage_id || 'Verse of the Day';
    $('#fqVerseText').textContent = data.content || '';
    $('#fqBibleCopyright').textContent = data.copyright || 'Bible text provided through YouVersion.';
    $('#fqReadChapter').dataset.chapter = data.chapter_id || '';
    $('#fqReadChapter').dataset.bibleId = data.bible_id || '';
    stateEl.hidden = true;
    content.hidden = false;
  } catch (error) {
    stateEl.hidden = false;
    stateEl.innerHTML = `
      <strong>📖 Verse of the Day is temporarily unavailable.</strong><br>
      ${String(error?.message || 'FitQuest could not reach YouVersion.')}
    `;
  }
}

async function readChapter(chapterId, bibleId = '') {
  if (!chapterId) return;
  const reader = $('#fqBibleReader');
  const btn = $('#fqReadChapter');
  if (!reader || !btn) return;

  btn.disabled = true;
  btn.textContent = 'Loading Chapter…';

  try {
    const params = new URLSearchParams({ id: chapterId });
    if (bibleId) params.set('bible_id', bibleId);

    const response = await fetch(
      `/api/youversion/chapter?${params.toString()}`,
      { credentials:'include' }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    reader.hidden = false;
    reader.textContent = data.content || 'Chapter unavailable.';

    if (data.copyright) {
      $('#fqBibleCopyright').textContent = data.copyright;
    }
  } catch (error) {
    reader.hidden = false;
    reader.textContent =
      `Unable to load the chapter right now. ${String(error?.message || '')}`.trim();
  } finally {
    btn.disabled = false;
    btn.textContent = '📖 Read Full Chapter';
  }
}

function renderCamp() {
  const grid = $('#fitquestScreenGrid-camp');
  if (!grid || $('#fitquestRestCamp')) return;

  const section = document.createElement('div');
  section.id = 'fitquestRestCamp';
  section.style.display = 'contents';
  section.innerHTML = `
    <article class="fq-camp-card">
      <div class="fq-camp-head">
        <div><p>🎮 BETWEEN-SET TRIVIA</p><h3>Personal Trivia</h3></div>
        <span class="fq-camp-score" id="fqTriviaScore">0 / 0</span>
      </div>
      <div id="fqTriviaBody"></div>
    </article>

    <article class="fq-camp-card">
      <div class="fq-camp-head">
        <div><p>📖 DAILY WORD</p><h3>Verse of the Day</h3></div>
        <span class="fq-camp-score">YOUVERSION</span>
      </div>

      <div class="fq-verse-shell">
        <div class="fq-bible-state" id="fqBibleState">Preparing Verse of the Day…</div>

        <div id="fqBibleContent" hidden>
          <div class="fq-verse-ref" id="fqVerseRef"></div>
          <div class="fq-verse-text" id="fqVerseText"></div>
          <div class="fq-bible-actions">
            <button class="fq-bible-btn primary" id="fqReadChapter" type="button">📖 Read Full Chapter</button>
            <button class="fq-bible-btn" id="fqReloadVerse" type="button">↻ Refresh</button>
          </div>
          <div class="fq-bible-reader" id="fqBibleReader" hidden></div>
          <div class="fq-attribution" id="fqBibleCopyright"></div>
        </div>
      </div>
    </article>
  `;

  grid.appendChild(section);
  renderTrivia();
  loadVerse();

  $('#fqReloadVerse')?.addEventListener('click', loadVerse);
  $('#fqReadChapter')?.addEventListener('click', event => {
    readChapter(
      event.currentTarget.dataset.chapter,
      event.currentTarget.dataset.bibleId
    );
  });
}

function boot() {
  styles();

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if ($('#fitquestScreenGrid-camp')) {
      clearInterval(timer);
      renderCamp();
    } else if (attempts > 140) clearInterval(timer);
  }, 120);

  window.addEventListener('fitquest:navigation', event => {
    if (event.detail?.screen === 'camp') renderCamp();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}
