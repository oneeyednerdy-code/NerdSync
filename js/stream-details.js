'use strict';

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
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => document.getElementById('modal-close').focus());
  loadModalDetails(s.user_id);
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
    document.getElementById('modal-avatar').src = safeHttpsUrl(result.user.profile_image_url);
    document.getElementById('modal-avatar').alt = `${result.user.display_name}'s avatar`;
  }

  videosEl.innerHTML = result.videos.length
    ? result.videos.map(v => `<a class="mini-card" href="${escapeHtml(safeTwitchUrl(v.url))}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(safeHttpsUrl(String(v.thumbnail_url || '').replace('%{width}', '160').replace('%{height}', '90')))}" alt="" loading="lazy" decoding="async" /><span class="mini-title">${escapeHtml(v.title)}</span><span class="mini-meta">${formatRelativeTime(v.created_at)}</span></a>`).join('')
    : '<p class="status-msg">No recent broadcasts found.</p>';

  clipsEl.innerHTML = result.clips.length
    ? result.clips.map(c => `<a class="mini-card" href="${escapeHtml(safeTwitchUrl(c.url))}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(safeHttpsUrl(c.thumbnail_url))}" alt="" loading="lazy" decoding="async" /><span class="mini-title">${escapeHtml(c.title)}</span><span class="mini-meta">${new Intl.NumberFormat().format(c.view_count)} views</span></a>`).join('')
    : '<p class="status-msg">No clips in the last 30 days.</p>';

  scheduleEl.innerHTML = result.schedule.length
    ? result.schedule.map(seg => `<div class="mini-card static"><span class="mini-title">${escapeHtml(seg.title || (seg.category && seg.category.name) || 'Scheduled stream')}</span><span class="mini-meta">${new Date(seg.start_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div>`).join('')
    : '<p class="status-msg">No upcoming schedule published.</p>';
}

// --- Session bootstrap ---
