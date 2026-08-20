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
  if (kind === 'open') { updateHistory(id, { openedAt:Date.now(), openCount:(current.openCount || 0) + 1, snapshot }); learnFromCreator(stream, 1); }
  if (kind === 'watch') { updateHistory(id, { watchedAt:Date.now(), watchClicks:(current.watchClicks || 0) + 1, snapshot }); learnFromCreator(stream, 2); }
  if (kind === 'save') { const saved = !current.saved; updateHistory(id, { saved, snapshot }); learnFromCreator(stream, saved ? 3 : -3); }
  if (kind === 'dismiss') { updateHistory(id, { dismissedUntil:Date.now() + 30 * 86400000, snapshot }); learnFromCreator(stream, -3); }
  if (kind === 'never') { updateHistory(id, { permanentDismiss:true, snapshot }); learnFromCreator(stream, -4); }
  if (kind === 'less') { updateHistory(id, { lessLike:(current.lessLike || 0) + 1, snapshot }); learnFromCreator(stream, -2); }
  if (kind === 'more') {
    const moreLike = !current.moreLike;
    updateHistory(id, { moreLike, snapshot });
    learnFromCreator(stream, moreLike ? 4 : -4);
  }
}
function isDismissed(id) { return Boolean(historyFor(id).permanentDismiss) || Number(historyFor(id).dismissedUntil || 0) > Date.now(); }
function wasSeenRecently(id) { return Number(historyFor(id).seenAt || 0) > Date.now() - 7 * 86400000; }

function discoveryScore(stream) {
  const reasons = [];
  let score = 0;
  const selectedCategory = filters.categories.some(category => category.id === stream.game_id);
  if (selectedCategory) { score += 22; reasons.push('selected category'); }
  const followedCategory = Boolean(preferences.followedCategories[stream.game_id]);
  if (personalizationEnabled && followedCategory) { score += 18; reasons.push('category followed in NerdSync'); }
  const categoryWeight = personalizationEnabled ? preferences.categories[stream.game_id] || 0 : 0;
  if (categoryWeight > 0) { score += Math.min(12, categoryWeight * 2); reasons.push('category you engage with'); }
  if (categoryWeight < 0) score += Math.max(-12, categoryWeight * 2);
  const followedCategorySignal = personalizationEnabled ? followedInterestProfile.categories.get(stream.game_id) : null;
  if (followedCategorySignal) { score += Math.min(10, 3 + followedCategorySignal.count); reasons.push('category used by followed channels'); }
  const streamTags = (stream.tags || []).map(tag => tag.toLowerCase());
  const explicitMatches = filters.tags.filter(tag => streamTags.includes(tag.toLowerCase())).length;
  if (explicitMatches) { score += Math.min(24, 12 + explicitMatches * 4); reasons.push(`${explicitMatches} selected tag${explicitMatches === 1 ? '' : 's'}`); }
  const learnedTagScore = personalizationEnabled ? streamTags.reduce((sum, tag) => sum + (preferences.tags[tag] || 0), 0) : 0;
  if (learnedTagScore > 0) { score += Math.min(12, learnedTagScore); reasons.push('tags you engage with'); }
  if (learnedTagScore < 0) score += Math.max(-12, learnedTagScore);
  const followedTagMatches = personalizationEnabled ? streamTags.filter(tag => followedInterestProfile.tags.has(tag)).length : 0;
  if (followedTagMatches) { score += Math.min(8, followedTagMatches * 2); reasons.push('tags shared with followed channels'); }
  const preferredViewers = personalizationEnabled && preferences.viewerSamples.length ? preferences.viewerSamples.reduce((sum,value) => sum + value, 0) / preferences.viewerSamples.length : null;
  const audienceFit = preferredViewers == null ? 0 : Math.max(0, 20 - Math.abs((stream.viewer_count || 0) - preferredViewers) / Math.max(3, preferredViewers) * 10);
  score += audienceFit;
  if (audienceFit >= 14) reasons.push('audience size fit');
  if (filters.language && stream.language === filters.language) { score += 10; reasons.push('language match'); }
  else if (personalizationEnabled && (preferences.languages[stream.language] || 0) > 0) { score += Math.min(7, preferences.languages[stream.language]); reasons.push('preferred language'); }
  const history = historyFor(stream.user_id);
  if (personalizationEnabled && !history.openedAt) { score += 10; reasons.push('someone new'); }
  else if (personalizationEnabled) score -= Math.min(10, (history.openCount || 1) * 2);
  if (personalizationEnabled && history.saved) score += 8;
  if (personalizationEnabled && history.moreLike) { score += 12; reasons.push('more like a creator you chose'); }
  if (personalizationEnabled && history.lessLike) score -= Math.min(15, history.lessLike * 5);
  if (stream._lastBroadcastAt && Date.now() - new Date(stream._lastBroadcastAt).getTime() < 30 * 86400000) { score += 5; reasons.push('recently active'); }
  if (stream._broadcasterType === 'none') { score += 4; reasons.push('not affiliated'); }
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score:finalScore, reasons:reasons.slice(0, 4) };
}

function recommendationCategorySeeds(limit = 10) {
  if (!personalizationEnabled) return [];
  const seeds = new Map();
  Object.entries(preferences.followedCategories || {}).forEach(([id, name]) => seeds.set(id, { id, name }));
  Object.entries(preferences.categories || {})
    .filter(([, weight]) => weight > 0)
    .sort((a,b) => b[1] - a[1])
    .forEach(([id]) => {
      if (!seeds.has(id) && preferences.categoryNames[id]) seeds.set(id, { id, name:preferences.categoryNames[id] });
    });
  return [...seeds.values()].slice(0, limit);
}

function buildFollowedInterestProfile(liveStreams = [], followedChannels = []) {
  const categories = new Map();
  const tags = new Map();
  const addCategory = (id, name) => {
    if (!id) return;
    const current = categories.get(id) || { name:name || 'Twitch category', count:0 };
    current.count += 1;
    if (name) current.name = name;
    categories.set(id, current);
  };
  followedChannels.forEach(channel => {
    addCategory(channel.game_id, channel.game_name);
    (channel.tags || []).forEach(tag => {
      const key = tag.toLowerCase();
      tags.set(key, (tags.get(key) || 0) + 1);
    });
  });
  liveStreams.forEach(stream => {
    addCategory(stream.game_id, stream.game_name);
    (stream.tags || []).forEach(tag => {
      const key = tag.toLowerCase();
      tags.set(key, (tags.get(key) || 0) + 1);
    });
  });
  followedInterestProfile = { categories, tags };
}

