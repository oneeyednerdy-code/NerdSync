'use strict';

const TWITCHTRACKER_SUMMARY_ENDPOINT = '/api/twitchtracker-summary';
const TWITCHTRACKER_CATEGORY_ENDPOINT = '/api/twitchtracker-category-summary';
const TWITCHTRACKER_CACHE_MS = 6 * 60 * 60 * 1000;
const TWITCHTRACKER_FAILURE_CACHE_MS = 60 * 60 * 1000;
const TWITCHTRACKER_DISCOVERY_LIMIT = 20;
const TWITCHTRACKER_CATEGORY_LIMIT = 6;
const TWITCHTRACKER_DISCOVERY_CONCURRENCY = 4;
const TWITCHTRACKER_STORAGE_KEY = 'nerdsync_twitchtracker_cache_v1';
const twitchTrackerSummaryCache = new Map();
const twitchTrackerCategoryCache = new Map();
const twitchTrackerFailureCache = new Map();
let twitchTrackerPersistentCacheLoaded = false;

function finiteTwitchTrackerNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstTwitchTrackerNumber(data, keys) {
  for (const key of keys) {
    const value = finiteTwitchTrackerNumber(data && data[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeTwitchTrackerSummary(data, channel = '') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    channel: String(channel || data.channel || data.username || '').trim().toLowerCase(),
    averageViewers: firstTwitchTrackerNumber(data, ['avg_viewers', 'average_viewers', 'averageViewers']),
    maxViewers: firstTwitchTrackerNumber(data, ['max_viewers', 'peak_viewers', 'maxViewers']),
    minutesStreamed: firstTwitchTrackerNumber(data, ['minutes_streamed', 'minutesStreamed']),
    hoursWatched: firstTwitchTrackerNumber(data, ['hours_watched', 'hoursWatched']),
    followersGained: firstTwitchTrackerNumber(data, ['followers', 'followers_gained', 'followersGained']),
    totalFollowers: firstTwitchTrackerNumber(data, ['followers_total', 'total_followers', 'totalFollowers']),
    rank: firstTwitchTrackerNumber(data, ['rank']),
    periodDays: 30,
    source: 'TwitchTracker',
  };
}

function normalizeTwitchTrackerCategorySummary(data, gameId = '') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    gameId: String(gameId || data.game_id || data.id || '').trim(),
    rank: firstTwitchTrackerNumber(data, ['rank']),
    hoursWatched: firstTwitchTrackerNumber(data, ['hours_watched', 'hoursWatched']),
    averageViewers: firstTwitchTrackerNumber(data, ['avg_viewers', 'average_viewers', 'averageViewers']),
    averageChannels: firstTwitchTrackerNumber(data, ['avg_channels', 'average_channels', 'averageChannels']),
    periodDays: 30,
    source: 'TwitchTracker',
  };
}

function trackerStorageAvailable() {
  try { return typeof localStorage !== 'undefined'; }
  catch { return false; }
}

function loadTwitchTrackerPersistentCache() {
  if (twitchTrackerPersistentCacheLoaded) return;
  twitchTrackerPersistentCacheLoaded = true;
  if (!trackerStorageAvailable()) return;
  try {
    const payload = JSON.parse(localStorage.getItem(TWITCHTRACKER_STORAGE_KEY) || '{}') || {};
    const now = Date.now();
    Object.entries(payload.channels || {}).forEach(([key, entry]) => {
      if (entry && Number(entry.at) > now - TWITCHTRACKER_CACHE_MS && entry.value) twitchTrackerSummaryCache.set(key, entry);
    });
    Object.entries(payload.categories || {}).forEach(([key, entry]) => {
      if (entry && Number(entry.at) > now - TWITCHTRACKER_CACHE_MS && entry.value) twitchTrackerCategoryCache.set(key, entry);
    });
  } catch {
    // Browser cache is optional. Network data still works without it.
  }
}

