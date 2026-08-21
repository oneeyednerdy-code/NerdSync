'use strict';

// --- Rendering ---
function setStatus(message, isError) {
  statusArea.innerHTML = '';
  if (!message) return;
  const paragraph = document.createElement('p');
  paragraph.className = `status-msg${isError ? ' error' : ''}`;
  paragraph.textContent = message;
  statusArea.appendChild(paragraph);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch (error) {
    return '';
  }
}

function safeTwitchUrl(value) {
  const safe = safeHttpsUrl(value);
  if (!safe) return '';
  const host = new URL(safe).hostname.toLowerCase();
  return host === 'twitch.tv' || host.endsWith('.twitch.tv') ? safe : '';
}

function formatDuration(seconds) {
  const total = Math.round(seconds || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return `${Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)))}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function historyFor(id) { return discoveryHistory[id] || {}; }
function historyStorageKey() { return `${HISTORY_KEY}:${currentUser?.id || 'anonymous'}`; }
function preferencesStorageKey() { return `${PREFERENCES_KEY}:${currentUser?.id || 'anonymous'}`; }
function accessibilityStorageKey() { return `${ACCESSIBILITY_KEY}:${currentUser?.id || 'anonymous'}`; }
function saveHistory() {
  try { localStorage.setItem(historyStorageKey(), JSON.stringify(discoveryHistory)); } catch (error) { console.warn('Could not save discovery history', error); }
}
function savePreferences() {
  try { localStorage.setItem(preferencesStorageKey(), JSON.stringify(preferences)); } catch (error) { console.warn('Could not save preferences', error); }
}
function saveAccessibilitySettings() {
  try { localStorage.setItem(accessibilityStorageKey(), JSON.stringify(accessibilitySettings)); } catch (error) { console.warn('Could not save accessibility settings', error); }
}
function resolvedTheme() {
  if (accessibilitySettings.theme === 'light' || accessibilitySettings.theme === 'dark') return accessibilitySettings.theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyAccessibilitySettings() {
  document.documentElement.dataset.theme = resolvedTheme();
  document.body.classList.toggle('a11y-text-large', accessibilitySettings.textSize === 'large');
  document.body.classList.toggle('a11y-text-xlarge', accessibilitySettings.textSize === 'xlarge');
  document.body.classList.toggle('a11y-large-cards', accessibilitySettings.largeCards);
  document.body.classList.toggle('a11y-high-contrast', accessibilitySettings.highContrast);
  document.body.classList.toggle('a11y-reduce-motion', accessibilitySettings.reduceMotion);
  themeSelect.value = accessibilitySettings.theme || 'system';
  textSizeSelect.value = accessibilitySettings.textSize || 'normal';
  Object.entries({ 'a11y-large-cards':'largeCards', 'a11y-high-contrast':'highContrast', 'a11y-reduce-motion':'reduceMotion' }).forEach(([id,key]) => { document.getElementById(id).checked = Boolean(accessibilitySettings[key]); });
}
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (accessibilitySettings.theme === 'system') applyAccessibilitySettings();
});
function updateHistory(id, patch) {
  discoveryHistory[id] = { ...historyFor(id), ...patch };
  saveHistory();
  updateSavedCount();
}
function creatorSnapshot(stream) {
  return {
    id:stream.user_id || stream.id,
    login:stream.user_login || stream.broadcaster_login || stream.login || '',
    name:stream.user_name || stream.broadcaster_name || stream.display_name || stream.name || '',
    gameId:stream.game_id || '', gameName:stream.game_name || '',
    thumbnail:stream.thumbnail_url || stream._profileImage || '',
    profileImage:stream._profileImage || '', tags:stream.tags || [], language:stream.language || '',
    broadcasterType:stream._broadcasterType || 'unknown', viewerCount:stream.viewer_count ?? null,
    contentLabels:stream.content_classification_labels || []
  };
}
function rememberCreator(stream) {
  const id = stream.user_id || stream.id;
  if (id) knownCreators.set(id, stream);
}
function learnFromCreator(stream, delta) {
  if (!stream || !delta || !personalizationEnabled) return;
  if (stream.game_id) {
    preferences.categories[stream.game_id] = Math.max(-10, Math.min(20, (preferences.categories[stream.game_id] || 0) + delta));
    if (stream.game_name) preferences.categoryNames[stream.game_id] = stream.game_name;
  }
  (stream.tags || []).slice(0, 8).forEach(tag => {
    const key = tag.toLowerCase();
    preferences.tags[key] = Math.max(-10, Math.min(20, (preferences.tags[key] || 0) + delta));
  });
  if (stream.language) preferences.languages[stream.language] = Math.max(-10, Math.min(20, (preferences.languages[stream.language] || 0) + delta));
  if (delta > 0 && Number.isFinite(stream.viewer_count)) preferences.viewerSamples = [...preferences.viewerSamples, stream.viewer_count].slice(-30);
  savePreferences();
}
function recordCreatorFeedback(stream, kind) {
  if (!stream) return;
  rememberCreator(stream);
  const id = stream.user_id || stream.id;
  const snapshot = creatorSnapshot(stream);
  const current = historyFor(id);
  if (kind === 'open') updateHistory(id, { openedAt:Date.now(), openCount:(current.openCount || 0) + 1, snapshot });
  if (kind === 'watch') { updateHistory(id, { watchedAt:Date.now(), watchClicks:(current.watchClicks || 0) + 1, snapshot }); learnFromCreator(stream, 3); }
  if (kind === 'save') { const saved = !current.saved; updateHistory(id, { saved, snapshot }); learnFromCreator(stream, saved ? 4 : -4); }
  if (kind === 'dismiss') { updateHistory(id, { dismissedUntil:Date.now() + 30 * 86400000, snapshot }); learnFromCreator(stream, -4); }
  if (kind === 'never') { updateHistory(id, { permanentDismiss:true, snapshot }); learnFromCreator(stream, -6); }
  if (kind === 'less') { updateHistory(id, { lessLike:(current.lessLike || 0) + 1, snapshot }); learnFromCreator(stream, -4); }
  if (kind === 'more') {
    const moreLike = !current.moreLike;
    updateHistory(id, { moreLike, snapshot });
    learnFromCreator(stream, moreLike ? 6 : -6);
  }
}
function isDismissed(id) { return Boolean(historyFor(id).permanentDismiss) || Number(historyFor(id).dismissedUntil || 0) > Date.now(); }
function wasSeenRecently(id) { return Number(historyFor(id).seenAt || 0) > Date.now() - 7 * 86400000; }

