import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const foundation = await readFile(new URL('../js/app-foundation.js', import.meta.url), 'utf8');
const filters = await readFile(new URL('../js/filters.js', import.meta.url), 'utf8');
const controls = await readFile(new URL('../js/app-controls.js', import.meta.url), 'utf8');
const discovery = await readFile(new URL('../js/discovery.js', import.meta.url), 'utf8');
const creatorMatch = await readFile(new URL('../js/creator-match.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../css/styles.css', import.meta.url), 'utf8');

test('quick-choice discovery controls use native buttons', () => {
  assert.doesNotMatch(html, /id="genre-filters"[\s\S]*?<label class="toggle">/);
  assert.doesNotMatch(html, /id="content-label-filters"[\s\S]*?<label class="toggle">/);
  for (const value of ['rpg','mmo','shooter','strategy','horror','survival','simulation','adventure']) {
    assert.match(html, new RegExp(`<button[^>]+data-value="${value}"[^>]+aria-pressed="false"`));
  }
  for (const value of ['DebatedSocialIssuesAndPolitics','DrugsIntoxication','Gambling','MatureGame','ProfanityVulgarity','SexualThemes','ViolentGraphic']) {
    assert.match(html, new RegExp(`<button[^>]+data-value="${value}"[^>]+aria-pressed="false"`));
  }
  assert.match(html, /<button id="open-chat-only"[^>]+option-button--inline[^>]+active[^>]+aria-pressed="true"[^>]*>Exclude restricted chats<\/button>/);
  for (const id of ['language-filter','filter-max-uptime','activity-filter']) {
    const start = html.indexOf(`id="${id}"`);
    assert.ok(start >= 0, `${id} exists`);
    assert.match(html.slice(start, start + 2200), /<button/);
    assert.doesNotMatch(html, new RegExp(`<select id="${id}"`));
  }
});

test('restricted chat exclusion is enabled by default and resets to default-on', () => {
  assert.match(foundation, /openChatOnly:true/);
  assert.match(filters, /filters = \{[^;]+openChatOnly:true \};/s);
  assert.match(filters, /setChoicePressed\(openChatOnlyEl, true\)/);
  assert.match(styles, /\.option-button--inline \{[^}]*width:auto;[^}]*min-height:32px;/s);
});

