'use strict';

// --- Filters ---
const mobileLayoutMedia = window.matchMedia('(max-width: 720px)');
function setFilterPanelOpen(open) {
  const shouldReturnFocus = !open && filterPanel.contains(document.activeElement);
  filterPanel.classList.toggle('hidden', !open);
  filtersToggleBtn.setAttribute('aria-expanded', String(open));
  const mobileOpen = open && mobileLayoutMedia.matches;
  mobileFilterBackdrop.classList.toggle('hidden', !mobileOpen);
  document.body.classList.toggle('mobile-sheet-open', mobileOpen);
  if (mobileOpen) {
    filterPanel.setAttribute('role', 'dialog');
    filterPanel.setAttribute('aria-modal', 'true');
    requestAnimationFrame(() => document.getElementById('filter-panel-close').focus());
  } else {
    filterPanel.removeAttribute('role');
    filterPanel.removeAttribute('aria-modal');
    if (shouldReturnFocus) requestAnimationFrame(() => filtersToggleBtn.focus());
  }
}
function closeFilterPanel() { setFilterPanelOpen(false); }
filtersToggleBtn.addEventListener('click', () => setFilterPanelOpen(filterPanel.classList.contains('hidden')));
document.getElementById('filter-panel-close').addEventListener('click', closeFilterPanel);
mobileFilterBackdrop.addEventListener('click', closeFilterPanel);
mobileLayoutMedia.addEventListener?.('change', () => {
  if (!mobileLayoutMedia.matches) {
    mobileFilterBackdrop.classList.add('hidden');
    document.body.classList.remove('mobile-sheet-open');
    filterPanel.removeAttribute('role');
    filterPanel.removeAttribute('aria-modal');
  } else if (!filterPanel.classList.contains('hidden')) {
    mobileFilterBackdrop.classList.remove('hidden');
    document.body.classList.add('mobile-sheet-open');
    filterPanel.setAttribute('role', 'dialog');
    filterPanel.setAttribute('aria-modal', 'true');
  }
});

tagInput.addEventListener('input', debounce(() => {
  filters.tags = parseTagInput(tagInput.value);
  syncPopularTagButtons();
  filtersChanged();
}, DEBOUNCE_MS));

function syncPopularTagButtons() {
  const selected = new Set(filters.tags.map(tag => tag.toLowerCase()));
  document.querySelectorAll('.tag-preset').forEach(button => {
    const active = selected.has(button.dataset.tag.toLowerCase());
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

document.querySelectorAll('.tag-preset').forEach(button => button.addEventListener('click', () => {
  const tag = button.dataset.tag;
  const exists = filters.tags.some(selected => selected.toLowerCase() === tag.toLowerCase());
  filters.tags = exists ? filters.tags.filter(selected => selected.toLowerCase() !== tag.toLowerCase()) : [...filters.tags, tag];
  tagInput.value = filters.tags.join(', ');
  syncPopularTagButtons();
  filtersChanged();
}));

excludedTagsInput.addEventListener('input', debounce(() => {
  filters.excludedTags = parseTagInput(excludedTagsInput.value);
  filtersChanged();
}, DEBOUNCE_MS));
languageFilterEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !languageFilterEl.contains(button)) return;
  setSingleChoice(languageFilterEl, button.dataset.value);
  filters.language = button.dataset.value;
  filtersChanged();
});
maxUptimeEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !maxUptimeEl.contains(button)) return;
  setSingleChoice(maxUptimeEl, button.dataset.value);
  filters.maxUptimeHours = numOrNull(button.dataset.value);
  filtersChanged();
});
activityFilterEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !activityFilterEl.contains(button)) return;
  setSingleChoice(activityFilterEl, button.dataset.value);
  filters.activityDays = numOrNull(button.dataset.value);
  renderFilterState();
  delete tabCache[activeTab];
  loadStreams();
});
openChatOnlyEl.addEventListener('click', () => {
  filters.openChatOnly = toggleChoicePressed(openChatOnlyEl);
  renderFilterState();
  delete tabCache[activeTab];
  loadStreams();
});
contentLabelFiltersEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !contentLabelFiltersEl.contains(button)) return;
  toggleChoicePressed(button);
  filters.contentLabels = selectedChoiceValues(contentLabelFiltersEl);
  filtersChanged();
});

