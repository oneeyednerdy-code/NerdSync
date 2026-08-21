import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/twitchtracker-summary.js';

test('proxy sends only the public channel lookup and no incoming Twitch authorization header', async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl = '';
  let upstreamOptions = null;
  globalThis.fetch = async (url, options) => {
    upstreamUrl = String(url);
    upstreamOptions = options;
    return new Response(JSON.stringify({ avg_viewers: 18, max_viewers: 44 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const request = new Request('https://nerdsync.test/api/twitchtracker-summary?channel=OneEyedNerdy', {
      headers: { Authorization: 'Bearer should-never-leave-nerdsync' },
    });
    const response = await onRequestGet({ request });
    assert.equal(response.status, 200);
    assert.equal(upstreamUrl, 'https://twitchtracker.com/api/channels/summary/oneeyednerdy');
    const headers = new Headers(upstreamOptions.headers);
    assert.equal(headers.has('authorization'), false);
    assert.equal(response.headers.get('x-nerdsync-data-source'), 'twitchtracker');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('proxy rejects invalid channel names before any upstream request', async () => {
  const response = await onRequestGet({
    request: new Request('https://nerdsync.test/api/twitchtracker-summary?channel=bad%20name!'),
  });
  assert.equal(response.status, 400);
});
