import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const meta = await readFile(new URL('../js/app-meta.js', import.meta.url), 'utf8');
const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');
const api = await readFile(new URL('../js/twitch-api.js', import.meta.url), 'utf8');
const manager = await readFile(new URL('../js/request-manager.js', import.meta.url), 'utf8');
const backup = await readFile(new URL('../js/data-portability.js', import.meta.url), 'utf8');
const workflows = await readFile(new URL('../js/local-workflows.js', import.meta.url), 'utf8');
const collab = await readFile(new URL('../js/collaboration-fit.js', import.meta.url), 'utf8');
const tools = await readFile(new URL('../js/discovery-tools.js', import.meta.url), 'utf8');
const compare = await readFile(new URL('../js/creator-tools.js', import.meta.url), 'utf8');
const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const channelProxy = await readFile(new URL('../functions/api/twitchtracker-summary.js', import.meta.url), 'utf8');
const categoryProxy = await readFile(new URL('../functions/api/twitchtracker-category-summary.js', import.meta.url), 'utf8');

function functionSource(source, name, next = '\nfunction ') {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  let end = source.indexOf(next, start + 10);
  if (end < 0) end = source.length;
  return source.slice(start, end);
}

test('0.19.0 centralizes browser release metadata and production builds a native ES module', () => {
  assert.match(meta, /version:\s*'0\.19\.0'/);
  assert.match(meta, /label:\s*'Alpha-0\.19\.0'/);
  assert.doesNotMatch(api, /const APP_VERSION/);
  assert.match(build, /versionMatch = appMetaSource\.match/);
  assert.match(build, /format:\s*'esm'/);
  assert.match(build, /<script type="module"/);
});

test('Twitch token validation accepts extra scopes while still requiring NerdSync scopes', () => {
  assert.match(api, /REQUIRED_SCOPES\.every\(scope => scopes\.includes\(scope\)\)/);
  assert.doesNotMatch(api, /scopes\.length === REQUIRED_SCOPES\.length/);
});

test('shared request manager coordinates concurrency, cancellation, rate budget, and diagnostics', () => {
  assert.match(manager, /maxConcurrent = 8/);
  assert.match(manager, /respectRateBudget/);
  assert.match(manager, /rateRemaining/);
  assert.match(manager, /cacheHits/);
  assert.match(api, /nerdSyncRequestManager\.acquire/);
  assert.match(api, /nerdSyncRequestManager\.release/);
  assert.match(api, /requestManager:nerdSyncRequestManager\.snapshot\(\)/);
});

test('local backup and restore is versioned, same-account only, and excludes OAuth data', () => {
  assert.match(html, /id="nerdsync-backup-export"/);
  assert.match(html, /id="nerdsync-backup-import"/);
  assert.match(backup, /NERDSYNC_BACKUP_KIND/);
  assert.match(backup, /backupSchema/);
  assert.match(backup, /twitchUserId/);
  assert.match(backup, /belongs to a different Twitch account/);
  const collect = functionSource(backup, 'collectNerdSyncBackup');
  assert.doesNotMatch(collect, /currentToken|STORAGE_KEY|access.?token|authorization/i);
  assert.match(backup, /migrateNerdSyncLocalProfile/);
});

test('Saved collections and guided Discovery Sessions remain browser-local', () => {
  assert.match(workflows, /collections:Array\.isArray/);
  assert.match(workflows, /function createCollection/);
  assert.match(workflows, /function addCreatorToCollection/);
  assert.match(html, /id="saved-collection-filter"/);
  assert.match(html, /id="start-discovery-session"/);
  assert.match(html, /id="discovery-session-dialog"/);
  assert.match(workflows, /function startDiscoverySession/);
  assert.match(workflows, /function advanceDiscoverySession/);
});

test('published schedule overlap is calculated from actual upcoming segment intersections', () => {
  const source = functionSource(collab, 'scheduleOverlapMinutes', '\nasync function ensureOwnCollabProfile');
  const context = vm.createContext({ Date, Math });
  vm.runInContext(`${source}; globalThis.result = scheduleOverlapMinutes([{start_time:'2026-08-22T12:00:00Z',end_time:'2026-08-22T16:00:00Z'}],[{start_time:'2026-08-22T14:00:00Z',end_time:'2026-08-22T18:00:00Z'}]);`, context);
  assert.equal(context.result, 120);
});

test('Creator Match Collaboration Fit is explainable, bounded, and checks only strongest candidates', () => {
  assert.match(html, /id="match-collaboration-fit"[^>]*checked/);
  assert.match(collab, /COLLAB_FIT_CANDIDATE_LIMIT = 12/);
  for (const label of ['Audience','Tags','Category','Schedule','Language/chat']) assert.match(collab, new RegExp(`label:'${label.replace('/', '\\/')}'`));
  assert.match(collab, /compatibility signal, not a creator-quality rating/i);
  assert.match(feed, /collaborationFitHtml\(s\)/);
});

test('Find similar seeds Discovery from creator category, tags, language, and audience', () => {
  assert.match(feed, /data-action="similar"/);
  assert.match(tools, /function findSimilarCreators/);
  assert.match(tools, /categories:stream\.game_id/);
  assert.match(tools, /tags:tags\.slice\(0,3\)/);
  assert.match(tools, /language:stream\.language/);
  assert.match(tools, /reference \* 0\.5/);
  assert.match(tools, /reference \* 1\.5/);
});

test('Discovery transparency and category context explicitly avoid quality/growth promises', () => {
  assert.match(tools, /Why this creator\?/);
  assert.match(tools, /Discovery Fit is an explainable ranking signal, not a creator-quality score/);
  assert.match(html, /id="category-opportunity-report"/);
  assert.match(tools, /Current counts are NerdSync's candidate sample, not Twitch's complete directory/);
  assert.match(tools, /This is context, not a promise of growth/);
});

test('Comparison 2.0 includes collaboration evidence and summary highlights without declaring a winner', () => {
  assert.match(compare, /comparisonInsightHtml\(details\)/);
  assert.match(compare, /collaborationFitHtml\(creator, false\)/);
  assert.match(collab, /Closest audience signal/);
  assert.match(collab, /Strongest shared-tag signal/);
  assert.match(collab, /Strongest schedule-overlap signal/);
  assert.match(collab, /not a recommendation that one creator is objectively better/);
});

test('TwitchTracker proxies have bounded upstream time and response validation', () => {
  for (const source of [channelProxy, categoryProxy]) {
    assert.match(source, /setTimeout\(\(\) => controller\.abort\(\), 8000\)/);
    assert.match(source, /redirect: 'error'/);
    assert.match(source, /content-type/);
    assert.match(source, /262144/);
    assert.match(source, /JSON\.parse/);
  }
});

test('new Plan A modules stay reasonably small and cards use offscreen rendering containment', async () => {
  for (const name of ['request-manager.js','data-portability.js','collaboration-fit.js','discovery-tools.js']) {
    const source = await readFile(new URL(`../js/${name}`, import.meta.url), 'utf8');
    assert.ok(Buffer.byteLength(source) < 26000, `${name} stays under 26 KB`);
  }
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /contain-intrinsic-size/);
});