function syncAudiencePresetButtons() {
  document.querySelectorAll('.audience-preset').forEach(button => {
    const active = String(filters.minViewers ?? '') === button.dataset.min && String(filters.maxViewers ?? '') === button.dataset.max;
    setChoicePressed(button, active);
  });
}

document.querySelectorAll('.audience-preset').forEach(button => button.addEventListener('click', () => {
  minViewersInput.value = button.dataset.min;
  maxViewersInput.value = button.dataset.max;
  filters.minViewers = numOrNull(button.dataset.min);
  filters.maxViewers = numOrNull(button.dataset.max);
  syncAudiencePresetButtons();
  filtersChanged();
}));

function parseTagInput(value) {
  const seen = new Set();
  return String(value || '').split(',').map(tag => tag.trim()).filter(tag => {
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numOrNull(val) {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

minViewersInput.addEventListener('input', debounce(() => {
  filters.minViewers = numOrNull(minViewersInput.value);
  syncAudiencePresetButtons();
  filtersChanged();
}, DEBOUNCE_MS));

maxViewersInput.addEventListener('input', debounce(() => {
  filters.maxViewers = numOrNull(maxViewersInput.value);
  syncAudiencePresetButtons();
  filtersChanged();
}, DEBOUNCE_MS));

followDaysInput.addEventListener('input', debounce(() => {
  filters.minFollowDays = numOrNull(followDaysInput.value);
  filtersChanged();
}, DEBOUNCE_MS));

function filtersChanged() {
  currentPage = 1;
  renderFilterState();
  renderGrid();
}

let genreResolveTimer = null;
let genreResolveGeneration = 0;
genreFiltersEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !genreFiltersEl.contains(button)) return;
  toggleChoicePressed(button);
  filters.genres = selectedChoiceValues(genreFiltersEl);
  renderFilterState();
  clearTimeout(genreResolveTimer);
  genreHint.textContent = filters.genres.length ? 'Resolving genre games against Twitch categories…' : 'Choose one or more groups. NerdSync resolves the same curated Wormhole game lists against Twitch categories.';
  genreResolveTimer = setTimeout(resolveSelectedGenres, 250);
});

async function resolveSelectedGenres() {
  const generation = ++genreResolveGeneration;
  filters.categories = filters.categories.filter(category => category.source !== 'genre');
  if (!filters.genres.length) {
    renderSelectedCategories();
    categoryFiltersChanged();
    return;
  }
  const names = [...new Set(GENRE_PRESETS.filter(preset => filters.genres.includes(preset.id)).flatMap(preset => preset.games))];
  try {
    const games = await fetchGamesByNames(names, currentToken);
    if (generation !== genreResolveGeneration) return;
    games.forEach(game => {
      if (!filters.categories.some(category => category.id === game.id)) {
        const labels = GENRE_PRESETS.filter(preset => filters.genres.includes(preset.id) && preset.games.some(name => normalizeCategoryName(name) === normalizeCategoryName(game.name))).map(preset => preset.label);
        filters.categories.push({ id: game.id, name: game.name, source: 'genre', genreLabels: labels });
      }
    });
    const unresolved = names.length - games.length;
    genreHint.textContent = `${games.length} genre ${games.length === 1 ? 'category' : 'categories'} selected${unresolved ? `; ${unresolved} unavailable names were skipped` : ''}.`;
  } catch (error) {
    console.error(error);
    genreHint.textContent = 'Could not resolve genre categories. Try again.';
  }
  renderSelectedCategories();
  categoryFiltersChanged();
}

function normalizeCategoryName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

categoryFilterMode.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !categoryFilterMode.contains(button)) return;
  setSingleChoice(categoryFilterMode, button.dataset.value);
});

