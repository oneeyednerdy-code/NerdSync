'use strict';

// Historical Discovery card context, filter rejection explanations, and TwitchTracker availability status.

function formatTrackerCompact(value) {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat(undefined, { notation:'compact', maximumFractionDigits:1 }).format(value);
}

function historicalDiscoveryContextHtml(stream) {
  const tracker = stream._trackerSummary;
  if (!tracker) return '';
  const signals = stream._trackerSignals || deriveTwitchTrackerSignals(tracker, stream.viewer_count, { mode:activeTab });
  const streamedHours = Number.isFinite(signals?.streamedHours) ? Math.round(signals.streamedHours * 10) / 10 : null;
  const growth = Number.isFinite(tracker.followersGained) ? `${tracker.followersGained >= 0 ? '+' : ''}${formatTrackerCompact(tracker.followersGained)}` : null;
  const stats = [
    [formatTrackerCompact(stream.viewer_count), 'Live now'],
    [formatTrackerCompact(tracker.averageViewers), '30d avg'],
    [growth, '30d growth'],
    [streamedHours == null ? null : `${formatTrackerCompact(streamedHours)}h`, '30d active']
  ].filter(([value]) => value != null);
  const contextLabel = signals?.gemLabel || signals?.liveContext || (signals?.growing ? 'Growing this month' : '');
  const percentage = Number.isFinite(signals?.percentVsAverage)
    ? `${signals.percentVsAverage >= 0 ? '+' : ''}${signals.percentVsAverage}% vs typical`
    : '';
  const category = stream._trackerCategorySummary;
  const categoryOpportunity = category && Number.isFinite(category.averageViewers) && Number.isFinite(category.averageChannels) && category.averageChannels > 0
    ? category.averageViewers / category.averageChannels : null;
  const stabilityRatio = Number.isFinite(tracker.averageViewers) && tracker.averageViewers > 0 && Number.isFinite(tracker.maxViewers)
    ? tracker.maxViewers / tracker.averageViewers : null;
  const categoryBits = category ? [
    Number.isFinite(category.averageViewers) ? `${formatTrackerCompact(category.averageViewers)} avg viewers` : null,
    Number.isFinite(category.averageChannels) ? `${formatTrackerCompact(category.averageChannels)} avg channels` : null,
    Number.isFinite(categoryOpportunity) ? `~${formatTrackerCompact(categoryOpportunity)} viewers per live channel` : null
  ].filter(Boolean) : [];
  const stabilityText = Number.isFinite(stabilityRatio) ? (stabilityRatio <= 2 ? 'Recent audience looks relatively steady' : stabilityRatio >= 6 ? 'Recent peak was far above typical' : 'Recent peak shows some audience variation') : '';
  return `<section class="historical-context" aria-label="30-day TwitchTracker discovery context">
    <div class="historical-context-head"><span>30-day context · TwitchTracker</span>${contextLabel ? `<strong class="historical-context-badge">${escapeHtml(contextLabel)}</strong>` : ''}</div>
    <div class="historical-stat-grid">${stats.map(([value, label]) => `<span class="historical-stat"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`).join('')}</div>
    ${percentage ? `<p class="historical-context-note">${escapeHtml(percentage)}</p>` : ''}
    ${stabilityText ? `<p class="historical-context-note">${escapeHtml(stabilityText)}</p>` : ''}
    ${categoryBits.length ? `<p class="historical-category-note"><strong>${escapeHtml(stream.game_name || 'Category')}:</strong> ${escapeHtml(categoryBits.join(' · '))} over 30 days</p>` : ''}
  </section>`;
}

function filterRejectionReason(s) {
  const tags = (s.tags || []).map(tag => String(tag).trim().toLowerCase());
  if (filters.tags.length && !filters.tags.some(tag => tags.includes(tag.toLowerCase()))) return 'required discovery tags';
  if (filters.excludedTags.some(tag => tags.includes(tag.toLowerCase()))) return 'excluded tags';
  if (filters.contentLabels.length && !filters.contentLabels.some(label => (s.content_classification_labels || []).includes(label))) return 'content classifications';
  if (filters.language && s.language !== filters.language) return 'language';
  if (filters.categories.length && !filters.categories.some(category => category.id === s.game_id)) return 'included categories';
  if (filters.excludedCategories.some(category => category.id === s.game_id)) return 'excluded categories';
  const audience = filters.audienceBasis === 'typical' ? s._trackerSummary?.averageViewers : s.viewer_count;
  if (filters.minViewers != null && (!Number.isFinite(audience) || audience < filters.minViewers)) return filters.audienceBasis === 'typical' ? '30D audience range' : 'live audience range';
  if (filters.maxViewers != null && (!Number.isFinite(audience) || audience > filters.maxViewers)) return filters.audienceBasis === 'typical' ? '30D audience range' : 'live audience range';
  if (filters.maxUptimeHours != null && s.started_at && (Date.now() - new Date(s.started_at).getTime()) / 3600000 > filters.maxUptimeHours) return 'uptime';
  if (filters.activityDays != null && (!s._lastBroadcastAt || Date.now() - new Date(s._lastBroadcastAt).getTime() > filters.activityDays * 86400000)) return 'recent VOD activity';
  if (filters.trackerActivityHours != null) {
    const hours = Number.isFinite(s._trackerSummary?.minutesStreamed) ? s._trackerSummary.minutesStreamed / 60 : null;
    if (!Number.isFinite(hours) || hours < filters.trackerActivityHours) return '30D streamed hours';
  }
  if (filters.trackerGrowth) {
    const signals = s._trackerSignals || (s._trackerSummary ? deriveTwitchTrackerSignals(s._trackerSummary, s.viewer_count) : null);
    if (!signals?.growing || (filters.trackerGrowth === 'strong' && !(Number.isFinite(signals.followersPerHour) && signals.followersPerHour >= 0.75))) return '30D growth';
  }
  if (filters.openChatOnly && s._chatOpen !== true) return 'restricted chat';
  return '';
}

function renderFilterExclusionSummary() {
  const el = document.getElementById('filter-exclusion-summary');
  if (!el || !TABS[activeTab]?.hasCommonFilters || !allStreams.length) { if (el) el.textContent = ''; return; }
  const counts = new Map();
  allStreams.forEach(stream => { const reason = filterRejectionReason(stream); if (reason) counts.set(reason, (counts.get(reason) || 0) + 1); });
  const excluded = [...counts.values()].reduce((sum, value) => sum + value, 0);
  if (!excluded) { el.textContent = ''; return; }
  const top = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,5).map(([reason,count]) => `${count} ${reason}`).join(' · ');
  el.textContent = `${allStreams.length} candidates loaded · ${excluded} filtered out: ${top}.`;
}

function updateTrackerAvailabilityStatus(items, tabId) {
  const el = document.getElementById('tracker-availability');
  if (!el) return;
  const supported = ['discover','gems','rising','spotlight','match'].includes(tabId);
  if (!supported) { el.textContent = '30D context idle'; el.dataset.state = 'idle'; return; }
  const explicitHistoricalFilter = filters.audienceBasis === 'typical' || filters.trackerActivityHours != null || Boolean(filters.trackerGrowth);
  if (!historicalDiscoveryEnabled && tabId !== 'match' && !explicitHistoricalFilter) { el.textContent = '30D context off'; el.dataset.state = 'off'; return; }
  const count = items.filter(item => item._trackerSummary).length;
  if (count) { el.textContent = `30D context · ${count} enriched`; el.dataset.state = 'ok'; }
  else { el.textContent = '30D context unavailable'; el.dataset.state = 'error'; }
}
