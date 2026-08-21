import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const api = await readFile(new URL('../js/twitch-api.js', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

test('Following Live exposes an opt-in Twitch teams checkbox', () => {
  assert.match(html, /id="following-team-control"[^>]*global-control--check[^>]*hidden/);
  assert.match(html, /<input id="following-teams-first" type="checkbox" \/>/);
  assert.match(html, /<span>Twitch teams first<\/span>/);
  assert.match(controls, /followingTeamControl\.classList\.toggle\('hidden', tabId !== 'following'\)/);
});

test('team lookup uses the current Helix channel teams endpoint and existing auth headers', () => {
  assert.match(api, /helix\/teams\/channel\?\$\{params\}/);
  assert.match(api, /new URLSearchParams\(\{ broadcaster_id:String\(broadcasterId\) \}\)/);
  assert.match(api, /headers:authHeaders\(token\)/);
  assert.match(api, /TEAM_LOOKUP_CONCURRENCY/);
});

test('team members are prioritized while preserving stable order within groups', () => {
  const start = feed.indexOf('function prioritizeFollowingTeamMembers(items)');
  const end = feed.indexOf('function followingTeamHtml(stream)', start);
  assert.ok(start >= 0 && end > start);
  const context = {};
  vm.runInNewContext(`${feed.slice(start, end)}\nglobalThis.prioritize = prioritizeFollowingTeamMembers;`, context);
  const input = [
    { user_name:'No Team A', _twitchTeams:[] },
    { user_name:'Team A', _twitchTeams:[{ displayName:'Team One' }] },
    { user_name:'No Team B', _twitchTeams:[] },
    { user_name:'Team B', _twitchTeams:[{ displayName:'Team Two' }] },
  ];
  assert.deepEqual(Array.from(context.prioritize(input), item => item.user_name), ['Team A','Team B','No Team A','No Team B']);
});

test('Following cards show Twitch team names in bold when the option is enabled', () => {
  const start = feed.indexOf('function followingTeamHtml(stream)');
  const end = feed.indexOf('function streamCardHtml(s)', start);
  assert.ok(start >= 0 && end > start);
  const context = { activeTab:'following', followingTeamsFirst:true, escapeHtml, Set };
  vm.runInNewContext(`${feed.slice(start, end)}\nglobalThis.teamHtml = followingTeamHtml;`, context);
  const rendered = context.teamHtml({ _twitchTeams:[{ displayName:'Live Coders' }] });
  assert.match(rendered, /Twitch Team/);
  assert.match(rendered, /<strong>Live Coders<\/strong>/);
  assert.match(styles, /\.twitch-team-line strong \{[^}]*font-weight:800;/s);
});

test('turning the team option on enriches current results without requiring a full page reload', () => {
  assert.match(controls, /followingTeamsFirstEl\.addEventListener\('change', async \(\) =>/);
  assert.match(controls, /const enriched = await enrichFollowingTeams\(allStreams, currentToken\)/);
  assert.match(controls, /allStreams = enriched/);
  assert.match(controls, /renderGrid\(\)/);
});