let categorySearchTimer = null;
let categorySearchGeneration = 0;
categorySearchInput.addEventListener('input', () => {
  clearTimeout(categorySearchTimer);
  if (!categorySearchInput.value.trim()) return hideCategorySuggestions();
  categorySearchTimer = setTimeout(() => runCategorySearch(categorySearchInput.value), DEBOUNCE_MS);
});
categorySearchInput.addEventListener('blur', () => setTimeout(hideCategorySuggestions, 150));

async function runCategorySearch(query) {
  const generation = ++categorySearchGeneration;
  const normalizedQuery = query.trim();
  try {
    const results = await searchTwitchCategories(normalizedQuery, currentToken);
    if (generation !== categorySearchGeneration || categorySearchInput.value.trim() !== normalizedQuery) return;
    const selectedIds = new Set([...filters.categories, ...filters.excludedCategories].map(category => category.id));
    const available = results.filter(game => !selectedIds.has(game.id));
    categorySuggestions.innerHTML = available.length ? available.map(game => `<li><button class="category-suggestion" type="button" data-id="${escapeHtml(game.id)}" data-name="${escapeHtml(game.name)}"><img src="${escapeHtml((game.box_art_url || '').replace('{width}','52').replace('{height}','72'))}" alt="" />${escapeHtml(game.name)}</button></li>`).join('') : '<li class="category-suggestion-empty">No other matches</li>';
    categorySuggestions.classList.remove('hidden');
    categorySuggestions.querySelectorAll('button[data-id]').forEach(button => {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => addCategory({ id:button.dataset.id, name:button.dataset.name, source:'manual' }, selectedChoiceValue(categoryFilterMode, 'include')));
    });
  } catch (error) {
    console.error(error);
    hideCategorySuggestions();
  }
}

function hideCategorySuggestions() { categorySuggestions.classList.add('hidden'); }
function categoryFiltersChanged() {
  ['discover', 'match', 'spotlight', 'gems', 'rising'].forEach(tab => { delete tabCache[tab]; });
  currentPage = 1;
  renderFilterState();
  if (['discover', 'match', 'spotlight', 'gems', 'rising'].includes(activeTab)) loadStreams();
  else renderGrid();
}
function addCategory(category, mode = 'include') {
  const collection = mode === 'exclude' ? filters.excludedCategories : filters.categories;
  if (!collection.some(existing => existing.id === category.id)) collection.push(category);
  categorySearchInput.value = '';
  hideCategorySuggestions();
  renderSelectedCategories();
  categoryFiltersChanged();
}
function removeCategory(id, mode = 'include') {
  if (mode === 'exclude') filters.excludedCategories = filters.excludedCategories.filter(category => category.id !== id);
  else filters.categories = filters.categories.filter(category => category.id !== id);
  renderSelectedCategories();
  categoryFiltersChanged();
}
function renderSelectedCategories() {
  const included = filters.categories.map(category => `<span class="filter-chip${category.source === 'genre' ? ' genre' : ''}" title="Included category">${escapeHtml(category.name)}<button type="button" data-remove-category="${escapeHtml(category.id)}" data-category-mode="include" aria-label="Remove ${escapeHtml(category.name)}">×</button></span>`);
  const excluded = filters.excludedCategories.map(category => `<span class="filter-chip exclude" title="Excluded category">Not ${escapeHtml(category.name)}<button type="button" data-remove-category="${escapeHtml(category.id)}" data-category-mode="exclude" aria-label="Remove ${escapeHtml(category.name)} exclusion">×</button></span>`);
  selectedCategoriesEl.innerHTML = [...included, ...excluded].join('');
  selectedCategoriesEl.querySelectorAll('[data-remove-category]').forEach(button => button.addEventListener('click', () => removeCategory(button.dataset.removeCategory, button.dataset.categoryMode)));
}

