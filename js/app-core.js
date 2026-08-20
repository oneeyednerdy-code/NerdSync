'use strict';

// --- CONFIGURATION ---
const CLIENT_ID = (typeof CONFIG !== 'undefined' && CONFIG.TWITCH_CLIENT_ID) || '';
const APP_VERSION = 'Alpha-0.10.0';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'user:read:follows';
const STORAGE_KEY = 'nerdsync_token';
const OAUTH_STATE_KEY = 'nerdsync_oauth_state';
const HISTORY_KEY = 'nerdsync_discovery_history_v1';
const PREFERENCES_KEY = 'nerdsync_preferences_v2';
const ACCESSIBILITY_KEY = 'nerdsync_accessibility_v1';
const PRIVACY_ACK_KEY = 'nerdsync_privacy_ack_v1';

// Tuning knobs — kept small to stay well under Twitch's Helix rate limits.
const MAX_FOLLOW_PAGES = 10;
const MAX_SEED_CATEGORIES_FOR_GEMS = 8;
const MIN_GEM_CATEGORIES = 4;
const GEMS_PER_CATEGORY = 18;
const GEMS_STREAM_PAGES = 5;
const SMALL_STREAM_VIEWER_CEILING = 75;
const CREATOR_STAGES = {
  new: { label:'New & Niche', min:0, max:20 },
  growing: { label:'Growing', min:21, max:100 },
  breakout: { label:'Breakout', min:101, max:500 },
  established: { label:'Established', min:501, max:5000 },
  headliner: { label:'Headliner', min:5001, max:null }
};
const BALANCED_STAGE_PATTERN = ['new','growing','breakout','established','new','growing','headliner','breakout','established','growing','new','breakout'];
const MAX_TOP_CATEGORIES_FOR_DISCOVER = 10;
const STREAMS_PER_CATEGORY_DISCOVER = 24;
const DISCOVER_STREAM_PAGES = 8;
const RISING_ACCOUNT_WINDOW_DAYS = 730;
const MAX_TOP_CATEGORIES_FOR_RISING = 10;
const RISING_STREAM_PAGES = 3;
const MAX_RISING_CANDIDATES = 600;
const RISING_MIN_VIEWERS = 3;
const RISING_MAX_VIEWERS = 500;
const NEW_AFFILIATE_ACCOUNT_DAYS = 365;
const NEW_AFFILIATE_STREAM_PAGES = 5;
const MAX_NEW_AFFILIATE_CANDIDATES = 1000;
const CLIPS_LOOKBACK_DAYS = 30;
const MAX_SEED_STREAMERS_FOR_CLIPS = 20;
const CLIPS_PER_STREAMER = 20;
const CACHE_TTL_MS = 3 * 60 * 1000;
const MODAL_CACHE_TTL_MS = 5 * 60 * 1000;
const PAGE_SIZE = 12;
const DEBOUNCE_MS = 300;
const SIGNAL_ENRICH_LIMIT = 40;
const SIGNAL_CACHE_TTL_MS = 30 * 60 * 1000;

