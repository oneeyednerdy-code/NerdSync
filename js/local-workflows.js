'use strict';

// Alpha-0.19.0 local-only workflow tools. These intentionally use browser storage only.
const LOCAL_WORKFLOW_VERSION = typeof NERDSYNC_META !== 'undefined' ? NERDSYNC_META.localWorkflowSchema : 2;
const LOCAL_WORKFLOW_KEY = 'nerdsync_local_workflows_v1';
let localWorkflowData = { version:LOCAL_WORKFLOW_VERSION, filterPresets:[], matchHistory:[], matchShortlist:[], collections:[] };
let activeSavedCollectionId = '';
let discoverySessionState = null;

function localWorkflowStorageKey() {
  return `${LOCAL_WORKFLOW_KEY}:${currentUser?.id || 'anonymous'}`;
}

function loadLocalWorkflowData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(localWorkflowStorageKey()) || '{}') || {};
    localWorkflowData = {
      version:LOCAL_WORKFLOW_VERSION,
      filterPresets:Array.isArray(parsed.filterPresets) ? parsed.filterPresets.slice(0, 20) : [],
      matchHistory:Array.isArray(parsed.matchHistory) ? parsed.matchHistory.slice(0, 20) : [],
      matchShortlist:Array.isArray(parsed.matchShortlist) ? parsed.matchShortlist.slice(0, 30) : [],
      collections:Array.isArray(parsed.collections) ? parsed.collections.slice(0, 30).map(item => ({ ...item, creatorIds:Array.isArray(item.creatorIds) ? [...new Set(item.creatorIds.map(String))].slice(0, 500) : [] })) : [],
    };
  } catch {
    localWorkflowData = { version:LOCAL_WORKFLOW_VERSION, filterPresets:[], matchHistory:[], matchShortlist:[], collections:[] };
  }
  renderLocalWorkflowTools();
}

function saveLocalWorkflowData() {
  try { localStorage.setItem(localWorkflowStorageKey(), JSON.stringify(localWorkflowData)); }
  catch (error) { console.warn('Could not save local workflow data', error); }
}

function localWorkflowStringList(value, limit = 50) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, limit) : [];
}

function localWorkflowNumber(value, { min = 0, max = 1000000000 } = {}) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function localWorkflowCategories(value, { allowSource = false } = {}) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).map(item => {
    if (!item || typeof item !== 'object') return null;
    const id = String(item.id || '').trim();
    if (!/^\d{1,24}$/.test(id)) return null;
    const name = String(item.name || '').trim().slice(0, 120);
    const record = { id, name };
    if (allowSource) record.source = item.source === 'genre' ? 'genre' : 'manual';
    return record;
  }).filter(Boolean);
}

function normalizeSerializableFilters(source = filters) {
  const validGenreIds = new Set((typeof GENRE_PRESETS !== 'undefined' ? GENRE_PRESETS : []).map(item => item.id));
  const audienceBasis = source?.audienceBasis === 'typical' ? 'typical' : 'live';
  const trackerGrowth = ['growing','strong'].includes(source?.trackerGrowth) ? source.trackerGrowth : '';
  const language = /^[a-z]{2,8}$/i.test(String(source?.language || '')) ? String(source.language).toLowerCase() : '';
  return {
    tags:localWorkflowStringList(source?.tags),
    preferredTags:localWorkflowStringList(source?.preferredTags),
    excludedTags:localWorkflowStringList(source?.excludedTags),
    contentLabels:localWorkflowStringList(source?.contentLabels, 20),
    language,
    genres:localWorkflowStringList(source?.genres, 20).filter(id => !validGenreIds.size || validGenreIds.has(id)),
    categories:localWorkflowCategories(source?.categories, { allowSource:true }),
    excludedCategories:localWorkflowCategories(source?.excludedCategories),
    minViewers:localWorkflowNumber(source?.minViewers),
    maxViewers:localWorkflowNumber(source?.maxViewers),
    audienceBasis,
    minFollowDays:localWorkflowNumber(source?.minFollowDays, { max:36500 }),
    maxUptimeHours:localWorkflowNumber(source?.maxUptimeHours, { max:168 }),
    activityDays:localWorkflowNumber(source?.activityDays, { max:3650 }),
    trackerActivityHours:localWorkflowNumber(source?.trackerActivityHours, { max:744 }),
    trackerGrowth,
    openChatOnly:source?.openChatOnly !== false,
  };
}

