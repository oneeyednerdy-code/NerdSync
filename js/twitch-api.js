'use strict';

// --- Token handling ---
function getAccessTokenFromUrl() {
  const params = new URLSearchParams(window.location.hash.substring(1));
  return params.get('access_token');
}

async function validateToken(token) {
  const res = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

function authHeaders(token) {
  return { 'Client-ID': CLIENT_ID, Authorization: `Bearer ${token}` };
}

async function apiFetch(url, options = {}, retry = true) {
  diagnostics.requests += 1;
  const started = performance.now();
  const parsed = new URL(url);
  const safeTarget = `${parsed.pathname}${[...parsed.searchParams.keys()].length ? `?${[...new Set(parsed.searchParams.keys())].join('&')}` : ''}`;
  let res;
  try {
    res = await fetch(url, options);
  } catch (error) {
    diagnosticEvents.push({ time:new Date().toISOString(), target:safeTarget, status:'network-error', ms:Math.round(performance.now()-started) });
    diagnosticEvents = diagnosticEvents.slice(-100);
    throw error;
  }
  diagnosticEvents.push({ time:new Date().toISOString(), target:safeTarget, status:res.status, ms:Math.round(performance.now()-started) });
  diagnosticEvents = diagnosticEvents.slice(-100);
  diagnostics.rateRemaining = res.headers.get('Ratelimit-Remaining') || diagnostics.rateRemaining;
  diagnostics.rateLimit = res.headers.get('Ratelimit-Limit') || diagnostics.rateLimit;
  if (res.status === 429 && retry) {
    const resetAt = Number(res.headers.get('Ratelimit-Reset') || 0) * 1000;
    const waitMs = Math.max(500, Math.min(5000, resetAt - Date.now()));
    await new Promise(resolve => setTimeout(resolve, waitMs));
    return apiFetch(url, options, false);
  }
  if (res.status === 401) throw new Error('SESSION_EXPIRED');
  return res;
}

function renderDiagnostics() {
  diagnosticsPanel.innerHTML = `<strong>Current scan</strong> · ${diagnostics.categories} categories · ${diagnostics.pages} directory pages · ${diagnostics.candidates} streams inspected · ${diagnostics.eligible} eligible · ${diagnostics.signalsChecked || 0} detailed checks · ${diagnostics.failures} partial failures · ${diagnostics.requests} API requests${diagnostics.rateRemaining != null ? ` · rate limit ${diagnostics.rateRemaining}/${diagnostics.rateLimit || '?'}` : ''}. <button id="download-diagnostics-btn" class="btn-logout" style="margin-left:.5rem" type="button">Download error log</button>`;
  document.getElementById('download-diagnostics-btn')?.addEventListener('click', downloadDiagnostics);
}

function downloadDiagnostics() {
  const safeFilters = {
    includedTagCount:filters.tags.length,
    excludedTagCount:filters.excludedTags.length,
    contentLabelCount:filters.contentLabels.length,
    includedCategoryCount:filters.categories.length,
    excludedCategoryCount:filters.excludedCategories.length,
    language:Boolean(filters.language),
    audienceRange:[filters.minViewers, filters.maxViewers],
    uptimeHours:filters.maxUptimeHours,
    activityDays:filters.activityDays,
    openChatOnly:filters.openChatOnly
  };
  const text = [
    `NerdSync ${APP_VERSION} diagnostic report`,
    `Generated: ${new Date().toISOString()}`,
    `Active panel: ${activeTab}`,
    `Browser: ${navigator.userAgent}`,
    `Summary: ${JSON.stringify(diagnostics)}`,
    `Filter summary: ${JSON.stringify(safeFilters)}`,
    '',
    'Recent requests (endpoint parameter names only; tokens and values omitted):',
    ...diagnosticEvents.map(event => `${event.time} ${event.status} ${event.ms}ms ${event.target}`)
  ].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type:'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `nerdsync-${APP_VERSION.toLowerCase()}-diagnostics.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  if (!res.ok) return []; // 404 when the channel has no schedule published
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
