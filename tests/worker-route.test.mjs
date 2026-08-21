import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

test('worker rejects non-GET TwitchTracker requests', async () => {
  const request = new Request('https://nerdsync.test/api/twitchtracker-summary?channel=test', { method: 'POST' });
  const response = await worker.fetch(request, { ASSETS: { fetch: () => new Response('asset') } }, { waitUntil() {} });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});

test('worker falls through to static assets', async () => {
  const request = new Request('https://nerdsync.test/index.html');
  const response = await worker.fetch(request, { ASSETS: { fetch: () => new Response('asset-ok') } }, { waitUntil() {} });
  assert.equal(await response.text(), 'asset-ok');
});