function applySerializableFilters(payload) {
  if (!payload || typeof payload !== 'object') return false;
  filters = {
    ...filters,
    ...normalizeSerializableFilters(payload),
  };
  tagInput.value = filters.tags.join(', ');
  const preferredInput = document.getElementById('preferred-tags');
  if (preferredInput) preferredInput.value = filters.preferredTags.join(', ');
  excludedTagsInput.value = filters.excludedTags.join(', ');
  minViewersInput.value = filters.minViewers ?? '';
  maxViewersInput.value = filters.maxViewers ?? '';
  followDaysInput.value = filters.minFollowDays ?? '';
  setSingleChoice(languageFilterEl, filters.language || '');
  setSingleChoice(maxUptimeEl, filters.maxUptimeHours == null ? '' : String(filters.maxUptimeHours));
  setSingleChoice(activityFilterEl, filters.activityDays == null ? '' : String(filters.activityDays));
  setSingleChoice(document.getElementById('audience-basis-filter'), filters.audienceBasis || 'live');
  setSingleChoice(document.getElementById('tracker-activity-filter'), filters.trackerActivityHours == null ? '' : String(filters.trackerActivityHours));
  setSingleChoice(document.getElementById('tracker-growth-filter'), filters.trackerGrowth || '');
  setChoicePressed(openChatOnlyEl, filters.openChatOnly !== false);
  choiceButtons(contentLabelFiltersEl).forEach(button => setChoicePressed(button, filters.contentLabels.includes(button.dataset.value)));
  choiceButtons(genreFiltersEl).forEach(button => setChoicePressed(button, filters.genres.includes(button.dataset.value)));
  syncPopularTagButtons();
  syncAudiencePresetButtons();
  renderSelectedCategories();
  renderFilterState();
  ['discover','match','spotlight','gems','rising'].forEach(tab => delete tabCache[tab]);
  currentPage = 1;
  return true;
}

