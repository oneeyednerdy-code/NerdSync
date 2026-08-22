'use strict';

// --- Token handling ---
function getAccessTokenFromUrl() {
  const params = new URLSearchParams(window.location.hash.substring(1));
  return params.get('access_token');
}

async function validateToken(token) {
  if (!token || typeof token !== 'string') return null;
  let res;
  try {
    res = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    });
  } catch (error) {
    recordNerdSyncDiagnostic({ area:'authentication', message:'Twitch token validation request failed', details:{ error } });
    return null;
  }
  if (!res.ok) {
    recordNerdSyncDiagnostic({ level:'warning', area:'authentication', message:'Twitch token validation was rejected', details:{ status:res.status } });
    return null;
  }
  const validation = await res.json();
  const scopes = Array.isArray(validation.scopes) ? validation.scopes : [];
  const validClient = validation.client_id === CLIENT_ID;
  const validIdentity = typeof validation.user_id === 'string' && validation.user_id.length > 0;
  const validExpiry = Number(validation.expires_in) > 0;
  const hasRequiredScopes = REQUIRED_SCOPES.every(scope => scopes.includes(scope));
  const valid = validClient && validIdentity && validExpiry && hasRequiredScopes;
  if (!valid) recordNerdSyncDiagnostic({ level:'warning', area:'authentication', message:'Twitch session did not meet NerdSync validation requirements', details:{ validClient, validIdentity, validExpiry, hasRequiredScopes, scopeCount:scopes.length } });
  return valid ? validation : null;
}

