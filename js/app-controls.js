'use strict';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// --- Login / logout ---
function showPrivacyNotice() {
  loginView.classList.add('hidden');
  discoveryView.classList.add('hidden');
  privacyView.classList.remove('hidden');
  requestAnimationFrame(() => privacyAcceptBtn.focus());
}

function showLoginView() {
  privacyView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

privacyAcceptBtn.addEventListener('click', async () => {
  try { localStorage.setItem(PRIVACY_ACK_KEY, 'accepted'); } catch (error) { console.warn('Could not remember privacy acknowledgement', error); }
  showLoginView();
  loginBtn.focus();
  await bootstrapSession();
});

privacyReviewBtn.addEventListener('click', showPrivacyNotice);

loginBtn.addEventListener('click', () => {
  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(stateBytes);
  const state = [...stateBytes].map(value => value.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(OAUTH_STATE_KEY, JSON.stringify({ value:state, createdAt:Date.now() }));
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}&state=${encodeURIComponent(state)}`;
  window.location.href = authUrl;
});

logoutBtn.addEventListener('click', () => {
  activeLoadController?.abort();
  activeLoadController = null;
  deepScanTabs.clear();
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  if (tokenValidationTimer) clearInterval(tokenValidationTimer);
  tokenValidationTimer = null;
  lastTokenValidationAt = 0;
  currentToken = null;
  currentUser = null;
  followedLiveCache = null;
  followedChannelsCache = null;
  tabCache = {};
  modalDetailCache = {};
  comparisonDetailCache = {};
  compareIds = [];
  matchVodsLoaded = false;
  matchSourceStream = null;
  matchVodEl.innerHTML = '<option value="">Load past broadcasts…</option>';
  knownCreators.clear();
  discoveryView.classList.add('hidden');
  loginView.classList.remove('hidden');
});

// --- Primary navigation and feed modes ---
const DISCOVER_TABS = new Set(['discover','gems','rising','spotlight']);
const FOLLOWING_TABS = new Set(['following','clips']);
function destinationForTab(tabId) {
  if (DISCOVER_TABS.has(tabId)) return 'discover';
  if (FOLLOWING_TABS.has(tabId)) return 'following';
  return tabId;
}
function routeForTab(tabId) {
  if (tabId === 'discover') return '#discover';
  if (DISCOVER_TABS.has(tabId)) return `#discover/${tabId}`;
  if (tabId === 'following') return '#following';
  if (tabId === 'clips') return '#following/clips';
  return `#${tabId}`;
}
function tabFromRoute() {
  const route = window.location.hash.toLowerCase();
  const routes = { '#discover':'discover', '#discover/gems':'gems', '#discover/rising':'rising', '#discover/spotlight':'spotlight', '#following':'following', '#following/clips':'clips', '#match':'match', '#saved':'saved' };
  return routes[route] || 'discover';
}
function setActiveTab(tabId, { updateRoute = true } = {}) {
  if (!TABS[tabId]) tabId = 'discover';
  activeLoadController?.abort();
  activeLoadController = null;
  activeTab = tabId;
  currentPage = 1;
  const cfg = TABS[tabId];
  scanDeeperRow.classList.add('hidden');
  const destination = destinationForTab(tabId);
  primaryNav.querySelectorAll('[data-destination]').forEach(button => {
    const active = button.dataset.destination === destination;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  discoverFeedControl.classList.toggle('hidden', destination !== 'discover');
  followingFeedControl.classList.toggle('hidden', destination !== 'following');
  if (DISCOVER_TABS.has(tabId)) discoverFeedMode.value = tabId;
  if (FOLLOWING_TABS.has(tabId)) followingFeedMode.value = tabId;
  contextToolbar.classList.toggle('hidden', cfg.isSaved === true);
  document.querySelector('.search-row').classList.toggle('hidden', destination === 'saved' || destination === 'match');
  featureActions.classList.toggle('hidden', destination !== 'discover');
  channelToolsPanel.classList.toggle('hidden', destination !== 'match');
  savedPanel.classList.toggle('hidden', destination !== 'saved');
  resultsArea.classList.toggle('hidden', destination === 'saved');
  tabExplainer.textContent = cfg.explainer;
  tabExplainer.classList.remove('hidden');
  clipSortRow.classList.toggle('hidden', !cfg.isClips);
  risingControlsRow.classList.toggle('hidden', !cfg.isRising);
  newAffiliateControlsRow.classList.toggle('hidden', !cfg.isRisingHub);
  creatorMatchPanel.classList.toggle('hidden', !cfg.isMatch);
  filterToggleRow.classList.toggle('hidden', !cfg.hasCommonFilters);
  if (!cfg.hasCommonFilters) closeFilterPanel();
  followAgeGroup.classList.toggle('hidden', tabId !== 'following');
  if (updateRoute && window.location.hash !== routeForTab(tabId)) history.pushState({ tabId }, '', routeForTab(tabId));
  if (cfg.isSaved) {
    renderSavedList();
    renderRecommendationProfile();
    resultsSummary.textContent = 'Saved creators and private discovery profile.';
    requestAnimationFrame(() => savedPanel.focus());
    return;
  }
  loadStreams();
}
function initializeTabControls() {
  TABS = buildTabs();
  channelToolsPanel.parentNode.insertBefore(creatorMatchPanel, channelToolsPanel);
  primaryNav.querySelectorAll('[data-destination]').forEach(button => {
    button.addEventListener('click', () => {
      const destination = button.dataset.destination;
      if (destination === 'discover') setActiveTab(DISCOVER_TABS.has(activeTab) ? activeTab : discoverFeedMode.value);
      else if (destination === 'following') setActiveTab(FOLLOWING_TABS.has(activeTab) ? activeTab : followingFeedMode.value);
      else setActiveTab(destination);
    });
  });
  primaryNav.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...primaryNav.querySelectorAll('[data-destination]')];
    const current = Math.max(0, buttons.indexOf(document.activeElement));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  });
  discoverFeedMode.addEventListener('change', () => setActiveTab(discoverFeedMode.value));
  followingFeedMode.addEventListener('change', () => setActiveTab(followingFeedMode.value));
  window.addEventListener('popstate', () => setActiveTab(tabFromRoute(), { updateRoute:false }));
}

searchInput.addEventListener('input', debounce(() => { currentPage = 1; renderGrid(); }, DEBOUNCE_MS));

refreshBtn.addEventListener('click', () => {
  delete tabCache[activeTab];
  followedLiveCache = null;
  followedChannelsCache = null;
  refreshBtn.classList.add('spinning');
  setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
  loadStreams();
});

scanDeeperBtn.addEventListener('click', () => {
  if (!TABS[activeTab]?.supportsDeepScan) return;
  deepScanTabs.add(activeTab);
  delete tabCache[activeTab];
  currentPage = 1;
  scanDeeperBtn.disabled = true;
  scanDeeperBtn.textContent = 'Scanning deeper…';
  loadStreams();
});

sortTopBtn.addEventListener('click', () => setClipSort('views'));
sortNewBtn.addEventListener('click', () => setClipSort('newest'));
function setClipSort(mode) {
  viewCountSort = 'default';
  viewCountSortEl.value = 'default';
  clipSort = mode;
  sortTopBtn.classList.toggle('active', mode === 'views');
  sortNewBtn.classList.toggle('active', mode === 'newest');
  currentPage = 1;
  renderGrid();
}

document.getElementById('rising-sort-viewers').addEventListener('click', () => setRisingSort('potential'));
document.getElementById('rising-sort-uptime').addEventListener('click', () => setRisingSort('account'));
function setRisingSort(mode) {
  viewCountSort = 'default';
  viewCountSortEl.value = 'default';
  risingSort = mode;
  document.getElementById('rising-sort-viewers').classList.toggle('active', mode === 'potential');
  document.getElementById('rising-sort-uptime').classList.toggle('active', mode === 'account');
  currentPage = 1;
  renderGrid();
}
document.getElementById('rising-status-filter').addEventListener('change', e => {
  risingStatusFilter = e.target.value;
  currentPage = 1;
  renderGrid();
});

document.getElementById('new-affiliate-sort-fit').addEventListener('click', () => setNewAffiliateSort('fit'));
document.getElementById('new-affiliate-sort-newest').addEventListener('click', () => setNewAffiliateSort('newest'));
function setNewAffiliateSort(mode) {
  newAffiliateSort = mode;
  viewCountSort = 'default';
  viewCountSortEl.value = 'default';
  document.getElementById('new-affiliate-sort-fit').classList.toggle('active', mode === 'fit');
  document.getElementById('new-affiliate-sort-newest').classList.toggle('active', mode === 'newest');
  currentPage = 1;
  renderGrid();
}

viewCountSortEl.addEventListener('change', () => {
  viewCountSort = viewCountSortEl.value;
  currentPage = 1;
  renderGrid();
});

creatorStageEl.addEventListener('change', () => {
  creatorStage = creatorStageEl.value;
  currentPage = 1;
  if (activeTab === 'discover' || activeTab === 'spotlight') {
    delete tabCache[activeTab];
    loadStreams();
  } else renderGrid();
});

excludePartnersEl.addEventListener('change', () => {
  excludePartners = excludePartnersEl.checked;
  currentPage = 1;
  renderGrid();
});

diversityLimitEl.addEventListener('change', () => {
  diversityLimit = diversityLimitEl.value === 'off' ? null : Number(diversityLimitEl.value);
  currentPage = 1;
  renderGrid();
});
personalizationModeEl.addEventListener('change', () => {
  personalizationEnabled = personalizationModeEl.value !== 'off';
  preferences.personalizationEnabled = personalizationEnabled;
  savePreferences();
  currentPage = 1;
  renderRecommendationProfile();
  renderGrid();
});
hideSeenEl.addEventListener('change', () => { hideSeen = hideSeenEl.checked; currentPage = 1; renderGrid(); });
document.getElementById('diagnostics-toggle').addEventListener('click', () => {
  diagnosticsPanel.classList.toggle('hidden');
  renderDiagnostics();
});

function toggleSettingsPanel(trigger) {
  const panel = accessibilityPanel;
  const willOpen = panel.classList.contains('hidden');
  if (willOpen) {
    panel.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    panelReturnFocus = trigger;
    panel.setAttribute('tabindex', '-1');
    panel.focus();
  } else {
    panel.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  }
}
accessibilityToggle.addEventListener('click', event => toggleSettingsPanel(event.currentTarget));
document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', () => {
  document.getElementById(button.dataset.closePanel).classList.add('hidden');
  accessibilityToggle.setAttribute('aria-expanded', 'false');
  if (panelReturnFocus?.isConnected) panelReturnFocus.focus();
}));
document.getElementById('try-someone-btn').addEventListener('click', () => trySomeoneNew());
document.getElementById('run-creator-match').addEventListener('click', () => {
  matchPeak = numOrNull(matchPeakEl.value);
  matchTolerance = Number(selectedChoiceValue(matchToleranceEl, '50'));
  matchSource = selectedChoiceValue(matchSourceEl, 'live');
  delete tabCache.match;
  loadStreams();
});
matchToleranceEl.addEventListener('click', event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !matchToleranceEl.contains(button)) return;
  setSingleChoice(matchToleranceEl, button.dataset.value);
  matchTolerance = Number(button.dataset.value);
  updateMatchRangeSummary();
});
matchPeakEl.addEventListener('input', debounce(() => { matchPeak = numOrNull(matchPeakEl.value); updateMatchRangeSummary(); }, DEBOUNCE_MS));
matchSourceEl.addEventListener('click', async event => {
  const button = event.target.closest('button[data-value]');
  if (!button || !matchSourceEl.contains(button)) return;
  setSingleChoice(matchSourceEl, button.dataset.value);
  matchSource = button.dataset.value;
  matchVodGroup.classList.toggle('hidden', matchSource !== 'vod');
  matchPeakGroup.classList.toggle('hidden', matchSource === 'live');
  if (matchSource === 'vod' && !matchVodsLoaded) await loadMatchVods();
  updateMatchRangeSummary();
});
matchVodEl.addEventListener('change', () => updateMatchRangeSummary());
document.getElementById('channel-search-form').addEventListener('submit', event => { event.preventDefault(); runChannelSearch(); });
document.getElementById('clear-compare-btn').addEventListener('click', () => { compareIds = []; renderComparison(); });
document.getElementById('clear-seen-btn').addEventListener('click', () => {
  Object.values(discoveryHistory).forEach(item => { delete item.seenAt; });
  saveHistory(); renderGrid(); renderSavedList();
});
document.getElementById('restore-dismissed-btn').addEventListener('click', () => {
  Object.values(discoveryHistory).forEach(item => { delete item.dismissedUntil; delete item.permanentDismiss; });
  saveHistory(); renderGrid(); renderSavedList();
});
document.getElementById('reset-recommendations-btn').addEventListener('click', () => {
  preferences = { categories:{}, categoryNames:{}, followedCategories:{}, tags:{}, languages:{}, viewerSamples:[], personalizationEnabled };
  savePreferences();
  Object.values(discoveryHistory).forEach(item => { delete item.lessLike; delete item.moreLike; delete item.openCount; });
  saveHistory(); renderRecommendationProfile(); renderGrid();
});

['large-cards','high-contrast','reduce-motion'].forEach(setting => {
  document.getElementById(`a11y-${setting}`).addEventListener('change', event => {
    const key = setting.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    accessibilitySettings[key] = event.target.checked;
    saveAccessibilitySettings();
    applyAccessibilitySettings();
  });
});
themeSelect.addEventListener('change', () => {
  accessibilitySettings.theme = themeSelect.value;
  saveAccessibilitySettings();
  applyAccessibilitySettings();
});
textSizeSelect.addEventListener('change', () => {
  accessibilitySettings.textSize = textSizeSelect.value;
  saveAccessibilitySettings();
  applyAccessibilitySettings();
});
document.getElementById('a11y-reset').addEventListener('click', () => {
  accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false };
  saveAccessibilitySettings();
  applyAccessibilitySettings();
});