function encodeSharedFilters(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeSharedFilters(value) {
  try {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

function applySharedFiltersFromUrl() {
  const url = new URL(window.location.href);
  const encoded = url.searchParams.get('nsf');
  if (!encoded) return false;
  const payload = decodeSharedFilters(encoded);
  if (!payload) return false;
  const applied = applySerializableFilters(payload);
  if (applied) setStatus('Shared Discovery filters loaded. They are active only in this browser unless you save them as a preset.');
  return applied;
}

async function copyShareableFilterUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('nsf', encodeSharedFilters(normalizeSerializableFilters()));
  url.hash = '';
  try {
    await navigator.clipboard.writeText(url.href);
    setStatus('Shareable filter link copied. It contains only the visible filter choices, not your Twitch identity or token.');
  } catch {
    window.prompt('Copy this NerdSync filter link:', url.href);
  }
}

function localWorkflowId() {
  try { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
  catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

function saveCurrentFilterPreset() {
  const input = document.getElementById('filter-preset-name');
  const name = String(input?.value || '').trim().slice(0, 60);
  if (!name) { setStatus('Give the filter preset a name first.', true); input?.focus(); return; }
  const existing = localWorkflowData.filterPresets.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
  const record = { id:localWorkflowId(), name, filters:normalizeSerializableFilters(), updatedAt:Date.now() };
  if (existing >= 0) localWorkflowData.filterPresets.splice(existing, 1, record);
  else localWorkflowData.filterPresets.unshift(record);
  localWorkflowData.filterPresets = localWorkflowData.filterPresets.slice(0, 20);
  saveLocalWorkflowData();
  if (input) input.value = '';
  renderFilterPresets();
  setStatus(`Saved local filter preset “${name}”.`);
}

function renderFilterPresets() {
  const container = document.getElementById('filter-preset-list');
  if (!container) return;
  container.innerHTML = localWorkflowData.filterPresets.length
    ? localWorkflowData.filterPresets.map(item => `<div class="local-tool-row"><button class="btn-logout local-tool-grow" type="button" data-load-filter-preset="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button><button class="footer-text-button" type="button" data-delete-filter-preset="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(item.name)} preset">Delete</button></div>`).join('')
    : '<p class="filter-hint">No local presets yet.</p>';
}

function recordCreatorMatchSearch(details) {
  const entry = { id:localWorkflowId(), at:Date.now(), ...details };
  localWorkflowData.matchHistory = [entry, ...localWorkflowData.matchHistory].slice(0, 20);
  saveLocalWorkflowData();
  renderMatchHistory();
}

function renderMatchHistory() {
  const container = document.getElementById('match-history-list');
  if (!container) return;
  container.innerHTML = localWorkflowData.matchHistory.length
    ? localWorkflowData.matchHistory.slice(0, 8).map(item => `<button class="btn-logout match-history-item" type="button" data-replay-match="${escapeHtml(item.id)}"><strong>${escapeHtml(String(item.audience || '?'))} viewers · ±${escapeHtml(String(item.tolerance || 50))}%</strong><span>${escapeHtml(item.sourceLabel || 'Creator Match')} · ${escapeHtml(new Date(item.at).toLocaleDateString())}</span></button>`).join('')
    : '<p class="filter-hint">No local Creator Match searches yet.</p>';
}

function replayCreatorMatchHistory(id) {
  const item = localWorkflowData.matchHistory.find(entry => entry.id === id);
  if (!item) return;
  if (Number.isFinite(Number(item.audience))) {
    matchPeakEl.value = String(item.audience);
    matchPeak = Number(item.audience);
  }
  if (item.tolerance) { setSingleChoice(matchToleranceEl, String(item.tolerance)); matchTolerance = Number(item.tolerance); }
  const required = document.getElementById('match-required-tags');
  const preferred = document.getElementById('match-preferred-tags');
  const excluded = document.getElementById('match-excluded-tags');
  if (required) required.value = (item.requiredTags || []).join(', ');
  if (preferred) preferred.value = (item.preferredTags || []).join(', ');
  if (excluded) excluded.value = (item.excludedTags || []).join(', ');
  updateMatchRangeSummary();
  setStatus('Creator Match history restored. Review the audience number, then run the match.');
}

function shortlistHas(id) { return localWorkflowData.matchShortlist.some(item => item.id === String(id)); }
function toggleMatchShortlist(stream) {
  if (!stream) return;
  const id = String(stream.user_id || stream.id || '');
  if (!id) return;
  if (shortlistHas(id)) localWorkflowData.matchShortlist = localWorkflowData.matchShortlist.filter(item => item.id !== id);
  else localWorkflowData.matchShortlist.unshift({ id, snapshot:creatorSnapshot(stream), addedAt:Date.now(), matchWhy:stream._why || '' });
  localWorkflowData.matchShortlist = localWorkflowData.matchShortlist.slice(0, 30);
  saveLocalWorkflowData();
  renderMatchShortlist();
  renderCollections();
}

function renderMatchShortlist() {
  const container = document.getElementById('match-shortlist-list');
  const count = document.getElementById('match-shortlist-count');
  if (count) count.textContent = String(localWorkflowData.matchShortlist.length);
  if (!container) return;
  container.innerHTML = localWorkflowData.matchShortlist.length
    ? localWorkflowData.matchShortlist.map(item => {
      const s = streamFromSnapshot(item.snapshot);
      return `<div class="local-tool-row"><div class="local-tool-grow"><strong>${escapeHtml(s.user_name || s.user_login)}</strong><span>${escapeHtml(s.game_name || 'No category')}${item.matchWhy ? ` · ${escapeHtml(item.matchWhy)}` : ''}</span></div><a class="footer-text-button" href="https://twitch.tv/${encodeURIComponent(s.user_login)}" target="_blank" rel="noopener noreferrer">Twitch</a><button class="footer-text-button" type="button" data-compare-shortlist="${escapeHtml(item.id)}">Compare</button><button class="footer-text-button" type="button" data-remove-shortlist="${escapeHtml(item.id)}">Remove</button></div>`;
    }).join('')
    : '<p class="filter-hint">Shortlist Creator Match cards to compare or export them here.</p>';
}

function cycleCreatorBookmark(stream) {
  if (!stream) return '';
  const id = stream.user_id || stream.id;
  const current = historyFor(id).bookmark || '';
  const order = ['', 'maybe', 'watch', 'raid'];
  const next = order[(order.indexOf(current) + 1) % order.length];
  updateHistory(id, { bookmark:next, snapshot:creatorSnapshot(stream) });
  return next;
}

function bookmarkLabel(value) {
  return value === 'maybe' ? 'Maybe' : value === 'watch' ? 'Watch later' : value === 'raid' ? 'Possible raid' : 'Mark';
}

function exportRowsForCurrentView() {
  const cfg = TABS[activeTab];
  if (cfg?.isClips) return [];
  const query = searchInput.value.trim().toLowerCase();
  let items = [...allStreams];
  if (query) items = items.filter(s => String(s.user_name || '').toLowerCase().includes(query) || String(s.game_name || '').toLowerCase().includes(query));
  if (excludePartners) items = items.filter(item => item._broadcasterType !== 'partner');
  items = items.filter(item => !isDismissed(item.user_id || item.broadcaster_id));
  if (cfg?.hasCommonFilters) items = items.filter(passesCommonFilters);
  return items;
}

function creatorExportRecord(stream) {
  const summary = stream._trackerSummary || {};
  return {
    creator:stream.user_name || '',
    login:stream.user_login || '',
    twitch:`https://twitch.tv/${stream.user_login || ''}`,
    twitchtracker:stream.user_login ? `https://twitchtracker.com/${stream.user_login}` : '',
    game:stream.game_name || '',
    live_viewers:stream.viewer_count ?? '',
    typical_30d:Number.isFinite(summary.averageViewers) ? summary.averageViewers : '',
    followers_gained_30d:Number.isFinite(summary.followersGained) ? summary.followersGained : '',
    hours_streamed_30d:Number.isFinite(summary.minutesStreamed) ? Math.round(summary.minutesStreamed / 6) / 10 : '',
    tags:(stream.tags || []).join(' | '),
    reason:stream._why || '',
    bookmark:historyFor(stream.user_id).bookmark || '',
  };
}

function csvCell(value) { const text = String(value ?? ''); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replace(/"/g, '""')}"`; }
function downloadTextFile(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportDiscovery(format = 'txt') {
  const records = exportRowsForCurrentView().map(creatorExportRecord);
  if (!records.length) { setStatus('There are no current creator results to export.', true); return; }
  const stamp = new Date().toISOString().slice(0,10);
  if (format === 'json') return downloadTextFile(`nerdsync-${activeTab}-${stamp}.json`, JSON.stringify(records, null, 2), 'application/json;charset=utf-8');
  if (format === 'csv') {
    const headers = Object.keys(records[0]);
    const csv = [headers.map(csvCell).join(','), ...records.map(row => headers.map(key => csvCell(row[key])).join(','))].join('\n');
    return downloadTextFile(`nerdsync-${activeTab}-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  }
  const text = records.map(row => `${row.creator} (@${row.login})\n${row.game} · ${row.live_viewers} live${row.typical_30d !== '' ? ` · ${row.typical_30d} typical/30d` : ''}\n${row.tags ? `Tags: ${row.tags}\n` : ''}${row.reason ? `Why: ${row.reason}\n` : ''}${row.twitch}\n${row.twitchtracker}`).join('\n\n---\n\n');
  downloadTextFile(`nerdsync-${activeTab}-${stamp}.txt`, text);
}

function exportMatchShortlist(format = 'txt') {
  const records = localWorkflowData.matchShortlist.map(item => creatorExportRecord({ ...streamFromSnapshot(item.snapshot), _why:item.matchWhy || '' }));
  if (!records.length) { setStatus('Your Creator Match shortlist is empty.', true); return; }
  const stamp = new Date().toISOString().slice(0,10);
  if (format === 'json') return downloadTextFile(`nerdsync-match-shortlist-${stamp}.json`, JSON.stringify(records, null, 2), 'application/json;charset=utf-8');
  if (format === 'csv') {
    const headers = Object.keys(records[0]);
    const csv = [headers.map(csvCell).join(','), ...records.map(row => headers.map(key => csvCell(row[key])).join(','))].join('\n');
    return downloadTextFile(`nerdsync-match-shortlist-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
  }
  const text = records.map(row => `${row.creator} (@${row.login}) · ${row.game}\n${row.reason}\n${row.twitch}\n${row.twitchtracker}`).join('\n\n');
  downloadTextFile(`nerdsync-match-shortlist-${stamp}.txt`, text);
}


function createCollection(name) {
  const clean = String(name || '').trim().slice(0, 50);
  if (!clean) return null;
  const existing = localWorkflowData.collections.find(item => item.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const collection = { id:localWorkflowId(), name:clean, creatorIds:[], createdAt:Date.now(), updatedAt:Date.now() };
  localWorkflowData.collections.unshift(collection);
  localWorkflowData.collections = localWorkflowData.collections.slice(0, 30);
  saveLocalWorkflowData();
  renderCollections();
  return collection;
}

function collectionFor(id) { return localWorkflowData.collections.find(item => item.id === String(id)); }

function addCreatorToCollection(creatorId, collectionId) {
  const collection = collectionFor(collectionId);
  if (!collection || !creatorId) return false;
  const id = String(creatorId);
  if (!collection.creatorIds.includes(id)) collection.creatorIds.push(id);
  collection.creatorIds = collection.creatorIds.slice(-500);
  collection.updatedAt = Date.now();
  saveLocalWorkflowData();
  renderCollections();
  renderSavedList();
  return true;
}

function removeCreatorFromCollection(creatorId, collectionId) {
  const collection = collectionFor(collectionId);
  if (!collection) return;
  collection.creatorIds = collection.creatorIds.filter(id => id !== String(creatorId));
  collection.updatedAt = Date.now();
  saveLocalWorkflowData();
  renderCollections();
  renderSavedList();
}

function creatorCollectionNames(creatorId) {
  return localWorkflowData.collections.filter(item => item.creatorIds.includes(String(creatorId))).map(item => item.name);
}

function renderCollections() {
  const container = document.getElementById('saved-collections-list');
  const select = document.getElementById('saved-collection-filter');
  if (select) {
    const current = activeSavedCollectionId;
    select.innerHTML = '<option value="">All saved creators</option>' + localWorkflowData.collections.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${item.creatorIds.length})</option>`).join('');
    select.value = localWorkflowData.collections.some(item => item.id === current) ? current : '';
    if (select.value !== current) activeSavedCollectionId = '';
  }
  if (!container) return;
  container.innerHTML = localWorkflowData.collections.length
    ? localWorkflowData.collections.map(item => `<div class="local-tool-row"><button class="btn-logout local-tool-grow" type="button" data-view-collection="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><span>${item.creatorIds.length} creator${item.creatorIds.length === 1 ? '' : 's'}</span></button><button class="footer-text-button" type="button" data-delete-collection="${escapeHtml(item.id)}">Delete</button></div>`).join('')
    : '<p class="filter-hint">No collections yet. Create one for raids, collabs, games, podcast guests, or any workflow you want.</p>';
}

function collectionOptionsHtml(creatorId) {
  if (!localWorkflowData.collections.length) return '';
  const member = new Set(localWorkflowData.collections.filter(item => item.creatorIds.includes(String(creatorId))).map(item => item.id));
  return `<select class="saved-collection-picker" data-saved-collection-picker aria-label="Add saved creator to collection"><option value="">Add to collection…</option>${localWorkflowData.collections.map(item => `<option value="${escapeHtml(item.id)}"${member.has(item.id) ? ' disabled' : ''}>${escapeHtml(item.name)}${member.has(item.id) ? ' ✓' : ''}</option>`).join('')}</select>`;
}

function startDiscoverySession() {
  let candidates = exportRowsForCurrentView();
  if (!candidates.length) { setStatus('Load some Discovery results before starting a Discovery Session.', true); return; }
  discoverySessionState = { index:0, ids:candidates.slice(0, 40).map(item => String(item.user_id || item.id)), saved:0, more:0, raids:0, skipped:0, startedAt:Date.now() };
  renderDiscoverySession();
  document.getElementById('discovery-session-dialog')?.showModal();
}

function discoverySessionCurrent() {
  if (!discoverySessionState) return null;
  const id = discoverySessionState.ids[discoverySessionState.index];
  return allStreams.find(item => String(item.user_id || item.id) === id) || knownCreators.get(id) || null;
}

function renderDiscoverySession() {
  const dialog = document.getElementById('discovery-session-dialog');
  const body = document.getElementById('discovery-session-body');
  const progress = document.getElementById('discovery-session-progress');
  if (!dialog || !body || !progress || !discoverySessionState) return;
  const current = discoverySessionCurrent();
  if (!current) {
    progress.textContent = 'Session complete';
    body.innerHTML = `<div class="discovery-session-summary"><h3>Discovery Session complete</h3><p>${discoverySessionState.ids.length} creators reviewed or queued.</p><div class="signal-row"><span class="signal">${discoverySessionState.saved} saved</span><span class="signal">${discoverySessionState.more} more-like-this</span><span class="signal">${discoverySessionState.raids} possible raids</span><span class="signal">${discoverySessionState.skipped} skipped</span></div></div>`;
    document.getElementById('discovery-session-actions').classList.add('hidden');
    return;
  }
  document.getElementById('discovery-session-actions').classList.remove('hidden');
  progress.textContent = `Creator ${discoverySessionState.index + 1} of ${discoverySessionState.ids.length}`;
  const tracker = current._trackerSummary;
  body.innerHTML = `<article class="discovery-session-card"><div><p class="footer-eyebrow">${escapeHtml(current.game_name || 'No category')}</p><h3>${escapeHtml(current.user_name || current.user_login)}</h3><p>${Number.isFinite(current.viewer_count) ? `${new Intl.NumberFormat().format(current.viewer_count)} live viewers` : 'Offline context'}${Number.isFinite(tracker?.averageViewers) ? ` · ~${Math.round(tracker.averageViewers)} typical/30d` : ''}</p><p>${escapeHtml(current._why || discoveryScore(current).reasons.join(' · ') || 'Live on Twitch')}</p></div><div class="match-tags-list">${(current.tags || []).slice(0,8).map(tag => `<span class="match-tag">${escapeHtml(tag)}</span>`).join('')}</div></article>`;
}

function advanceDiscoverySession(action) {
  const current = discoverySessionCurrent();
  if (!current || !discoverySessionState) return;
  if (action === 'save') { if (!historyFor(current.user_id).saved) recordCreatorFeedback(current, 'save'); discoverySessionState.saved += 1; }
  if (action === 'more') { if (!historyFor(current.user_id).moreLike) recordCreatorFeedback(current, 'more'); discoverySessionState.more += 1; }
  if (action === 'raid') { if (historyFor(current.user_id).bookmark !== 'raid') updateHistory(current.user_id, { bookmark:'raid', snapshot:creatorSnapshot(current) }); discoverySessionState.raids += 1; }
  if (action === 'never') recordCreatorFeedback(current, 'never');
  if (action === 'skip') discoverySessionState.skipped += 1;
  discoverySessionState.index += 1;
  renderDiscoverySession();
  renderGrid(); renderSavedList();
}

function renderLocalWorkflowTools() {
  renderFilterPresets();
  renderMatchHistory();
  renderMatchShortlist();
  renderCollections();
}

function installLocalWorkflowEvents() {
  document.getElementById('save-filter-preset')?.addEventListener('click', saveCurrentFilterPreset);
  document.getElementById('copy-filter-link')?.addEventListener('click', copyShareableFilterUrl);
  document.getElementById('filter-preset-list')?.addEventListener('click', event => {
    const load = event.target.closest('[data-load-filter-preset]');
    const remove = event.target.closest('[data-delete-filter-preset]');
    if (load) {
      const preset = localWorkflowData.filterPresets.find(item => item.id === load.dataset.loadFilterPreset);
      if (preset) { applySerializableFilters(preset.filters); setStatus(`Loaded local preset “${preset.name}”.`); if (['discover','match','spotlight','gems','rising'].includes(activeTab)) loadStreams(); }
    }
    if (remove) {
      localWorkflowData.filterPresets = localWorkflowData.filterPresets.filter(item => item.id !== remove.dataset.deleteFilterPreset);
      saveLocalWorkflowData(); renderFilterPresets();
    }
  });
  document.getElementById('match-history-list')?.addEventListener('click', event => {
    const button = event.target.closest('[data-replay-match]');
    if (button) replayCreatorMatchHistory(button.dataset.replayMatch);
  });
  document.getElementById('match-shortlist-list')?.addEventListener('click', event => {
    const compare = event.target.closest('[data-compare-shortlist]');
    if (compare) {
      const entry = localWorkflowData.matchShortlist.find(item => item.id === compare.dataset.compareShortlist);
      if (entry?.snapshot) addToComparison(streamFromSnapshot(entry.snapshot));
      return;
    }
    const button = event.target.closest('[data-remove-shortlist]');
    if (!button) return;
    localWorkflowData.matchShortlist = localWorkflowData.matchShortlist.filter(item => item.id !== button.dataset.removeShortlist);
    saveLocalWorkflowData(); renderMatchShortlist(); renderGrid();
  });
  document.querySelectorAll('[data-export-current]').forEach(button => button.addEventListener('click', () => exportDiscovery(button.dataset.exportCurrent)));
  document.querySelectorAll('[data-export-shortlist]').forEach(button => button.addEventListener('click', () => exportMatchShortlist(button.dataset.exportShortlist)));
  document.getElementById('create-saved-collection')?.addEventListener('click', () => {
    const input = document.getElementById('saved-collection-name');
    const collection = createCollection(input?.value);
    if (!collection) { setStatus('Give the collection a name first.', true); return; }
    if (input) input.value = '';
    activeSavedCollectionId = collection.id;
    renderCollections(); renderSavedList();
    setStatus(`Created local collection “${collection.name}”.`);
  });
  document.getElementById('saved-collection-filter')?.addEventListener('change', event => { activeSavedCollectionId = event.target.value || ''; renderSavedList(); });
  document.getElementById('saved-collections-list')?.addEventListener('click', event => {
    const view = event.target.closest('[data-view-collection]');
    const remove = event.target.closest('[data-delete-collection]');
    if (view) { activeSavedCollectionId = view.dataset.viewCollection; renderCollections(); renderSavedList(); }
    if (remove) {
      const collection = collectionFor(remove.dataset.deleteCollection);
      if (collection && window.confirm(`Delete the local collection “${collection.name}”? Saved creators themselves will stay saved.`)) {
        localWorkflowData.collections = localWorkflowData.collections.filter(item => item.id !== collection.id);
        if (activeSavedCollectionId === collection.id) activeSavedCollectionId = '';
        saveLocalWorkflowData(); renderCollections(); renderSavedList();
      }
    }
  });
  document.getElementById('start-discovery-session')?.addEventListener('click', startDiscoverySession);
  document.getElementById('discovery-session-close')?.addEventListener('click', () => document.getElementById('discovery-session-dialog')?.close());
  document.getElementById('discovery-session-actions')?.addEventListener('click', event => {
    const button = event.target.closest('[data-session-action]'); if (button) advanceDiscoverySession(button.dataset.sessionAction);
  });

  document.addEventListener('keydown', event => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target?.isContentEditable;
    if (!typing && event.key === '/') { event.preventDefault(); searchInput.focus(); }
    if (!typing && event.key.toLowerCase() === 'f') { event.preventDefault(); filtersToggleBtn.click(); }
    const card = document.activeElement?.closest?.('.stream-card[data-kind="stream"]');
    if (!typing && card && event.key.toLowerCase() === 's') {
      event.preventDefault();
      const item = cardDataById.get(card.dataset.userId); if (item) { recordCreatorFeedback(item, 'save'); renderGrid(); }
    }
    if (!typing && card && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      const item = cardDataById.get(card.dataset.userId); if (item) { cycleCreatorBookmark(item); renderGrid(); }
    }
  });
}

installLocalWorkflowEvents();
