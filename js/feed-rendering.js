'use strict';

function contentLabelsHtml(stream) {
  const labels = (stream.content_classification_labels || []).map(id => CONTENT_LABELS[id] || id).filter(Boolean);
  if (!labels.length) return '';
  return `<div class="content-labels" aria-label="Twitch content classification">${labels.map(label => `<span class="content-label">${escapeHtml(label)}</span>`).join('')}</div>`;
}

function creatorMatchTwitchTrackerLinkHtml(stream) {
  if (activeTab !== 'match' || !stream.user_login) return '';
  const login = encodeURIComponent(String(stream.user_login).trim().toLowerCase());
  return `<a class="card-action card-action-link card-action-twitchtracker" href="https://twitchtracker.com/${login}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(stream.user_name || stream.user_login)} on TwitchTracker for more detailed statistics">TwitchTracker stats</a>`;
}

function creatorMatchTagsHtml(stream) {
  if (activeTab !== 'match') return '';
  const parseLocalTags = value => String(value || '').split(',').map(tag => tag.trim()).filter(Boolean);
  const discovery = new Set(((typeof filters !== 'undefined' ? filters.tags : []) || []).map(tag => String(tag).trim().toLowerCase()).filter(Boolean));
  const doc = typeof document !== 'undefined' ? document : null;
  const required = new Set(parseLocalTags(doc?.getElementById('match-required-tags')?.value).map(tag => tag.toLowerCase()));
  const preferred = new Set(parseLocalTags(doc?.getElementById('match-preferred-tags')?.value).map(tag => tag.toLowerCase()));
  const seen = new Set();
  const tags = (stream.tags || []).map(tag => String(tag).trim()).filter(tag => {
    const key = tag.toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true;
  }).map(tag => {
    const key = tag.toLowerCase();
    const kind = required.has(key) ? 'required' : preferred.has(key) ? 'preferred' : discovery.has(key) ? 'discovery' : '';
    return { tag, kind, matched:Boolean(kind) };
  }).sort((a,b) => Number(b.matched) - Number(a.matched) || a.tag.localeCompare(b.tag));
  if (!tags.length) return '<div class="match-tags" aria-label="Creator tags"><span class="match-tags-label">Twitch tags</span><div class="match-tags-list"><span class="match-tags-empty">No Twitch tags listed</span></div></div>';
  return `<div class="match-tags" aria-label="Creator tags"><span class="match-tags-label">Twitch tags</span><div class="match-tags-list">${tags.map(({ tag, kind, matched }) => {
    const aria = kind === 'discovery' ? `${tag}, matches your selected tag` : kind === 'required' ? `${tag}, required Creator Match tag` : kind === 'preferred' ? `${tag}, preferred Creator Match tag` : '';
    return `<span class="match-tag${matched ? ' match-tag--matched' : ''}${kind ? ` match-tag--${kind}` : ''}"${aria ? ` aria-label="${escapeHtml(aria)}"` : ''}>${escapeHtml(tag)}${matched ? `<span class="match-tag-check" aria-hidden="true">${kind === 'required' ? '★' : '✓'}</span>` : ''}</span>`;
  }).join('')}</div></div>`;
}

function prioritizeFollowingTeamMembers(items) {
  return [...items].sort((a,b) => Number(Boolean(b._twitchTeams?.length)) - Number(Boolean(a._twitchTeams?.length)));
}

function followingTeamHtml(stream) {
  if (activeTab !== 'following' || !followingTeamsFirst) return '';
  const teams = Array.isArray(stream._twitchTeams) ? stream._twitchTeams : [];
  if (!teams.length) return '';
  const names = [...new Set(teams.map(team => String(team.displayName || team.name || '').trim()).filter(Boolean))];
  if (!names.length) return '';
  const label = names.length === 1 ? 'Twitch Team' : 'Twitch Teams';
  return `<p class="twitch-team-line"><span>${label}</span> ${names.map(name => `<strong>${escapeHtml(name)}</strong>`).join('<span aria-hidden="true"> · </span>')}</p>`;
}


