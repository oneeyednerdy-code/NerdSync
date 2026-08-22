'use strict';

const COLLAB_FIT_CANDIDATE_LIMIT = 12;
const COLLAB_PROFILE_TTL_MS = 15 * 60 * 1000;
const OBSERVED_SCHEDULE_VOD_LIMIT = 30;
const OBSERVED_SCHEDULE_MAX_AGE_DAYS = 90;
const OBSERVED_SCHEDULE_MIN_STREAM_MINUTES = 30;
const OBSERVED_SCHEDULE_CLUSTER_MINUTES = 120;
const OBSERVED_SCHEDULE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let ownCollabProfileCache = null;
let collabFitCache = new Map();

function genreIdsForGameName(name) {
  const lower = String(name || '').toLowerCase();
  return GENRE_PRESETS.filter(group => group.games.some(game => game.toLowerCase() === lower)).map(group => group.id);
}

function scheduleOverlapMinutes(first = [], second = []) {
  let total = 0;
  for (const a of first) {
    const aStart = new Date(a.start_time).getTime();
    const aEnd = new Date(a.end_time).getTime();
    if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) continue;
    for (const b of second) {
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();
      if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) continue;
      const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart);
      if (overlap > 0) total += overlap / 60000;
    }
  }
  return Math.round(total);
}

function parseTwitchDurationMinutes(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 0;
  const hours = Number(text.match(/(\d+)h/)?.[1] || 0);
  const minutes = Number(text.match(/(\d+)m/)?.[1] || 0);
  const seconds = Number(text.match(/(\d+)s/)?.[1] || 0);
  return Math.max(0, hours * 60 + minutes + seconds / 60);
}

function circularMinuteDifference(a, b) {
  const raw = ((Number(a) - Number(b) + 720) % 1440) - 720;
  return raw;
}

function recencyWeight(ageDays) {
  if (ageDays <= 30) return 1;
  if (ageDays <= 60) return 0.75;
  return 0.5;
}

function splitWeeklyWindow(day, startMinute, durationMinutes, representativeStart = '') {
  const windows = [];
  let currentDay = ((Number(day) % 7) + 7) % 7;
  let start = Math.max(0, Math.min(1439.999, Number(startMinute) || 0));
  let remaining = Math.max(1, Number(durationMinutes) || 1);
  let elapsed = 0;
  const representativeMs = new Date(representativeStart).getTime();
  while (remaining > 0 && windows.length < 3) {
    const end = Math.min(1440, start + remaining);
    const windowRepresentative = Number.isFinite(representativeMs) ? new Date(representativeMs + elapsed * 60000).toISOString() : representativeStart;
    windows.push({ day:currentDay, startMinute:start, endMinute:end, representativeStart:windowRepresentative });
    const consumed = end - start;
    remaining -= consumed;
    elapsed += consumed;
    currentDay = (currentDay + 1) % 7;
    start = 0;
  }
  return windows;
}

function weeklyWindowsFromPublished(segments = []) {
  const windows = [];
  for (const segment of segments) {
    const start = new Date(segment.start_time);
    const end = new Date(segment.end_time);
    const duration = (end.getTime() - start.getTime()) / 60000;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || duration <= 0) continue;
    const minute = start.getUTCHours() * 60 + start.getUTCMinutes() + start.getUTCSeconds() / 60;
    windows.push(...splitWeeklyWindow(start.getUTCDay(), minute, duration, segment.start_time));
  }
  // Collapse duplicate recurring published segments so two future weeks do not double-count overlap.
  const collapsed = new Map();
  for (const window of windows) {
    const key = `${window.day}:${Math.round(window.startMinute / 15)}`;
    const prior = collapsed.get(key);
    if (!prior || (window.endMinute - window.startMinute) > (prior.endMinute - prior.startMinute)) collapsed.set(key, window);
  }
  return [...collapsed.values()];
}