clearFiltersBtn.addEventListener('click', () => {
  genreResolveGeneration += 1;
  clearTimeout(genreResolveTimer);
  filters = { tags: [], excludedTags: [], contentLabels:[], language:'', genres: [], categories: [], excludedCategories: [], minViewers: null, maxViewers: null, minFollowDays: null, maxUptimeHours:null, activityDays:null, openChatOnly:true };
  tagInput.value = '';
  excludedTagsInput.value = '';
  setSingleChoice(languageFilterEl, '');
  minViewersInput.value = '';
  maxViewersInput.value = '';
  followDaysInput.value = '';
  setSingleChoice(maxUptimeEl, '');
  setSingleChoice(activityFilterEl, '');
  setChoicePressed(openChatOnlyEl, true);
  choiceButtons(contentLabelFiltersEl).forEach(button => setChoicePressed(button, false));
  choiceButtons(genreFiltersEl).forEach(button => setChoicePressed(button, false));
  setSingleChoice(categoryFilterMode, 'include');
  setSingleChoice(languageFilterEl, '');
  setSingleChoice(maxUptimeEl, '');
  setSingleChoice(activityFilterEl, '');
  categorySearchInput.value = '';
  syncPopularTagButtons();
  syncAudiencePresetButtons();
  genreHint.textContent = 'Choose one or more groups. NerdSync resolves the same curated Wormhole game lists against Twitch categories.';
  renderSelectedCategories();
  categoryFiltersChanged();
});

function renderFilterState() {
  const active = [
    ...filters.tags.map(tag => ({ key:`tag:${tag}`, label:`#${tag}` })),
    ...filters.excludedTags.map(tag => ({ key:`excludedTag:${tag}`, label:`Not #${tag}` })),
    ...filters.contentLabels.map(id => ({ key:`contentLabel:${id}`, label:CONTENT_LABELS[id] || id })),
    ...(filters.language ? [{ key:'language', label:`Language ${filters.language.toUpperCase()}` }] : []),
    ...filters.genres.map(id => ({ key:`genre:${id}`, label:(GENRE_PRESETS.find(preset => preset.id === id)?.label || id) })),
    ...filters.categories.filter(category => category.source === 'manual').map(category => ({ key:`category:${category.id}`, label:category.name })),
    ...filters.excludedCategories.map(category => ({ key:`excludedCategory:${category.id}`, label:`Not ${category.name}` })),
    ...(filters.minViewers != null ? [{ key:'min', label:`Min ${filters.minViewers}` }] : []),
    ...(filters.maxViewers != null ? [{ key:'max', label:`Max ${filters.maxViewers}` }] : []),
    ...(filters.minFollowDays != null ? [{ key:'follow', label:`Followed ${filters.minFollowDays}+ days` }] : []),
    ...(filters.maxUptimeHours != null ? [{ key:'uptime', label:`Uptime ≤ ${filters.maxUptimeHours}h` }] : []),
    ...(filters.activityDays != null ? [{ key:'activity', label:`Active in ${filters.activityDays}d` }] : []),
    ...(filters.openChatOnly ? [{ key:'openChat', label:'Open chat only' }] : [])
  ];
  const count = active.length;
  filtersBadge.textContent = String(count);
  filtersBadge.classList.toggle('hidden', count === 0);
  activeFilterCount.textContent = `${count} active filter${count === 1 ? '' : 's'}`;
  activeFilterChips.innerHTML = active.map(item => `<button class="active-chip" type="button" data-clear-filter="${escapeHtml(item.key)}" aria-label="Remove ${escapeHtml(item.label)} filter">${escapeHtml(item.label)} ×</button>`).join('');
  activeFilterChips.querySelectorAll('[data-clear-filter]').forEach(button => button.addEventListener('click', () => clearSingleFilter(button.dataset.clearFilter)));
}