function saveTwitchTrackerPersistentCache() {
  if (!trackerStorageAvailable()) return;
  try {
    const trimEntries = cache => [...cache.entries()]
      .sort((a,b) => Number(b[1]?.at || 0) - Number(a[1]?.at || 0))
      .slice(0, 80);
    localStorage.setItem(TWITCHTRACKER_STORAGE_KEY, JSON.stringify({
      channels:Object.fromEntries(trimEntries(twitchTrackerSummaryCache)),
      categories:Object.fromEntries(trimEntries(twitchTrackerCategoryCache)),
    }));
  } catch {
    // Cache persistence is best-effort only.
  }
}

async function getTwitchTrackerSummary(channel, { fetchImpl = fetch, signal, force = false } = {}) {
  loadTwitchTrackerPersistentCache();
  const normalized = String(channel || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{1,25}$/.test(normalized)) throw new Error('Invalid Twitch channel login.');
  const cached = twitchTrackerSummaryCache.get(normalized);
  if (!force && cached && Date.now() - cached.at < TWITCHTRACKER_CACHE_MS) { if (typeof nerdSyncRequestManager !== 'undefined') nerdSyncRequestManager.markCacheHit(); return cached.value; }
  const failedAt = twitchTrackerFailureCache.get(`channel:${normalized}`);
  if (!force && failedAt && Date.now() - failedAt < TWITCHTRACKER_FAILURE_CACHE_MS) return null;

  const url = new URL(TWITCHTRACKER_SUMMARY_ENDPOINT, location.origin);
  url.searchParams.set('channel', normalized);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error?.name !== 'AbortError') recordNerdSyncDiagnostic({ area:'twitchtracker', message:'TwitchTracker channel summary request failed', details:{ endpoint:'channel-summary', error } });
    throw error;
  }
  if (!response.ok) {
    twitchTrackerFailureCache.set(`channel:${normalized}`, Date.now());
    if (response.status === 404) return null;
    recordNerdSyncDiagnostic({ level:'warning', area:'twitchtracker', message:'TwitchTracker channel summary returned a non-success status', details:{ endpoint:'channel-summary', status:response.status } });
    throw new Error(`TwitchTracker summary unavailable (${response.status}).`);
  }
  const payload = await response.json();
  const value = normalizeTwitchTrackerSummary(payload, normalized);
  if (value) {
    twitchTrackerSummaryCache.set(normalized, { at: Date.now(), value });
    saveTwitchTrackerPersistentCache();
  }
  return value;
}

async function getTwitchTrackerCategorySummary(gameId, { fetchImpl = fetch, signal, force = false } = {}) {
  loadTwitchTrackerPersistentCache();
  const normalized = String(gameId || '').trim();
  if (!/^\d{1,24}$/.test(normalized)) throw new Error('Invalid Twitch category ID.');
  const cached = twitchTrackerCategoryCache.get(normalized);
  if (!force && cached && Date.now() - cached.at < TWITCHTRACKER_CACHE_MS) { if (typeof nerdSyncRequestManager !== 'undefined') nerdSyncRequestManager.markCacheHit(); return cached.value; }
  const failedAt = twitchTrackerFailureCache.get(`category:${normalized}`);
  if (!force && failedAt && Date.now() - failedAt < TWITCHTRACKER_FAILURE_CACHE_MS) return null;

  const url = new URL(TWITCHTRACKER_CATEGORY_ENDPOINT, location.origin);
  url.searchParams.set('game', normalized);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error?.name !== 'AbortError') recordNerdSyncDiagnostic({ area:'twitchtracker', message:'TwitchTracker category summary request failed', details:{ endpoint:'category-summary', error } });
    throw error;
  }
  if (!response.ok) {
    twitchTrackerFailureCache.set(`category:${normalized}`, Date.now());
    if (response.status === 404) return null;
    recordNerdSyncDiagnostic({ level:'warning', area:'twitchtracker', message:'TwitchTracker category summary returned a non-success status', details:{ endpoint:'category-summary', status:response.status } });
    throw new Error(`TwitchTracker category summary unavailable (${response.status}).`);
  }
  const payload = await response.json();
  const value = normalizeTwitchTrackerCategorySummary(payload, normalized);
  if (value) {
    twitchTrackerCategoryCache.set(normalized, { at: Date.now(), value });
    saveTwitchTrackerPersistentCache();
  }
  return value;
}

