import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const collab = await readFile(new URL('../js/collaboration-fit.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const details = await readFile(new URL('../js/stream-details.js', import.meta.url), 'utf8');
const foundation = await readFile(new URL('../js/app-foundation.js', import.meta.url), 'utf8');

function sourceBetween(startName, endName) {
  const start = collab.indexOf(`function ${startName}`);
  assert.ok(start >= 0, `${startName} exists`);
  const end = collab.indexOf(`function ${endName}`, start + 10);
  assert.ok(end > start, `${endName} follows ${startName}`);
  return collab.slice(start, end);
}

test('Schedule Intelligence is exposed in Creator Match and styled as evidence, not certainty', () => {
  assert.match(html, /Add Collaboration Fit \+ Schedule Intelligence/);
  assert.match(css, /\.schedule-evidence/);
  assert.match(collab, /Observed schedule/);
  assert.match(collab, /not a published schedule or a promise of future availability/i);
  assert.match(collab, /informational only/);
});

test('observed schedule inference finds a stable recurring public VOD pattern with high confidence', () => {
  const chunk = sourceBetween('parseTwitchDurationMinutes', 'publishedScheduleEvidence');
  const context = vm.createContext({ Date, Math, Number, String, Array });
  vm.runInContext(`const OBSERVED_SCHEDULE_MIN_STREAM_MINUTES=30; const OBSERVED_SCHEDULE_MAX_AGE_DAYS=90; const OBSERVED_SCHEDULE_CLUSTER_MINUTES=120; ${chunk}`, context);
  const now = Date.parse('2026-08-22T12:00:00Z');
  const videos = [
    ['2026-08-21T19:05:00Z','4h'],['2026-08-19T19:10:00Z','4h'],['2026-08-17T19:00:00Z','4h'],
    ['2026-08-14T19:15:00Z','4h'],['2026-08-12T18:55:00Z','4h'],['2026-08-10T19:20:00Z','4h'],
    ['2026-08-07T19:00:00Z','4h'],['2026-08-05T19:05:00Z','4h'],['2026-08-03T18:50:00Z','4h'],
    ['2026-07-31T19:10:00Z','4h'],['2026-07-29T19:00:00Z','4h'],['2026-07-27T19:05:00Z','4h'],
  ].map(([created_at,duration], index) => ({ id:String(index+1), created_at, duration }));
  const result = context.observedScheduleFromVods(videos, { minutesStreamed:48 * 60 }, now);
  assert.equal(result.confidence, 'high');
  assert.ok(result.confidenceScore >= 75);
  assert.equal(result.recurringDays, 3);
  assert.ok(result.coverageRatio >= 0.9);
  assert.ok(result.windows.length >= 3);
});

test('TwitchTracker activity mismatch prevents observed VOD history from becoming high confidence', () => {
  const chunk = sourceBetween('parseTwitchDurationMinutes', 'publishedScheduleEvidence');
  const context = vm.createContext({ Date, Math, Number, String, Array });
  vm.runInContext(`const OBSERVED_SCHEDULE_MIN_STREAM_MINUTES=30; const OBSERVED_SCHEDULE_MAX_AGE_DAYS=90; const OBSERVED_SCHEDULE_CLUSTER_MINUTES=120; ${chunk}`, context);
  const now = Date.parse('2026-08-22T12:00:00Z');
  const videos = [
    ['2026-08-21T19:00:00Z','4h'],['2026-08-14T19:05:00Z','4h'],['2026-08-07T19:10:00Z','4h'],['2026-07-31T19:00:00Z','4h'],
    ['2026-08-20T19:00:00Z','4h'],['2026-08-13T19:10:00Z','4h'],['2026-08-06T19:05:00Z','4h'],['2026-07-30T19:00:00Z','4h'],
  ].map(([created_at,duration], index) => ({ id:String(index+1), created_at, duration }));
  const result = context.observedScheduleFromVods(videos, { minutesStreamed:100 * 60 }, now);
  assert.notEqual(result.confidence, 'high');
  assert.ok(result.coverageRatio < 0.65);
});

test('sparse VOD history does not invent a schedule', () => {
  const chunk = sourceBetween('parseTwitchDurationMinutes', 'publishedScheduleEvidence');
  const context = vm.createContext({ Date, Math, Number, String, Array });
  vm.runInContext(`const OBSERVED_SCHEDULE_MIN_STREAM_MINUTES=30; const OBSERVED_SCHEDULE_MAX_AGE_DAYS=90; const OBSERVED_SCHEDULE_CLUSTER_MINUTES=120; ${chunk}`, context);
  const now = Date.parse('2026-08-22T12:00:00Z');
  const videos = [
    { id:'1', created_at:'2026-08-21T10:00:00Z', duration:'2h' },
    { id:'2', created_at:'2026-08-19T17:00:00Z', duration:'3h' },
    { id:'3', created_at:'2026-08-16T23:00:00Z', duration:'1h30m' },
  ];
  const result = context.observedScheduleFromVods(videos, { minutesStreamed:8 * 60 }, now);
  assert.equal(result.confidence, 'insufficient');
  assert.equal(result.windows.length, 0);
});

test('observed schedule weighting is lower than published schedule weighting', () => {
  assert.match(collab, /if \(evidence\.confidence === 'high'\) return 0\.8/);
  assert.match(collab, /if \(evidence\.confidence === 'medium'\) return 0\.6/);
  assert.match(collab, /return 0;/);
  assert.match(collab, /Published Twitch schedules get full schedule weight/);
});

test('Schedule Intelligence stays no-D1 and bounded to top collaboration candidates', () => {
  assert.match(collab, /COLLAB_FIT_CANDIDATE_LIMIT = 12/);
  assert.match(collab, /OBSERVED_SCHEDULE_VOD_LIMIT = 30/);
  assert.match(collab, /OBSERVED_SCHEDULE_MAX_AGE_DAYS = 90/);
  assert.doesNotMatch(collab, /D1|NERDSYNC_DB|\/api\/stream-history/i);
});


test('Creator Match Details can show observed schedule evidence when no published schedule exists', () => {
  assert.match(html, /Schedule \/ Observed Pattern/);
  assert.match(details, /stream\._collabFit\?\.scheduleEvidence/);
  assert.match(details, /scheduleEvidenceHtml\(scheduleEvidence\)/);
  assert.match(details, /No upcoming schedule published and no reliable observed pattern is available/);
});

test('Schedule Intelligence privacy behavior forces a fresh acknowledgement and explains the public cross-check', () => {
  assert.match(foundation, /nerdsync_privacy_ack_v4/);
  assert.match(html, /Schedule Intelligence cross-checks inferred VOD activity/);
  assert.match(html, /Twitch token is never sent to TwitchTracker/);
});

test('observed windows that cross midnight keep the second-day display reference aligned', () => {
  const chunk = sourceBetween('parseTwitchDurationMinutes', 'publishedScheduleEvidence');
  const context = vm.createContext({ Date, Math, Number, String, Array });
  vm.runInContext(`const OBSERVED_SCHEDULE_MIN_STREAM_MINUTES=30; const OBSERVED_SCHEDULE_MAX_AGE_DAYS=90; const OBSERVED_SCHEDULE_CLUSTER_MINUTES=120; ${chunk}`, context);
  const windows = context.splitWeeklyWindow(5, 23 * 60, 180, '2026-08-21T23:00:00Z');
  assert.equal(windows.length, 2);
  assert.equal(windows[0].day, 5);
  assert.equal(windows[1].day, 6);
  assert.match(windows[1].representativeStart, /^2026-08-22T00:00:00/);
});

test('Schedule Intelligence distinguishes no published schedule from a Twitch Schedule API failure', async () => {
  const api = await readFile(new URL('../js/twitch-api.js', import.meta.url), 'utf8');
  assert.match(api, /if \(res\.status === 404\) return \[\]/);
  assert.match(api, /if \(!res\.ok\) throw new Error\('Failed to load Twitch schedule'\)/);
  assert.match(collab, /scheduleR\.status === 'fulfilled'[\s\S]*resolveScheduleEvidence/);
  assert.match(collab, /: noScheduleEvidence\(\)/);
});