function observedScheduleFromVods(videos = [], trackerSummary = null, now = Date.now()) {
  const records = [];
  let vodMinutes30d = 0;
  for (const video of Array.isArray(videos) ? videos : []) {
    const created = new Date(video.created_at);
    const timestamp = created.getTime();
    const duration = parseTwitchDurationMinutes(video.duration);
    if (!Number.isFinite(timestamp) || duration < OBSERVED_SCHEDULE_MIN_STREAM_MINUTES) continue;
    const ageDays = Math.max(0, (now - timestamp) / 86400000);
    if (ageDays > OBSERVED_SCHEDULE_MAX_AGE_DAYS) continue;
    if (ageDays <= 30) vodMinutes30d += duration;
    records.push({
      day:created.getUTCDay(),
      startMinute:created.getUTCHours() * 60 + created.getUTCMinutes() + created.getUTCSeconds() / 60,
      duration,
      ageDays,
      weight:recencyWeight(ageDays),
      createdAt:video.created_at,
      id:String(video.id || ''),
    });
  }

  const windows = [];
  const clusterStats = [];
  for (let day = 0; day < 7; day++) {
    const dayRecords = records.filter(record => record.day === day);
    if (dayRecords.length < 2) continue;
    let best = null;
    for (const anchor of dayRecords) {
      const members = dayRecords.filter(record => Math.abs(circularMinuteDifference(record.startMinute, anchor.startMinute)) <= OBSERVED_SCHEDULE_CLUSTER_MINUTES);
      const weight = members.reduce((sum, record) => sum + record.weight, 0);
      if (!best || weight > best.weight || (weight === best.weight && members.length > best.members.length)) best = { anchor, members, weight };
    }
    if (!best || best.members.length < 2 || best.weight < 1.5) continue;
    const totalWeight = best.members.reduce((sum, record) => sum + record.weight, 0) || 1;
    const center = best.anchor.startMinute + best.members.reduce((sum, record) => sum + circularMinuteDifference(record.startMinute, best.anchor.startMinute) * record.weight, 0) / totalWeight;
    const normalizedCenter = ((center % 1440) + 1440) % 1440;
    const duration = best.members.reduce((sum, record) => sum + record.duration * record.weight, 0) / totalWeight;
    const variance = best.members.reduce((sum, record) => {
      const diff = circularMinuteDifference(record.startMinute, normalizedCenter);
      return sum + diff * diff * record.weight;
    }, 0) / totalWeight;
    const deviation = Math.sqrt(Math.max(0, variance));
    const representative = [...best.members].sort((a,b) => a.ageDays - b.ageDays)[0]?.createdAt || '';
    windows.push(...splitWeeklyWindow(day, normalizedCenter, duration, representative));
    clusterStats.push({ day, count:best.members.length, weight:best.weight, deviation, available:dayRecords.length });
  }

  const recurringSamples = clusterStats.reduce((sum, item) => sum + item.count, 0);
  const recurrenceRatio = records.length ? Math.min(1, recurringSamples / records.length) : 0;
  const avgDeviation = clusterStats.length ? clusterStats.reduce((sum, item) => sum + item.deviation, 0) / clusterStats.length : 999;
  const trackerMinutes30d = Number.isFinite(trackerSummary?.minutesStreamed) ? Number(trackerSummary.minutesStreamed) : null;
  const coverageRatio = trackerMinutes30d && trackerMinutes30d > 0 && vodMinutes30d > 0
    ? Math.max(0, Math.min(1, Math.min(vodMinutes30d / trackerMinutes30d, trackerMinutes30d / vodMinutes30d)))
    : null;

  let confidenceScore = Math.min(35, records.length * 3);
  confidenceScore += Math.round(recurrenceRatio * 25);
  confidenceScore += avgDeviation <= 45 ? 20 : avgDeviation <= 90 ? 14 : avgDeviation <= 150 ? 7 : 0;
  confidenceScore += coverageRatio == null ? 0 : Math.round(coverageRatio * 20);
  confidenceScore = Math.max(0, Math.min(100, confidenceScore));

  let confidence = 'insufficient';
  if (windows.length && records.length >= 4) {
    if (confidenceScore >= 75 && coverageRatio != null && coverageRatio >= 0.65) confidence = 'high';
    else if (confidenceScore >= 50) confidence = 'medium';
    else if (confidenceScore >= 30) confidence = 'low';
  }

  const coverageText = coverageRatio == null
    ? 'TwitchTracker activity cross-check unavailable'
    : `${Math.round(coverageRatio * 100)}% VOD/activity agreement with TwitchTracker 30D streamed time`;
  const patternText = windows.length
    ? `${clusterStats.length} recurring day${clusterStats.length === 1 ? '' : 's'} from ${records.length} usable archived broadcast${records.length === 1 ? '' : 's'}`
    : `${records.length} usable archived broadcast${records.length === 1 ? '' : 's'}; no recurring day/time pattern found`;

  return {
    kind:'observed',
    confidence,
    confidenceScore,
    windows,
    usableBroadcasts:records.length,
    recurringSamples,
    recurringDays:clusterStats.length,
    vodMinutes30d:Math.round(vodMinutes30d),
    trackerMinutes30d:trackerMinutes30d == null ? null : Math.round(trackerMinutes30d),
    coverageRatio,
    averageStartDeviationMinutes:Number.isFinite(avgDeviation) ? Math.round(avgDeviation) : null,
    detail:`${patternText} · ${coverageText}`,
    sourceNote:'Inferred from recent public Twitch archived broadcasts. This is not a published schedule or a promise of future availability.',
  };
}

