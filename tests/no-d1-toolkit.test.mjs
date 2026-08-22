import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const guide = await readFile(new URL('../guide.html', import.meta.url), 'utf8');
const foundation = await readFile(new URL('../js/app-foundation.js', import.meta.url), 'utf8');
const meta = await readFile(new URL('../js/app-meta.js', import.meta.url), 'utf8');
const discovery = await readFile(new URL('../js/discovery.js', import.meta.url), 'utf8');
const creatorMatch = await readFile(new URL('../js/creator-match.js', import.meta.url), 'utf8');
const discoveryContext = await readFile(new URL('../js/discovery-context.js', import.meta.url), 'utf8');
const filters = await readFile(new URL('../js/filters.js', import.meta.url), 'utf8');
const workflows = await readFile(new URL('../js/local-workflows.js', import.meta.url), 'utf8');
const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');
const compare = await readFile(new URL('../js/creator-tools.js', import.meta.url), 'utf8');
const api = await readFile(new URL('../js/twitch-api.js', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const wrangler = await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const roadmap = await readFile(new URL('../ROADMAP_3.0.md', import.meta.url), 'utf8');
const security = await readFile(new URL('../SECURITY.md', import.meta.url), 'utf8');

function sliceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `${startText} block exists`);
  return source.slice(start, end);
}

test('Alpha-0.19.x is visible and Creator Match is explicitly no-D1', () => {
  assert.match(meta, /label:\s*'Alpha-0\.19\.0'/);
  assert.match(meta, /const APP_VERSION = NERDSYNC_META\.label/);
  assert.match(html, /Alpha-0\.19\.0/);
  assert.match(guide, /Alpha-0\.19\.0/);
  assert.match(html, /Creator Match 2\.0/);
  assert.match(html, /Nothing here requires D1 or permanent server storage/);
});

test('Creator Match exposes five editable audience sources plus candidate live or typical basis', () => {
  const match = sliceBetween(html, 'id="creator-match-panel"', 'id="filter-panel"');
  for (const value of ['live','typical','last','vod','custom']) assert.match(match, new RegExp(`data-value="${value}"`));
  assert.match(match, /id="match-peak"[^>]*type="number"/);
  assert.match(match, /id="match-audience-basis"[\s\S]*data-value="live"[\s\S]*data-value="typical"/);
  assert.match(creatorMatch, /if \(source === 'typical'\)[\s\S]*matchOwnTrackerSummary\.averageViewers/);
  assert.match(creatorMatch, /matchAudienceBasis === 'typical'/);
});

test('past broadcast context uses Twitch archive metadata and never treats VOD play count as live audience', () => {
  assert.match(api, /helix\/videos\?user_id=\$\{broadcasterId\}&type=archive&first=\$\{first\}/);
  const vodBlock = sliceBetween(creatorMatch, 'async function loadMatchVods', 'async function ensureCreatorMatchOwnContext');
  assert.match(vodBlock, /created_at/);
  assert.match(vodBlock, /video\.title/);
  assert.match(vodBlock, /video\.duration/);
  assert.doesNotMatch(vodBlock, /view_count|viewCount/);
  const sourceBlock = sliceBetween(creatorMatch, 'async function applyCreatorMatchSource', 'async function enrichCreatorMatchCandidatesWithTypical');
  assert.match(sourceBlock, /source === 'last'/);
  assert.match(sourceBlock, /source === 'vod'/);
  assert.match(sourceBlock, /matchOwnTrackerSummary\?\.averageViewers/);
  assert.doesNotMatch(sourceBlock, /view_count|viewCount/);
});

