const YV_BASE = 'https://api.youversion.com/v1';
const DEFAULT_BIBLE_ID = 3034; // Berean Standard Bible (fallback)

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, max-age=300',
      ...headers
    }
  });
}

function yvHeaders(env) {
  if (!env.YOUVERSION_APP_KEY) {
    throw new Error('YOUVERSION_APP_KEY is not configured.');
  }

  return {
    'Accept': 'application/json',
    'X-YVP-App-Key': env.YOUVERSION_APP_KEY
  };
}

async function yvFetch(env, path) {
  const response = await fetch(`${YV_BASE}${path}`, {
    headers: yvHeaders(env)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(
      'YouVersion API error:',
      response.status,
      path,
      body.slice(0, 500)
    );

    const error = new Error(
      response.status === 401
        ? 'YouVersion rejected the App Key.'
        : `YouVersion request failed (${response.status}).`
    );

    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start +
    (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000;

  return Math.floor(diff / 86400000);
}

function chapterFromPassageId(passageId) {
  const match = String(passageId || '')
    .toUpperCase()
    .match(/^([1-3]?[A-Z]{2,3})\.(\d+)/);

  if (!match) return null;
  return `${match[1]}.${match[2]}`;
}

// The Bible list rarely changes, so reuse the choice within a Worker instance.
const BIBLE_CACHE_MS = 6 * 60 * 60 * 1000;
let cachedBible = null;

async function chooseBible(env) {
  if (cachedBible && Date.now() - cachedBible.at < BIBLE_CACHE_MS) return cachedBible.id;
  const id = await lookupBible(env);
  cachedBible = { id, at: Date.now() };
  return id;
}

async function lookupBible(env) {
  // The App Key only returns Bible versions available to this app.
  try {
    const collection = await yvFetch(
      env,
      '/bibles?language_ranges=en&page_size=100'
    );

    const bibles = Array.isArray(collection?.data)
      ? collection.data
      : [];

    if (!bibles.length) return DEFAULT_BIBLE_ID;

    const preferred =
      bibles.find(b => Number(b.id) === 3034) || // BSB
      bibles.find(b => Number(b.id) === 206) ||  // WEBUS
      bibles.find(b => Number(b.id) === 111) ||  // NIV if licensed
      bibles[0];

    return Number(preferred.id) || DEFAULT_BIBLE_ID;
  } catch {
    return DEFAULT_BIBLE_ID;
  }
}

async function bibleMeta(env, bibleId) {
  try {
    const bible = await yvFetch(env, `/bibles/${bibleId}`);

    return {
      id: Number(bible?.id) || bibleId,
      abbreviation: bible?.abbreviation || '',
      title: bible?.title || bible?.localized_title || '',
      copyright: bible?.copyright || '',
      promotional_content: bible?.promotional_content || '',
      youversion_deep_link: bible?.youversion_deep_link || ''
    };
  } catch {
    return {
      id: bibleId,
      abbreviation: '',
      title: '',
      copyright: 'Bible text provided through YouVersion.',
      promotional_content: '',
      youversion_deep_link: ''
    };
  }
}

async function passage(env, bibleId, passageId) {
  const encoded = encodeURIComponent(passageId);
  return yvFetch(
    env,
    `/bibles/${bibleId}/passages/${encoded}?format=text&include_headings=true`
  );
}

async function verseOfDay(request, env) {
  // Prefer the player's local day (sent by the client) over the Worker's UTC clock.
  const requested = Number(new URL(request.url).searchParams.get('day'));
  const day = Number.isInteger(requested) && requested >= 1 && requested <= 366
    ? requested
    : dayOfYear();
  const selection = await yvFetch(env, `/verse_of_the_days/${day}`);

  if (!selection?.passage_id) {
    return json(
      { ok: false, error: 'No Verse of the Day was returned.' },
      502
    );
  }

  const bibleId = await chooseBible(env);
  const [verse, meta] = await Promise.all([
    passage(env, bibleId, selection.passage_id),
    bibleMeta(env, bibleId)
  ]);

  const chapterId = chapterFromPassageId(selection.passage_id);

  return json({
    ok: true,
    day,
    bible_id: bibleId,
    bible: meta,
    passage_id: selection.passage_id,
    chapter_id: chapterId,
    reference: verse?.reference || selection.passage_id,
    content: verse?.content || '',
    copyright: meta.copyright || 'Bible text provided through YouVersion.'
  });
}

async function chapter(request, env, url) {
  const chapterId = String(url.searchParams.get('id') || '')
    .trim()
    .toUpperCase();

  if (!/^[1-3]?[A-Z]{2,3}\.\d+$/.test(chapterId)) {
    return json(
      { ok: false, error: 'Invalid chapter identifier.' },
      400
    );
  }

  const requestedBibleId =
    Number(url.searchParams.get('bible_id')) || 0;

  const bibleId =
    requestedBibleId > 0
      ? requestedBibleId
      : await chooseBible(env);

  const [chapterPassage, meta] = await Promise.all([
    passage(env, bibleId, chapterId),
    bibleMeta(env, bibleId)
  ]);

  return json({
    ok: true,
    bible_id: bibleId,
    bible: meta,
    chapter_id: chapterId,
    reference: chapterPassage?.reference || chapterId,
    content: chapterPassage?.content || '',
    copyright: meta.copyright || 'Bible text provided through YouVersion.'
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (
        url.pathname === '/api/youversion/votd' &&
        request.method === 'GET'
      ) {
        return await verseOfDay(request, env);
      }

      if (
        url.pathname === '/api/youversion/chapter' &&
        request.method === 'GET'
      ) {
        return await chapter(request, env, url);
      }
    } catch (error) {
      console.error('LEVEL IRL YouVersion route error:', error);

      return json(
        {
          ok: false,
          error:
            error?.message ||
            'Unable to load Bible content right now.'
        },
        error?.status === 401 ? 502 : 500
      );
    }

    return env.ASSETS.fetch(request);
  }
};
