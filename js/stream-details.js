'use strict';

streamGrid.addEventListener('click', async e => {
  const card = e.target.closest('.stream-card');
  if (!card || card.dataset.kind !== 'stream') return;
  const externalCardLink = e.target.closest('a.card-action-link');
  if (externalCardLink) return;
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
    if (action.dataset.action === 'similar') { findSimilarCreators(item); return; }
    if (action.dataset.action === 'follow-category') toggleFollowCategory(item);
    if (action.dataset.action === 'shortlist') { toggleMatchShortlist(item); renderGrid(); return; }
    if (action.dataset.action === 'bookmark') { cycleCreatorBookmark(item); renderGrid(); return; }
    if (action.dataset.action === 'retry-tracker') {
      setButtonLoading(action, true, 'Retrying…');
      try {
        const summary = await getTwitchTrackerSummary(item.user_login, { force:true });
        if (summary) {
          const updated = applyTwitchTrackerSummaryToStream(item, summary, activeTab);
          const index = allStreams.findIndex(stream => stream.user_id === item.user_id);
          if (index >= 0) allStreams[index] = updated;
          cardDataById.set(item.user_id, updated);
          setStatus('30-day context refreshed for this creator.');
        } else setStatus('TwitchTracker has no public 30-day summary for this creator right now.', true);
      } catch { setStatus('TwitchTracker is unavailable for this creator right now.', true); }
      renderGrid(); return;
    }
    if (action.dataset.action === 'compare') { addToComparison(item); return; }
    renderGrid();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) { window.open(card.dataset.url, '_blank', 'noopener'); return; }
  e.preventDefault();
  const item = cardDataById.get(card.dataset.userId);
  if (item) { recordCreatorFeedback(item, 'open'); openStreamModal(item); }
});

streamGrid.addEventListener('keydown', event => {
  const card = event.target.closest?.('.stream-card[data-kind="stream"]');
  if (!card || event.target.closest('button,a,input,select')) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const item = cardDataById.get(card.dataset.userId);
    if (item) { recordCreatorFeedback(item, 'open'); openStreamModal(item); }
  }
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
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.getElementById('modal-close').focus());
  loadModalDetails(s);
}