function publishedScheduleEvidence(segments = []) {
  return {
    kind:'published',
    confidence:'published',
    confidenceScore:100,
    segments:Array.isArray(segments) ? segments : [],
    windows:weeklyWindowsFromPublished(segments),
    detail:`${segments.length} upcoming published Twitch schedule segment${segments.length === 1 ? '' : 's'}`,
    sourceNote:'Published through the creator’s Twitch schedule.',
  };
}

function noScheduleEvidence() {
  return { kind:'none', confidence:'insufficient', confidenceScore:0, segments:[], windows:[], detail:'No usable published or observed schedule evidence', sourceNote:'Schedule evidence unavailable.' };
}

function weeklyScheduleOverlapMinutes(firstEvidence, secondEvidence) {
  const first = firstEvidence?.windows || [];
  const second = secondEvidence?.windows || [];
  let total = 0;
  for (const a of first) {
    for (const b of second) {
      if (a.day !== b.day) continue;
      const overlap = Math.min(a.endMinute, b.endMinute) - Math.max(a.startMinute, b.startMinute);
      if (overlap > 0) total += overlap;
    }
  }
  return Math.round(total);
}

function collaborationCacheTtl(evidence) {
  return evidence?.kind === 'observed' ? OBSERVED_SCHEDULE_CACHE_TTL_MS : COLLAB_PROFILE_TTL_MS;
}

function observedConfidenceFactor(evidence) {
  if (!evidence || evidence.kind !== 'observed') return 1;
  if (evidence.confidence === 'high') return 0.8;
  if (evidence.confidence === 'medium') return 0.6;
  return 0;
}

