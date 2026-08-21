'use strict';

async function showDiscoveryView() {
  document.getElementById('welcome-msg').textContent = currentUser.display_name;
  document.getElementById('user-avatar').src = safeHttpsUrl(currentUser.profile_image_url);
  document.getElementById('user-avatar').alt = `${currentUser.display_name}'s avatar`;
  renderSecretRewardProfile();
  privacyView.classList.add('hidden');
  loginView.classList.add('hidden');
  discoveryView.classList.remove('hidden');
  try { discoveryHistory = JSON.parse(localStorage.getItem(historyStorageKey()) || '{}') || {}; } catch (error) { discoveryHistory = {}; }
  try { preferences = { ...preferences, ...(JSON.parse(localStorage.getItem(preferencesStorageKey()) || '{}') || {}) }; } catch (error) { preferences = { categories:{}, categoryNames:{}, followedCategories:{}, tags:{}, languages:{}, viewerSamples:[], personalizationEnabled:true, historicalDiscoveryEnabled:true }; }
  preferences.categories ||= {}; preferences.categoryNames ||= {}; preferences.followedCategories ||= {}; preferences.tags ||= {}; preferences.languages ||= {}; preferences.viewerSamples ||= [];
  personalizationEnabled = preferences.personalizationEnabled !== false;
  personalizationModeEl.value = personalizationEnabled ? 'on' : 'off';
  historicalDiscoveryEnabled = preferences.historicalDiscoveryEnabled !== false;
  historicalDiscoveryEl.checked = historicalDiscoveryEnabled;
  try {
    const storedAccessibility = JSON.parse(localStorage.getItem(accessibilityStorageKey()) || '{}') || {};
    accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false, ...storedAccessibility };
    if (!storedAccessibility.textSize && storedAccessibility.largeText) accessibilitySettings.textSize = 'large';
    if (!['system','dark','light'].includes(accessibilitySettings.theme)) accessibilitySettings.theme = 'system';
    if (!['normal','large','xlarge'].includes(accessibilitySettings.textSize)) accessibilitySettings.textSize = 'normal';
  } catch (error) { accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false }; }
  applyAccessibilitySettings();
  loadLocalWorkflowData();
  applySharedFiltersFromUrl();
  updateSavedCount();
  renderSavedList();
  renderRecommendationProfile();
  renderComparison();
  setActiveTab(tabFromRoute(), { updateRoute:false });
}

async function trySession(token) {
  try {
    const validation = await validateToken(token);
    if (!validation) { sessionStorage.removeItem(STORAGE_KEY); return false; }
    currentToken = token;
    sessionStorage.setItem(STORAGE_KEY, token);
    currentUser = await fetchTwitchUserData(token);
    if (!currentUser || currentUser.id !== validation.user_id) {
      sessionStorage.removeItem(STORAGE_KEY);
      currentToken = null;
      currentUser = null;
      return false;
    }
    lastTokenValidationAt = Date.now();
    startTokenValidationTimer();
    await showDiscoveryView();
    return true;
  } catch (error) {
    sessionStorage.removeItem(STORAGE_KEY);
    currentToken = null;
    currentUser = null;
    return false;
  }
}

function endExpiredSession() {
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
  channelTeamsCache.clear();
  tabCache = {};
  modalDetailCache = {};
  knownCreators.clear();
  discoveryView.classList.add('hidden');
  loginView.classList.remove('hidden');
  configWarning.textContent = 'Your Twitch session expired or no longer has the required read-only permission. Please sign in again.';
  configWarning.classList.remove('hidden');
}

async function revalidateCurrentSession() {
  if (!currentToken) return false;
  const validation = await validateToken(currentToken).catch(() => null);
  if (!validation || validation.user_id !== currentUser?.id) {
    endExpiredSession();
    return false;
  }
  lastTokenValidationAt = Date.now();
  return true;
}

function startTokenValidationTimer() {
  if (tokenValidationTimer) clearInterval(tokenValidationTimer);
  tokenValidationTimer = setInterval(revalidateCurrentSession, TOKEN_VALIDATION_INTERVAL_MS);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentToken && Date.now() - lastTokenValidationAt >= TOKEN_VALIDATION_INTERVAL_MS) {
    revalidateCurrentSession();
  }
});

async function bootstrapSession() {
  if (sessionBootstrapStarted) return;
  sessionBootstrapStarted = true;
  const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
  const urlToken = fragmentParams.get('access_token');
  if (urlToken) {
    const returnedState = fragmentParams.get('state');
    const rawExpectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    let expectedState = null;
    try { expectedState = JSON.parse(rawExpectedState || 'null'); } catch (error) { expectedState = null; }
    const stateIsFresh = expectedState && Number(expectedState.createdAt) > Date.now() - OAUTH_STATE_MAX_AGE_MS;
    if (!stateIsFresh || !returnedState || returnedState !== expectedState.value) {
      loginBtn.disabled = false;
      configWarning.textContent = 'Twitch login could not be verified. Please try signing in again.';
      configWarning.classList.remove('hidden');
      return;
    }
    if (await trySession(urlToken)) return;
  }
  if (fragmentParams.get('error')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    configWarning.textContent = 'Twitch login was cancelled or denied. No session was created.';
    configWarning.classList.remove('hidden');
    return;
  }
  const storedToken = sessionStorage.getItem(STORAGE_KEY);
  if (storedToken) await trySession(storedToken);
}

async function init() {
  applyAccessibilitySettings();
  const urlToken = getAccessTokenFromUrl();
  const returningFromTwitch = Boolean(urlToken && sessionStorage.getItem(OAUTH_STATE_KEY));
  let acknowledged = false;
  try { acknowledged = localStorage.getItem(PRIVACY_ACK_KEY) === 'accepted'; } catch (error) { acknowledged = false; }
  if (!acknowledged && !returningFromTwitch) {
    showPrivacyNotice();
    return;
  }
  showLoginView();
  await bootstrapSession();
}

initializeTabControls();
init();
