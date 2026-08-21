'use strict';

const TWITCHTRACKER_SUMMARY_ENDPOINT = '/api/twitchtracker-summary';
const twitchTrackerSummaryCache = new Map();
const TWITCHTRACKER_CACHE_MS = 5 * 60 * 1000;

function finiteTwitchTrackerNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstTwitchTrackerNumber(data, keys) {
  for (const key of keys) {
    const value = finiteTwitchTrackerNumber(data && data[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeTwitchTrackerSummary(data, channel = '') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return {
    channel: String(channel || data.channel || data.username || '').trim().toLowerCase(),
    averageViewers: firstTwitchTrackerNumber(data, ['avg_viewers', 'average_viewers', 'averageViewers']),
    maxViewers: firstTwitchTrackerNumber(data, ['max_viewers', 'peak_viewers', 'maxViewers']),
    minutesStreamed: firstTwitchTrackerNumber(data, ['minutes_streamed', 'minutesStreamed']),
    hoursWatched: firstTwitchTrackerNumber(data, ['hours_watched', 'hoursWatched']),
    followersGained: firstTwitchTrackerNumber(data, ['followers', 'followers_gained', 'followersGained']),
    totalFollowers: firstTwitchTrackerNumber(data, ['followers_total', 'total_followers', 'totalFollowers']),
    rank: firstTwitchTrackerNumber(data, ['rank']),
    periodDays: 30,
    source: 'TwitchTracker',
  };
}

async function getTwitchTrackerSummary(channel, { fetchImpl = fetch, signal, force = false } = {}) {
  const normalized = String(channel || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{1,25}$/.test(normalized)) throw new Error('Invalid Twitch channel login.');
  const cached = twitchTrackerSummaryCache.get(normalized);
  if (!force && cached && Date.now() - cached.at < TWITCHTRACKER_CACHE_MS) return cached.value;

  const url = new URL(TWITCHTRACKER_SUMMARY_ENDPOINT, location.origin);
  url.searchParams.set('channel', normalized);
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`TwitchTracker summary unavailable (${response.status}).`);
  const payload = await response.json();
  const value = normalizeTwitchTrackerSummary(payload, normalized);
  if (value) twitchTrackerSummaryCache.set(normalized, { at: Date.now(), value });
  return value;
}
