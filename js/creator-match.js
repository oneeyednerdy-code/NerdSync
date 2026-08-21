'use strict';

// Creator Match 2.0: audience sources, tag logic, historical candidate context, and match loading.

function matchAudienceRange(peak = matchPeak, tolerance = matchTolerance) {
  if (!Number.isFinite(peak) || peak < 1) return null;
  const ratio = tolerance / 100;
  return { min:Math.max(0, Math.floor(peak * (1 - ratio))), max:Math.ceil(peak * (1 + ratio)) };
}

function creatorMatchTagConfig() {
  return {
    required:parseTagInput(document.getElementById('match-required-tags')?.value || ''),
    preferred:parseTagInput(document.getElementById('match-preferred-tags')?.value || ''),
    excluded:parseTagInput(document.getElementById('match-excluded-tags')?.value || ''),
  };
}

function creatorMatchTagAssessment(stream) {
  const config = creatorMatchTagConfig();
  const tags = (stream.tags || []).map(tag => String(tag).toLowerCase());
  const requiredMissing = config.required.filter(tag => !tags.includes(tag.toLowerCase()));
  const excludedFound = config.excluded.filter(tag => tags.includes(tag.toLowerCase()));
  const preferredMatches = config.preferred.filter(tag => tags.includes(tag.toLowerCase()));
  const discoveryMatches = filters.tags.filter(tag => tags.includes(tag.toLowerCase()));
  return { ...config, requiredMissing, excludedFound, preferredMatches, discoveryMatches, passes:requiredMissing.length === 0 && excludedFound.length === 0 };
}

function creatorMatchAudienceForCandidate(stream) {
  if (matchAudienceBasis === 'typical' && Number.isFinite(stream._trackerSummary?.averageViewers)) return stream._trackerSummary.averageViewers;
  return stream.viewer_count;
}

function creatorMatchWhy(stream, audienceValue) {
  const assessment = creatorMatchTagAssessment(stream);
  const candidateAudience = creatorMatchAudienceForCandidate(stream);
  const distance = Math.abs(candidateAudience - matchPeak) / Math.max(matchPeak, 1);
  const reasons = [
    `${Math.round(distance * 100)}% from your ${matchPeak}-viewer target`,
    matchAudienceBasis === 'typical' && Number.isFinite(stream._trackerSummary?.averageViewers) ? '30D typical audience match' : 'live audience match',
  ];
  if (assessment.preferredMatches.length) reasons.push(`${assessment.preferredMatches.length} preferred match tag${assessment.preferredMatches.length === 1 ? '' : 's'}`);
  if (assessment.discoveryMatches.length) reasons.push(`${assessment.discoveryMatches.length} Discovery tag${assessment.discoveryMatches.length === 1 ? '' : 's'}`);
  if (matchSourceStream?.game_id && stream.game_id === matchSourceStream.game_id) reasons.push('same current category');
  else if (filters.genres.length) reasons.push('selected genre relationship');
  if (stream._trackerSignals?.liveContext) reasons.push(stream._trackerSignals.liveContext.toLowerCase());
  return { distance, reasons:reasons.slice(0, 5).join(' · '), audienceValue:candidateAudience };
}

function matchSourceLabel() {
  return matchSource === 'live' ? 'Live now' : matchSource === 'typical' ? '30D typical' : matchSource === 'last' ? 'Last stream context (30D suggestion)' : matchSource === 'vod' ? 'Past broadcast' : 'Custom';
}

function updateMatchRangeSummary() {
  const peak = numOrNull(matchPeakEl.value);
  const range = matchAudienceRange(peak, Number(selectedChoiceValue(matchToleranceEl, '50')));
  const vodText = (matchSource === 'vod' || matchSource === 'last') && matchVodEl.selectedIndex > 0 ? ` · ${matchVodEl.options[matchVodEl.selectedIndex].text}` : '';
  const basis = selectedChoiceValue(document.getElementById('match-audience-basis'), 'live') === 'typical' ? '30D typical candidate audiences when available' : 'current live candidate audiences';
  matchRangeSummary.textContent = range ? `${matchSourceLabel()}: ${peak} viewers. Searching ${range.min}–${range.max} using ${basis}${vodText}.` : 'Choose an audience source or enter a valid audience of at least one viewer.';
}

function renderCreatorMatchOwnContext() {
  const box = document.getElementById('match-own-context');
  if (!box) return;
  const live = matchSourceStream?.viewer_count;
  const typical = matchOwnTrackerSummary?.averageViewers;
  const ratio = Number.isFinite(live) && Number.isFinite(typical) && typical > 0 ? Math.round((live / typical - 1) * 100) : null;
  const parts = [
    Number.isFinite(live) ? `<span><strong>${new Intl.NumberFormat().format(live)}</strong><small>live now</small></span>` : '<span><strong>Offline</strong><small>live now</small></span>',
    Number.isFinite(typical) ? `<span><strong>${new Intl.NumberFormat().format(Math.round(typical))}</strong><small>30D typical</small></span>` : '<span><strong>—</strong><small>30D typical</small></span>',
    Number.isFinite(ratio) ? `<span><strong>${ratio > 0 ? '+' : ''}${ratio}%</strong><small>live vs typical</small></span>` : '',
    matchVods[0] ? `<span><strong>${escapeHtml(new Date(matchVods[0].created_at).toLocaleDateString())}</strong><small>latest VOD</small></span>` : '',
  ].filter(Boolean);
  box.innerHTML = parts.join('');
}