test('Creator Match source and tolerance are button groups', () => {
  assert.match(html, /id="match-source"[\s\S]*data-value="live"[\s\S]*data-value="typical"[\s\S]*data-value="last"[\s\S]*data-value="vod"[\s\S]*data-value="custom"/);
  assert.match(html, /id="match-audience-basis"[\s\S]*data-value="live"[\s\S]*data-value="typical"/);
  assert.match(html, /id="match-tolerance"[\s\S]*data-value="50"[\s\S]*data-value="75"[\s\S]*data-value="100"/);
  assert.doesNotMatch(html, /<select id="match-source"/);
  assert.doesNotMatch(html, /<select id="match-tolerance"/);
  assert.match(controls, /matchSourceEl\.addEventListener\('click'/);
  assert.match(controls, /matchToleranceEl\.addEventListener\('click'/);
  assert.match(creatorMatch, /selectedChoiceValue\(matchSourceEl, 'live'\)/);
  assert.match(creatorMatch, /matchAudienceBasis/);
  assert.match(creatorMatch, /selectedChoiceValue\(matchToleranceEl, '50'\)/);
});

test('button state helpers update classes and aria-pressed together', () => {
  assert.match(foundation, /function setChoicePressed\(button, pressed\)/);
  assert.match(foundation, /button\.classList\.toggle\('active', active\)/);
  assert.match(foundation, /button\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(foundation, /function selectedChoiceValues\(container\)/);
  assert.match(foundation, /function setSingleChoice\(container, value\)/);
});

test('tags and audience presets explicitly synchronize pressed state', () => {
  assert.match(filters, /function syncPopularTagButtons\(\)/);
  assert.match(filters, /button\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(filters, /function syncAudiencePresetButtons\(\)/);
  assert.match(filters, /setChoicePressed\(button, active\)/);
});

test('game category search results are native buttons', () => {
  assert.match(filters, /<li><button class="category-suggestion" type="button" data-id=/);
  assert.match(filters, /querySelectorAll\('button\[data-id\]'\)/);
  assert.match(filters, /addEventListener\('click', \(\) => addCategory/);
  assert.doesNotMatch(filters, /<li class="category-suggestion" tabindex="0"/);
});

test('language, uptime, and activity filters use button click handlers', () => {
  assert.match(filters, /languageFilterEl\.addEventListener\('click'/);
  assert.match(filters, /maxUptimeEl\.addEventListener\('click'/);
  assert.match(filters, /activityFilterEl\.addEventListener\('click'/);
  assert.match(filters, /setSingleChoice\(languageFilterEl/);
  assert.match(filters, /setSingleChoice\(maxUptimeEl/);
  assert.match(filters, /setSingleChoice\(activityFilterEl/);
});

test('category include and exclude mode is a pressed button group', () => {
  assert.match(html, /id="category-filter-mode"[\s\S]*data-value="include"[\s\S]*data-value="exclude"/);
  assert.match(filters, /categoryFilterMode\.addEventListener\('click'/);
  assert.match(filters, /selectedChoiceValue\(categoryFilterMode, 'include'\)/);
});

test('quick-choice buttons have visible active and keyboard focus styling', () => {
  assert.match(styles, /\.option-button\[aria-pressed="true"\]/);
  assert.match(styles, /\.category-suggestion:focus-visible/);
  assert.match(styles, /\.option-button-grid--three/);
});

test('choice button helpers execute real pressed-state transitions', async () => {
  const vm = await import('node:vm');
  const helperMatch = foundation.match(/function choiceButtons\(container\)[\s\S]*?function setSingleChoice\(container, value\) \{[\s\S]*?\n\}/);
  assert.ok(helperMatch, 'choice helper implementation is present');
  const createButton = (value) => {
    const classes = new Set();
    const attrs = new Map([['aria-pressed', 'false']]);
    return {
      dataset:{ value },
      classList:{ toggle(name, force) { force ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      getAttribute(name) { return attrs.get(name) ?? null; },
    };
  };
  const a = createButton('a');
  const b = createButton('b');
  const context = {
    container:{ querySelectorAll() { return [a,b]; } },
    a, b,
  };
  vm.runInNewContext(`${helperMatch[0]}\nsetSingleChoice(container, 'b'); globalThis.result = { value:selectedChoiceValue(container), a:a.getAttribute('aria-pressed'), b:b.getAttribute('aria-pressed'), active:b.classList.contains('active') };`, context);
  assert.deepEqual({ ...context.result }, { value:'b', a:'false', b:'true', active:true });
});

test('genre resolution turns a selected genre into Twitch category filters', async () => {
  const vm = await import('node:vm');
  const resolveStart = filters.indexOf('async function resolveSelectedGenres()');
  const normalizeStart = filters.indexOf('function normalizeCategoryName');
  const categoryTimerStart = filters.indexOf('categoryFilterMode.addEventListener', normalizeStart);
  assert.ok(resolveStart >= 0 && normalizeStart > resolveStart && categoryTimerStart > normalizeStart);
  const resolveSource = filters.slice(resolveStart, normalizeStart);
  const normalizeSource = filters.slice(normalizeStart, categoryTimerStart);
  const context = {
    filters:{ genres:['horror'], categories:[], excludedCategories:[] },
    GENRE_PRESETS:[{ id:'horror', label:'Horror', games:['Phasmophobia','SOMA'] }],
    currentToken:null,
    genreResolveGeneration:0,
    genreHint:{ textContent:'' },
    fetchGamesByNames: async () => [{ id:'509658', name:'Phasmophobia' }],
    renderSelectedCategories() {},
    categoryFiltersChanged() {},
    console,
  };
  vm.runInNewContext(`${normalizeSource}\n${resolveSource}\nglobalThis.runGenreResolve = resolveSelectedGenres;`, context);
  await context.runGenreResolve();
  assert.equal(context.filters.categories.length, 1);
  assert.equal(context.filters.categories[0].id, '509658');
  assert.equal(context.filters.categories[0].source, 'genre');
  assert.deepEqual(Array.from(context.filters.categories[0].genreLabels), ['Horror']);
});

test('common filtering honors tag, content label, category, and viewer choices', async () => {
  const vm = await import('node:vm');
  const start = filters.indexOf('function passesCommonFilters(s,');
  assert.ok(start >= 0);
  const source = filters.slice(start, filters.indexOf('// Keep every button', start));
  const context = {
    filters:{
      tags:['Cozy'], excludedTags:['DropsEnabled'], contentLabels:['MatureGame'], language:'en',
      genres:[], categories:[{ id:'game-1' }], excludedCategories:[], minViewers:10, maxViewers:100,
      audienceBasis:'live', minFollowDays:null, maxUptimeHours:null, activityDays:null, trackerActivityHours:null, trackerGrowth:'', openChatOnly:false,
    },
    activeTab:'discover',
    Date,
  };
  vm.runInNewContext(`${source}\nglobalThis.passes = passesCommonFilters;`, context);
  const base = { tags:['Cozy'], content_classification_labels:['MatureGame'], language:'en', game_id:'game-1', viewer_count:50 };
  assert.equal(context.passes(base), true);
  assert.equal(context.passes({ ...base, tags:['Other'] }), false);
  assert.equal(context.passes({ ...base, tags:['Cozy','DropsEnabled'] }), false);
  assert.equal(context.passes({ ...base, content_classification_labels:[] }), false);
  assert.equal(context.passes({ ...base, game_id:'game-2' }), false);
  assert.equal(context.passes({ ...base, viewer_count:101 }), false);
});