function newerAffiliateContextHtml(stream) {
  if (activeTab !== 'rising' || stream._emergingSection !== 'newAffiliate') return '';
  const label = stream._newAffiliateLabel || 'Newer Affiliate';
  const ageDays = Number.isFinite(stream._newAffiliateAgeDays) ? Math.round(stream._newAffiliateAgeDays) : null;
  const ageLabel = ageDays == null ? 'newer Twitch account' : ageDays < 60 ? `${ageDays}d-old Twitch account` : `${Math.max(1, Math.round(ageDays / 30))}mo-old Twitch account`;
  const score = Number.isFinite(stream._newAffiliateScore) ? `<span>${stream._newAffiliateScore}/100 signal</span>` : '';
  return `<div class="newer-affiliate-context" aria-label="Newer Affiliate context"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(ageLabel)} · current Affiliate status</span>${score}</div>`;
}

function streamCardHtml(s) {
  const thumb = safeHttpsUrl(String(s.thumbnail_url || '').replace('{width}', '320').replace('{height}', '180'));
  const viewers = new Intl.NumberFormat().format(s.viewer_count);
  const viaTag = s._via ? `<span class="via-tag">via ${escapeHtml(s._via)}</span>` : '';
  const statusTag = s._broadcasterType ? `<span class="status-badge">${escapeHtml(s._broadcasterType === 'none' ? 'not affiliated' : s._broadcasterType)}</span>` : '';
  const stage = CREATOR_STAGES[creatorStageKey(s.viewer_count)];
  const saved = Boolean(historyFor(s.user_id).saved);
  const moreLike = Boolean(historyFor(s.user_id).moreLike);
  const followsCategory = Boolean(preferences.followedCategories[s.game_id]);
  const bookmark = historyFor(s.user_id).bookmark || '';
  const shortlisted = activeTab === 'match' && typeof shortlistHas === 'function' ? shortlistHas(s.user_id) : false;
  const learningDisabled = personalizationEnabled ? '' : ' disabled title="Turn personalization on to teach the feed"';
  const why = s._why || (s._via ? `Found via ${s._via}` : 'Live now');
  const uptimeHours = s.started_at ? Math.max(0, (Date.now() - new Date(s.started_at).getTime()) / 3600000) : null;
  const signals = [
    uptimeHours != null ? `${uptimeHours < 1 ? '<1' : Math.round(uptimeHours)}h live` : null,
    s._chatOpen === true ? 'Open chat' : s._chatOpen === false ? 'Restricted chat' : null,
    s._lastBroadcastAt ? `Last broadcast ${formatRelativeTime(s._lastBroadcastAt)}` : null
  ].filter(Boolean);
  return `
    <article class="stream-card" aria-label="${escapeHtml(s.user_name)}. ${viewers} viewers. ${escapeHtml(stage.label)}. ${escapeHtml(s.game_name || 'No category')}." data-kind="stream" tabindex="0" data-user-id="${s.user_id}" data-url="https://twitch.tv/${encodeURIComponent(s.user_login)}">
      <div class="thumb-wrap">
        <img class="thumbnail" src="${escapeHtml(thumb)}" alt="Live preview for ${escapeHtml(s.user_name)}" loading="lazy" decoding="async" />
        <span class="live-badge">Live</span>
        ${statusTag}
        <span class="viewer-badge">${viewers} viewers</span>
      </div>
      <div class="stream-info">
        <p class="stream-title">${escapeHtml(s.title)}</p>
        <p class="streamer-name">${escapeHtml(s.user_name)}</p>
        <p class="game-name">${escapeHtml(s.game_name || 'No category')}</p>
        ${followingTeamHtml(s)}
        ${creatorMatchTagsHtml(s)}
        ${contentLabelsHtml(s)}
        ${newerAffiliateContextHtml(s)}
        ${historicalDiscoveryContextHtml(s)}
        ${viaTag}
        <p class="why-row">Why this: ${escapeHtml(why)}</p>
        <span class="stage-badge">${escapeHtml(stage.label)} · current live audience</span>
        ${s._discoveryScore != null ? `<span class="score-badge">Discovery fit ${s._discoveryScore}/100</span>` : ''}
        ${signals.length ? `<div class="signal-row">${signals.map(signal => `<span class="signal">${escapeHtml(signal)}</span>`).join('')}</div>` : ''}
        <div class="card-actions"><button class="card-action" data-action="open" type="button" aria-label="Open ${escapeHtml(s.user_name)} stream details">Details</button>${creatorMatchTwitchTrackerLinkHtml(s)}${activeTab === 'match' ? `<button class="card-action${shortlisted ? ' saved' : ''}" data-action="shortlist" type="button">${shortlisted ? 'Shortlisted ✓' : 'Shortlist'}</button>` : ''}<button class="card-action${saved ? ' saved' : ''}" data-action="save" type="button" aria-label="${saved ? 'Unsave' : 'Save'} ${escapeHtml(s.user_name)}">${saved ? 'Saved' : 'Save'}</button><button class="card-action${bookmark ? ' saved' : ''}" data-action="bookmark" type="button" aria-label="Cycle local bookmark for ${escapeHtml(s.user_name)}">${escapeHtml(bookmarkLabel(bookmark))}</button><button class="card-action${moreLike ? ' saved' : ''}" data-action="more" type="button" aria-pressed="${moreLike}" aria-label="${moreLike ? 'Remove' : 'Add'} more like ${escapeHtml(s.user_name)} preference"${learningDisabled}>${moreLike ? 'More like this ✓' : 'More like this'}</button><button class="card-action" data-action="less" type="button" aria-label="Show fewer creators like ${escapeHtml(s.user_name)}"${learningDisabled}>Less like this</button><button class="card-action${followsCategory ? ' saved' : ''}" data-action="follow-category" type="button" aria-pressed="${followsCategory}" aria-label="${followsCategory ? 'Unfollow' : 'Follow'} ${escapeHtml(s.game_name || 'this category')} in NerdSync">${followsCategory ? 'Category followed' : 'Follow category'}</button>${historicalDiscoveryEnabled && ['discover','match','spotlight','gems','rising'].includes(activeTab) && !s._trackerSummary ? '<button class="card-action" data-action="retry-tracker" type="button">Retry 30D</button>' : ''}<button class="card-action" data-action="dismiss" type="button" aria-label="Hide ${escapeHtml(s.user_name)} for 30 days">Hide 30d</button><button class="card-action" data-action="never" type="button" aria-label="Never show ${escapeHtml(s.user_name)} again">Never show</button><button class="card-action" data-action="compare" type="button" aria-label="Add ${escapeHtml(s.user_name)} to comparison">Compare</button></div>
      </div>
    </article>`;
}

