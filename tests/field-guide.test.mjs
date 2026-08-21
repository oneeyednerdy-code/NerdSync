import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const guide = await readFile(new URL('../guide.html', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const build = await readFile(new URL('../build.mjs', import.meta.url), 'utf8');

test('signed-in NerdSync brand is a real home link wired to Discover', () => {
  assert.match(html, /class="brand-mini brand-home-link" href="#discover"/);
  assert.match(controls, /brandHomeLink\?\.addEventListener\('click'/);
  assert.match(controls, /setActiveTab\('discover'\)/);
});

test('footer links to the NerdSync Field Guide', () => {
  const matches = html.match(/href="guide\.html">NerdSync Field Guide<\/a>/g) || [];
  assert.ok(matches.length >= 2, 'Field Guide is available from both login and app footers');
});

test('Field Guide covers all major NerdSync sections', () => {
  for (const id of ['discover','following','match','saved','filters','cards','settings','privacy']) {
    assert.match(guide, new RegExp(`id="${id}"`));
  }
  assert.match(guide, /Twitch teams first/);
  assert.match(guide, /Exclude restricted chats/);
  assert.match(guide, /Creator Match/);
});

test('production build emits guide.html using the hashed main stylesheet', () => {
  assert.match(build, /readFile\(path\.join\(root, 'guide\.html'\)/);
  assert.match(build, /writeFile\(path\.join\(dist, 'guide\.html'\), guideHtml\)/);
});


test('text-only NerdSync branding removes the brain image asset from all primary surfaces', async () => {
  const css = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /nerdsync-brain-circuit|brand-brain/);
  assert.doesNotMatch(guide, /nerdsync-brain-circuit|brand-brain/);
  assert.doesNotMatch(css, /brand-brain/);
  assert.match(html, /brand-wordmark brand-wordmark--hero/);
  assert.match(html, /brand-mini brand-home-link/);
});
