const GAME_RE = /^\d{1,24}$/;
const UPSTREAM = 'https://twitchtracker.com/api/games/summary/';
const CACHE_SECONDS = 6 * 60 * 60;

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? `public, max-age=${CACHE_SECONDS}` : 'no-store',
      ...extraHeaders,
    },
  });
}

export async function onRequestGet(context) {
  const game = new URL(context.request.url).searchParams.get('game')?.trim() || '';
  if (!GAME_RE.test(game)) return json({ error: 'Invalid Twitch category ID.' }, 400);

  try {
    const upstream = await fetch(`${UPSTREAM}${encodeURIComponent(game)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; NerdSync/0.17.1)',
      },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
    if (!upstream.ok) {
      return json(
        { error: 'TwitchTracker did not return category data.' },
        upstream.status === 404 ? 404 : 502,
      );
    }
    const data = await upstream.json();
    return json(data, 200, { 'x-nerdsync-data-source': 'twitchtracker' });
  } catch {
    return json({ error: 'TwitchTracker is temporarily unavailable.' }, 502);
  }
}