test('Creator Match separates required preferred and excluded tags and explains exclusions', () => {
  for (const id of ['match-required-tags','match-preferred-tags','match-excluded-tags','match-exclusion-summary']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(creatorMatch, /requiredMissing/);
  assert.match(creatorMatch, /excludedFound/);
  assert.match(creatorMatch, /preferredMatches/);
  assert.match(creatorMatch, /missing required match tags/);
  assert.match(creatorMatch, /excluded by match tags/);
});

test('thin Creator Match results expand explicitly rather than silently widening', () => {
  assert.match(html, /id="expand-creator-match"/);
  assert.match(controls, /matchTolerance < 75[\s\S]*75[\s\S]*matchTolerance < 100[\s\S]*100/);
  assert.match(controls, /matchFallbackExpanded = true/);
  assert.match(creatorMatch, /matchFallbackExpanded \? 16 : MAX_TOP_CATEGORIES_FOR_DISCOVER/);
});

test('local workflow tools cap presets match history and shortlist in browser storage', () => {
  assert.match(workflows, /localStorage\.getItem\(localWorkflowStorageKey\(\)\)/);
  assert.match(workflows, /localStorage\.setItem\(localWorkflowStorageKey\(\)/);
  assert.match(workflows, /filterPresets:[\s\S]*slice\(0, 20\)/);
  assert.match(workflows, /matchHistory:[\s\S]*slice\(0, 20\)/);
  assert.match(workflows, /matchShortlist:[\s\S]*slice\(0, 30\)/);
  assert.match(html, /id="match-history-list"/);
  assert.match(html, /id="match-shortlist-list"/);
});

test('shareable filter links serialize visible filter choices without Twitch identity or token', () => {
  const normalize = sliceBetween(workflows, 'function normalizeSerializableFilters', 'function applySerializableFilters');
  assert.match(normalize, /preferredTags/);
  assert.match(normalize, /audienceBasis/);
  assert.match(normalize, /trackerActivityHours/);
  assert.match(normalize, /trackerGrowth/);
  assert.doesNotMatch(normalize, /currentUser|token|oauth|authorization/i);
  const share = sliceBetween(workflows, 'async function copyShareableFilterUrl', 'function saveCurrentFilterPreset');
  assert.match(share, /searchParams\.set\('nsf'/);
  assert.match(share, /normalizeSerializableFilters\(\)/);
  assert.doesNotMatch(share, /currentUser|currentToken|access_token|authorization/i);
});

test('Discovery exposes preferred tags, historical audience basis, activity, and growth filters', () => {
  for (const id of ['preferred-tags','audience-basis-filter','tracker-activity-filter','tracker-growth-filter']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(filters, /filters\.preferredTags/);
  assert.match(filters, /filters\.audienceBasis === 'typical'/);
  assert.match(filters, /filters\.trackerActivityHours/);
  assert.match(filters, /filters\.trackerGrowth/);
});

test('Discovery renders exclusion and TwitchTracker availability context with retry support', () => {
  assert.match(html, /id="filter-exclusion-summary"/);
  assert.match(html, /id="tracker-availability"/);
  assert.match(html, /id="retry-historical-btn"/);
  assert.match(discoveryContext, /function renderFilterExclusionSummary/);
  assert.match(discoveryContext, /function updateTrackerAvailabilityStatus/);
  assert.match(feed, /Live results ready · adding 30-day historical context/);
  assert.match(feed, /data-action="retry-tracker"/);
});

test('category context includes a viewer-per-live-channel opportunity indicator and stability explanation', () => {
  assert.match(discoveryContext, /category\.averageViewers \/ category\.averageChannels/);
  assert.match(discoveryContext, /viewers per live channel/);
  assert.match(discoveryContext, /Recent audience looks relatively steady/);
  assert.match(discoveryContext, /Recent peak was far above typical/);
});

test('comparison supports up to four creators with TwitchTracker context', () => {
  assert.match(compare, /slice\(-4\)/);
  assert.match(compare, /\$\{compareIds\.length\}\/4/);
  assert.match(compare, /Choose up to four creators/);
  assert.match(compare, /30D avg:/);
  assert.match(compare, /TwitchTracker/);
});

test('current results and Creator Match shortlists can export TXT CSV or JSON', () => {
  assert.equal((html.match(/data-export-current=/g) || []).length, 3);
  assert.equal((html.match(/data-export-shortlist=/g) || []).length, 3);
  assert.match(workflows, /function exportDiscovery\(format = 'txt'\)/);
  assert.match(workflows, /application\/json/);
  assert.match(workflows, /text\/csv/);
  assert.match(workflows, /function exportMatchShortlist\(format = 'txt'\)/);
});

test('local bookmarks and keyboard shortcuts are wired without a backend', () => {
  assert.match(workflows, /\['', 'maybe', 'watch', 'raid'\]/);
  assert.match(workflows, /event\.key === '\/'/);
  assert.match(workflows, /event\.key\.toLowerCase\(\) === 'f'/);
  assert.match(workflows, /event\.key\.toLowerCase\(\) === 's'/);
  assert.match(workflows, /event\.key\.toLowerCase\(\) === 'b'/);
});

test('Creator Match and Discovery context remain separate modules under the modular size budget', async () => {
  const modules = ['discovery.js','creator-match.js','discovery-context.js','feed-rendering.js'];
  for (const name of modules) {
    const source = await readFile(new URL(`../js/${name}`, import.meta.url), 'utf8');
    assert.ok(Buffer.byteLength(source, 'utf8') < 25000, `${name} stays below 25 KB`);
    assert.match(html, new RegExp(`js/${name.replace('.', '\\.')}\\?v=0\\.19\\.0`));
  }
});

test('Alpha-0.19.x has no D1 binding or server-side user persistence implementation', async () => {
  assert.doesNotMatch(wrangler, /d1_databases|NERDSYNC_DB/i);
  const jsFiles = (await readdir(new URL('../js/', import.meta.url))).filter(name => name.endsWith('.js'));
  const serverFiles = ['worker.js','functions/api/twitchtracker-summary.js','functions/api/twitchtracker-category-summary.js'];
  let serverAndClient = '';
  for (const name of jsFiles) serverAndClient += await readFile(new URL(`../js/${name}`, import.meta.url), 'utf8');
  for (const name of serverFiles) serverAndClient += await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  assert.doesNotMatch(serverAndClient, /env\.NERDSYNC_DB|d1_databases|\.prepare\(\s*[`'"](?:INSERT|UPDATE|DELETE|SELECT)/i);
  assert.doesNotMatch(serverAndClient, /\/api\/(?:sync|stream-history)/);
  assert.match(security, /No-D1 boundary through Alpha-0\.19\.x/);
});

test('D1 sync and background per-stream history are reserved for 3.0', () => {
  assert.match(roadmap, /NerdSync 3\.0/);
  assert.match(roadmap, /does \*\*not\*\* implement Cloudflare D1/);
  assert.match(roadmap, /Cross-browser and cross-device synchronization/);
  assert.match(roadmap, /background stream audience history/i);
  assert.match(roadmap, /export and permanent-delete controls/i);
});