const GENRE_PRESETS = [
  { id:'rpg', label:'RPG', games:["Baldur's Gate 3",'The Elder Scrolls V: Skyrim','Cyberpunk 2077','Fallout 4','Elden Ring','Diablo IV','Path of Exile 2','Persona 5 Royal'] },
  { id:'mmo', label:'MMO', games:['World of Warcraft','FINAL FANTASY XIV ONLINE','The Elder Scrolls Online','Star Wars: The Old Republic','Guild Wars 2','Black Desert','Old School RuneScape','New World: Aeternum'] },
  { id:'shooter', label:'Shooter', games:['Fortnite','VALORANT','Counter-Strike 2','Call of Duty: Warzone','Apex Legends','Overwatch 2',"Tom Clancy's Rainbow Six Siege",'Destiny 2'] },
  { id:'strategy', label:'Strategy', games:['StarCraft II',"Sid Meier's Civilization VI",'Age of Empires IV','Total War: WARHAMMER III','Hearts of Iron IV','Crusader Kings III','Teamfight Tactics','XCOM 2'] },
  { id:'horror', label:'Horror', games:['Dead by Daylight','Phasmophobia','Resident Evil 4','Silent Hill 2','The Outlast Trials','Lethal Company','Alien: Isolation','SOMA'] },
  { id:'survival', label:'Survival', games:['Minecraft','Rust','ARK: Survival Ascended','Valheim','DayZ','7 Days to Die','Sons of the Forest','Icarus'] },
  { id:'simulation', label:'Simulation', games:['The Sims 4','Microsoft Flight Simulator 2024','Euro Truck Simulator 2','Farming Simulator 25','Cities: Skylines II','House Flipper 2','PowerWash Simulator','Planet Zoo'] },
  { id:'adventure', label:'Adventure', games:['The Legend of Zelda: Tears of the Kingdom','God of War Ragnarök','Stray',"Uncharted 4: A Thief's End",'Indiana Jones and the Great Circle','A Plague Tale: Requiem','Red Dead Redemption 2','Star Wars Jedi: Survivor'] }
];

const CONTENT_LABELS = {
  DebatedSocialIssuesAndPolitics:'Politics and sensitive social issues',
  DrugsIntoxication:'Drugs / intoxication',
  Gambling:'Gambling',
  MatureGame:'Mature-rated game',
  ProfanityVulgarity:'Profanity',
  SexualThemes:'Sexual themes',
  ViolentGraphic:'Graphic violence'
};