function scheduleEvidenceComponent(ownEvidence, creatorEvidence) {
  if (!ownEvidence || !creatorEvidence || ownEvidence.kind === 'none' || creatorEvidence.kind === 'none') return null;
  let overlap = 0;
  let basePoints = 0;
  let detail = '';
  let source = 'published';

  if (ownEvidence.kind === 'published' && creatorEvidence.kind === 'published') {
    overlap = scheduleOverlapMinutes(ownEvidence.segments || [], creatorEvidence.segments || []);
    basePoints = overlap >= 240 ? 20 : overlap >= 120 ? 16 : overlap >= 30 ? 10 : overlap > 0 ? 6 : 0;
    detail = overlap ? `${Math.round(overlap / 6) / 10}h published schedule overlap` : 'No overlap in upcoming published schedules';
  } else {
    overlap = weeklyScheduleOverlapMinutes(ownEvidence, creatorEvidence);
    basePoints = overlap >= 180 ? 20 : overlap >= 90 ? 16 : overlap >= 30 ? 10 : overlap > 0 ? 6 : 0;
    const factor = Math.min(observedConfidenceFactor(ownEvidence), observedConfidenceFactor(creatorEvidence));
    source = 'observed';
    const observedParts = [ownEvidence, creatorEvidence].filter(item => item.kind === 'observed');
    const confidence = observedParts.some(item => item.confidence === 'low' || item.confidence === 'insufficient') ? 'low'
      : observedParts.some(item => item.confidence === 'medium') ? 'medium' : 'high';
    const scaled = factor > 0 ? Math.round(basePoints * factor) : 0;
    detail = overlap
      ? `${Math.round(overlap / 6) / 10}h likely weekly overlap · ${confidence}-confidence observed pattern${factor === 0 ? ' (informational only)' : ''}`
      : `No overlap found in ${confidence}-confidence observed pattern`;
    basePoints = scaled;
  }

  return { key:'schedule', label:'Schedule', score:basePoints, max:20, detail, overlapMinutes:overlap, source };
}

function formatScheduleEvidenceWindows(evidence) {
  if (!evidence?.windows?.length) return [];
  return evidence.windows.slice(0, 7).map(window => {
    let start;
    if (window.representativeStart) start = new Date(window.representativeStart);
    if (!start || !Number.isFinite(start.getTime())) {
      const sunday = new Date('2026-08-23T00:00:00Z');
      start = new Date(sunday.getTime() + window.day * 86400000 + window.startMinute * 60000);
    }
    const duration = Math.max(1, window.endMinute - window.startMinute);
    const end = new Date(start.getTime() + duration * 60000);
    const day = new Intl.DateTimeFormat(undefined, { weekday:'short' }).format(start);
    const time = new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit' }).format(start);
    const endTime = new Intl.DateTimeFormat(undefined, { hour:'numeric', minute:'2-digit' }).format(end);
    return `${day} · ~${time}–${endTime}`;
  });
}