function authHeaders(token) {
  return { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${token}` };
}

async function apiFetch(url, options = {}, retry = true) {
  diagnostics.requests += 1;
  const started = performance.now();
  const parsed = new URL(url);
  if (parsed.origin !== 'https://api.twitch.tv' || !parsed.pathname.startsWith('/helix/')) throw new Error('UNTRUSTED_API_TARGET');
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET') throw new Error('READ_ONLY_API_REQUIRED');
  const safeTarget = `${parsed.pathname}${[...parsed.searchParams.keys()].length ? `?${[...new Set(parsed.searchParams.keys())].join('&')}` : ''}`;
  const controller = new AbortController();
  const scanSignal = activeLoadController?.signal || null;
  const cancelForAbandonedScan = () => controller.abort();
  if (scanSignal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');
  scanSignal?.addEventListener('abort', cancelForAbandonedScan, { once:true });
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let acquired = false;
  let outcome = 'completed';
  try {
    await nerdSyncRequestManager.respectRateBudget(scanSignal);
    await nerdSyncRequestManager.acquire(scanSignal);
    acquired = true;
    const res = await fetch(url, {
      ...options,
      method,
      signal:controller.signal,
      cache:'no-store',
      credentials:'omit',
      referrerPolicy:'no-referrer'
    });
    nerdSyncRequestManager.updateRate(res.headers);
    const requestEvent = { time:new Date().toISOString(), target:safeTarget, status:res.status, ms:Math.round(performance.now()-started) };
    diagnosticEvents.push(requestEvent);
    diagnosticEvents = diagnosticEvents.slice(-100);
    diagnostics.rateRemaining = res.headers.get('Ratelimit-Remaining') || diagnostics.rateRemaining;
    diagnostics.rateLimit = res.headers.get('Ratelimit-Limit') || diagnostics.rateLimit;
    if (!res.ok) {
      outcome = res.status >= 500 ? 'failed' : 'completed';
      recordNerdSyncDiagnostic({ level:res.status >= 500 ? 'error' : 'warning', area:'twitch-api', message:'Twitch API returned a non-success status', details:{ target:safeTarget, status:res.status, ms:requestEvent.ms } });
    }
    if (res.status === 429 && retry) {
      const resetAt = Number(res.headers.get('Ratelimit-Reset') || 0) * 1000;
      const waitMs = Math.max(500, Math.min(5000, resetAt - Date.now()));
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, waitMs);
        const abort = () => { clearTimeout(timer); reject(new DOMException('Scan cancelled', 'AbortError')); };
        scanSignal?.addEventListener('abort', abort, { once:true });
      });
      if (scanSignal?.aborted) throw new DOMException('Scan cancelled', 'AbortError');
      return apiFetch(url, options, false);
    }
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    return res;
  } catch (error) {
    outcome = error?.name === 'AbortError' ? 'cancelled' : 'failed';
    const status = error?.name === 'AbortError' ? (scanSignal?.aborted ? 'cancelled' : 'timeout') : 'network-error';
    const requestEvent = { time:new Date().toISOString(), target:safeTarget, status, ms:Math.round(performance.now()-started) };
    diagnosticEvents.push(requestEvent);
    diagnosticEvents = diagnosticEvents.slice(-100);
    recordNerdSyncDiagnostic({ area:'twitch-api', message:`Twitch request ${status}`, details:{ target:safeTarget, status, ms:requestEvent.ms, error } });
    throw error;
  } finally {
    clearTimeout(timeoutId);
    scanSignal?.removeEventListener('abort', cancelForAbandonedScan);
    if (acquired) nerdSyncRequestManager.release(outcome);
  }
}

function diagnosticsFilterSummary() {
  return {
    includedTagCount:filters.tags.length,
    preferredTagCount:(filters.preferredTags || []).length,
    excludedTagCount:filters.excludedTags.length,
    contentLabelCount:filters.contentLabels.length,
    genreCount:filters.genres.length,
    includedCategoryCount:filters.categories.length,
    excludedCategoryCount:filters.excludedCategories.length,
    languageSelected:Boolean(filters.language),
    audienceRange:[filters.minViewers, filters.maxViewers],
    audienceBasis:filters.audienceBasis || 'live',
    trackerActivityHours:filters.trackerActivityHours,
    trackerGrowth:filters.trackerGrowth || null,
    uptimeHours:filters.maxUptimeHours,
    activityDays:filters.activityDays,
    openChatOnly:filters.openChatOnly,
  };
}

function diagnosticsReportExtras() {
  return {
    activeSection:activeTab,
    filterSummary:diagnosticsFilterSummary(),
    scanSummary:{ ...diagnostics },
    creatorMatch:{ source:matchSource, audience:matchPeak, tolerance:matchTolerance, candidateAudienceBasis:matchAudienceBasis, shortlistCount:typeof localWorkflowData !== 'undefined' ? localWorkflowData.matchShortlist.length : 0, historyCount:typeof localWorkflowData !== 'undefined' ? localWorkflowData.matchHistory.length : 0 },
    requestManager:nerdSyncRequestManager.snapshot(),
    recentRequests:diagnosticEvents.slice(-100),
  };
}

function renderDiagnostics() {
  const dialog = document.getElementById('diagnostics-dialog');
  if (!dialog?.open) return;
  const status = document.getElementById('diagnostics-storage-status');
  const preview = document.getElementById('diagnostics-preview');
  const clear = document.getElementById('diagnostics-clear');
  const copy = document.getElementById('diagnostics-copy');
  const entries = nerdSyncDiagnosticsLog.entries();
  const requestCount = diagnosticEvents.length;
  if (status) { const budget = nerdSyncRequestManager.snapshot(); status.textContent = `${entries.length} recorded error/event${entries.length === 1 ? '' : 's'} · ${requestCount} recent sanitized request${requestCount === 1 ? '' : 's'} · ${budget.cacheHits} cache hits · Twitch rate remaining ${budget.rateRemaining ?? 'unknown'} · kept in this browser session only.`; }
  if (preview) preview.textContent = nerdSyncDiagnosticsLog.toText(diagnosticsReportExtras());
  if (clear) clear.disabled = entries.length === 0 && requestCount === 0;
  if (copy) copy.disabled = false;
}

function downloadDiagnostics() {
  const text = nerdSyncDiagnosticsLog.toText(diagnosticsReportExtras());
  const url = URL.createObjectURL(new Blob([text], { type:'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `nerdsync-${APP_VERSION.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}-bug-log-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const status = document.getElementById('diagnostics-storage-status');
  if (status) status.textContent = 'Bug log downloaded. Post the TXT file in #bug-reports in the Nerdspace Labs Discord with a short description of the issue.';
}

async function fetchTwitchUserData(token) {
  const res = await apiFetch('https://api.twitch.tv/helix/users', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to load profile');
  return (await res.json()).data[0];
}

async function fetchFollowedStreams(userId, token) {
  const streams = [];
  let after = '';
  for (let page = 0; page < MAX_FOLLOW_PAGES; page++) {
    const params = new URLSearchParams({ user_id:userId, first:'100' });
    if (after) params.set('after', after);
    const res = await apiFetch(`https://api.twitch.tv/helix/streams/followed?${params}`, { headers:authHeaders(token) });
    if (!res.ok) throw new Error('Failed to load followed streams');
    const payload = await res.json();
    streams.push(...payload.data);
    after = payload.pagination?.cursor || '';
    if (!after) break;
  }
  return streams;
}

async function fetchFollowedChannels(userId, token) {
  const channels = [];
  let after = '';
  for (let page = 0; page < MAX_FOLLOW_PAGES; page++) {
    const params = new URLSearchParams({ user_id:userId, first:'100' });
    if (after) params.set('after', after);
    const res = await apiFetch(`https://api.twitch.tv/helix/channels/followed?${params}`, { headers:authHeaders(token) });
    if (!res.ok) throw new Error('Failed to load followed channels');
    const payload = await res.json();
    channels.push(...payload.data);
    after = payload.pagination?.cursor || '';
    if (!after) break;
  }
  return channels;
}

async function fetchChannelTeams(broadcasterId, token) {
  if (!broadcasterId) return [];
  const params = new URLSearchParams({ broadcaster_id:String(broadcasterId) });
  const res = await apiFetch(`https://api.twitch.tv/helix/teams/channel?${params}`, { headers:authHeaders(token) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('Failed to load Twitch teams');
  const payload = await res.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

async function getChannelTeams(broadcasterId, token) {
  const key = String(broadcasterId || '');
  if (!key) return [];
  const cached = channelTeamsCache.get(key);
  if (cached && Date.now() - cached.timestamp < TEAM_CACHE_TTL_MS) return cached.data;
  const data = await fetchChannelTeams(key, token);
  channelTeamsCache.set(key, { data, timestamp:Date.now() });
  return data;
}

async function enrichFollowingTeams(streams, token) {
  if (!Array.isArray(streams) || !streams.length) return [];
  const enriched = streams.map(stream => ({ ...stream }));
  let nextIndex = 0;
  const workerCount = Math.min(TEAM_LOOKUP_CONCURRENCY, enriched.length);
  const workers = Array.from({ length:workerCount }, async () => {
    while (nextIndex < enriched.length) {
      const index = nextIndex++;
      const stream = enriched[index];
      try {
        const teams = await getChannelTeams(stream.user_id, token);
        enriched[index] = { ...stream, _twitchTeams:teams.map(team => ({
          id:String(team.id || ''),
          name:String(team.team_name || ''),
          displayName:String(team.team_display_name || team.team_name || 'Twitch Team')
        })).filter(team => team.id || team.name || team.displayName) };
      } catch (error) {
        console.warn(`Could not load Twitch teams for ${stream.user_login || stream.user_id}`, error);
        enriched[index] = { ...stream, _twitchTeams:[] };
      }
    }
  });
  await Promise.all(workers);
  return enriched;
}

async function fetchTopGames(token, first) {
  const res = await apiFetch(`https://api.twitch.tv/helix/games/top?first=${first}`, { headers: authHeaders(token) });
  if (!res.ok) return [];
  return (await res.json()).data;
}

async function fetchGamesByNames(names, token) {
  if (!names.length) return [];
  const chunks = [];
  for (let i = 0; i < names.length; i += 100) chunks.push(names.slice(i, i + 100));
  const responses = await Promise.all(chunks.map(async chunk => {
    const params = new URLSearchParams();
    chunk.forEach(name => params.append('name', name));
    const res = await apiFetch(`https://api.twitch.tv/helix/games?${params}`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('Failed to resolve genre categories');
    return (await res.json()).data;
  }));
  const unique = new Map();
  responses.flat().forEach(game => unique.set(game.id, game));
  return [...unique.values()];
}

async function searchTwitchCategories(query, token) {
  const params = new URLSearchParams({ query, first:'20' });
  const res = await apiFetch(`https://api.twitch.tv/helix/search/categories?${params}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to search Twitch categories');
  return (await res.json()).data;
}

async function searchTwitchChannels(query, token) {
  const params = new URLSearchParams({ query, first:'10', live_only:'false' });
  const res = await apiFetch(`https://api.twitch.tv/helix/search/channels?${params}`, { headers:authHeaders(token) });
  if (!res.ok) throw new Error('Failed to search Twitch channels');
  return (await res.json()).data;
}

async function fetchStreamsByUserIds(ids, token) {
  if (!ids.length) return [];
  const streams = [];
  for (let index = 0; index < ids.length; index += 100) {
    const params = new URLSearchParams({ first:'100' });
    ids.slice(index, index + 100).forEach(id => params.append('user_id', id));
    const res = await apiFetch(`https://api.twitch.tv/helix/streams?${params}`, { headers:authHeaders(token) });
    if (res.ok) streams.push(...(await res.json()).data);
  }
  return streams;
}

async function fetchChatSettings(broadcasterId, token) {
  const params = new URLSearchParams({ broadcaster_id:broadcasterId });
  const res = await apiFetch(`https://api.twitch.tv/helix/chat/settings?${params}`, { headers:authHeaders(token) });
  if (!res.ok) return null;
  return (await res.json()).data?.[0] || null;
}

async function fetchStreamsByGameId(gameId, token) {
  const res = await apiFetch(`https://api.twitch.tv/helix/streams?game_id=${gameId}&first=100`, { headers: authHeaders(token) });
  if (!res.ok) return [];
  return (await res.json()).data;
}

async function fetchStreamsByGameIdPages(gameId, token, maxPages) {
  const streams = [];
  let after = '';
  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ game_id:gameId, first:'100' });
    if (after) params.set('after', after);
    const res = await apiFetch(`https://api.twitch.tv/helix/streams?${params}`, { headers:authHeaders(token) });
    if (!res.ok) throw new Error(`Failed to load streams for category ${gameId}`);
    const payload = await res.json();
    diagnostics.pages += 1;
    diagnostics.candidates += payload.data.length;
    streams.push(...payload.data);
    after = payload.pagination?.cursor || '';
    if (!after) break;
  }
  return streams;
}

async function fetchSmallStreamsForGame(gameId, token, options = {}) {
  const maxPages = options.maxPages || DISCOVER_STREAM_PAGES;
  const target = options.target || STREAMS_PER_CATEGORY_DISCOVER;
  const excludedIds = options.excludedIds || new Set();
  const eligible = [];
  let after = '';
  for (let page = 0; page < maxPages && eligible.length < target; page++) {
    const params = new URLSearchParams({ game_id:gameId, first:'100' });
    if (after) params.set('after', after);
    const res = await apiFetch(`https://api.twitch.tv/helix/streams?${params}`, { headers:authHeaders(token) });
    if (!res.ok) throw new Error(`Failed to scan category ${gameId}`);
    const payload = await res.json();
    diagnostics.pages += 1;
    diagnostics.candidates += payload.data.length;
    eligible.push(...payload.data.filter(stream => !excludedIds.has(stream.user_id) && stream.viewer_count >= 0 && stream.viewer_count <= SMALL_STREAM_VIEWER_CEILING));
    after = payload.pagination?.cursor || '';
    if (!after) break;
  }
  diagnostics.eligible += eligible.length;
  return eligible.slice(0, target);
}

function creatorStageKey(viewers) {
  const count = Number(viewers) || 0;
  return Object.entries(CREATOR_STAGES).find(([,stage]) => count >= stage.min && (stage.max == null || count <= stage.max))?.[0] || 'headliner';
}

function matchesCreatorStage(stream, stageKey = creatorStage) {
  if (stageKey === 'balanced' || stageKey === 'all') return true;
  return creatorStageKey(stream.viewer_count) === stageKey;
}

function mixCreatorStages(items) {
  const buckets = Object.fromEntries(Object.keys(CREATOR_STAGES).map(key => [key, []]));
  items.forEach(item => buckets[creatorStageKey(item.viewer_count)].push(item));
  const mixed = [];
  const used = new Set();
  while (mixed.length < items.length) {
    let added = false;
    for (const key of BALANCED_STAGE_PATTERN) {
      const item = buckets[key].shift();
      if (item && !used.has(item.user_id)) {
        mixed.push(item);
        used.add(item.user_id);
        added = true;
      }
    }
    if (!added) break;
  }
  items.forEach(item => { if (!used.has(item.user_id)) mixed.push(item); });
  return mixed;
}

async function fetchDiscoveryStreamsForGame(gameId, token, options = {}) {
  const target = options.target || STREAMS_PER_CATEGORY_DISCOVER;
  const excludedIds = options.excludedIds || new Set();
  const streams = (await fetchStreamsByGameIdPages(gameId, token, options.maxPages || DISCOVER_STREAM_PAGES))
    .filter(stream => !excludedIds.has(stream.user_id));
  let eligible;
  if (creatorStage === 'balanced') eligible = mixCreatorStages(streams);
  else if (creatorStage === 'all') {
    const stride = Math.max(1, Math.floor(streams.length / Math.max(target, 1)));
    eligible = streams.filter((_,index) => index % stride === 0);
  } else eligible = streams.filter(stream => matchesCreatorStage(stream));
  diagnostics.eligible += Math.min(eligible.length, target);
  return eligible.slice(0, target);
}

async function fetchUsersByIds(ids, token) {
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const results = await Promise.all(chunks.map(async chunk => {
    const params = chunk.map(id => `id=${id}`).join('&');
    const res = await apiFetch(`https://api.twitch.tv/helix/users?${params}`, { headers: authHeaders(token) });
    if (!res.ok) return [];
    return (await res.json()).data;
  }));
  return results.flat();
}

async function fetchChannelsByIds(ids, token) {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  if (!uniqueIds.length) return [];
  const results = [];
  for (let index = 0; index < uniqueIds.length; index += 100) {
    const params = new URLSearchParams();
    uniqueIds.slice(index, index + 100).forEach(id => params.append('broadcaster_id', id));
    const res = await apiFetch(`https://api.twitch.tv/helix/channels?${params}`, { headers:authHeaders(token) });
    if (res.ok) results.push(...(await res.json()).data);
    else diagnostics.failures += 1;
  }
  return results;
}

async function enrichBroadcasterTypes(items, isClips) {
  const idKey = isClips ? 'broadcaster_id' : 'user_id';
  const missingUserIds = [...new Set(items.filter(item => item._broadcasterType == null || !item._profileImage).map(item => item[idKey]).filter(Boolean))];
  const missingChannelIds = isClips ? [] : [...new Set(items.filter(item => item.content_classification_labels == null).map(item => item[idKey]).filter(Boolean))];
  if (!missingUserIds.length && !missingChannelIds.length) return items;
  const [users, channels] = await Promise.all([
    fetchUsersByIds(missingUserIds, currentToken),
    fetchChannelsByIds(missingChannelIds, currentToken)
  ]);
  const userById = new Map(users.map(user => [user.id, user]));
  const channelById = new Map(channels.map(channel => [channel.broadcaster_id, channel]));
  return items.map(item => {
    const user = userById.get(item[idKey]);
    const channel = channelById.get(item[idKey]);
    return { ...item, _broadcasterType:item._broadcasterType ?? user?.broadcaster_type ?? 'unknown', _profileImage:item._profileImage || user?.profile_image_url || '', _accountCreatedAt:item._accountCreatedAt || user?.created_at || '', content_classification_labels:item.content_classification_labels ?? channel?.content_classification_labels ?? [] };
  });
}

async function fetchClipsForBroadcaster(broadcasterId, token, startedAt, endedAt) {
  const params = new URLSearchParams({ broadcaster_id: broadcasterId, started_at: startedAt, ended_at: endedAt, first: String(CLIPS_PER_STREAMER) });
  const res = await apiFetch(`https://api.twitch.tv/helix/clips?${params}`, { headers: authHeaders(token) });
  if (!res.ok) return [];
  return (await res.json()).data;
}

async function fetchVideosForBroadcaster(broadcasterId, token, first) {
  const res = await apiFetch(`https://api.twitch.tv/helix/videos?user_id=${broadcasterId}&type=archive&first=${first}`, { headers: authHeaders(token) });
  if (!res.ok) return [];
  return (await res.json()).data;
}

async function fetchScheduleForBroadcaster(broadcasterId, token, first) {
  const res = await apiFetch(`https://api.twitch.tv/helix/schedule?broadcaster_id=${broadcasterId}&first=${first}`, { headers: authHeaders(token) });
  if (res.status === 404) return []; // Twitch uses 404 when the broadcaster has no schedule published.
  if (!res.ok) throw new Error('Failed to load Twitch schedule');
  const data = await res.json();
  return (data.data && data.data.segments) || [];
}

async function mapWithConcurrency(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      try { output[index] = await worker(items[index], index); }
      catch (error) { diagnostics.failures += 1; output[index] = null; }
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, items.length) }, run));
  return output;
}

