import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const recommendations = await readFile(new URL('../js/recommendations.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

test('Settings exposes Historical Discovery as an explicit default-on checkbox', () => {
  assert.match(html, /id="historical-discovery"[^>]*type="checkbox"[^>]*checked/);
  assert.match(controls, /historicalDiscoveryEnabled = historicalDiscoveryEl\.checked/);
  assert.match(controls, /preferences\.historicalDiscoveryEnabled/);
});

test('Discovery cards render a separate 30-day context panel', () => {
  assert.match(feed, /function historicalDiscoveryContextHtml/);
  assert.match(feed, /Live now/);
  assert.match(feed, /30d avg/);
  assert.match(feed, /30d growth/);
  assert.match(feed, /30d active/);
  assert.match(feed, /_trackerCategorySummary/);
  assert.match(css, /\.historical-stat-grid/);
});

test('Discovery audience-fit uses 30-day average when available instead of replacing live viewer count everywhere', () => {
  assert.match(recommendations, /const audienceReference = Number\.isFinite\(stream\._trackerSummary\?\.averageViewers\)/);
  assert.match(recommendations, /stream\.viewer_count \|\| 0/);
  assert.match(recommendations, /typical audience size fit/);
});

test('privacy text explains limited automatic TwitchTracker enrichment and no OAuth forwarding', () => {
  assert.match(html, /limited set of strong Discovery candidates/);
  assert.match(html, /Your Twitch token is never sent to TwitchTracker/);
});


test('Emerging exposes Newer Affiliate signal without claiming an Affiliate-earned date', () => {
  assert.match(html, /Newer Affiliates/);
  assert.match(html, /Best newer Affiliate signal/);
  assert.match(feed, /function newerAffiliateContextHtml/);
  assert.match(feed, /current Affiliate status/);
  assert.match(feed, /Affiliate-earned date is not/);
  assert.match(css, /\.newer-affiliate-context/);
});