function blendDiscoveryModes(items) {
  if (!personalizationEnabled || items.length < 4) return items;
  const selectedIds = new Set(filters.categories.map(category => category.id));
  const positiveCategories = new Set([
    ...Object.keys(preferences.followedCategories || {}),
    ...Object.entries(preferences.categories || {}).filter(([,weight]) => weight > 0).map(([id]) => id),
    ...followedInterestProfile.categories.keys()
  ]);
  const positiveTags = new Set([
    ...Object.entries(preferences.tags || {}).filter(([,weight]) => weight > 0).map(([tag]) => tag),
    ...followedInterestProfile.tags.keys()
  ]);
  const hasAffinity = stream => selectedIds.has(stream.game_id) || positiveCategories.has(stream.game_id) || (stream.tags || []).some(tag => positiveTags.has(tag.toLowerCase()));
  const exploration = items.filter(stream => !hasAffinity(stream));
  const discovery = items.filter(stream => hasAffinity(stream) && !historyFor(stream.user_id).openedAt && !historyFor(stream.user_id).triedAt);
  const personal = items.filter(hasAffinity);
  const output = [];
  const used = new Set();
  const take = (queue, lane) => {
    const item = queue.find(candidate => !used.has(candidate.user_id));
    if (!item) return false;
    used.add(item.user_id);
    const laneLabel = lane === 'discovery' ? 'Discovery pick' : lane === 'explore' ? 'Exploration pick' : 'Strong match';
    output.push({ ...item, _recommendationLane:lane, _why:`${laneLabel} · ${item._why || 'Live now'}` });
    return true;
  };
  const pattern = ['personal','personal','personal','personal','personal','personal','personal','discovery','discovery','explore'];
  while (output.length < items.length) {
    let addedThisRound = false;
    pattern.forEach(lane => {
      if (output.length >= items.length) return;
      const queue = lane === 'personal' ? personal : lane === 'discovery' ? discovery : exploration;
      let added = take(queue, lane);
      if (!added) added = take(items, lane);
      addedThisRound = added || addedThisRound;
    });
    if (!addedThisRound) break;
  }
  return output;
}

function toggleFollowCategory(stream) {
  if (!stream?.game_id) return;
  if (preferences.followedCategories[stream.game_id]) delete preferences.followedCategories[stream.game_id];
  else preferences.followedCategories[stream.game_id] = stream.game_name || 'Selected category';
  savePreferences();
  renderRecommendationProfile();
  if (activeTab !== 'following' && !TABS[activeTab].isClips) delete tabCache[activeTab];
}

function renderRecommendationProfile() {
  if (!recommendationProfileSummary) return;
  if (!personalizationEnabled) {
    recommendationProfileSummary.innerHTML = '<span class="signal">Learning from NerdSync choices is off</span><span class="signal">Twitch follows and explicit filters still guide discovery</span>';
    return;
  }
  const followed = Object.values(preferences.followedCategories || {}).slice(0, 5).map(name => `Following: ${name}`);
  const learnedCategories = Object.entries(preferences.categories || {})
    .filter(([, weight]) => weight > 0)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id]) => preferences.categoryNames[id])
    .filter(Boolean)
    .map(name => `Learns: ${name}`);
  const learnedTags = Object.entries(preferences.tags || {})
    .filter(([, weight]) => weight > 0)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => `Tag: ${tag}`);
  const signals = [...followed, ...learnedCategories, ...learnedTags];
  recommendationProfileSummary.innerHTML = signals.length
    ? signals.map(signal => `<span class="signal">${escapeHtml(signal)}</span>`).join('')
    : '<span class="signal">No learned interests yet</span><span class="signal">Use More like this, Save, or Follow category</span>';
}

function diversifyItems(items, cap) {
  if (!cap || activeTab === 'following' || TABS[activeTab].isClips) return items;
  const remaining = [...items];
  const output = [];
  while (remaining.length) {
    const page = [];
    const counts = new Map();
    for (let index = 0; index < remaining.length && page.length < PAGE_SIZE;) {
      const item = remaining[index];
      const category = item.game_id || 'none';
      if ((counts.get(category) || 0) < cap) {
        page.push(item);
        counts.set(category, (counts.get(category) || 0) + 1);
        remaining.splice(index, 1);
      } else index += 1;
    }
    while (page.length < PAGE_SIZE && remaining.length) page.push(remaining.shift());
    output.push(...page);
  }
  return output;
}

function updateSavedCount() {
  savedCount.textContent = String(Object.values(discoveryHistory).filter(item => item.saved).length);
}

function streamFromSnapshot(snapshot) {
  return {
    id:snapshot.id, user_id:snapshot.id, user_login:snapshot.login, user_name:snapshot.name,
    game_id:snapshot.gameId || '', game_name:snapshot.gameName || '', thumbnail_url:snapshot.thumbnail || '',
    tags:snapshot.tags || [], language:snapshot.language || '', viewer_count:snapshot.viewerCount,
    content_classification_labels:snapshot.contentLabels || [],
    _profileImage:snapshot.profileImage || '', _broadcasterType:snapshot.broadcasterType || 'unknown', type:'offline', title:''
  };
}

