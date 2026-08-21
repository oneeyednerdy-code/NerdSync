import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');
const details = await readFile(new URL('../js/stream-details.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
const guide = await readFile(new URL('../guide.html', import.meta.url), 'utf8');

test('Creator Match cards expose a direct TwitchTracker profile action', () => {
  assert.match(feed, /function creatorMatchTwitchTrackerLinkHtml\(stream\)/);
  assert.match(feed, /activeTab !== 'match'/);
  assert.match(feed, /https:\/\/twitchtracker\.com\/\$\{login\}/);
  assert.match(feed, />TwitchTracker stats<\/a>/);
  assert.match(feed, /target="_blank" rel="noopener noreferrer"/);
});

test('external Creator Match action is not swallowed by the card Details handler', () => {
  assert.match(details, /closest\('a\.card-action-link'\)/);
  assert.match(details, /if \(externalCardLink\) return;/);
});

test('TwitchTracker action has link-specific button styling and is documented', () => {
  assert.match(styles, /\.card-action-link\s*\{/);
  assert.match(styles, /\.card-action-twitchtracker\s*\{/);
  assert.match(guide, /TwitchTracker stats/);
});
