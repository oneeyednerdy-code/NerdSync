'use strict';

function discoveryTransparencyHtml(stream) {
  if (!stream || TABS[activeTab]?.isClips) return '';
  const fit = discoveryScore(stream);
  const signals = [];
  if (stream._why) signals.push(stream._why);
  fit.reasons.forEach(reason => { if (!signals.includes(reason)) signals.push(reason); });
  if (filters.tags.length) {
    const matches = filters.tags.filter(tag => (stream.tags || []).some(item => item.toLowerCase() === tag.toLowerCase()));
    if (matches.length) signals.push(`${matches.length} selected Discovery tag match${matches.length === 1 ? '' : 'es'}`);
  }
  if ((filters.preferredTags || []).length) {
    const matches = filters.preferredTags.filter(tag => (stream.tags || []).some(item => item.toLowerCase() === tag.toLowerCase()));
    if (matches.length) signals.push(`${matches.length} preferred Discovery tag${matches.length === 1 ? '' : 's'}`);
  }
  if (Number.isFinite(stream._trackerSummary?.averageViewers)) signals.push(`~${Math.round(stream._trackerSummary.averageViewers)} typical viewers over 30d`);
  if (stream._recommendationLane) signals.push(`${stream._recommendationLane} recommendation lane`);
  return `<details class="why-details"><summary>Why this creator?</summary><div class="why-details-body"><strong>Discovery Fit ${fit.score}/100</strong>${signals.length ? `<ul>${signals.slice(0,8).map(signal => `<li>${escapeHtml(signal)}</li>`).join('')}</ul>` : '<p>Live candidate that passed your active filters.</p>'}<p class="filter-hint">Discovery Fit is an explainable ranking signal, not a creator-quality score.</p></div></details>`;
}

function findSimilarCreators(stream) {
  if (!stream) return;
  const reference = Number.isFinite(stream._trackerSummary?.averageViewers) ? stream._trackerSummary.averageViewers : Number(stream.viewer_count || 0);
  const tags = [...new Set((stream.tags || []).map(String).filter(Boolean))];
  filters = {
    ...filters,
    categories:stream.game_id ? [{ id:String(stream.game_id), name:stream.game_name || 'Selected category', source:'manual' }] : [],
    genres:stream.game_name ? genreIdsForGameName(stream.game_name) : [],
    tags:tags.slice(0,3),
    preferredTags:tags.slice(3,6),
    language:stream.language || '',
    audienceBasis:Number.isFinite(stream._trackerSummary?.averageViewers) ? 'typical' : 'live',
    minViewers:reference > 0 ? Math.max(0, Math.floor(reference * 0.5)) : null,
    maxViewers:reference > 0 ? Math.max(1, Math.ceil(reference * 1.5)) : null,
  };
  applySerializableFilters(filters);
  setActiveTab('discover');
  setStatus(`Finding creators similar to ${stream.user_name || stream.user_login}: category, audience, language, and Twitch tags are now seeded into Discovery.`);
  loadStreams();
}

function categoryOpportunityRecords(items) {
  const groups = new Map();
  (items || []).forEach(stream => {
    if (!stream?.game_id) return;
    const current = groups.get(stream.game_id) || { id:stream.game_id, name:stream.game_name || 'Twitch category', candidates:0, viewers:0, historical:null };
    current.candidates += 1;
    current.viewers += Number(stream.viewer_count || 0);
    if (!current.historical && stream._trackerCategorySummary) current.historical = stream._trackerCategorySummary;
    groups.set(stream.game_id, current);
  });
  return [...groups.values()].filter(item => item.historical).sort((a,b) => b.candidates - a.candidates).slice(0,4).map(item => {
    const h = item.historical;
    const typicalPerChannel = Number.isFinite(h.averageViewers) && Number.isFinite(h.averageChannels) && h.averageChannels > 0 ? h.averageViewers / h.averageChannels : null;
    const crowding = Number.isFinite(h.averageChannels) ? (item.candidates < h.averageChannels * 0.35 ? 'lighter candidate sample' : item.candidates > h.averageChannels ? 'dense candidate sample' : 'moderate candidate sample') : 'context available';
    return { ...item, typicalPerChannel, crowding };
  });
}

function renderCategoryOpportunityReport(items) {
  const box = document.getElementById('category-opportunity-report');
  if (!box) return;
  if (!historicalDiscoveryEnabled || TABS[activeTab]?.isClips || ['following','saved'].includes(activeTab)) { box.classList.add('hidden'); box.innerHTML=''; return; }
  const records = categoryOpportunityRecords(items);
  if (!records.length) { box.classList.add('hidden'); box.innerHTML=''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `<details><summary>Category context from this scan</summary><div class="category-opportunity-grid">${records.map(item => `<article><strong>${escapeHtml(item.name)}</strong><span>${item.candidates} creator${item.candidates === 1 ? '' : 's'} in this NerdSync candidate scan</span><span>${Number.isFinite(item.historical.averageViewers) ? `~${new Intl.NumberFormat().format(Math.round(item.historical.averageViewers))} 30D category viewers` : '30D viewers unavailable'}</span><span>${Number.isFinite(item.historical.averageChannels) ? `~${Math.round(item.historical.averageChannels)} typical live channels` : 'Typical channels unavailable'}</span>${Number.isFinite(item.typicalPerChannel) ? `<span>~${Math.round(item.typicalPerChannel * 10) / 10} historical viewers/live channel</span>` : ''}<em>${escapeHtml(item.crowding)}</em></article>`).join('')}</div><p class="filter-hint">Current counts are NerdSync's candidate sample, not Twitch's complete directory. Historical values come from TwitchTracker's public 30-day category summary. This is context, not a promise of growth.</p></details>`;
}