function renderSavedList() {
  const saved = Object.entries(discoveryHistory).filter(([,item]) => item.saved);
  updateSavedCount();
  if (!saved.length) { savedList.innerHTML = '<p class="empty-compact">No creators saved yet.</p>'; return; }
  savedList.innerHTML = saved.map(([id,item]) => {
    const creator = knownCreators.get(id) || (item.snapshot ? streamFromSnapshot(item.snapshot) : null);
    const name = creator?.user_name || item.snapshot?.name || 'Saved creator';
    const login = creator?.user_login || item.snapshot?.login || '';
    const image = creator?._profileImage || item.snapshot?.profileImage || '';
    return `<div class="tool-result" data-creator-id="${escapeHtml(id)}">${image ? `<img src="${escapeHtml(image)}" alt="" />` : ''}<div class="tool-result-info"><p class="tool-result-title">${escapeHtml(name)}</p><p class="tool-result-meta">${escapeHtml(creator?.game_name || item.snapshot?.gameName || 'Category unavailable')}</p></div><div class="tool-result-actions">${login ? `<a class="btn-logout" href="https://twitch.tv/${encodeURIComponent(login)}" target="_blank" rel="noopener noreferrer">Twitch</a>` : ''}<button class="btn-logout" data-saved-action="compare" type="button">Compare</button><button class="btn-logout" data-saved-action="remove" type="button">Unsave</button></div></div>`;
  }).join('');
}

savedList.addEventListener('click', event => {
  const button = event.target.closest('[data-saved-action]');
  const row = event.target.closest('[data-creator-id]');
  if (!button || !row) return;
  const id = row.dataset.creatorId;
  const creator = knownCreators.get(id) || (historyFor(id).snapshot ? streamFromSnapshot(historyFor(id).snapshot) : null);
  if (button.dataset.savedAction === 'remove') updateHistory(id, { saved:false });
  if (button.dataset.savedAction === 'compare' && creator) addToComparison(creator);
  renderSavedList(); renderGrid();
});

async function runChannelSearch() {
  const query = channelSearchInput.value.trim();
  if (query.length < 2) { channelSearchResults.innerHTML = '<p class="empty-compact">Enter at least two characters.</p>'; return; }
  channelSearchResults.innerHTML = '<p class="empty-compact">Searching Twitch…</p>';
  try {
    const channels = await searchTwitchChannels(query, currentToken);
    const ids = channels.map(channel => channel.id);
    const [users, streams] = await Promise.all([fetchUsersByIds(ids, currentToken), fetchStreamsByUserIds(ids, currentToken)]);
    const userById = new Map(users.map(user => [user.id,user]));
    const streamById = new Map(streams.map(stream => [stream.user_id,stream]));
    const results = channels.map(channel => {
      const user = userById.get(channel.id);
      const live = streamById.get(channel.id);
      const creator = live || {
        id:channel.id, user_id:channel.id, user_login:channel.broadcaster_login, user_name:channel.display_name,
        game_id:channel.game_id || '', game_name:channel.game_name || '', title:channel.title || '', tags:channel.tags || [],
        language:channel.broadcaster_language || '', thumbnail_url:channel.thumbnail_url || '', viewer_count:null, type:'offline'
      };
      creator._profileImage = user?.profile_image_url || channel.thumbnail_url || '';
      creator._broadcasterType = user?.broadcaster_type || 'none';
      creator._accountCreatedAt = user?.created_at || '';
      rememberCreator(creator);
      return creator;
    });
    channelSearchResults.innerHTML = results.length ? results.map(creator => `<div class="tool-result" data-search-id="${escapeHtml(creator.user_id)}"><img src="${escapeHtml(creator._profileImage || creator.thumbnail_url || '')}" alt="" /><div class="tool-result-info"><p class="tool-result-title">${escapeHtml(creator.user_name)}</p><p class="tool-result-meta">${creator.type === 'live' ? `${new Intl.NumberFormat().format(creator.viewer_count)} viewers · ` : 'Offline · '}${escapeHtml(creator.game_name || 'No category')} · ${escapeHtml(creator._broadcasterType === 'none' ? 'not affiliated' : creator._broadcasterType)}</p></div><div class="tool-result-actions"><a class="btn-logout" href="https://twitch.tv/${encodeURIComponent(creator.user_login)}" target="_blank" rel="noopener noreferrer">Twitch</a><button class="btn-logout" data-search-action="save" type="button">Save</button><button class="btn-logout" data-search-action="compare" type="button">Compare</button></div></div>`).join('') : '<p class="empty-compact">No matching Twitch channels found.</p>';
  } catch (error) {
    console.error(error);
    channelSearchResults.innerHTML = '<p class="empty-compact">Channel search failed. Check Scan details and try again.</p>';
  }
}

channelSearchResults.addEventListener('click', event => {
  const button = event.target.closest('[data-search-action]');
  const row = event.target.closest('[data-search-id]');
  if (!button || !row) return;
  const creator = knownCreators.get(row.dataset.searchId);
  if (!creator) return;
  if (button.dataset.searchAction === 'save') { recordCreatorFeedback(creator, 'save'); button.textContent = historyFor(creator.user_id).saved ? 'Saved' : 'Save'; }
  if (button.dataset.searchAction === 'compare') addToComparison(creator);
  renderSavedList();
});

function addToComparison(creator) {
  rememberCreator(creator);
  const id = creator.user_id || creator.id;
  if (!compareIds.includes(id)) compareIds = [...compareIds, id].slice(-2);
  if (activeTab !== 'match') setActiveTab('match');
  renderComparison();
}

async function fetchComparisonDetail(creator) {
  const id = creator.user_id || creator.id;
  const cached = comparisonDetailCache[id];
  if (cached && Date.now() - cached.timestamp < SIGNAL_CACHE_TTL_MS) return cached.data;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [userR, streamR, videosR, clipsR, chatR, channelR] = await Promise.allSettled([
    fetchUsersByIds([id], currentToken), fetchStreamsByUserIds([id], currentToken), fetchVideosForBroadcaster(id, currentToken, 3),
    fetchClipsForBroadcaster(id, currentToken, since, new Date().toISOString()), fetchChatSettings(id, currentToken), fetchChannelsByIds([id], currentToken)
  ]);
  const user = userR.status === 'fulfilled' ? userR.value[0] : null;
  const live = streamR.status === 'fulfilled' ? streamR.value[0] : null;
  const videos = videosR.status === 'fulfilled' ? videosR.value : [];
  const clips = clipsR.status === 'fulfilled' ? clipsR.value : [];
  const chat = chatR.status === 'fulfilled' ? chatR.value : null;
  const channel = channelR.status === 'fulfilled' ? channelR.value[0] : null;
  const data = { ...creator, ...(live || {}), _profileImage:user?.profile_image_url || creator._profileImage, _broadcasterType:user?.broadcaster_type || creator._broadcasterType || 'none', _accountCreatedAt:user?.created_at || creator._accountCreatedAt, content_classification_labels:channel?.content_classification_labels || creator.content_classification_labels || [], _lastBroadcastAt:videos[0]?.created_at || null, _recentBroadcasts:videos.length, _recentClips:clips.length, _chatOpen:chat ? !chat.follower_mode && !chat.subscriber_mode && !chat.emote_mode : null };
  comparisonDetailCache[id] = { timestamp:Date.now(), data };
  knownCreators.set(id, data);
  return data;
}