function clearSingleFilter(key) {
  if (key.startsWith('tag:')) {
    const removed = key.slice(4).toLowerCase();
    filters.tags = filters.tags.filter(tag => tag.toLowerCase() !== removed);
    tagInput.value = filters.tags.join(', ');
    syncPopularTagButtons();
  } else if (key.startsWith('excludedTag:')) {
    const removed = key.slice(12).toLowerCase();
    filters.excludedTags = filters.excludedTags.filter(tag => tag.toLowerCase() !== removed);
    excludedTagsInput.value = filters.excludedTags.join(', ');
  } else if (key.startsWith('contentLabel:')) {
    const id = key.slice(13);
    filters.contentLabels = filters.contentLabels.filter(label => label !== id);
    const button = choiceButtons(contentLabelFiltersEl).find(item => item.dataset.value === id);
    setChoicePressed(button, false);
  } else if (key === 'language') { filters.language = ''; setSingleChoice(languageFilterEl, ''); }
  else if (key.startsWith('genre:')) {
    const id = key.slice(6);
    const button = choiceButtons(genreFiltersEl).find(item => item.dataset.value === id);
    setChoicePressed(button, false);
    filters.genres = filters.genres.filter(genre => genre !== id);
    resolveSelectedGenres();
    return;
  } else if (key.startsWith('category:')) {
    removeCategory(key.slice(9));
    return;
  } else if (key.startsWith('excludedCategory:')) {
    removeCategory(key.slice(17), 'exclude');
    return;
  } else if (key === 'min') { filters.minViewers = null; minViewersInput.value = ''; syncAudiencePresetButtons(); }
  else if (key === 'max') { filters.maxViewers = null; maxViewersInput.value = ''; syncAudiencePresetButtons(); }
  else if (key === 'follow') { filters.minFollowDays = null; followDaysInput.value = ''; }
  else if (key === 'uptime') { filters.maxUptimeHours = null; setSingleChoice(maxUptimeEl, ''); }
  else if (key === 'activity') { filters.activityDays = null; setSingleChoice(activityFilterEl, ''); delete tabCache[activeTab]; loadStreams(); return; }
  else if (key === 'openChat') { filters.openChatOnly = false; setChoicePressed(openChatOnlyEl, false); delete tabCache[activeTab]; loadStreams(); return; }
  filtersChanged();
}

function passesCommonFilters(s) {
  const streamTags = (s.tags || []).map(tag => String(tag).trim().toLowerCase());
  const contentLabels = s.content_classification_labels || [];
  if (filters.tags.length) {
    if (!filters.tags.some(tag => streamTags.includes(tag.toLowerCase()))) return false;
  }
  if (filters.excludedTags.some(tag => streamTags.includes(tag.toLowerCase()))) return false;
  if (filters.contentLabels.length && !filters.contentLabels.some(label => contentLabels.includes(label))) return false;
  if (filters.language && s.language !== filters.language) return false;
  if (filters.categories.length && !filters.categories.some(category => category.id === s.game_id)) return false;
  if (filters.excludedCategories.some(category => category.id === s.game_id)) return false;
  if (filters.minViewers != null && s.viewer_count < filters.minViewers) return false;
  if (filters.maxViewers != null && s.viewer_count > filters.maxViewers) return false;
  if (filters.maxUptimeHours != null && s.started_at) {
    const uptimeHours = (Date.now() - new Date(s.started_at).getTime()) / 3600000;
    if (uptimeHours > filters.maxUptimeHours) return false;
  }
  if (filters.activityDays != null) {
    if (!s._lastBroadcastAt || Date.now() - new Date(s._lastBroadcastAt).getTime() > filters.activityDays * 86400000) return false;
  }
  if (filters.openChatOnly && s._chatOpen !== true) return false;
  if (filters.minFollowDays != null && activeTab === 'following') {
    const days = s._followedAt ? (Date.now() - new Date(s._followedAt).getTime()) / 86400000 : null;
    if (days == null || days < filters.minFollowDays) return false;
  }
  return true;
}

// Keep every button's visual/accessible state aligned with the filter model on first load.
syncPopularTagButtons();
syncAudiencePresetButtons();
setChoicePressed(openChatOnlyEl, filters.openChatOnly);
choiceButtons(contentLabelFiltersEl).forEach(button => setChoicePressed(button, filters.contentLabels.includes(button.dataset.value)));
choiceButtons(genreFiltersEl).forEach(button => setChoicePressed(button, filters.genres.includes(button.dataset.value)));
setSingleChoice(categoryFilterMode, 'include');
setSingleChoice(languageFilterEl, filters.language);
setSingleChoice(maxUptimeEl, filters.maxUptimeHours == null ? '' : String(filters.maxUptimeHours));
setSingleChoice(activityFilterEl, filters.activityDays == null ? '' : String(filters.activityDays));