function scheduleEvidenceHtml(evidence) {
  if (!evidence || evidence.kind === 'none') return '<div class="schedule-evidence"><strong>Schedule evidence unavailable</strong><span>No published schedule or reliable VOD pattern was found.</span></div>';
  const title = evidence.kind === 'published' ? 'Published Twitch schedule' : `Observed schedule · ${evidence.confidence} confidence`;
  const windows = formatScheduleEvidenceWindows(evidence);
  const coverage = evidence.kind === 'observed' && evidence.coverageRatio != null
    ? `<small>TwitchTracker activity agreement: ${Math.round(evidence.coverageRatio * 100)}%</small>` : '';
  const sample = evidence.kind === 'observed'
    ? `<small>${evidence.usableBroadcasts} usable archived broadcasts · confidence ${evidence.confidenceScore}/100</small>` : '';
  return `<div class="schedule-evidence"><strong>${escapeHtml(title)}</strong>${windows.length ? `<div class="schedule-evidence-windows">${windows.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}${sample}${coverage}<small>${escapeHtml(evidence.sourceNote || '')}</small></div>`;
}

async function resolveScheduleEvidence({ broadcasterId, login = '', publishedSegments = [], trackerSummary = null, videos = null, token = currentToken } = {}) {
  if (Array.isArray(publishedSegments) && publishedSegments.length) return publishedScheduleEvidence(publishedSegments);
  const [videosR, trackerR] = await Promise.allSettled([
    Array.isArray(videos) ? Promise.resolve(videos) : fetchVideosForBroadcaster(broadcasterId, token, OBSERVED_SCHEDULE_VOD_LIMIT),
    trackerSummary ? Promise.resolve(trackerSummary) : (login ? getTwitchTrackerSummary(login) : Promise.resolve(null)),
  ]);
  const observedVideos = videosR.status === 'fulfilled' ? videosR.value : [];
  const tracker = trackerR.status === 'fulfilled' ? trackerR.value : trackerSummary;
  const observed = observedScheduleFromVods(observedVideos, tracker);
  return observed.confidence === 'insufficient' ? { ...observed, kind:'none', sourceNote:'Not enough consistent public VOD history to estimate a likely stream window.' } : observed;
}

async function ensureOwnCollabProfile(force = false) {
  if (!force && ownCollabProfileCache && Date.now() - ownCollabProfileCache.timestamp < COLLAB_PROFILE_TTL_MS) return ownCollabProfileCache.data;
  const [channelsR, scheduleR, liveR, trackerR] = await Promise.allSettled([
    fetchChannelsByIds([currentUser.id], currentToken),
    fetchScheduleForBroadcaster(currentUser.id, currentToken, 20),
    fetchStreamsByUserIds([currentUser.id], currentToken),
    getTwitchTrackerSummary(currentUser.login || currentUser.display_name)
  ]);
  const channel = channelsR.status === 'fulfilled' ? channelsR.value[0] : null;
  const live = liveR.status === 'fulfilled' ? liveR.value[0] : null;
  const tracker = trackerR.status === 'fulfilled' ? trackerR.value : null;
  const schedule = scheduleR.status === 'fulfilled' ? scheduleR.value : [];
  const scheduleEvidence = scheduleR.status === 'fulfilled'
    ? await resolveScheduleEvidence({ broadcasterId:currentUser.id, login:currentUser.login || currentUser.display_name, publishedSegments:schedule, trackerSummary:tracker, token:currentToken })
    : noScheduleEvidence();
  const data = {
    id:String(currentUser.id),
    language:channel?.broadcaster_language || live?.language || '',
    tags:channel?.tags || live?.tags || [],
    gameId:channel?.game_id || live?.game_id || '',
    gameName:channel?.game_name || live?.game_name || '',
    liveViewers:live?.viewer_count ?? null,
    typicalViewers:Number.isFinite(tracker?.averageViewers) ? tracker.averageViewers : null,
    schedule,
    scheduleEvidence,
  };
  ownCollabProfileCache = { timestamp:Date.now(), data };
  return data;
}

function scoreCollaborationFit(creator, ownProfile, creatorSchedule = [], creatorScheduleEvidence = null) {
  const components = [];
  const ownAudience = Number.isFinite(ownProfile?.typicalViewers) ? ownProfile.typicalViewers : ownProfile?.liveViewers;
  const creatorAudience = Number.isFinite(creator._trackerSummary?.averageViewers) ? creator._trackerSummary.averageViewers : creator.viewer_count;
  if (Number.isFinite(ownAudience) && ownAudience > 0 && Number.isFinite(creatorAudience)) {
    const ratio = Math.abs(creatorAudience - ownAudience) / Math.max(ownAudience, 1);
    components.push({ key:'audience', label:'Audience', score:Math.max(0, Math.round(25 * (1 - Math.min(1, ratio)))), max:25, detail:`${Math.round(ratio * 100)}% audience difference` });
  }
  const ownTags = new Set((ownProfile?.tags || []).map(tag => String(tag).toLowerCase()));
  const creatorTags = (creator.tags || []).map(tag => String(tag).toLowerCase());
  if (ownTags.size || creatorTags.length) {
    const shared = creatorTags.filter(tag => ownTags.has(tag));
    components.push({ key:'tags', label:'Tags', score:Math.min(25, shared.length * 6 + (shared.length ? 1 : 0)), max:25, detail:shared.length ? `${shared.length} shared Twitch tag${shared.length === 1 ? '' : 's'}` : 'No shared Twitch tags found' });
  }
  if (ownProfile?.gameId || creator.game_id) {
    let points = 0; let detail = 'Different categories';
    if (ownProfile?.gameId && ownProfile.gameId === creator.game_id) { points = 20; detail = 'Same current category'; }
    else {
      const ownGenres = new Set(genreIdsForGameName(ownProfile?.gameName));
      const sharedGenres = genreIdsForGameName(creator.game_name).filter(id => ownGenres.has(id));
      if (sharedGenres.length) { points = 14; detail = `Related ${sharedGenres.map(id => GENRE_PRESETS.find(item => item.id === id)?.label || id).join('/')} genre`; }
    }
    components.push({ key:'category', label:'Category', score:points, max:20, detail });
  }
  const ownEvidence = ownProfile?.scheduleEvidence || (ownProfile?.schedule?.length ? publishedScheduleEvidence(ownProfile.schedule) : noScheduleEvidence());
  const creatorEvidence = creatorScheduleEvidence || (creatorSchedule.length ? publishedScheduleEvidence(creatorSchedule) : noScheduleEvidence());
  const scheduleComponent = scheduleEvidenceComponent(ownEvidence, creatorEvidence);
  if (scheduleComponent) components.push(scheduleComponent);

  const languageKnown = Boolean(ownProfile?.language && creator.language);
  if (languageKnown || creator._chatOpen != null) {
    let points = 0; const details = [];
    if (languageKnown) { if (ownProfile.language === creator.language) { points += 6; details.push('same stream language'); } else details.push('different stream language'); }
    if (creator._chatOpen === true) { points += 4; details.push('open chat'); }
    else if (creator._chatOpen === false) details.push('restricted chat');
    components.push({ key:'access', label:'Language/chat', score:points, max:10, detail:details.join(' · ') || 'Context unavailable' });
  }
  const earned = components.reduce((sum,item) => sum + item.score, 0);
  const possible = components.reduce((sum,item) => sum + item.max, 0);
  const score = possible ? Math.round(earned / possible * 100) : null;
  const overlap = components.find(item => item.key === 'schedule')?.detail || 'Schedule overlap unavailable';
  return {
    score,
    components,
    scheduleNote:overlap,
    scheduleEvidence:creatorEvidence,
    ownScheduleEvidence:ownEvidence,
    explanation:components.filter(item => item.score > 0).sort((a,b) => b.score - a.score).slice(0,4).map(item => item.detail).join(' · ') || 'Limited collaboration context available'
  };
}

async function enrichCollaborationFit(items, { limit = COLLAB_FIT_CANDIDATE_LIMIT } = {}) {
  if (!document.getElementById('match-collaboration-fit')?.checked || !items.length) return items;
  const own = await ensureOwnCollabProfile();
  const head = items.slice(0, limit);
  const enrichedHead = await mapWithConcurrency(head, 4, async creator => {
    const id = String(creator.user_id || creator.id || '');
    const cached = collabFitCache.get(id);
    const cachedValid = cached && Date.now() - cached.timestamp < collaborationCacheTtl(cached.scheduleEvidence);
    let schedule = cachedValid ? cached.schedule : null;
    let scheduleEvidence = cachedValid ? cached.scheduleEvidence : null;
    let chatOpen = creator._chatOpen;
    if (!schedule) {
      const [scheduleR, chatR] = await Promise.allSettled([
        fetchScheduleForBroadcaster(id, currentToken, 20),
        creator._chatOpen == null ? fetchChatSettings(id, currentToken) : Promise.resolve(null)
      ]);
      schedule = scheduleR.status === 'fulfilled' ? scheduleR.value : [];
      if (chatR.status === 'fulfilled' && chatR.value) chatOpen = !chatR.value.follower_mode && !chatR.value.subscriber_mode && !chatR.value.emote_mode;
      scheduleEvidence = scheduleR.status === 'fulfilled'
        ? await resolveScheduleEvidence({
          broadcasterId:id,
          login:creator.user_login || creator.login || '',
          publishedSegments:schedule,
          trackerSummary:creator._trackerSummary || null,
          token:currentToken,
        })
        : noScheduleEvidence();
      collabFitCache.set(id, { timestamp:Date.now(), schedule, scheduleEvidence });
    }
    const withChat = { ...creator, _chatOpen:chatOpen, _scheduleEvidence:scheduleEvidence };
    return { ...withChat, _collabFit:scoreCollaborationFit(withChat, own, schedule, scheduleEvidence), _scheduleSegments:schedule };
  });
  const byId = new Map(enrichedHead.filter(Boolean).map(item => [String(item.user_id || item.id), item]));
  return items.map(item => byId.get(String(item.user_id || item.id)) || item).sort((a,b) => {
    const fitA = Number.isFinite(a._collabFit?.score) ? a._collabFit.score : -1;
    const fitB = Number.isFinite(b._collabFit?.score) ? b._collabFit.score : -1;
    return fitB - fitA || (a._matchDistance ?? 999) - (b._matchDistance ?? 999);
  });
}

function collaborationFitHtml(stream, compact = true) {
  const fit = stream?._collabFit;
  if (!Number.isFinite(fit?.score)) return '';
  if (compact) return `<div class="collab-fit-card"><strong>Collaboration Fit ${fit.score}/100</strong><span>${escapeHtml(fit.explanation)}</span>${fit.scheduleEvidence?.kind === 'observed' ? `<small>Observed schedule: ${escapeHtml(fit.scheduleEvidence.confidence)} confidence · not a published schedule</small>` : ''}</div>`;
  return `<section class="collab-fit-detail"><h4>Collaboration Fit ${fit.score}/100</h4><div class="collab-fit-components">${fit.components.map(item => `<div><span>${escapeHtml(item.label)}</span><strong>${item.score}/${item.max}</strong><small>${escapeHtml(item.detail)}</small></div>`).join('')}</div>${scheduleEvidenceHtml(fit.scheduleEvidence)}<p class="filter-hint">A compatibility signal, not a creator-quality rating. Published Twitch schedules get full schedule weight. High/medium-confidence observed VOD patterns get reduced weight; low-confidence patterns are informational only and never claim future availability.</p></section>`;
}

function comparisonInsightHtml(creators) {
  const withFit = creators.filter(item => Number.isFinite(item._collabFit?.score));
  if (!withFit.length) return '';
  const bestBy = key => [...withFit].sort((a,b) => {
    const av = a._collabFit.components.find(item => item.key === key)?.score ?? -1;
    const bv = b._collabFit.components.find(item => item.key === key)?.score ?? -1;
    return bv - av;
  })[0];
  const audience = bestBy('audience');
  const tags = bestBy('tags');
  const schedule = bestBy('schedule');
  const overall = [...withFit].sort((a,b) => b._collabFit.score - a._collabFit.score)[0];
  const scheduleComponent = schedule?._collabFit?.components.find(item => item.key === 'schedule');
  const chips = [
    audience ? `Closest audience signal: ${audience.user_name}` : null,
    tags ? `Strongest shared-tag signal: ${tags.user_name}` : null,
    scheduleComponent?.score > 0 ? `Strongest schedule-overlap signal: ${schedule.user_name}${scheduleComponent.source === 'observed' ? ' (observed)' : ''}` : null,
    overall ? `Highest Collaboration Fit signal: ${overall.user_name} (${overall._collabFit.score}/100)` : null,
  ].filter(Boolean);
  return `<div class="comparison-insights"><strong>Comparison highlights</strong><div class="signal-row">${chips.map(item => `<span class="signal">${escapeHtml(item)}</span>`).join('')}</div><p class="filter-hint">These are evidence summaries, not a recommendation that one creator is objectively better.</p></div>`;
}