async function renderComparison() {
  const generation = ++comparisonGeneration;
  document.getElementById('compare-count').textContent = `${compareIds.length}/2`;
  if (!compareIds.length) { comparisonGrid.innerHTML = '<p class="empty-compact">Choose up to two creators from search results, saved creators, or discovery cards.</p>'; return; }
  comparisonGrid.innerHTML = '<p class="empty-compact">Loading comparison…</p>';
  const bases = compareIds.map(id => knownCreators.get(id) || (historyFor(id).snapshot ? streamFromSnapshot(historyFor(id).snapshot) : null)).filter(Boolean);
  const details = await Promise.all(bases.map(fetchComparisonDetail));
  if (generation !== comparisonGeneration) return;
  comparisonGrid.innerHTML = details.map(creator => {
    const score = discoveryScore(creator);
    const status = creator.type === 'live' ? `${new Intl.NumberFormat().format(creator.viewer_count)} viewers` : 'Offline';
    const chat = creator._chatOpen == null ? 'Chat unknown' : creator._chatOpen ? 'Open chat' : 'Restricted chat';
    return `<article class="compare-card"><h3>${escapeHtml(creator.user_name)}</h3><p>${escapeHtml(status)}<br>${escapeHtml(creator.game_name || 'No category')}<br>${escapeHtml(creator._broadcasterType === 'none' ? 'Not affiliated' : creator._broadcasterType)}<br>${escapeHtml(chat)}<br>Recent broadcasts checked: ${creator._recentBroadcasts || 0}<br>Recent clips checked: ${creator._recentClips || 0}<br>Latest broadcast: ${creator._lastBroadcastAt ? formatRelativeTime(creator._lastBroadcastAt) : 'Unavailable'}<br>Account created: ${creator._accountCreatedAt ? new Date(creator._accountCreatedAt).toLocaleDateString() : 'Unavailable'}</p>${contentLabelsHtml(creator)}<span class="score-badge">Discovery fit ${score.score}/100</span><div class="signal-row">${(creator.tags || []).slice(0,5).map(tag => `<span class="signal">${escapeHtml(tag)}</span>`).join('')}</div><a class="btn-twitch" style="margin-top:.7rem;text-decoration:none" href="https://twitch.tv/${encodeURIComponent(creator.user_login)}" target="_blank" rel="noopener noreferrer">Watch on Twitch</a></article>`;
  }).join('');
}

function trySomeoneNew() {
  if (!['discover','match','spotlight','gems','rising'].includes(activeTab)) { setActiveTab('discover'); setStatus('For You is loading. Try Someone New again when the feed appears.'); return; }
  let candidates = allStreams.filter(stream => !isDismissed(stream.user_id));
  if (excludePartners) candidates = candidates.filter(stream => stream._broadcasterType !== 'partner');
  if (TABS[activeTab].hasCommonFilters) candidates = candidates.filter(passesCommonFilters);
  candidates = candidates.map(stream => { const fit = discoveryScore(stream); return { ...stream, _discoveryScore:fit.score, _why:fit.reasons.join(' · ') }; }).sort((a,b) => b._discoveryScore-a._discoveryScore || a.viewer_count-b.viewer_count);
  const fresh = candidates.filter(stream => !historyFor(stream.user_id).triedAt && !historyFor(stream.user_id).openedAt);
  const choice = (fresh.length ? fresh : candidates)[0];
  if (!choice) { setStatus('No eligible creator is available for Try Someone New. Clear a filter or refresh the feed.'); return; }
  updateHistory(choice.user_id, { triedAt:Date.now(), snapshot:creatorSnapshot(choice) });
  recordCreatorFeedback(choice, 'open');
  openStreamModal(choice);
}

function contentLabelsHtml(stream) {
  const labels = (stream.content_classification_labels || []).map(id => CONTENT_LABELS[id] || id).filter(Boolean);
  if (!labels.length) return '';
  return `<div class="content-labels" aria-label="Twitch content classification">${labels.map(label => `<span class="content-label">${escapeHtml(label)}</span>`).join('')}</div>`;
}