async function loadMatchVods(force = false) {
  if (matchVodsLoaded && !force) return matchVods;
  matchVodEl.setAttribute('aria-busy', 'true');
  matchVodEl.innerHTML = '<option value="">Loading past broadcasts…</option>';
  try {
    matchVods = await fetchVideosForBroadcaster(currentUser.id, currentToken, 20);
    matchVodEl.innerHTML = '<option value="">Choose a past broadcast</option>' + matchVods.map(video => {
      const date = new Date(video.created_at).toLocaleDateString();
      const title = video.title || 'Untitled broadcast';
      const duration = video.duration || '';
      return `<option value="${escapeHtml(video.id)}">${escapeHtml(date)} · ${escapeHtml(title)}${duration ? ` · ${escapeHtml(duration)}` : ''}</option>`;
    }).join('');
    matchVodsLoaded = true;
    matchVodEl.setAttribute('aria-busy', 'false');
    renderCreatorMatchOwnContext();
    return matchVods;
  } catch (error) {
    matchVodEl.setAttribute('aria-busy', 'false');
    matchVodEl.innerHTML = '<option value="">Past broadcasts unavailable</option>';
    return [];
  }
}

async function ensureCreatorMatchOwnContext({ force = false } = {}) {
  const context = document.getElementById('match-own-context');
  if (context) { context.setAttribute('aria-busy', 'true'); context.innerHTML = loadingPanelHtml('Loading Twitch live, VOD, and 30-day context…'); }
  const [liveResult, trackerResult, vodResult] = await Promise.allSettled([
    fetchStreamsByUserIds([currentUser.id], currentToken),
    getTwitchTrackerSummary(currentUser.login || currentUser.display_name, { force }),
    loadMatchVods(force),
  ]);
  matchSourceStream = liveResult.status === 'fulfilled' ? liveResult.value[0] || null : null;
  matchOwnTrackerSummary = trackerResult.status === 'fulfilled' ? trackerResult.value : null;
  if (vodResult.status === 'fulfilled') matchVods = vodResult.value || matchVods;
  renderCreatorMatchOwnContext();
  if (context) context.setAttribute('aria-busy', 'false');
  return { live:matchSourceStream, tracker:matchOwnTrackerSummary, vods:matchVods };
}

async function applyCreatorMatchSource(source, { preserveInput = false } = {}) {
  matchSource = source;
  if (!matchVodsLoaded || source !== 'custom') await ensureCreatorMatchOwnContext();
  matchVodGroup.classList.toggle('hidden', source !== 'vod');
  matchPeakGroup.classList.remove('hidden');
  let suggestion = preserveInput ? numOrNull(matchPeakEl.value) : null;
  if (source === 'live') suggestion = matchSourceStream?.viewer_count ?? suggestion;
  if (source === 'typical') suggestion = Number.isFinite(matchOwnTrackerSummary?.averageViewers) ? Math.round(matchOwnTrackerSummary.averageViewers) : suggestion;
  if (source === 'last') {
    if (matchVods[0]) {
      matchVodEl.value = matchVods[0].id;
      suggestion = Number.isFinite(matchOwnTrackerSummary?.averageViewers) ? Math.round(matchOwnTrackerSummary.averageViewers) : suggestion;
    }
  }
  if (source === 'vod') {
    suggestion = Number.isFinite(matchOwnTrackerSummary?.averageViewers) && !preserveInput ? Math.round(matchOwnTrackerSummary.averageViewers) : suggestion;
  }
  if (Number.isFinite(suggestion) && suggestion >= 1) matchPeakEl.value = String(suggestion);
  matchPeak = numOrNull(matchPeakEl.value);
  updateMatchRangeSummary();
}

async function enrichCreatorMatchCandidatesWithTypical(items, signal) {
  const limit = Math.min(30, items.length);
  const nearestLive = [...items].sort((a,b) => Math.abs(a.viewer_count - matchPeak) - Math.abs(b.viewer_count - matchPeak)).slice(0, limit);
  const results = await trackerMapWithConcurrency(nearestLive, 4, async stream => ({ id:stream.user_id, summary:await getTwitchTrackerSummary(stream.user_login, { signal }) }), signal);
  const summaries = new Map(results.filter(result => result?.summary).map(result => [result.id, result.summary]));
  return items.map(stream => {
    const summary = summaries.get(stream.user_id);
    return summary ? applyTwitchTrackerSummaryToStream(stream, summary, 'match') : stream;
  });
}

