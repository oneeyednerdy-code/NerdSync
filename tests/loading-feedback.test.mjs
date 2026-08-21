import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const ui = await readFile(new URL('../js/ui-state.js', import.meta.url), 'utf8');
const match = await readFile(new URL('../js/creator-match.js', import.meta.url), 'utf8');
const details = await readFile(new URL('../js/stream-details.js', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const tools = await readFile(new URL('../js/creator-tools.js', import.meta.url), 'utf8');
const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');

test('Alpha-0.18.1 exposes shared contextual loading helpers', () => {
  assert.match(ui, /function setLoadingStatus/);
  assert.match(ui, /function loadingMessageHtml/);
  assert.match(ui, /function loadingPanelHtml/);
  assert.match(ui, /function setButtonLoading/);
  assert.match(css, /\.loading-spinner/);
  assert.match(css, /@keyframes nerdsync-loader-spin/);
});

test('loading feedback is wired into the major async surfaces', () => {
  assert.match(match, /aria-busy/);
  assert.match(details, /loadingMessageHtml\('Loading TwitchTracker context/);
  assert.match(controls, /setButtonLoading\(loginBtn/);
  assert.match(controls, /setButtonLoading\(scanDeeperBtn/);
  assert.match(tools, /setButtonLoading\(submitButton/);
  assert.match(feed, /streamGrid\.setAttribute\('aria-busy', 'true'\)/);
});

test('loading animation respects reduced motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /body\.a11y-reduce-motion \.loading-spinner/);
  assert.match(css, /animation:none!important/);
});

test('0.18.1 asset URLs are consistently versioned', () => {
  assert.match(html, /css\/styles\.css\?v=0\.18\.1/);
  assert.match(html, /js\/ui-state\.js\?v=0\.18\.1/);
  assert.doesNotMatch(html, /\?v=0\.18\.0/);
});