function streamCardHtml(s) {
  const thumb = s.thumbnail_url.replace('{width}', '320').replace('{height}', '180');
  const viewers = new Intl.NumberFormat().format(s.viewer_count);
  const viaTag = s._via ? `<span class="via-tag">via ${escapeHtml(s._via)}</span>` : '';
  const statusTag = s._broadcasterType ? `<span class="status-badge">${escapeHtml(s._broadcasterType === 'none' ? 'not affiliated' : s._broadcasterType)}</span>` : '';
  const stage = CREATOR_STAGES[creatorStageKey(s.viewer_count)];
  const saved = Boolean(historyFor(s.user_id).saved);
  const moreLike = Boolean(historyFor(s.user_id).moreLike);
  const followsCategory = Boolean(preferences.followedCategories[s.game_id]);
  const learningDisabled = personalizationEnabled ? '' : ' disabled title="Turn personalization on to teach the feed"';
  const why = s._why || (s._via ? `Found via ${s._via}` : 'Live now');
  const uptimeHours = s.started_at ? Math.max(0, (Date.now() - new Date(s.started_at).getTime()) / 3600000) : null;
  const signals = [
    uptimeHours != null ? `${uptimeHours < 1 ? '<1' : Math.round(uptimeHours)}h live` : null,
    s._chatOpen === true ? 'Open chat' : s._chatOpen === false ? 'Restricted chat' : null,
    s._lastBroadcastAt ? `Last broadcast ${formatRelativeTime(s._lastBroadcastAt)}` : null
  ].filter(Boolean);
  return `
    <article class="stream-card" aria-label="${escapeHtml(s.user_name)}. ${viewers} viewers. ${escapeHtml(stage.label)}. ${escapeHtml(s.game_name || 'No category')}." data-kind="stream" data-user-id="${s.user_id}" data-url="https://twitch.tv/${encodeURIComponent(s.user_login)}">
      <div class="thumb-wrap">
        <img class="thumbnail" src="${thumb}" alt="Live preview for ${escapeHtml(s.user_name)}" loading="lazy" decoding="async" />
        <span class="live-badge">Live</span>
        ${statusTag}
        <span class="viewer-badge">${viewers} viewers</span>
      </div>
      <div class="stream-info">
        <p class="stream-title">${escapeHtml(s.title)}</p>
        <p class="streamer-name">${escapeHtml(s.user_name)}</p>
        <p class="game-name">${escapeHtml(s.game_name || 'No category')}</p>
        ${contentLabelsHtml(s)}
        ${viaTag}
        <p class="why-row">Why this: ${escapeHtml(why)}</p>
        <span class="stage-badge">${escapeHtml(stage.label)} · current live audience</span>
        ${s._discoveryScore != null ? `<span class="score-badge">Discovery fit ${s._discoveryScore}/100</span>` : ''}
        ${signals.length ? `<div class="signal-row">${signals.map(signal => `<span class="signal">${escapeHtml(signal)}</span>`).join('')}</div>` : ''}
        <div class="card-actions"><button class="card-action" data-action="open" type="button" aria-label="Open ${escapeHtml(s.user_name)} stream details">Details</button><button class="card-action${saved ? ' saved' : ''}" data-action="save" type="button" aria-label="${saved ? 'Unsave' : 'Save'} ${escapeHtml(s.user_name)}">${saved ? 'Saved' : 'Save'}</button><button class="card-action${moreLike ? ' saved' : ''}" data-action="more" type="button" aria-pressed="${moreLike}" aria-label="${moreLike ? 'Remove' : 'Add'} more like ${escapeHtml(s.user_name)} preference"${learningDisabled}>${moreLike ? 'More like this ✓' : 'More like this'}</button><button class="card-action" data-action="less" type="button" aria-label="Show fewer creators like ${escapeHtml(s.user_name)}"${learningDisabled}>Less like this</button><button class="card-action${followsCategory ? ' saved' : ''}" data-action="follow-category" type="button" aria-pressed="${followsCategory}" aria-label="${followsCategory ? 'Unfollow' : 'Follow'} ${escapeHtml(s.game_name || 'this category')} in NerdSync">${followsCategory ? 'Category followed' : 'Follow category'}</button><button class="card-action" data-action="dismiss" type="button" aria-label="Hide ${escapeHtml(s.user_name)} for 30 days">Hide 30d</button><button class="card-action" data-action="never" type="button" aria-label="Never show ${escapeHtml(s.user_name)} again">Never show</button><button class="card-action" data-action="compare" type="button" aria-label="Add ${escapeHtml(s.user_name)} to comparison">Compare</button></div>
      </div>
    </article>`;
}

function clipCardHtml(c) {
  const views = new Intl.NumberFormat().format(c.view_count);
  const creatorNote = c.creator_name && c.creator_name !== c.broadcaster_name ? ` · clipped by ${escapeHtml(c.creator_name)}` : '';
  return `
    <a class="stream-card" href="${c.url}" target="_blank" rel="noopener noreferrer" data-kind="clip">
      <div class="thumb-wrap">
        <img class="thumbnail" src="${c.thumbnail_url}" alt="" loading="lazy" decoding="async" />
        <span class="viewer-badge">${views} views</span>
        <span class="duration-badge">${formatDuration(c.duration)}</span>
      </div>
      <div class="stream-info">
        <p class="stream-title">${escapeHtml(c.title)}</p>
        <p class="streamer-name">${escapeHtml(c.broadcaster_name)}</p>
        <p class="clip-meta">${formatRelativeTime(c.created_at)}${creatorNote}</p>
      </div>
    </a>`;
}

