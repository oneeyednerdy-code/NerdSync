import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const feed = await readFile(new URL('../js/feed-rendering.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

function helperSource() {
  const start = feed.indexOf('function creatorMatchTagsHtml(stream)');
  const end = feed.indexOf('function streamCardHtml(s)', start);
  assert.ok(start >= 0 && end > start, 'Creator Match tag helper exists');
  return feed.slice(start, end);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

test('stream cards include the Creator Match tag block', () => {
  assert.match(feed, /<p class=\"game-name\">[\s\S]*?\$\{creatorMatchTagsHtml\(s\)\}/);
});

test('Creator Match cards render Twitch tags and highlight selected exact matches', () => {
  const context = { activeTab:'match', filters:{ tags:['Cozy','LGBTQIAPlus'] }, escapeHtml };
  vm.runInNewContext(`${helperSource()}\nglobalThis.renderTags = creatorMatchTagsHtml;`, context);
  const html = context.renderTags({ tags:['Speedrun','cozy','LGBTQIAPlus'] });
  assert.match(html, /match-tag--matched[^>]*aria-label="cozy, matches your selected tag"[^>]*>cozy<span class="match-tag-check"/);
  assert.match(html, /match-tag--matched[^>]*aria-label="LGBTQIAPlus, matches your selected tag"/);
  assert.match(html, /<span class="match-tag">Speedrun<\/span>/);
  assert.ok(html.indexOf('cozy') < html.indexOf('Speedrun'), 'matching tags are ordered before non-matches');
});

test('tag highlighting is limited to Creator Match', () => {
  const context = { activeTab:'discover', filters:{ tags:['Cozy'] }, escapeHtml };
  vm.runInNewContext(`${helperSource()}\nglobalThis.renderTags = creatorMatchTagsHtml;`, context);
  assert.equal(context.renderTags({ tags:['Cozy'] }), '');
});

test('Creator Match cards explain when Twitch returns no tags', () => {
  const context = { activeTab:'match', filters:{ tags:[] }, escapeHtml };
  vm.runInNewContext(`${helperSource()}\nglobalThis.renderTags = creatorMatchTagsHtml;`, context);
  assert.match(context.renderTags({ tags:[] }), /No Twitch tags listed/);
});

test('matched tag CSS has a distinct visual treatment', () => {
  assert.match(styles, /\.match-tag--matched \{[^}]*border-color:var\(--violet-bright\);[^}]*background:rgba\(139,92,246,.24\)/s);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*\.match-tag--matched/);
});
