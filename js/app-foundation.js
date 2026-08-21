'use strict';

// --- CONFIGURATION ---
const CLIENT_ID = (typeof CONFIG !== 'undefined' && CONFIG.TWITCH_CLIENT_ID) || '';
const APP_VERSION = 'Alpha-0.17.1';
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'user:read:follows';
const REQUIRED_SCOPES = Object.freeze(SCOPES.split(' ').filter(Boolean));
const STORAGE_KEY = 'nerdsync_token';
const OAUTH_STATE_KEY = 'nerdsync_oauth_state';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const TOKEN_VALIDATION_INTERVAL_MS = 60 * 60 * 1000;
const HISTORY_KEY = 'nerdsync_discovery_history_v1';
const PREFERENCES_KEY = 'nerdsync_preferences_v2';
const ACCESSIBILITY_KEY = 'nerdsync_accessibility_v1';
const PRIVACY_ACK_KEY = 'nerdsync_privacy_ack_v2';

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
const TEAM_CACHE_TTL_MS = 15 * 60 * 1000;
const TEAM_LOOKUP_CONCURRENCY = 6;
const INITIAL_SCAN_PAGES = 2;

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
const brandHomeLink = document.querySelector('.brand-home-link');
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
const historicalDiscoveryEl = document.getElementById('historical-discovery');
const primaryNav = document.getElementById('primary-nav');
const discoverFeedControl = document.getElementById('discover-feed-control');
const discoverFeedMode = document.getElementById('discover-feed-mode');
const followingFeedControl = document.getElementById('following-feed-control');
const followingFeedMode = document.getElementById('following-feed-mode');
const followingTeamControl = document.getElementById('following-team-control');
const followingTeamsFirstEl = document.getElementById('following-teams-first');
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
const scanDeeperRow = document.getElementById('scan-deeper-row');
const scanDeeperBtn = document.getElementById('scan-deeper-btn');
const streamModal = document.getElementById('stream-modal');

let TABS;
function buildTabs() {
  return {
  following: {
    label: 'Following Live',
    explainer: 'Channels you follow that are live right now. Turn on Twitch teams first to check team memberships, label team-affiliated creators, and place them at the top of the live list.',
    empty: "None of the channels you follow are live right now. Try Discover to see what's trending.",
    load: loadFollowing,
    hasCommonFilters: true
  },
  gems: {
    label: 'Hidden Gems',
    explainer: `Channels with 1–${SMALL_STREAM_VIEWER_CEILING} current viewers found deeper in relevant categories. With Historical Discovery enabled, strong candidates can also show 30-day typical audience, growth, and activity context without changing the small-channel eligibility lanes.`,
    empty: 'No eligible small channels were found in the scanned categories right now. Try another category, clear restrictive filters, or refresh later.',
    load: loadHiddenGems,
    hasCommonFilters: true,
    supportsDeepScan: true
  },
  rising: {
    label: 'Emerging',
    explainer: 'Emerging Live contains Standard Emerging Live and Newer Affiliates. For Newer Affiliates, NerdSync uses current Affiliate status plus Twitch account age; when Historical Discovery is enabled, 30-day activity and follower-growth can strengthen that signal. Twitch does not provide the date Affiliate status was earned.',
    empty: 'No eligible Emerging Live channels or Newer Affiliates were found in the sampled categories right now. Try Scan Deeper, refresh later, or use For You.',
    load: loadEmergingHub,
    hasCommonFilters: true,
    isRising: true,
    isRisingHub: true,
    supportsDeepScan: true
  },
  match: {
    label: 'Creator Match',
    explainer: 'Find live networking peers near your current audience or an audience peak you enter. The match range is based on current live viewers; use tags, categories, language, chat openness, and other filters to find compatible creators.',
    empty: 'Set an audience source and choose Find Creator Matches. If you entered a peak, try a wider percentage or more categories.',
    load: loadCreatorMatches,
    hasCommonFilters: true,
    isMatch: true,
    supportsDeepScan: true
  },
  spotlight: {
    label: 'Established',
    explainer: "Established and larger live creators selected through your categories, followed-channel interests, tags, language, and learned preferences. Historical Discovery can show how the current stream compares with the creator's 30-day typical audience.",
    empty: 'No established or larger live creators matched the current categories and filters.',
    load: loadSpotlight,
    hasCommonFilters: true,
    isSpotlight: true,
    supportsDeepScan: true
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
    explainer: 'A personalized, balanced feed across every creator stage. Twitch supplies who is live now; when Historical Discovery is enabled, a limited set of strong candidates also receives 30-day TwitchTracker context for typical audience, growth, activity, and category conditions.',
    empty: 'No live channels were found in the selected discovery categories right now.',
    load: loadDiscover,
    hasCommonFilters: true,
    supportsDeepScan: true
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
let tokenValidationTimer = null;
let lastTokenValidationAt = 0;
let activeTab = 'discover';
let currentPage = 1;
let allStreams = [];
let followedLiveCache = null;
let followedChannelsCache = null;
let channelTeamsCache = new Map();
let tabCache = {};
let modalDetailCache = {};
let clipSort = 'views';
let risingSort = 'potential';
let risingStatusFilter = 'all';
let newAffiliateSort = 'fit';
let viewCountSort = 'default';
let followingTeamsFirst = false;
let creatorStage = 'balanced';
let matchSource = 'live';
let matchTolerance = 50;
let matchPeak = null;
let matchSourceStream = null;
let matchVodsLoaded = false;
let excludePartners = false;
let diversityLimit = 3;
let personalizationEnabled = true;
let historicalDiscoveryEnabled = true;
let followedInterestProfile = { categories:new Map(), tags:new Map() };
let hideSeen = false;
let filters = { tags: [], excludedTags: [], contentLabels:[], language:'', genres: [], categories: [], excludedCategories: [], minViewers: null, maxViewers: null, minFollowDays: null, maxUptimeHours:null, activityDays:null, openChatOnly:true };
let diagnostics = { requests:0, pages:0, candidates:0, eligible:0, failures:0, categories:0, rateRemaining:null, rateLimit:null };
let discoveryHistory = {};
let preferences = { categories:{}, categoryNames:{}, followedCategories:{}, tags:{}, languages:{}, viewerSamples:[], personalizationEnabled:true, historicalDiscoveryEnabled:true };
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
let activeLoadController = null;
const deepScanTabs = new Set();
const cardDataById = new Map();

// --- Choice button helpers ---
function choiceButtons(container) {
  return container ? [...container.querySelectorAll('button[data-value]')] : [];
}
function setChoicePressed(button, pressed) {
  if (!button) return;
  const active = Boolean(pressed);
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
}
function toggleChoicePressed(button) {
  const next = button?.getAttribute('aria-pressed') !== 'true';
  setChoicePressed(button, next);
  return next;
}
function selectedChoiceValue(container, fallback = '') {
  return choiceButtons(container).find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.value ?? fallback;
}
function selectedChoiceValues(container) {
  return choiceButtons(container).filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.value);
}
function setSingleChoice(container, value) {
  let matched = false;
  choiceButtons(container).forEach(button => {
    const active = button.dataset.value === String(value);
    matched ||= active;
    setChoicePressed(button, active);
  });
  return matched;
}

// --- Config guard ---
if (!CLIENT_ID || CLIENT_ID === 'YOUR_TWITCH_CLIENT_ID_HERE') {
  loginBtn.disabled = true;
  configWarning.classList.remove('hidden');
}