const loginView = document.getElementById('login-view');
const privacyView = document.getElementById('privacy-view');
const privacyAcceptBtn = document.getElementById('privacy-accept-btn');
const privacyReviewBtn = document.getElementById('privacy-review-btn');
const discoveryView = document.getElementById('discovery-view');
const loginBtn = document.getElementById('twitch-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const configWarning = document.getElementById('config-warning');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const statusArea = document.getElementById('status-area');
const streamGrid = document.getElementById('stream-grid');
const tabExplainer = document.getElementById('tab-explainer');
const clipSortRow = document.getElementById('clip-sort-row');
const sortTopBtn = document.getElementById('sort-top');
const sortNewBtn = document.getElementById('sort-new');
const filterToggleRow = document.getElementById('filter-toggle-row');
const filterPanel = document.getElementById('filter-panel');
const filtersToggleBtn = document.getElementById('filters-toggle-btn');
const mobileFilterBackdrop = document.getElementById('mobile-filter-backdrop');
const filtersBadge = document.getElementById('filters-badge');
const viewCountSortEl = document.getElementById('view-count-sort');
const creatorStageEl = document.getElementById('creator-stage');
const excludePartnersEl = document.getElementById('exclude-partners');
const diversityLimitEl = document.getElementById('diversity-limit');
const personalizationModeEl = document.getElementById('personalization-mode');
const hideSeenEl = document.getElementById('hide-seen');
const primaryNav = document.getElementById('primary-nav');
const discoverFeedControl = document.getElementById('discover-feed-control');
const discoverFeedMode = document.getElementById('discover-feed-mode');
const followingFeedControl = document.getElementById('following-feed-control');
const followingFeedMode = document.getElementById('following-feed-mode');
const contextToolbar = document.getElementById('context-toolbar');
const resultsArea = document.getElementById('results-area');
const featureActions = document.querySelector('.discovery-container > .feature-actions');
const diagnosticsPanel = document.getElementById('diagnostics-panel');
const channelToolsPanel = document.getElementById('channel-tools-panel');
const channelSearchInput = document.getElementById('channel-search-input');
const channelSearchResults = document.getElementById('channel-search-results');
const comparisonGrid = document.getElementById('comparison-grid');
const savedPanel = document.getElementById('saved-panel');
const savedList = document.getElementById('saved-list');
const savedCount = document.getElementById('saved-count');
const recommendationProfileSummary = document.getElementById('recommendation-profile-summary');
const accessibilityPanel = document.getElementById('accessibility-panel');
const accessibilityToggle = document.getElementById('accessibility-toggle');
const themeSelect = document.getElementById('a11y-theme');
const textSizeSelect = document.getElementById('a11y-text-size');
const resultsSummary = document.getElementById('results-summary');
const creatorMatchPanel = document.getElementById('creator-match-panel');
const matchSourceEl = document.getElementById('match-source');
const matchToleranceEl = document.getElementById('match-tolerance');
const matchVodGroup = document.getElementById('match-vod-group');
const matchVodEl = document.getElementById('match-vod');
const matchPeakGroup = document.getElementById('match-peak-group');
const matchPeakEl = document.getElementById('match-peak');
const matchRangeSummary = document.getElementById('match-range-summary');
const followAgeGroup = document.getElementById('follow-age-group');
const tagInput = document.getElementById('filter-tag');
const excludedTagsInput = document.getElementById('excluded-tags');
const languageFilterEl = document.getElementById('language-filter');
const minViewersInput = document.getElementById('filter-min-viewers');
const maxViewersInput = document.getElementById('filter-max-viewers');
const followDaysInput = document.getElementById('filter-follow-days');
const maxUptimeEl = document.getElementById('filter-max-uptime');
const activityFilterEl = document.getElementById('activity-filter');
const openChatOnlyEl = document.getElementById('open-chat-only');
const contentLabelFiltersEl = document.getElementById('content-label-filters');
const genreFiltersEl = document.getElementById('genre-filters');
const genreHint = document.getElementById('genre-hint');
const categorySearchInput = document.getElementById('category-search-input');
const categoryFilterMode = document.getElementById('category-filter-mode');
const categorySuggestions = document.getElementById('category-suggestions');
const selectedCategoriesEl = document.getElementById('selected-categories');
const activeFilterCount = document.getElementById('active-filter-count');
const activeFilterChips = document.getElementById('active-filter-chips');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const risingControlsRow = document.getElementById('rising-controls-row');
const newAffiliateControlsRow = document.getElementById('new-affiliate-controls-row');
const paginationControls = document.getElementById('pagination-controls');
const streamModal = document.getElementById('stream-modal');

let TABS;
function buildTabs() {
  return {
  following: {
    label: 'Following Live',
    explainer: 'Channels you follow that are live right now.',
    empty: "None of the channels you follow are live right now. Try Discover to see what's trending.",
    load: loadFollowing,
    hasCommonFilters: true
  },
  gems: {
    label: 'Hidden Gems',
    explainer: `Channels with 1–${SMALL_STREAM_VIEWER_CEILING} viewers found deeper in categories you select or your followed channels are playing. Sparse category lists are supplemented so this view stays useful.`,
    empty: 'No eligible small channels were found in the scanned categories right now. Try another category, clear restrictive filters, or refresh later.',
    load: loadHiddenGems,
    hasCommonFilters: true
  },
  rising: {
    label: 'Emerging',
    explainer: 'Emerging Live contains two discovery feeds: Standard Emerging Live appears first, followed by New Affiliates. Both use the same NerdSync filters and sampled categories, but keep their own eligibility rules and sorting controls.',
    empty: 'No eligible Emerging Live or New Affiliate channels were found in the sampled categories right now. Try refreshing later or use For You.',
    load: loadEmergingHub,
    hasCommonFilters: true,
    isRising: true,
    isRisingHub: true
  },
  match: {
    label: 'Creator Match',
    explainer: 'Find live networking peers near your current audience or an audience peak you enter. The match range is based on current live viewers; use tags, categories, language, chat openness, and other filters to find compatible creators.',
    empty: 'Set an audience source and choose Find Creator Matches. If you entered a peak, try a wider percentage or more categories.',
    load: loadCreatorMatches,
    hasCommonFilters: true,
    isMatch: true
  },
  spotlight: {
    label: 'Established',
    explainer: 'Established and larger live creators, selected through your categories, followed-channel interests, tags, language, and learned preferences. Spotlight starts at 501 current viewers and does not replace smaller creators in For You.',
    empty: 'No established or larger live creators matched the current categories and filters.',
    load: loadSpotlight,
    hasCommonFilters: true,
    isSpotlight: true
  },
  clips: {
    label: 'Following Clips',
    explainer: `Following Clips from the last ${CLIPS_LOOKBACK_DAYS} days, pulled from up to ${MAX_SEED_STREAMERS_FOR_CLIPS} channels you follow.`,
    empty: `No clips from your followed channels in the last ${CLIPS_LOOKBACK_DAYS} days.`,
    load: loadClips,
    isClips: true
  },
  discover: {
    label: 'For You',
    explainer: 'A personalized, balanced feed across every creator stage. Selected categories and followed-channel interests come first, then top Twitch categories fill gaps. Smaller creators retain dedicated space without imposing an audience ceiling.',
    empty: 'No live channels were found in the selected discovery categories right now.',
    load: loadDiscover,
    hasCommonFilters: true
  },
  saved: {
    label: 'Saved',
    explainer: 'Creators you saved, plus your private discovery profile and recommendation controls.',
    empty: 'No creators saved yet.',
    isSaved: true
  }
  };
}

let currentUser = null;
let currentToken = null;
let activeTab = 'discover';
let currentPage = 1;
let allStreams = [];
let followedLiveCache = null;
let followedChannelsCache = null;
let tabCache = {};
let modalDetailCache = {};
let clipSort = 'views';
let risingSort = 'potential';
let risingStatusFilter = 'all';
let newAffiliateSort = 'fit';
let viewCountSort = 'default';
let creatorStage = 'balanced';
let matchSource = 'live';
let matchTolerance = 50;
let matchPeak = null;
let matchSourceStream = null;
let matchVodsLoaded = false;
let excludePartners = false;
let diversityLimit = 3;
let personalizationEnabled = true;
let followedInterestProfile = { categories:new Map(), tags:new Map() };
let hideSeen = false;
let filters = { tags: [], excludedTags: [], contentLabels:[], language:'', genres: [], categories: [], excludedCategories: [], minViewers: null, maxViewers: null, minFollowDays: null, maxUptimeHours:null, activityDays:null, openChatOnly:false };
let diagnostics = { requests:0, pages:0, candidates:0, eligible:0, failures:0, categories:0, rateRemaining:null, rateLimit:null };
let discoveryHistory = {};
let preferences = { categories:{}, categoryNames:{}, followedCategories:{}, tags:{}, languages:{}, viewerSamples:[], personalizationEnabled:true };
let accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false };
let panelReturnFocus = null;
let modalReturnFocus = null;
let diagnosticEvents = [];
let signalCache = {};
let compareIds = [];
let comparisonGeneration = 0;
let comparisonDetailCache = {};
let sessionBootstrapStarted = false;
const knownCreators = new Map();
let loadGeneration = 0;
const cardDataById = new Map();

// --- Config guard ---
if (!CLIENT_ID || CLIENT_ID === 'YOUR_TWITCH_CLIENT_ID_HERE') {
  loginBtn.disabled = true;
  loginBtn.style.opacity = '0.5';
  loginBtn.style.cursor = 'not-allowed';
  configWarning.classList.remove('hidden');
}

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
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}&state=${encodeURIComponent(state)}`;
  window.location.href = authUrl;
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(STORAGE_KEY);
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
  activeTab = tabId;
  currentPage = 1;
  const cfg = TABS[tabId];
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
  matchTolerance = Number(matchToleranceEl.value);
  matchSource = matchSourceEl.value;
  delete tabCache.match;
  loadStreams();
});
matchToleranceEl.addEventListener('change', () => { matchTolerance = Number(matchToleranceEl.value); updateMatchRangeSummary(); });
matchPeakEl.addEventListener('input', debounce(() => { matchPeak = numOrNull(matchPeakEl.value); updateMatchRangeSummary(); }, DEBOUNCE_MS));
matchSourceEl.addEventListener('change', async () => {
  matchSource = matchSourceEl.value;
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
