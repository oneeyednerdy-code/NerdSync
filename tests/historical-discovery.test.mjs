import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadClient(fetchImpl = async () => { throw new Error('unexpected fetch'); }) {
  const source = await readFile(new URL('../js/twitchtracker-summary.js', import.meta.url), 'utf8');
  const context = {
    Map, Set, Date, Number, String, Array, Error, URL, Math, Intl, Promise,
    location: { origin: 'https://nerdsync.local' },
    fetch: fetchImpl,
    historicalDiscoveryEnabled: true,
    NEW_AFFILIATE_ACCOUNT_DAYS: 365,
    excludePartners: false,
    hideSeen: false,
    creatorStage: 'balanced',
    matchesCreatorStage: () => true,
    diagnostics: {},
    TABS: { discover:{ hasCommonFilters:true }, gems:{ hasCommonFilters:true }, rising:{ hasCommonFilters:true }, spotlight:{ hasCommonFilters:true } },
    passesCommonFilters: () => true,
    isDismissed: () => false,
    wasSeenRecently: () => false,
    historyFor: () => ({}),
    discoveryScore: stream => ({ score: stream._baseScore || 50, reasons:[] }),
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

test('normalizes TwitchTracker 30-day category summary fields', async () => {
  const client = await loadClient();
  const result = client.normalizeTwitchTrackerCategorySummary({
    rank: 7,
    hours_watched: 120000,
    avg_viewers: 2400,
    avg_channels: 88,
  }, '27471');
  assert.equal(result.gameId, '27471');
  assert.equal(result.averageViewers, 2400);
  assert.equal(result.averageChannels, 88);
  assert.equal(result.periodDays, 30);
});

test('derives typical-audience and growth context without replacing live viewers', async () => {
  const client = await loadClient();
  const summary = client.normalizeTwitchTrackerSummary({
    avg_viewers: 20,
    followers: 20,
    minutes_streamed: 2400,
  }, 'creator');
  const signals = client.deriveTwitchTrackerSignals(summary, 32, { mode:'gems' });
  assert.equal(signals.percentVsAverage, 60);
  assert.equal(signals.liveContext, 'Hot right now');
  assert.equal(signals.growing, true);
  assert.equal(signals.gemLabel, 'Rising gem');
  assert.equal(Math.round(signals.streamedHours), 40);
});

test('requests category context through the same-origin NerdSync endpoint', async () => {
  let requested = '';
  const client = await loadClient(async url => {
    requested = String(url);
    return { ok:true, json:async () => ({ avg_viewers:1000, avg_channels:40 }) };
  });
  const result = await client.getTwitchTrackerCategorySummary('27471');
  assert.match(requested, /\/api\/twitchtracker-category-summary\?game=27471$/);
  assert.equal(result.averageChannels, 40);
});

test('Historical Discovery limits automatic enrichment to 20 creator lookups and 6 categories', async () => {
  let channelCalls = 0;
  let categoryCalls = 0;
  const client = await loadClient(async url => {
    const value = String(url);
    if (value.includes('twitchtracker-summary')) {
      channelCalls += 1;
      return { ok:true, json:async () => ({ avg_viewers:12, followers:4, minutes_streamed:600 }) };
    }
    if (value.includes('twitchtracker-category-summary')) {
      categoryCalls += 1;
      return { ok:true, json:async () => ({ avg_viewers:1000, avg_channels:40 }) };
    }
    throw new Error(`unexpected ${value}`);
  });
  const streams = Array.from({ length:30 }, (_, index) => ({
    user_id:String(index + 1),
    user_login:`creator_${index + 1}`,
    viewer_count:index + 2,
    game_id:String(1000 + index),
    _baseScore:100 - index,
    _broadcasterType:'affiliate',
  }));
  const enriched = await client.enrichDiscoveryWithTwitchTracker(streams, 'discover');
  assert.equal(channelCalls, 20);
  assert.equal(categoryCalls, 6);
  assert.equal(enriched.filter(item => item._trackerSummary).length, 20);
  assert.equal(client.diagnostics.trackerChecked, 20);
  assert.equal(client.diagnostics.trackerCategories, 6);
});

test('Historical Discovery can be disabled before any TwitchTracker request happens', async () => {
  let calls = 0;
  const client = await loadClient(async () => { calls += 1; return { ok:true, json:async () => ({}) }; });
  client.historicalDiscoveryEnabled = false;
  const input = [{ user_id:'1', user_login:'creator', viewer_count:5, game_id:'123' }];
  const output = await client.enrichDiscoveryWithTwitchTracker(input, 'gems');
  assert.equal(calls, 0);
  assert.equal(output[0]._trackerSummary, undefined);
});


test('Newer Affiliate signal combines account recency with TwitchTracker activity and growth without inventing an affiliate date', async () => {
  const client = await loadClient();
  const stream = {
    user_id:'affiliate-1',
    user_login:'newer_affiliate',
    viewer_count:18,
    _emergingSection:'newAffiliate',
    _broadcasterType:'affiliate',
    _newAffiliateAgeDays:120,
    _newAffiliateScore:37,
  };
  const summary = client.normalizeTwitchTrackerSummary({
    avg_viewers:16,
    followers:30,
    minutes_streamed:2400,
  }, stream.user_login);
  const signal = client.deriveNewerAffiliateSignal(stream, summary);
  assert.ok(signal.score > stream._newAffiliateScore);
  assert.match(signal.label, /newer Affiliate/i);
  assert.ok(signal.reasons.some(reason => /streamed \/ 30d/.test(reason)));
  assert.ok(signal.reasons.some(reason => /followers \/ 30d/.test(reason)));
});

test('Newer Affiliate signal refuses creators who are not currently Twitch Affiliates', async () => {
  const client = await loadClient();
  assert.equal(client.deriveNewerAffiliateSignal({
    _emergingSection:'newAffiliate',
    _broadcasterType:'none',
    _newAffiliateAgeDays:30,
    viewer_count:5,
  }, { followersGained:20, minutesStreamed:1200 }), null);
});


test('Historical enrichment writes the Newer Affiliate label and score onto the stream', async () => {
  const client = await loadClient();
  const stream = {
    user_id:'affiliate-2',
    user_login:'affiliate_two',
    viewer_count:10,
    _emergingSection:'newAffiliate',
    _broadcasterType:'affiliate',
    _newAffiliateAgeDays:90,
    _newAffiliateScore:40,
    _newAffiliateLabel:'Newer Affiliate',
    _why:'Current Twitch Affiliate',
  };
  const summary = client.normalizeTwitchTrackerSummary({ followers:24, minutes_streamed:1800, avg_viewers:12 }, stream.user_login);
  const output = client.applyTwitchTrackerSummaryToStream(stream, summary, 'rising');
  assert.ok(output._newAffiliateScore > 40);
  assert.match(output._newAffiliateLabel, /newer Affiliate/i);
  assert.match(output._why, /affiliate-earned date unavailable/i);
});
