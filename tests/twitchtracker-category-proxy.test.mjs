import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/twitchtracker-category-summary.js';

test('category proxy sends only a public Twitch category ID and never forwards authorization', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl = '';
  let upstreamOptions = null;
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url);
    upstreamOptions = options;
    return new Response(JSON.stringify({ avg_viewers:2000, avg_channels:100 }), { status:200, headers:{ 'content-type':'application/json' } });
  };
  try {
    const request = new Request('https://nerdsync.test/api/twitchtracker-category-summary?game=27471', {
      headers:{ Authorization:'Bearer never-forward-this' },
    });
    const response = await onRequestGet({ request });
    assert.equal(response.status, 200);
    assert.equal(upstreamUrl, 'https://twitchtracker.com/api/games/summary/27471');
    const headers = new Headers(upstreamOptions.headers);
    assert.equal(headers.has('authorization'), false);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=21600');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('category proxy rejects non-numeric category IDs', async () => {
  const response = await onRequestGet({ request:new Request('https://nerdsync.test/api/twitchtracker-category-summary?game=bad-name') });
  assert.equal(response.status, 400);
});