function deriveTwitchTrackerSignals(summary, currentViewers, { mode = '' } = {}) {
  if (!summary) return null;
  const average = finiteTwitchTrackerNumber(summary.averageViewers);
  const current = finiteTwitchTrackerNumber(currentViewers);
  const streamedHours = Number.isFinite(summary.minutesStreamed) ? Math.max(0, summary.minutesStreamed / 60) : null;
  const followersGained = finiteTwitchTrackerNumber(summary.followersGained);
  const followersPerHour = Number.isFinite(followersGained) && Number.isFinite(streamedHours) && streamedHours >= 1
    ? followersGained / streamedHours
    : null;
  const currentRatio = Number.isFinite(current) && Number.isFinite(average) && average > 0 ? current / average : null;
  const percentVsAverage = Number.isFinite(currentRatio) ? Math.round((currentRatio - 1) * 100) : null;
  const labels = [];
  let liveContext = '';

  if (Number.isFinite(currentRatio)) {
    if (currentRatio >= 1.35) liveContext = 'Hot right now';
    else if (currentRatio <= 0.65) liveContext = 'Quiet right now';
    else if (currentRatio >= 0.8 && currentRatio <= 1.2) liveContext = 'Near typical';
    if (liveContext) labels.push(liveContext);
  }

  const growing = Number.isFinite(followersGained) && followersGained >= 8 && Number.isFinite(followersPerHour) && followersPerHour >= 0.2;
  const active = Number.isFinite(streamedHours) && streamedHours >= 24;
  if (growing) labels.push('Growing this month');
  if (active) labels.push('Active this month');

  let gemLabel = '';
  if (mode === 'gems') {
    if (growing) gemLabel = 'Rising gem';
    else if (liveContext === 'Near typical') gemLabel = 'Steady gem';
    else if (liveContext) gemLabel = liveContext;
  }

  return {
    streamedHours,
    followersPerHour,
    currentRatio,
    percentVsAverage,
    liveContext,
    growing,
    active,
    gemLabel,
    labels:[...new Set(labels)],
  };
}

function deriveNewerAffiliateSignal(stream, summary) {
  if (!stream || stream._broadcasterType !== 'affiliate' || stream._emergingSection !== 'newAffiliate') return null;
  const ageDays = Number.isFinite(stream._newAffiliateAgeDays)
    ? stream._newAffiliateAgeDays
    : stream._accountCreatedAt ? Math.max(0, (Date.now() - new Date(stream._accountCreatedAt).getTime()) / 86400000) : null;
  if (!Number.isFinite(ageDays) || ageDays >= NEW_AFFILIATE_ACCOUNT_DAYS) return null;

  const recencyScore = Math.max(0, Math.min(55, (1 - ageDays / NEW_AFFILIATE_ACCOUNT_DAYS) * 55));
  const signals = summary ? deriveTwitchTrackerSignals(summary, stream.viewer_count, { mode:'rising' }) : null;
  const streamedHours = signals?.streamedHours;
  const followersPerHour = signals?.followersPerHour;
  const activityScore = Number.isFinite(streamedHours) ? Math.min(20, streamedHours / 2) : 0;
  const growthScore = Number.isFinite(followersPerHour) && followersPerHour > 0 ? Math.min(25, followersPerHour * 25) : 0;
  const score = Math.max(0, Math.min(100, Math.round(recencyScore + activityScore + growthScore)));

  let label = 'Newer Affiliate';
  if (signals?.growing && signals?.active) label = 'Active + growing newer Affiliate';
  else if (signals?.growing) label = 'Growing newer Affiliate';
  else if (signals?.active) label = 'Active newer Affiliate';

  const reasons = [`current Affiliate · ${Math.round(ageDays)}d account`];
  if (Number.isFinite(streamedHours)) reasons.push(`${Math.round(streamedHours * 10) / 10}h streamed / 30d`);
  if (Number.isFinite(summary?.followersGained)) reasons.push(`${summary.followersGained >= 0 ? '+' : ''}${summary.followersGained} followers / 30d`);
  return { label, score, ageDays, signals, reasons:reasons.slice(0,3) };
}

