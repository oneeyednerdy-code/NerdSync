import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadClient() {
  const source = await readFile(new URL('../js/twitchtracker-summary.js', import.meta.url), 'utf8');
  const context = {
    Map,
    Date,
    Number,
    String,
    Array,
    Error,
    URL,
    location: { origin: 'https://nerdsync.local' },
    fetch: async () => { throw new Error('unexpected fetch'); },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test('normalizes TwitchTracker 30-day summary fields', async () => {
  const client = await loadClient();
  const result = client.normalizeTwitchTrackerSummary({
    rank: 42,
    minutes_streamed: 1200,
    avg_viewers: 37,
    max_viewers: 91,
    hours_watched: 740,
    followers: 12,
    followers_total: 900,
  }, 'OneEyedNerdy');
  assert.equal(result.channel, 'oneeyednerdy');
  assert.equal(result.averageViewers, 37);
  assert.equal(result.maxViewers, 91);
  assert.equal(result.periodDays, 30);
});

test('requests TwitchTracker through NerdSync same-origin endpoint', async () => {
  const client = await loadClient();
  let requested = '';
  const result = await client.getTwitchTrackerSummary('OneEyedNerdy', {
    fetchImpl: async url => {
      requested = String(url);
      return { ok: true, json: async () => ({ avg_viewers: 22 }) };
    },
  });
  assert.match(requested, /\/api\/twitchtracker-summary\?channel=oneeyednerdy$/);
  assert.equal(result.averageViewers, 22);
});

test('caches repeat summary requests across the six-hour discovery window', async () => {
  const client = await loadClient();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ avg_viewers: 31, max_viewers: 80 }) };
  };
  const first = await client.getTwitchTrackerSummary('Cache_Test_Channel', { fetchImpl });
  const second = await client.getTwitchTrackerSummary('cache_test_channel', { fetchImpl });
  assert.equal(first.averageViewers, 31);
  assert.equal(second.maxViewers, 80);
  assert.equal(calls, 1);
});