async function loadCreatorMatches(options = {}) {
  const pageLimit = scanPageLimit(DISCOVER_STREAM_PAGES, options.deep);
  matchSource = selectedChoiceValue(matchSourceEl, 'live');
  matchTolerance = Number(selectedChoiceValue(matchToleranceEl, '50'));
  matchAudienceBasis = selectedChoiceValue(document.getElementById('match-audience-basis'), 'live');
  await ensureCreatorMatchOwnContext();

  if (matchSource === 'live' && !matchSourceStream) {
    if (Number.isFinite(matchOwnTrackerSummary?.averageViewers)) {
      setSingleChoice(matchSourceEl, 'typical');
      matchSource = 'typical';
      matchPeakEl.value = String(Math.round(matchOwnTrackerSummary.averageViewers));
      setStatus('You are offline, so Creator Match switched to your TwitchTracker 30-day typical audience. You can still adjust it.');
    } else {
      matchRangeSummary.textContent = 'Your channel is offline and no 30-day average is available. Choose Last stream, Past broadcast, or Custom.';
      return [];
    }
  } else if (matchSource !== 'custom') {
    await applyCreatorMatchSource(matchSource, { preserveInput:matchSource === 'vod' });
  }

  matchPeak = numOrNull(matchPeakEl.value);
  const range = matchAudienceRange();
  if (!range) { matchRangeSummary.textContent = 'Enter a valid audience of at least one viewer.'; return []; }
  updateMatchRangeSummary();

  const categoryMap = new Map();
  const matchCategoryLimit = matchFallbackExpanded ? 16 : MAX_TOP_CATEGORIES_FOR_DISCOVER;
  filters.categories.slice(0, matchCategoryLimit).forEach(category => categoryMap.set(category.id, category));
  recommendationCategorySeeds(matchCategoryLimit).forEach(category => {
    if (categoryMap.size < matchCategoryLimit && !categoryMap.has(category.id)) categoryMap.set(category.id, category);
  });
  if (matchSourceStream?.game_id && categoryMap.size < matchCategoryLimit) categoryMap.set(matchSourceStream.game_id, { id:matchSourceStream.game_id, name:matchSourceStream.game_name });
  if (!categoryMap.size || matchFallbackExpanded) (await fetchTopGames(currentToken, matchCategoryLimit)).forEach(game => { if (categoryMap.size < matchCategoryLimit && !categoryMap.has(game.id)) categoryMap.set(game.id, game); });
  const games = [...categoryMap.values()];
  diagnostics.categories = games.length;
  const exclusion = { checked:0, audience:0, requiredTags:0, excludedTags:0 };
  const perCategory = await Promise.allSettled(games.map(async game => {
    const streams = await fetchStreamsByGameIdPages(game.id, currentToken, pageLimit);
    return streams.filter(stream => stream.user_id !== currentUser.id).map(stream => ({ ...stream, _via:game.name }));
  }));
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;
  const merged = new Map();
  perCategory.forEach(result => {
    if (result.status !== 'fulfilled') return;
    result.value.forEach(stream => { if (!merged.has(stream.user_id)) merged.set(stream.user_id, stream); });
  });
  let candidates = [...merged.values()];
  exclusion.checked = candidates.length;
  if (matchAudienceBasis === 'typical') candidates = await enrichCreatorMatchCandidatesWithTypical(candidates, activeLoadController?.signal);

  candidates = candidates.filter(stream => {
    const tags = creatorMatchTagAssessment(stream);
    if (tags.requiredMissing.length) { exclusion.requiredTags += 1; return false; }
    if (tags.excludedFound.length) { exclusion.excludedTags += 1; return false; }
    const audience = creatorMatchAudienceForCandidate(stream);
    if (!Number.isFinite(audience) || audience < range.min || audience > range.max) { exclusion.audience += 1; return false; }
    return true;
  }).map(stream => {
    const why = creatorMatchWhy(stream);
    return { ...stream, _matchDistance:why.distance, _matchAudienceValue:why.audienceValue, _why:why.reasons };
  }).sort((a,b) => {
    const tagA = creatorMatchTagAssessment(a).preferredMatches.length;
    const tagB = creatorMatchTagAssessment(b).preferredMatches.length;
    return tagB - tagA || a._matchDistance - b._matchDistance;
  });

  diagnostics.eligible += candidates.length;
  const summary = document.getElementById('match-exclusion-summary');
  if (summary) summary.textContent = `${exclusion.checked} candidates checked · ${exclusion.audience} outside audience range · ${exclusion.requiredTags} missing required match tags · ${exclusion.excludedTags} excluded by match tags · ${candidates.length} matches.`;
  const expand = document.getElementById('expand-creator-match');
  if (expand) expand.classList.toggle('hidden', candidates.length >= 4 || (matchTolerance >= 100 && matchFallbackExpanded));
  if (recordNextCreatorMatch) {
    recordCreatorMatchSearch({ audience:matchPeak, tolerance:matchTolerance, source:matchSource, sourceLabel:matchSourceLabel(), audienceBasis:matchAudienceBasis, ...creatorMatchTagConfig() });
    recordNextCreatorMatch = false;
  }
  return candidates.slice(0, 120);
}