function renderPagination(totalItems, totalPages) {
  if (totalPages <= 1) { paginationControls.innerHTML = ''; return; }
  paginationControls.innerHTML = `
    <button id="page-prev" class="btn-logout" ${currentPage <= 1 ? 'disabled' : ''} type="button">&larr; Prev</button>
    <span class="page-indicator">Page ${currentPage} of ${totalPages} · ${totalItems} results</span>
    <button id="page-next" class="btn-logout" ${currentPage >= totalPages ? 'disabled' : ''} type="button">Next &rarr;</button>`;
  const prevBtn = document.getElementById('page-prev');
  const nextBtn = document.getElementById('page-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentPage--; renderGrid(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentPage++; renderGrid(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

function renderEmergingSections(items, cfg) {
  let standard = items.filter(item => item._emergingSection === 'standard');
  let newAffiliates = items.filter(item => item._emergingSection === 'newAffiliate');
  if (risingStatusFilter !== 'all') standard = standard.filter(item => (item._broadcasterType || 'none') === risingStatusFilter);

  const applyViewSort = list => viewCountSort === 'asc'
    ? list.sort((a,b) => a.viewer_count - b.viewer_count)
    : viewCountSort === 'desc'
      ? list.sort((a,b) => b.viewer_count - a.viewer_count)
      : list;
  if (viewCountSort === 'default') {
    standard.sort((a,b) => risingSort === 'potential' ? (b._risingScore || 0) - (a._risingScore || 0) : new Date(b._accountCreatedAt) - new Date(a._accountCreatedAt));
    newAffiliates.sort((a,b) => newAffiliateSort === 'newest' ? new Date(b._accountCreatedAt) - new Date(a._accountCreatedAt) : (b._discoveryScore || 0) - (a._discoveryScore || 0) || a.viewer_count - b.viewer_count);
  } else {
    standard = applyViewSort(standard);
    newAffiliates = applyViewSort(newAffiliates);
  }
  standard = diversifyItems(standard, diversityLimit);
  newAffiliates = diversifyItems(newAffiliates, diversityLimit);

  const totalItems = standard.length + newAffiliates.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(standard.length, newAffiliates.length) / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const standardPage = standard.slice(start, start + PAGE_SIZE);
  const affiliatePage = newAffiliates.slice(start, start + PAGE_SIZE);
  if (!totalItems) {
    streamGrid.innerHTML = '';
    paginationControls.innerHTML = '';
    resultsSummary.textContent = 'No results in Emerging Live.';
    setStatus(allStreams.length === 0 ? cfg.empty : 'No Emerging Live results match your filters.');
    return;
  }

  setStatus('');
  resultsSummary.textContent = `${standard.length} Standard Emerging Live results and ${newAffiliates.length} New Affiliate results. Showing page ${currentPage} of ${totalPages}.`;
  cardDataById.clear();
  [...standardPage, ...affiliatePage].forEach(item => { cardDataById.set(item.user_id, item); rememberCreator(item); });
  const cards = list => list.length ? list.map(streamCardHtml).join('') : '<p class="empty-compact">No results for this section on this page.</p>';
  streamGrid.innerHTML = `
    <section class="feed-section" aria-labelledby="standard-emerging-heading">
      <div class="feed-section-head"><h2 id="standard-emerging-heading">Standard Emerging Live</h2><p>${standard.length} matches · 3–500 current viewers · account under two years · sorted independently above.</p></div>
      <div class="stream-grid-section">${cards(standardPage)}</div>
    </section>
    <section class="feed-section" aria-labelledby="new-affiliates-heading">
      <div class="feed-section-head"><h2 id="new-affiliates-heading">New Affiliates</h2><p>${newAffiliates.length} matches · verified Affiliate · account under 365 days · no built-in viewer ceiling.</p></div>
      <div class="stream-grid-section">${cards(affiliatePage)}</div>
    </section>`;
  [...standardPage, ...affiliatePage].forEach(item => {
    if (!historyFor(item.user_id).seenAt) updateHistory(item.user_id, { seenAt:Date.now(), snapshot:creatorSnapshot(item) });
  });
  renderPagination(totalItems, totalPages);
  renderDiagnostics();
}

function renderGrid() {
  const query = searchInput.value.trim().toLowerCase();
  const cfg = TABS[activeTab];
  if (cfg.isSaved) {
    renderSavedList();
    renderRecommendationProfile();
    return;
  }
  let items = [...allStreams];

  if (activeTab === 'discover' || activeTab === 'spotlight' || activeTab === 'gems' || activeTab === 'rising') {
    items = items.map(stream => {
      if (activeTab === 'rising' && stream._emergingSection !== 'newAffiliate') return stream;
      const fit = discoveryScore(stream);
      const explanation = [...(stream._why ? [stream._why] : []), ...fit.reasons].slice(0, 4).join(' · ');
      return { ...stream, _discoveryScore:fit.score, _why:explanation };
    });
  }

  if (excludePartners) items = items.filter(item => item._broadcasterType !== 'partner');
  items = items.filter(item => !isDismissed(item.user_id || item.broadcaster_id));
  if (hideSeen) items = items.filter(item => !wasSeenRecently(item.user_id || item.broadcaster_id) || historyFor(item.user_id || item.broadcaster_id).saved);

  if (cfg.isClips) {
    items.sort((a, b) => viewCountSort === 'asc'
      ? a.view_count - b.view_count
      : viewCountSort === 'desc'
        ? b.view_count - a.view_count
        : clipSort === 'views'
          ? b.view_count - a.view_count
          : new Date(b.created_at) - new Date(a.created_at));
    if (query) items = items.filter(c => c.broadcaster_name.toLowerCase().includes(query) || c.title.toLowerCase().includes(query));
  } else {
    if (query) items = items.filter(s => s.user_name.toLowerCase().includes(query) || (s.game_name || '').toLowerCase().includes(query));
    if (creatorStage !== 'balanced' && creatorStage !== 'all') items = items.filter(stream => matchesCreatorStage(stream));
    if (cfg.hasCommonFilters) items = items.filter(passesCommonFilters);
    if (cfg.isRisingHub) { renderEmergingSections(items, cfg); return; }
    if (cfg.isRising) {
      if (risingStatusFilter !== 'all') items = items.filter(s => (s._broadcasterType || 'none') === risingStatusFilter);
      items.sort((a, b) => risingSort === 'potential' ? (b._risingScore || 0) - (a._risingScore || 0) : new Date(b._accountCreatedAt) - new Date(a._accountCreatedAt));
    }
    if (cfg.isMatch && viewCountSort === 'default') items.sort((a,b) => (a._matchDistance || 0) - (b._matchDistance || 0));
    if (viewCountSort === 'default' && (activeTab === 'discover' || activeTab === 'spotlight' || activeTab === 'gems')) items.sort((a,b) => (b._discoveryScore || 0) - (a._discoveryScore || 0) || a.viewer_count - b.viewer_count);
    if (viewCountSort === 'asc') items.sort((a,b) => a.viewer_count - b.viewer_count);
    if (viewCountSort === 'desc') items.sort((a,b) => b.viewer_count - a.viewer_count);
    if (activeTab === 'discover' && creatorStage === 'balanced' && viewCountSort === 'default') items = mixCreatorStages(items);
    if (activeTab === 'discover' && viewCountSort === 'default') items = blendDiscoveryModes(items);
    items = diversifyItems(items, diversityLimit);
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  currentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  if (totalItems === 0) {
    streamGrid.innerHTML = '';
    paginationControls.innerHTML = '';
    resultsSummary.textContent = `No results in ${cfg.label}.`;
    setStatus(allStreams.length === 0 ? cfg.empty : 'No results match your filters.');
    return;
  }

  setStatus('');
  resultsSummary.textContent = `${totalItems} results in ${cfg.label}. Showing page ${currentPage} of ${totalPages}.`;
  cardDataById.clear();
  streamGrid.innerHTML = pageItems.map(item => {
    if (cfg.isClips) return clipCardHtml(item);
    cardDataById.set(item.user_id, item);
    rememberCreator(item);
    return streamCardHtml(item);
  }).join('');
  pageItems.forEach(item => {
    const id = item.user_id || item.broadcaster_id;
    if (id && !historyFor(id).seenAt) updateHistory(id, { seenAt:Date.now(), snapshot:creatorSnapshot(item) });
  });
  renderPagination(totalItems, totalPages);
  renderDiagnostics();
}

async function loadStreams() {
  const tabId = activeTab;
  const generation = ++loadGeneration;
  const cached = tabCache[tabId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (tabId !== activeTab || generation !== loadGeneration) return;
    allStreams = cached.data;
    streamGrid.setAttribute('aria-busy', 'false');
    renderGrid();
    return;
  }
  streamGrid.innerHTML = '';
  streamGrid.setAttribute('aria-busy', 'true');
  paginationControls.innerHTML = '';
  setStatus('Loading streams…');
  diagnostics = { requests:0, pages:0, candidates:0, eligible:0, failures:0, categories:0, rateRemaining:null, rateLimit:null };
  renderDiagnostics();
  try {
    let loaded = await TABS[tabId].load();
    loaded = await enrichBroadcasterTypes(loaded, TABS[tabId].isClips === true);
    loaded = await enrichCandidateSignals(loaded, tabId);
    tabCache[tabId] = { data: loaded, timestamp: Date.now() };
    if (tabId !== activeTab || generation !== loadGeneration) return;
    allStreams = loaded;
    streamGrid.setAttribute('aria-busy', 'false');
    renderGrid();
  } catch (err) {
    console.error(err);
    streamGrid.setAttribute('aria-busy', 'false');
    if (err.message === 'SESSION_EXPIRED') {
      sessionStorage.removeItem(STORAGE_KEY);
      setStatus('Your Twitch session expired. Log out and sign in again.', true);
    } else setStatus(`Could not complete this scan${diagnostics.failures ? ` (${diagnostics.failures} category requests failed)` : ''}. Try refresh or reduce selected categories.`, true);
    renderDiagnostics();
  }
}

// --- Stream detail modal (click a card instead of navigating away) ---
streamGrid.addEventListener('click', e => {
  const card = e.target.closest('.stream-card');
  if (!card || card.dataset.kind !== 'stream') return;
  const action = e.target.closest('[data-action]');
  if (action) {
    e.preventDefault();
    const id = card.dataset.userId;
    const item = cardDataById.get(id);
    if (action.dataset.action === 'open') { recordCreatorFeedback(item, 'open'); openStreamModal(item); return; }
    if (action.dataset.action === 'save') recordCreatorFeedback(item, 'save');
    if (action.dataset.action === 'dismiss') recordCreatorFeedback(item, 'dismiss');
    if (action.dataset.action === 'never') recordCreatorFeedback(item, 'never');
    if (action.dataset.action === 'less') recordCreatorFeedback(item, 'less');
    if (action.dataset.action === 'more') recordCreatorFeedback(item, 'more');
    if (action.dataset.action === 'follow-category') toggleFollowCategory(item);
    if (action.dataset.action === 'compare') { addToComparison(item); return; }
    renderGrid();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) { window.open(card.dataset.url, '_blank', 'noopener'); return; }
  e.preventDefault();
  const item = cardDataById.get(card.dataset.userId);
  if (item) { recordCreatorFeedback(item, 'open'); openStreamModal(item); }
});

let modalCurrentStream = null;
function openStreamModal(s) {
  modalReturnFocus = document.activeElement;
  modalCurrentStream = s;
  document.getElementById('modal-streamer').textContent = s.user_name;
  document.getElementById('modal-category').textContent = s.game_name || 'No category';
  document.getElementById('modal-title-text').textContent = s.title || '';
  document.getElementById('modal-viewers').textContent = s.viewer_count != null ? `${new Intl.NumberFormat().format(s.viewer_count)} viewers` : '';
  document.getElementById('modal-live-badge').classList.toggle('hidden', s.type !== 'live');
  document.getElementById('modal-tags').innerHTML = (s.tags || []).map(t => `<span class="via-tag">${escapeHtml(t)}</span>`).join('');
  document.getElementById('modal-watch-btn').href = `https://twitch.tv/${encodeURIComponent(s.user_login)}`;
  document.getElementById('modal-avatar').src = '';
  document.getElementById('modal-avatar').alt = `${s.user_name} profile image`;
  streamModal.classList.remove('hidden');
  document.getElementById('main-content').inert = true;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => document.getElementById('modal-close').focus());
  loadModalDetails(s.user_id);
}

function closeStreamModal() {
  if (streamModal.classList.contains('hidden')) return;
  streamModal.classList.add('hidden');
  document.getElementById('main-content').inert = false;
  document.body.style.overflow = '';
  if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
}
document.getElementById('modal-close').addEventListener('click', closeStreamModal);
document.getElementById('modal-compare-btn').addEventListener('click', () => { if (modalCurrentStream) { addToComparison(modalCurrentStream); closeStreamModal(); } });
document.getElementById('modal-watch-btn').addEventListener('click', () => { if (modalCurrentStream) recordCreatorFeedback(modalCurrentStream, 'watch'); });
streamModal.addEventListener('click', e => { if (e.target === streamModal) closeStreamModal(); });
document.addEventListener('keydown', e => {
  if (!streamModal.classList.contains('hidden')) {
    if (e.key === 'Escape') { e.preventDefault(); closeStreamModal(); return; }
    if (e.key === 'Tab') {
      const focusable = [...streamModal.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (mobileLayoutMedia.matches && !filterPanel.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeFilterPanel();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = [...filterPanel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element => element.offsetParent !== null);
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (e.key === 'Escape') {
    if (!filterPanel.classList.contains('hidden')) { closeFilterPanel(); return; }
    if (!accessibilityPanel.classList.contains('hidden')) {
      accessibilityPanel.classList.add('hidden');
      accessibilityToggle.setAttribute('aria-expanded', 'false');
      if (panelReturnFocus?.isConnected) panelReturnFocus.focus();
    }
  }
});

async function loadModalDetails(userId) {
  const videosEl = document.getElementById('modal-videos');
  const clipsEl = document.getElementById('modal-clips');
  const scheduleEl = document.getElementById('modal-schedule');
  videosEl.innerHTML = '<p class="status-msg">Loading…</p>';
  clipsEl.innerHTML = '<p class="status-msg">Loading…</p>';
  scheduleEl.innerHTML = '<p class="status-msg">Loading…</p>';

  const cached = modalDetailCache[userId];
  let result;
  if (cached && Date.now() - cached.timestamp < MODAL_CACHE_TTL_MS) {
    result = cached;
  } else {
    const since = new Date(Date.now() - CLIPS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [videosR, clipsR, scheduleR, userR] = await Promise.allSettled([
      fetchVideosForBroadcaster(userId, currentToken, 3),
      fetchClipsForBroadcaster(userId, currentToken, since, new Date().toISOString()),
      fetchScheduleForBroadcaster(userId, currentToken, 3),
      fetchUsersByIds([userId], currentToken)
    ]);
    result = {
      timestamp: Date.now(),
      videos: videosR.status === 'fulfilled' ? videosR.value.slice(0, 3) : [],
      clips: clipsR.status === 'fulfilled' ? [...clipsR.value].sort((a, b) => b.view_count - a.view_count).slice(0, 3) : [],
      schedule: scheduleR.status === 'fulfilled' ? scheduleR.value.slice(0, 3) : [],
      user: userR.status === 'fulfilled' ? userR.value[0] : null
    };
    modalDetailCache[userId] = result;
  }

  if (result.user) {
    document.getElementById('modal-avatar').src = result.user.profile_image_url;
    document.getElementById('modal-avatar').alt = `${result.user.display_name}'s avatar`;
  }

  videosEl.innerHTML = result.videos.length
    ? result.videos.map(v => `<a class="mini-card" href="${v.url}" target="_blank" rel="noopener noreferrer"><img src="${v.thumbnail_url.replace('%{width}', '160').replace('%{height}', '90')}" alt="" loading="lazy" decoding="async" /><span class="mini-title">${escapeHtml(v.title)}</span><span class="mini-meta">${formatRelativeTime(v.created_at)}</span></a>`).join('')
    : '<p class="status-msg">No recent broadcasts found.</p>';

  clipsEl.innerHTML = result.clips.length
    ? result.clips.map(c => `<a class="mini-card" href="${c.url}" target="_blank" rel="noopener noreferrer"><img src="${c.thumbnail_url}" alt="" loading="lazy" decoding="async" /><span class="mini-title">${escapeHtml(c.title)}</span><span class="mini-meta">${new Intl.NumberFormat().format(c.view_count)} views</span></a>`).join('')
    : '<p class="status-msg">No clips in the last 30 days.</p>';

  scheduleEl.innerHTML = result.schedule.length
    ? result.schedule.map(seg => `<div class="mini-card static"><span class="mini-title">${escapeHtml(seg.title || (seg.category && seg.category.name) || 'Scheduled stream')}</span><span class="mini-meta">${new Date(seg.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>`).join('')
    : '<p class="status-msg">No upcoming schedule published.</p>';
}

// --- Session bootstrap ---
async function showDiscoveryView() {
  document.getElementById('welcome-msg').textContent = currentUser.display_name;
  document.getElementById('user-avatar').src = currentUser.profile_image_url;
  document.getElementById('user-avatar').alt = `${currentUser.display_name}'s avatar`;
  privacyView.classList.add('hidden');
  loginView.classList.add('hidden');
  discoveryView.classList.remove('hidden');
  try { discoveryHistory = JSON.parse(localStorage.getItem(historyStorageKey()) || '{}') || {}; } catch (error) { discoveryHistory = {}; }
  try { preferences = { ...preferences, ...(JSON.parse(localStorage.getItem(preferencesStorageKey()) || '{}') || {}) }; } catch (error) { preferences = { categories:{}, categoryNames:{}, followedCategories:{}, tags:{}, languages:{}, viewerSamples:[], personalizationEnabled:true }; }
  preferences.categories ||= {}; preferences.categoryNames ||= {}; preferences.followedCategories ||= {}; preferences.tags ||= {}; preferences.languages ||= {}; preferences.viewerSamples ||= [];
  personalizationEnabled = preferences.personalizationEnabled !== false;
  personalizationModeEl.value = personalizationEnabled ? 'on' : 'off';
  try {
    const storedAccessibility = JSON.parse(localStorage.getItem(accessibilityStorageKey()) || '{}') || {};
    accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false, ...storedAccessibility };
    if (!storedAccessibility.textSize && storedAccessibility.largeText) accessibilitySettings.textSize = 'large';
    if (!['system','dark','light'].includes(accessibilitySettings.theme)) accessibilitySettings.theme = 'system';
    if (!['normal','large','xlarge'].includes(accessibilitySettings.textSize)) accessibilitySettings.textSize = 'normal';
  } catch (error) { accessibilitySettings = { theme:'system', textSize:'normal', largeCards:false, highContrast:false, reduceMotion:false }; }
  applyAccessibilitySettings();
  updateSavedCount();
  renderSavedList();
  renderRecommendationProfile();
  renderComparison();
  setActiveTab(tabFromRoute(), { updateRoute:false });
}

async function trySession(token) {
  const validation = await validateToken(token);
  if (!validation) { sessionStorage.removeItem(STORAGE_KEY); return false; }
  currentToken = token;
  sessionStorage.setItem(STORAGE_KEY, token);
  currentUser = await fetchTwitchUserData(token);
  currentUser.id = validation.user_id;
  await showDiscoveryView();
  return true;
}

async function bootstrapSession() {
  if (sessionBootstrapStarted) return;
  sessionBootstrapStarted = true;
  const urlToken = getAccessTokenFromUrl();
  if (urlToken) {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const returnedState = params.get('state');
    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    if (!expectedState || returnedState !== expectedState) {
      loginBtn.disabled = false;
      configWarning.textContent = 'Twitch login could not be verified. Please try signing in again.';
      configWarning.classList.remove('hidden');
      return;
    }
    if (await trySession(urlToken)) return;
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