function closeStreamModal() {
  if (streamModal.classList.contains('hidden')) return;
  streamModal.classList.add('hidden');
  document.getElementById('main-content').inert = false;
  document.body.classList.remove('modal-open');
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

async function loadModalDetails(stream) {
  const userId = stream.user_id;
  const videosEl = document.getElementById('modal-videos');
  const clipsEl = document.getElementById('modal-clips');
  const scheduleEl = document.getElementById('modal-schedule');
  const trackerSectionEl = document.getElementById('modal-tracker-section');
  const trackerEl = document.getElementById('modal-tracker');
  const shouldLoadTracker = Boolean(stream.user_login) && (activeTab === 'match' || (historicalDiscoveryEnabled && ['discover','gems','rising','spotlight'].includes(activeTab)));
  const shouldLoadTrackerCategory = shouldLoadTracker && /^\d+$/.test(String(stream.game_id || ''));
  videosEl.setAttribute('aria-busy', 'true'); clipsEl.setAttribute('aria-busy', 'true'); scheduleEl.setAttribute('aria-busy', 'true');
  videosEl.innerHTML = loadingMessageHtml('Loading recent broadcasts…');
  clipsEl.innerHTML = loadingMessageHtml('Loading recent clips…');
  scheduleEl.innerHTML = loadingMessageHtml('Loading schedule…');
  trackerSectionEl.classList.toggle('hidden', !shouldLoadTracker);
  if (shouldLoadTracker) { trackerEl.setAttribute('aria-busy', 'true'); trackerEl.innerHTML = loadingMessageHtml('Loading TwitchTracker context…'); }
  else trackerEl.innerHTML = '';

  const cached = modalDetailCache[userId];
  let result;
  if (cached && Date.now() - cached.timestamp < MODAL_CACHE_TTL_MS && (!shouldLoadTracker || cached.trackerSummary || cached.trackerUnavailable) && (!shouldLoadTrackerCategory || cached.trackerCategorySummary || cached.trackerCategoryUnavailable)) {
    result = cached;
  } else {
    const since = new Date(Date.now() - CLIPS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const requests = [
      fetchVideosForBroadcaster(userId, currentToken, 3),
      fetchClipsForBroadcaster(userId, currentToken, since, new Date().toISOString()),
      fetchScheduleForBroadcaster(userId, currentToken, 3),
      fetchUsersByIds([userId], currentToken),
      shouldLoadTracker ? (stream._trackerSummary ? Promise.resolve(stream._trackerSummary) : getTwitchTrackerSummary(stream.user_login)) : Promise.resolve(null),
      shouldLoadTrackerCategory ? (stream._trackerCategorySummary ? Promise.resolve(stream._trackerCategorySummary) : getTwitchTrackerCategorySummary(stream.game_id)) : Promise.resolve(null)
    ];
    const [videosR, clipsR, scheduleR, userR, trackerR, trackerCategoryR] = await Promise.allSettled(requests);
    result = {
      timestamp: Date.now(),
      videos: videosR.status === 'fulfilled' ? videosR.value.slice(0, 3) : [],
      clips: clipsR.status === 'fulfilled' ? [...clipsR.value].sort((a, b) => b.view_count - a.view_count).slice(0, 3) : [],
      schedule: scheduleR.status === 'fulfilled' ? scheduleR.value.slice(0, 3) : [],
      user: userR.status === 'fulfilled' ? userR.value[0] : null,
      trackerSummary: shouldLoadTracker && trackerR.status === 'fulfilled' ? trackerR.value : null,
      trackerUnavailable: shouldLoadTracker && (trackerR.status === 'rejected' || !trackerR.value),
      trackerCategorySummary: shouldLoadTrackerCategory && trackerCategoryR.status === 'fulfilled' ? trackerCategoryR.value : null,
      trackerCategoryUnavailable: shouldLoadTrackerCategory && (trackerCategoryR.status === 'rejected' || !trackerCategoryR.value)
    };
    modalDetailCache[userId] = result;
  }

  if (result.user) {
    document.getElementById('modal-avatar').src = safeHttpsUrl(result.user.profile_image_url);
    document.getElementById('modal-avatar').alt = `${result.user.display_name}'s avatar`;
  }

  if (shouldLoadTracker) {
    const tracker = result.trackerSummary;
    if (tracker) {
      const fmt = value => Number.isFinite(value) ? new Intl.NumberFormat().format(value) : 'Unavailable';
      const streamedHours = Number.isFinite(tracker.minutesStreamed) ? Math.round((tracker.minutesStreamed / 60) * 10) / 10 : null;
      const stats = [
        [fmt(tracker.averageViewers), '30-day average viewers'],
        [fmt(tracker.maxViewers), '30-day peak viewers'],
        [streamedHours == null ? 'Unavailable' : `${new Intl.NumberFormat().format(streamedHours)}h`, 'streamed in 30 days'],
        [fmt(tracker.hoursWatched), 'hours watched'],
        [Number.isFinite(tracker.followersGained) ? `${tracker.followersGained >= 0 ? '+' : ''}${fmt(tracker.followersGained)}` : 'Unavailable', 'followers gained'],
        [Number.isFinite(tracker.rank) ? `#${fmt(tracker.rank)}` : 'Unavailable', 'TwitchTracker rank']
      ];
      const category = result.trackerCategorySummary;
      if (category) {
        stats.push(
          [fmt(category.averageViewers), `${stream.game_name || 'category'} 30-day avg viewers`],
          [fmt(category.averageChannels), `${stream.game_name || 'category'} avg live channels`],
          [fmt(category.hoursWatched), `${stream.game_name || 'category'} hours watched`],
          [Number.isFinite(category.rank) ? `#${fmt(category.rank)}` : 'Unavailable', `${stream.game_name || 'category'} TwitchTracker rank`]
        );
      }
      const newerAffiliate = activeTab === 'rising' && stream._emergingSection === 'newAffiliate' ? deriveNewerAffiliateSignal(stream, tracker) : null;
      const affiliateContext = newerAffiliate
        ? `<div class="mini-card static tracker-stat newer-affiliate-detail"><strong>${escapeHtml(newerAffiliate.label)}</strong><span class="mini-meta">${escapeHtml(`${Math.round(newerAffiliate.ageDays)}d-old Twitch account · current Affiliate status · ${newerAffiliate.score}/100 signal`)}</span><span class="mini-meta">Affiliate-earned date is not available from Twitch.</span></div>`
        : '';
      trackerEl.innerHTML = affiliateContext + stats.map(([value, label]) => `<div class="mini-card static tracker-stat"><strong>${escapeHtml(value)}</strong><span class="mini-meta">${escapeHtml(label)}</span></div>`).join('');
    } else {
      trackerEl.innerHTML = '<p class="status-msg">TwitchTracker data is unavailable for this channel right now. Twitch details still work normally.</p>';
    }
  }

  videosEl.setAttribute('aria-busy', 'false');
  clipsEl.setAttribute('aria-busy', 'false');
  scheduleEl.setAttribute('aria-busy', 'false');
  trackerEl.setAttribute('aria-busy', 'false');

  videosEl.innerHTML = result.videos.length
    ? result.videos.map(v => `<a class="mini-card" href="${escapeHtml(safeTwitchUrl(v.url))}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(safeHttpsUrl(String(v.thumbnail_url || '').replace('%{width}', '160').replace('%{height}', '90')))}" alt="" loading="lazy" decoding="async" /><span class="mini-title">${escapeHtml(v.title)}</span><span class="mini-meta">${formatRelativeTime(v.created_at)}</span></a>`).join('')
    : '<p class="status-msg">No recent broadcasts found.</p>';

  clipsEl.innerHTML = result.clips.length
    ? result.clips.map(c => `<a class="mini-card" href="${escapeHtml(safeTwitchUrl(c.url))}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(safeHttpsUrl(c.thumbnail_url))}" alt="" loading="lazy" decoding="async" /><span class="mini-title">${escapeHtml(c.title)}</span><span class="mini-meta">${new Intl.NumberFormat().format(c.view_count)} views</span></a>`).join('')
    : '<p class="status-msg">No clips in the last 30 days.</p>';

  const scheduleEvidence = stream._collabFit?.scheduleEvidence || stream._scheduleEvidence || null;
  scheduleEl.innerHTML = result.schedule.length
    ? result.schedule.map(seg => `<div class="mini-card static"><span class="mini-title">${escapeHtml(seg.title || (seg.category && seg.category.name) || 'Scheduled stream')}</span><span class="mini-meta">${new Date(seg.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>`).join('')
    : scheduleEvidence?.kind === 'observed'
      ? scheduleEvidenceHtml(scheduleEvidence)
      : '<p class="status-msg">No upcoming schedule published and no reliable observed pattern is available.</p>';
}

// --- Session bootstrap ---