function twitchTrackerDiscoveryBonus(summary, currentViewers, mode = '') {
  const signals = deriveTwitchTrackerSignals(summary, currentViewers, { mode });
  if (!signals) return { bonus:0, reasons:[], signals:null };
  let bonus = 0;
  const reasons = [];

  if (Number.isFinite(signals.streamedHours)) {
    const activityBonus = Math.min(6, signals.streamedHours / 8);
    bonus += activityBonus;
    if (activityBonus >= 3) reasons.push('30-day activity');
  }
  if (Number.isFinite(signals.followersPerHour) && signals.followersPerHour > 0) {
    const growthBonus = Math.min(7, Math.log1p(signals.followersPerHour) * 4);
    bonus += growthBonus;
    if (growthBonus >= 2) reasons.push('recent follower growth');
  }
  if (signals.liveContext === 'Hot right now') {
    bonus += 2;
    reasons.push('live above typical');
  } else if (signals.liveContext === 'Near typical') {
    bonus += 1;
  }
  if ((mode === 'rising' || mode === 'gems') && signals.growing) bonus += 2;

  return { bonus:Math.min(16, Math.round(bonus)), reasons:[...new Set(reasons)].slice(0, 2), signals };
}

function trackerCandidatePriority(stream, tabId) {
  if (tabId === 'match') {
    const distance = Number.isFinite(matchPeak) ? Math.abs(stream.viewer_count - matchPeak) / Math.max(matchPeak, 1) : 1;
    const preferred = typeof creatorMatchTagAssessment === 'function' ? creatorMatchTagAssessment(stream).preferredMatches.length : 0;
    return Math.max(0, 100 - distance * 100) + preferred * 8;
  }
  if (tabId === 'rising' && stream._emergingSection === 'newAffiliate') return Number(stream._newAffiliateScore || 0) + discoveryScore(stream).score + 20;
  if (tabId === 'rising') return Number(stream._risingScore || 0) + discoveryScore(stream).score;
  if (tabId === 'gems') {
    const laneBoost = String(stream._gemAudienceLane || '').startsWith('1–5') ? 8 : String(stream._gemAudienceLane || '').startsWith('6–20') ? 5 : 2;
    return discoveryScore(stream).score + laneBoost;
  }
  return discoveryScore(stream).score;
}

function trackerEligibleCandidate(stream, tabId) {
  if (!stream?.user_login || !stream?.user_id) return false;
  if (excludePartners && stream._broadcasterType === 'partner') return false;
  if (isDismissed(stream.user_id)) return false;
  if (hideSeen && wasSeenRecently(stream.user_id) && !historyFor(stream.user_id).saved) return false;
  if (creatorStage !== 'balanced' && creatorStage !== 'all' && !matchesCreatorStage(stream)) return false;
  if (TABS[tabId]?.hasCommonFilters && !passesCommonFilters(stream, { ignoreHistorical:true })) return false;
  return true;
}

async function trackerMapWithConcurrency(items, limit, worker, signal) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length && !signal?.aborted) {
      const index = next++;
      try { output[index] = await worker(items[index], index); }
      catch { output[index] = null; }
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, items.length) }, run));
  return output;
}