async function enrichCandidateSignals(items, tabId) {
  if ((!filters.openChatOnly && filters.activityDays == null) || TABS[tabId]?.isClips) return items;
  const candidates = items.slice(0, SIGNAL_ENRICH_LIMIT);
  const enriched = await mapWithConcurrency(candidates, 5, async item => {
    const cached = signalCache[item.user_id];
    const cacheFresh = cached && Date.now() - cached.timestamp < SIGNAL_CACHE_TTL_MS;
    const cacheComplete = cacheFresh && (!filters.openChatOnly || cached.data._chatChecked) && (filters.activityDays == null || cached.data._activityChecked);
    if (cacheComplete) return { ...item, ...cached.data };
    const [chatResult, videosResult] = await Promise.allSettled([
      filters.openChatOnly ? fetchChatSettings(item.user_id, currentToken) : Promise.resolve(null),
      filters.activityDays != null ? fetchVideosForBroadcaster(item.user_id, currentToken, 1) : Promise.resolve([])
    ]);
    const chat = chatResult.status === 'fulfilled' ? chatResult.value : null;
    const videos = videosResult.status === 'fulfilled' ? videosResult.value : [];
    const data = { ...(cacheFresh ? cached.data : {}) };
    if (filters.openChatOnly) Object.assign(data, { _chatOpen:chat ? !chat.follower_mode && !chat.subscriber_mode && !chat.emote_mode : false, _chatSettings:chat, _chatChecked:true });
    if (filters.activityDays != null) Object.assign(data, { _lastBroadcastAt:videos[0]?.created_at || null, _activityChecked:true });
    signalCache[item.user_id] = { timestamp:Date.now(), data };
    return { ...item, ...data };
  });
  diagnostics.signalsChecked = candidates.length;
  const byId = new Map(enriched.filter(Boolean).map(item => [item.user_id, item]));
  return items.map(item => byId.get(item.user_id) || item);
}

async function getFollowedLive() {
  if (followedLiveCache) return followedLiveCache;
  followedLiveCache = await fetchFollowedStreams(currentUser.id, currentToken);
  return followedLiveCache;
}

async function getFollowedChannels() {
  if (followedChannelsCache) return followedChannelsCache;
  followedChannelsCache = await fetchFollowedChannels(currentUser.id, currentToken);
  return followedChannelsCache;
}