function clipCardHtml(c) {
  const views = new Intl.NumberFormat().format(c.view_count);
  const creatorNote = c.creator_name && c.creator_name !== c.broadcaster_name ? ` · clipped by ${escapeHtml(c.creator_name)}` : '';
  const clipUrl = safeTwitchUrl(c.url);
  const thumbnailUrl = safeHttpsUrl(c.thumbnail_url);
  return `
    <a class="stream-card" href="${escapeHtml(clipUrl)}" target="_blank" rel="noopener noreferrer" data-kind="clip">
      <div class="thumb-wrap">
        <img class="thumbnail" src="${escapeHtml(thumbnailUrl)}" alt="" loading="lazy" decoding="async" />
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
    newAffiliates.sort((a,b) => newAffiliateSort === 'newest' ? new Date(b._accountCreatedAt) - new Date(a._accountCreatedAt) : (b._newAffiliateScore || b._discoveryScore || 0) - (a._newAffiliateScore || a._discoveryScore || 0) || a.viewer_count - b.viewer_count);
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
  resultsSummary.textContent = `${standard.length} Standard Emerging Live results and ${newAffiliates.length} Newer Affiliate results. Showing page ${currentPage} of ${totalPages}.`;
  cardDataById.clear();
  [...standardPage, ...affiliatePage].forEach(item => { cardDataById.set(item.user_id, item); rememberCreator(item); });
  const cards = list => list.length ? list.map(streamCardHtml).join('') : '<p class="empty-compact">No results for this section on this page.</p>';
  streamGrid.innerHTML = `
    <section class="feed-section" aria-labelledby="standard-emerging-heading">
      <div class="feed-section-head"><h2 id="standard-emerging-heading">Standard Emerging Live</h2><p>${standard.length} matches · 3–500 current viewers · account under two years · sorted independently above.</p></div>
      <div class="stream-grid-section">${cards(standardPage)}</div>
    </section>
    <section class="feed-section" aria-labelledby="new-affiliates-heading">
      <div class="feed-section-head"><h2 id="new-affiliates-heading">Newer Affiliates</h2><p>${newAffiliates.length} matches · current Twitch Affiliate status on accounts under 365 days · account age is known, but the Affiliate-earned date is not. Historical context can strengthen the signal with 30-day activity and growth.</p></div>
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
  renderFilterExclusionSummary();
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
    if (activeTab === 'following' && followingTeamsFirst) {
      items = prioritizeFollowingTeamMembers(items);
    }
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

function updateScanDeeperControl(tabId, loading = false) {
  const supports = Boolean(TABS[tabId]?.supportsDeepScan);
  const deep = deepScanTabs.has(tabId);
  const show = supports && (!deep || loading);
  scanDeeperRow.classList.toggle('hidden', !show);
  scanDeeperBtn.disabled = loading;
  scanDeeperBtn.textContent = loading ? (deep ? 'Scanning deeper…' : 'Loading initial scan…') : 'Scan deeper in these categories';
}

async function loadStreams() {
  const tabId = activeTab;
  const generation = ++loadGeneration;
  activeLoadController?.abort();
  activeLoadController = null;
  const cached = tabCache[tabId];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (tabId !== activeTab || generation !== loadGeneration) return;
    allStreams = cached.data;
    updateTrackerAvailabilityStatus(allStreams, tabId);
    streamGrid.setAttribute('aria-busy', 'false');
    renderGrid();
    updateScanDeeperControl(tabId, false);
    return;
  }
  const controller = new AbortController();
  activeLoadController = controller;
  allStreams = [];
  cardDataById.clear();
  streamGrid.innerHTML = '';
  streamGrid.setAttribute('aria-busy', 'true');
  paginationControls.innerHTML = '';
  setStatus('Loading streams…');
  updateScanDeeperControl(tabId, true);
  diagnostics = { requests:0, pages:0, candidates:0, eligible:0, failures:0, categories:0, rateRemaining:null, rateLimit:null };
  renderDiagnostics();
  try {
    setStatus('Finding live Twitch candidates…');
    let loaded = await TABS[tabId].load({ deep:deepScanTabs.has(tabId) });
    setStatus('Applying account, chat, activity, and filter context…');
    loaded = await enrichBroadcasterTypes(loaded, TABS[tabId].isClips === true);
    loaded = await enrichCandidateSignals(loaded, tabId);
    const historicalFiltering = filters.audienceBasis === 'typical' || filters.trackerActivityHours != null || Boolean(filters.trackerGrowth) || (tabId === 'match' && matchAudienceBasis === 'typical');
    if (!historicalFiltering && !TABS[tabId].isClips && tabId !== 'saved') {
      allStreams = loaded;
      streamGrid.setAttribute('aria-busy', 'false');
      renderGrid();
    }
    if ((historicalDiscoveryEnabled && ['discover','gems','rising','spotlight'].includes(tabId)) || tabId === 'match' || historicalFiltering) setStatus('Live results ready · adding 30-day historical context…');
    loaded = await enrichDiscoveryWithTwitchTracker(loaded, tabId, { signal:controller.signal });
    if (tabId === 'following' && followingTeamsFirst) loaded = await enrichFollowingTeams(loaded, currentToken);
    tabCache[tabId] = { data: loaded, timestamp: Date.now() };
    if (tabId !== activeTab || generation !== loadGeneration) return;
    allStreams = loaded;
    streamGrid.setAttribute('aria-busy', 'false');
    updateTrackerAvailabilityStatus(loaded, tabId);
    renderGrid();
    updateScanDeeperControl(tabId, false);
  } catch (err) {
    if (err?.name === 'AbortError' && controller.signal.aborted) return;
    console.error(err);
    streamGrid.setAttribute('aria-busy', 'false');
    if (err.message === 'SESSION_EXPIRED') {
      endExpiredSession();
    } else setStatus(`Could not complete this scan${diagnostics.failures ? ` (${diagnostics.failures} category requests failed)` : ''}. Try refresh or reduce selected categories.`, true);
    renderDiagnostics();
    updateScanDeeperControl(tabId, false);
  } finally {
    if (activeLoadController === controller) activeLoadController = null;
  }
}

// --- Stream detail modal (click a card instead of navigating away) ---