function applyTwitchTrackerSummaryToStream(stream, summary, tabId) {
  if (!summary) return stream;
  const historical = twitchTrackerDiscoveryBonus(summary, stream.viewer_count, tabId);
  const newerAffiliate = tabId === 'rising' ? deriveNewerAffiliateSignal(stream, summary) : null;
  let risingScore = stream._risingScore;
  if (tabId === 'rising' && Number.isFinite(risingScore)) risingScore = Math.min(100, Math.round(risingScore + historical.bonus));
  const affiliateWhy = newerAffiliate ? newerAffiliate.reasons.join(' · ') + ' · affiliate-earned date unavailable' : null;
  return {
    ...stream,
    _trackerSummary:summary,
    _trackerSignals:historical.signals,
    _trackerDiscoveryBonus:historical.bonus,
    _trackerReasons:historical.reasons,
    _risingScore:risingScore,
    _newAffiliateScore:newerAffiliate?.score ?? stream._newAffiliateScore,
    _newAffiliateLabel:newerAffiliate?.label ?? stream._newAffiliateLabel,
    _why:affiliateWhy || stream._why,
  };
}

async function enrichDiscoveryWithTwitchTracker(items, tabId, { signal } = {}) {
  const filterState = typeof filters !== 'undefined' && filters ? filters : {};
  const currentMatchBasis = typeof matchAudienceBasis !== 'undefined' ? matchAudienceBasis : 'live';
  const explicitHistoricalFilter = filterState.audienceBasis === 'typical' || filterState.trackerActivityHours != null || Boolean(filterState.trackerGrowth);
  if ((!historicalDiscoveryEnabled && tabId !== 'match' && !explicitHistoricalFilter) || !['discover', 'gems', 'rising', 'spotlight', 'match'].includes(tabId) || !items.length) return items;
  const requestedLimit = (filterState.audienceBasis === 'typical' || filterState.trackerActivityHours != null || filterState.trackerGrowth || (tabId === 'match' && currentMatchBasis === 'typical')) ? 40 : TWITCHTRACKER_DISCOVERY_LIMIT;
  const candidates = items
    .filter(stream => trackerEligibleCandidate(stream, tabId))
    .sort((a,b) => trackerCandidatePriority(b, tabId) - trackerCandidatePriority(a, tabId) || a.viewer_count - b.viewer_count)
    .slice(0, requestedLimit);
  if (!candidates.length) return items;

  const categoryIds = [...new Set(candidates.map(stream => String(stream.game_id || '')).filter(id => /^\d+$/.test(id)))].slice(0, TWITCHTRACKER_CATEGORY_LIMIT);
  const channelPromise = trackerMapWithConcurrency(candidates, TWITCHTRACKER_DISCOVERY_CONCURRENCY, async stream => ({
    id:stream.user_id,
    summary:await getTwitchTrackerSummary(stream.user_login, { signal }),
  }), signal);
  const categoryPromise = trackerMapWithConcurrency(categoryIds, 3, async gameId => ({
    gameId,
    summary:await getTwitchTrackerCategorySummary(gameId, { signal }),
  }), signal);
  const [channelResults, categoryResults] = await Promise.all([channelPromise, categoryPromise]);
  const byId = new Map(channelResults.filter(result => result?.summary).map(result => [result.id, result.summary]));
  const categoryById = new Map(categoryResults.filter(result => result?.summary).map(result => [result.gameId, result.summary]));

  diagnostics.trackerChecked = candidates.length;
  diagnostics.trackerCategories = categoryIds.length;
  return items.map(stream => {
    const channelSummary = byId.get(stream.user_id);
    const categorySummary = categoryById.get(String(stream.game_id || ''));
    const withChannel = applyTwitchTrackerSummaryToStream(stream, channelSummary, tabId);
    return categorySummary ? { ...withChannel, _trackerCategorySummary:categorySummary } : withChannel;
  });
}
