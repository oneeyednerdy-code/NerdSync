'use strict';

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
  const sortedViewerSamples = personalizationEnabled ? preferences.viewerSamples.filter(Number.isFinite).slice().sort((a,b) => a-b) : [];
  const middle = Math.floor(sortedViewerSamples.length / 2);
  const preferredViewers = !sortedViewerSamples.length ? null : sortedViewerSamples.length % 2 ? sortedViewerSamples[middle] : (sortedViewerSamples[middle - 1] + sortedViewerSamples[middle]) / 2;
  const audienceReference = Number.isFinite(stream._trackerSummary?.averageViewers) ? stream._trackerSummary.averageViewers : (stream.viewer_count || 0);
  const audienceFit = preferredViewers == null ? 0 : Math.max(0, 20 - Math.abs(audienceReference - preferredViewers) / Math.max(3, preferredViewers) * 10);
  score += audienceFit;
  if (audienceFit >= 14) reasons.push(Number.isFinite(stream._trackerSummary?.averageViewers) ? 'typical audience size fit' : 'audience size fit');
  if (filters.language && stream.language === filters.language) { score += 10; reasons.push('language match'); }
  else if (personalizationEnabled && (preferences.languages[stream.language] || 0) > 0) { score += Math.min(7, preferences.languages[stream.language]); reasons.push('preferred language'); }
  const history = historyFor(stream.user_id);
  if (personalizationEnabled && !history.openedAt) { score += 10; reasons.push('someone new'); }
  else if (personalizationEnabled) score -= Math.min(4, history.openCount || 1);
  if (personalizationEnabled && history.saved) score += 8;
  if (personalizationEnabled && history.moreLike) { score += 12; reasons.push('more like a creator you chose'); }
  if (personalizationEnabled && history.lessLike) score -= Math.min(15, history.lessLike * 5);
  if (stream._lastBroadcastAt && Date.now() - new Date(stream._lastBroadcastAt).getTime() < 30 * 86400000) { score += 5; reasons.push('recently active'); }
  if (Number.isFinite(stream._trackerDiscoveryBonus) && stream._trackerDiscoveryBonus > 0) {
    score += stream._trackerDiscoveryBonus;
    (stream._trackerReasons || []).forEach(reason => { if (!reasons.includes(reason)) reasons.push(reason); });
  }
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
    const image = safeHttpsUrl(creator?._profileImage || item.snapshot?.profileImage || '');
    return `<div class="tool-result" data-creator-id="${escapeHtml(id)}">${image ? `<img src="${escapeHtml(image)}" alt="" />` : ''}<div class="tool-result-info"><p class="tool-result-title">${escapeHtml(name)}</p><p class="tool-result-meta">${escapeHtml(creator?.game_name || item.snapshot?.gameName || 'Category unavailable')}</p></div><div class="tool-result-actions">${login ? `<a class="btn-logout" href="https://twitch.tv/${encodeURIComponent(login)}" target="_blank" rel="noopener noreferrer">Twitch</a>` : ''}<button class="btn-logout" data-saved-action="compare" type="button">Compare</button><button class="btn-logout" data-saved-action="remove" type="button">Unsave</button></div></div>`;
  }).join('');
}
