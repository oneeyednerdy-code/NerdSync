'use strict';

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
    channelSearchResults.innerHTML = results.length ? results.map(creator => `<div class="tool-result" data-search-id="${escapeHtml(creator.user_id)}"><img src="${escapeHtml(safeHttpsUrl(creator._profileImage || creator.thumbnail_url || ''))}" alt="" /><div class="tool-result-info"><p class="tool-result-title">${escapeHtml(creator.user_name)}</p><p class="tool-result-meta">${creator.type === 'live' ? `${new Intl.NumberFormat().format(creator.viewer_count)} viewers · ` : 'Offline · '}${escapeHtml(creator.game_name || 'No category')} · ${escapeHtml(creator._broadcasterType === 'none' ? 'not affiliated' : creator._broadcasterType)}</p></div><div class="tool-result-actions"><a class="btn-logout" href="https://twitch.tv/${encodeURIComponent(creator.user_login)}" target="_blank" rel="noopener noreferrer">Twitch</a><button class="btn-logout" data-search-action="save" type="button">Save</button><button class="btn-logout" data-search-action="compare" type="button">Compare</button></div></div>`).join('') : '<p class="empty-compact">No matching Twitch channels found.</p>';
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
    return `<article class="compare-card"><h3>${escapeHtml(creator.user_name)}</h3><p>${escapeHtml(status)}<br>${escapeHtml(creator.game_name || 'No category')}<br>${escapeHtml(creator._broadcasterType === 'none' ? 'Not affiliated' : creator._broadcasterType)}<br>${escapeHtml(chat)}<br>Recent broadcasts checked: ${creator._recentBroadcasts || 0}<br>Recent clips checked: ${creator._recentClips || 0}<br>Latest broadcast: ${creator._lastBroadcastAt ? formatRelativeTime(creator._lastBroadcastAt) : 'Unavailable'}<br>Account created: ${creator._accountCreatedAt ? new Date(creator._accountCreatedAt).toLocaleDateString() : 'Unavailable'}</p>${contentLabelsHtml(creator)}<span class="score-badge">Discovery fit ${score.score}/100</span><div class="signal-row">${(creator.tags || []).slice(0,5).map(tag => `<span class="signal">${escapeHtml(tag)}</span>`).join('')}</div><a class="btn-twitch compare-watch-link" href="https://twitch.tv/${encodeURIComponent(creator.user_login)}" target="_blank" rel="noopener noreferrer">Watch on Twitch</a></article>`;
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
