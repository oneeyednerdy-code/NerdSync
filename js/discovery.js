'use strict';

function scanPageLimit(maxPages, deep = false) {
  return deep ? maxPages : Math.min(INITIAL_SCAN_PAGES, maxPages);
}

function mixHiddenGemAudienceBuckets(streams, limit) {
  const lanes = [
    { min:1, max:5, label:'1–5 viewer lane' },
    { min:6, max:20, label:'6–20 viewer lane' },
    { min:21, max:SMALL_STREAM_VIEWER_CEILING, label:`21–${SMALL_STREAM_VIEWER_CEILING} viewer lane` }
  ].map(lane => ({ ...lane, items:streams
    .filter(stream => stream.viewer_count >= lane.min && stream.viewer_count <= lane.max)
    .sort((a,b) => a.viewer_count - b.viewer_count || a.user_name.localeCompare(b.user_name)) }));
  const mixed = [];
  while (mixed.length < limit) {
    let added = false;
    lanes.forEach(lane => {
      const stream = lane.items.shift();
      if (stream && mixed.length < limit) {
        mixed.push({ ...stream, _gemAudienceLane:lane.label });
        added = true;
      }
    });
    if (!added) break;
  }
  return mixed;
}

// --- Tab data builders ---
async function loadFollowing() {
  const [live, channels] = await Promise.all([getFollowedLive(), getFollowedChannels()]);
  const followedAtById = new Map(channels.map(c => [c.broadcaster_id, c.followed_at]));
  return live.map(s => ({ ...s, _followedAt: followedAtById.get(s.user_id) }));
}

async function loadDiscover(options = {}) {
  const pageLimit = scanPageLimit(DISCOVER_STREAM_PAGES, options.deep);
  const [followedLive, followedChannels, topGames] = await Promise.all([getFollowedLive(), getFollowedChannels(), fetchTopGames(currentToken, MAX_TOP_CATEGORIES_FOR_DISCOVER)]);
  const followedChannelInfo = await fetchChannelsByIds(followedChannels.slice(0, 200).map(channel => channel.broadcaster_id), currentToken).catch(() => []);
  buildFollowedInterestProfile(followedLive, followedChannelInfo);
  const excludedIds = new Set(followedChannels.map(channel => channel.broadcaster_id));
  excludedIds.add(currentUser.id);
  const categoryMap = new Map();
  filters.categories.slice(0, MAX_TOP_CATEGORIES_FOR_DISCOVER).forEach(category => categoryMap.set(category.id, { id:category.id, name:category.name, reason:'Selected category' }));
  recommendationCategorySeeds(MAX_TOP_CATEGORIES_FOR_DISCOVER).forEach(category => {
    if (categoryMap.size < MAX_TOP_CATEGORIES_FOR_DISCOVER && !categoryMap.has(category.id)) categoryMap.set(category.id, { ...category, reason:'Your NerdSync discovery profile' });
  });
  const frequency = new Map();
  followedInterestProfile.categories.forEach((item, id) => frequency.set(id, { id, name:item.name, count:item.count }));
  [...frequency.values()].sort((a,b) => b.count-a.count).forEach(game => {
    if (categoryMap.size < MAX_TOP_CATEGORIES_FOR_DISCOVER && !categoryMap.has(game.id)) categoryMap.set(game.id, { ...game, reason:'Played by channels you follow' });
  });
  topGames.forEach(game => {
    if (categoryMap.size < MAX_TOP_CATEGORIES_FOR_DISCOVER && !categoryMap.has(game.id)) categoryMap.set(game.id, { ...game, reason:'Popular category, smaller channel' });
  });
  const games = [...categoryMap.values()];
  diagnostics.categories = games.length;
  if (!games.length) return [];
  const perCategory = await Promise.allSettled(games.map(async game => {
    const streams = await fetchDiscoveryStreamsForGame(game.id, currentToken, { excludedIds, maxPages:pageLimit });
    return streams.map(stream => ({ ...stream, _via:game.name, _why:`${game.reason} · ${CREATOR_STAGES[creatorStageKey(stream.viewer_count)].label} · ${stream.viewer_count} live viewers` }));
  }));
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;
  const merged = new Map();
  const lists = perCategory.filter(result => result.status === 'fulfilled').map(result => result.value);
  for (let row = 0; ; row++) {
    let added = false;
    lists.forEach(list => { const stream = list[row]; if (stream && !merged.has(stream.user_id)) { merged.set(stream.user_id, stream); added = true; } });
    if (!added) break;
  }
  return [...merged.values()];
}

async function loadSpotlight(options = {}) {
  const pageLimit = scanPageLimit(3, options.deep);
  const [followedLive, followedChannels, topGames] = await Promise.all([getFollowedLive(), getFollowedChannels(), fetchTopGames(currentToken, MAX_TOP_CATEGORIES_FOR_DISCOVER)]);
  const excludedIds = new Set(followedChannels.map(channel => channel.broadcaster_id));
  excludedIds.add(currentUser.id);
  const categoryMap = new Map();
  filters.categories.slice(0, MAX_TOP_CATEGORIES_FOR_DISCOVER).forEach(category => categoryMap.set(category.id, { id:category.id, name:category.name, reason:'Selected category' }));
  recommendationCategorySeeds(MAX_TOP_CATEGORIES_FOR_DISCOVER).forEach(category => {
    if (categoryMap.size < MAX_TOP_CATEGORIES_FOR_DISCOVER && !categoryMap.has(category.id)) categoryMap.set(category.id, { ...category, reason:'Your NerdSync discovery profile' });
  });
  followedLive.forEach(stream => {
    if (stream.game_id && categoryMap.size < MAX_TOP_CATEGORIES_FOR_DISCOVER && !categoryMap.has(stream.game_id)) categoryMap.set(stream.game_id, { id:stream.game_id, name:stream.game_name, reason:'Category you already watch' });
  });
  topGames.forEach(game => {
    if (categoryMap.size < MAX_TOP_CATEGORIES_FOR_DISCOVER && !categoryMap.has(game.id)) categoryMap.set(game.id, { ...game, reason:'Popular category spotlight' });
  });
  const games = [...categoryMap.values()];
  diagnostics.categories = games.length;
  const perCategory = await Promise.allSettled(games.map(async game => {
    const streams = await fetchStreamsByGameIdPages(game.id, currentToken, pageLimit);
    return streams
      .filter(stream => !excludedIds.has(stream.user_id) && stream.viewer_count >= CREATOR_STAGES.established.min)
      .slice(0, STREAMS_PER_CATEGORY_DISCOVER)
      .map(stream => ({ ...stream, _via:game.name, _why:`${game.reason} · ${CREATOR_STAGES[creatorStageKey(stream.viewer_count)].label} · ${stream.viewer_count} live viewers` }));
  }));
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;
  const merged = new Map();
  const lists = perCategory.filter(result => result.status === 'fulfilled').map(result => result.value);
  for (let row = 0; ; row++) {
    let added = false;
    lists.forEach(list => {
      const stream = list[row];
      if (stream && !merged.has(stream.user_id)) { merged.set(stream.user_id, stream); added = true; }
    });
    if (!added) break;
  }
  diagnostics.eligible += merged.size;
  return [...merged.values()];
}

async function loadHiddenGems(options = {}) {
  const pageLimit = scanPageLimit(GEMS_STREAM_PAGES, options.deep);
  const [seeds, followedChannels] = await Promise.all([getFollowedLive(), getFollowedChannels()]);
  const followedIds = new Set(followedChannels.map(channel => channel.broadcaster_id));
  followedIds.add(currentUser.id);

  const categorySeen = new Map();
  filters.categories.forEach(category => {
    if (categorySeen.size < MAX_SEED_CATEGORIES_FOR_GEMS) categorySeen.set(category.id, category.name);
  });
  recommendationCategorySeeds(MAX_SEED_CATEGORIES_FOR_GEMS).forEach(category => {
    if (categorySeen.size < MAX_SEED_CATEGORIES_FOR_GEMS && !categorySeen.has(category.id)) categorySeen.set(category.id, category.name);
  });
  const frequency = new Map();
  seeds.forEach(stream => {
    if (!stream.game_id) return;
    const existing = frequency.get(stream.game_id) || { name:stream.game_name, count:0 };
    existing.count += 1;
    frequency.set(stream.game_id, existing);
  });
  [...frequency.entries()].sort((a,b) => b[1].count - a[1].count).forEach(([id, item]) => {
    if (categorySeen.size < MAX_SEED_CATEGORIES_FOR_GEMS && !categorySeen.has(id)) categorySeen.set(id, item.name);
  });
  if (categorySeen.size < MIN_GEM_CATEGORIES) {
    const topGames = await fetchTopGames(currentToken, MIN_GEM_CATEGORIES + 2);
    topGames.forEach(game => {
      if (categorySeen.size < MIN_GEM_CATEGORIES && !categorySeen.has(game.id)) categorySeen.set(game.id, game.name);
    });
  }
  if (categorySeen.size === 0) return [];

  const perCategory = await Promise.allSettled([...categorySeen.entries()].map(async ([gameId, gameName]) => {
    const streams = await fetchStreamsByGameIdPages(gameId, currentToken, pageLimit);
    const eligible = streams.filter(s => !followedIds.has(s.user_id) && s.viewer_count >= 1 && s.viewer_count <= SMALL_STREAM_VIEWER_CEILING);
    return mixHiddenGemAudienceBuckets(eligible, GEMS_PER_CATEGORY)
      .map(s => ({ ...s, _via:gameName, _why:`${s._gemAudienceLane} · deep in ${gameName} · ${s.viewer_count} live viewers` }));
  }));

  diagnostics.categories = categorySeen.size;
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;

  const merged = new Map();
  perCategory.forEach(result => { if (result.status === 'fulfilled') result.value.forEach(s => { if (!merged.has(s.user_id)) merged.set(s.user_id, s); }); });
  diagnostics.eligible += merged.size;
  return [...merged.values()];
}

async function loadEmergingHub(options = {}) {
  const pageLimit = scanPageLimit(NEW_AFFILIATE_STREAM_PAGES, options.deep);
  const [topGames, followedChannels] = await Promise.all([fetchTopGames(currentToken, MAX_TOP_CATEGORIES_FOR_RISING), getFollowedChannels()]);
  const gameMap = new Map();
  filters.categories.slice(0, MAX_TOP_CATEGORIES_FOR_RISING).forEach(category => gameMap.set(category.id, category));
  recommendationCategorySeeds(MAX_TOP_CATEGORIES_FOR_RISING).forEach(category => {
    if (gameMap.size < MAX_TOP_CATEGORIES_FOR_RISING && !gameMap.has(category.id)) gameMap.set(category.id, category);
  });
  topGames.forEach(game => { if (gameMap.size < MAX_TOP_CATEGORIES_FOR_RISING) gameMap.set(game.id, game); });
  const games = [...gameMap.values()];
  const excludedIds = new Set(followedChannels.map(channel => channel.broadcaster_id));
  excludedIds.add(currentUser.id);
  diagnostics.categories = games.length;
  if (!games.length) return [];

  const perCategory = await Promise.allSettled(games.map(async game => {
    const streams = await fetchStreamsByGameIdPages(game.id, currentToken, pageLimit);
    return streams.filter(stream => !excludedIds.has(stream.user_id)).map(stream => ({ ...stream, _sourceCategory:game.name }));
  }));
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;
  const categoryLists = perCategory.filter(result => result.status === 'fulfilled').map(result => result.value);
  const candidates = new Map();
  for (let row = 0; candidates.size < MAX_NEW_AFFILIATE_CANDIDATES; row++) {
    let added = false;
    categoryLists.forEach(list => {
      const stream = list[row];
      if (stream && !candidates.has(stream.user_id) && candidates.size < MAX_NEW_AFFILIATE_CANDIDATES) {
        candidates.set(stream.user_id, stream);
        added = true;
      }
    });
    if (!added) break;
  }
  const candidateList = [...candidates.values()];
  if (!candidateList.length) return [];
  const users = await fetchUsersByIds(candidateList.map(stream => stream.user_id), currentToken);
  const userById = new Map(users.map(user => [user.id, user]));
  const enriched = candidateList.map(stream => {
    const user = userById.get(stream.user_id);
    if (!user) return null;
    const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000;
    return { stream, user, ageDays, type:user.broadcaster_type || 'none' };
  }).filter(Boolean);

  const newAffiliates = enriched
    .filter(item => item.type === 'affiliate' && item.ageDays >= 0 && item.ageDays < NEW_AFFILIATE_ACCOUNT_DAYS)
    .map(({ stream, user, ageDays }) => {
      const ageLabel = ageDays < 60 ? `${Math.round(ageDays)}d account` : `${Math.max(1, Math.round(ageDays / 30))}mo account`;
      const baseSignalScore = Math.max(0, Math.min(55, Math.round((1 - ageDays / NEW_AFFILIATE_ACCOUNT_DAYS) * 55)));
      return { ...stream, _emergingSection:'newAffiliate', _broadcasterType:'affiliate', _accountCreatedAt:user.created_at, _profileImage:user.profile_image_url || '', _newAffiliateAgeDays:ageDays, _newAffiliateScore:baseSignalScore, _newAffiliateLabel:'Newer Affiliate', _via:`Newer Affiliate · ${ageLabel}`, _why:`Current Twitch Affiliate · account created ${Math.round(ageDays)} days ago · affiliate-earned date unavailable` };
    });
  const newAffiliateIds = new Set(newAffiliates.map(stream => stream.user_id));
  const standard = enriched
    .filter(item => !newAffiliateIds.has(item.stream.user_id) && item.ageDays >= 0 && item.ageDays <= RISING_ACCOUNT_WINDOW_DAYS && item.stream.viewer_count >= RISING_MIN_VIEWERS && item.stream.viewer_count <= RISING_MAX_VIEWERS)
    .map(({ stream, user, ageDays, type }) => {
      const recencyScore = Math.max(0, 1 - ageDays / RISING_ACCOUNT_WINDOW_DAYS);
      const audienceScore = Math.min(stream.viewer_count / 75, 75 / Math.max(stream.viewer_count, 1));
      const statusBonus = type === 'none' ? 10 : type === 'affiliate' ? 5 : 0;
      const score = Math.round(recencyScore * 55 + audienceScore * 35 + statusBonus);
      const ageLabel = ageDays < 60 ? `${Math.round(ageDays)}d account` : `${Math.max(1, Math.round(ageDays / 30))}mo account`;
      return { ...stream, _emergingSection:'standard', _broadcasterType:type, _accountCreatedAt:user.created_at, _profileImage:user.profile_image_url || '', _risingScore:score, _via:`Score ${score} · ${ageLabel}`, _why:`Newer account signal · ${stream.viewer_count} live viewers · ${type === 'none' ? 'not affiliated' : type}` };
    });
  diagnostics.eligible += standard.length + newAffiliates.length;
  return [...standard, ...newAffiliates];
}

async function loadRisingStars() {
  const [topGames, followedChannels] = await Promise.all([fetchTopGames(currentToken, MAX_TOP_CATEGORIES_FOR_RISING), getFollowedChannels()]);
  const gameMap = new Map();
  filters.categories.slice(0, MAX_TOP_CATEGORIES_FOR_RISING).forEach(category => gameMap.set(category.id, category));
  topGames.forEach(game => { if (gameMap.size < MAX_TOP_CATEGORIES_FOR_RISING) gameMap.set(game.id, game); });
  const games = [...gameMap.values()];
  const excludedIds = new Set(followedChannels.map(channel => channel.broadcaster_id));
  excludedIds.add(currentUser.id);
  diagnostics.categories = games.length;
  if (games.length === 0) return [];

  const perCategory = await Promise.allSettled(games.map(async game => {
    const streams = await fetchStreamsByGameIdPages(game.id, currentToken, RISING_STREAM_PAGES);
    return streams
      .filter(stream => !excludedIds.has(stream.user_id) && stream.viewer_count >= RISING_MIN_VIEWERS && stream.viewer_count <= RISING_MAX_VIEWERS)
      .map(stream => ({ ...stream, _sourceCategory:game.name }));
  }));
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;
  const categoryLists = perCategory.filter(result => result.status === 'fulfilled').map(result => result.value);
  const candidates = new Map();
  for (let row = 0; candidates.size < MAX_RISING_CANDIDATES; row++) {
    let added = false;
    categoryLists.forEach(list => {
      const stream = list[row];
      if (stream && !candidates.has(stream.user_id) && candidates.size < MAX_RISING_CANDIDATES) {
        candidates.set(stream.user_id, stream);
        added = true;
      }
    });
    if (!added) break;
  }
  const candidateList = [...candidates.values()];
  if (candidateList.length === 0) return [];

  const users = await fetchUsersByIds(candidateList.map(s => s.user_id), currentToken);
  const userById = new Map(users.map(u => [u.id, u]));
  const eligible = candidateList
    .map(s => ({ stream: s, user: userById.get(s.user_id) }))
    .filter(({ user }) => Boolean(user) && (Date.now() - new Date(user.created_at).getTime()) / 86400000 <= RISING_ACCOUNT_WINDOW_DAYS)
    .map(({ stream, user }) => {
      const ageDays = Math.max(0, (Date.now() - new Date(user.created_at).getTime()) / 86400000);
      const recencyScore = Math.max(0, 1 - ageDays / RISING_ACCOUNT_WINDOW_DAYS);
      const audienceScore = Math.min(stream.viewer_count / 75, 75 / Math.max(stream.viewer_count, 1));
      const type = user.broadcaster_type || 'none';
      const statusBonus = type === 'none' ? 10 : type === 'affiliate' ? 5 : 0;
      const score = Math.round(recencyScore * 55 + audienceScore * 35 + statusBonus);
      const ageLabel = ageDays < 60 ? `${Math.round(ageDays)}d account` : `${Math.max(1, Math.round(ageDays / 30))}mo account`;
      return { ...stream, _broadcasterType:type, _accountCreatedAt:user.created_at, _risingScore:score, _via:`Score ${score} · ${ageLabel}`, _why:`Newer account signal · ${stream.viewer_count} live viewers · ${type === 'none' ? 'not affiliated' : type}` };
    })
    .sort((a,b) => b._risingScore - a._risingScore);
  diagnostics.eligible += eligible.length;
  return eligible;
}

async function loadNewAffiliates() {
  const [topGames, followedChannels] = await Promise.all([fetchTopGames(currentToken, MAX_TOP_CATEGORIES_FOR_RISING), getFollowedChannels()]);
  const gameMap = new Map();
  filters.categories.slice(0, MAX_TOP_CATEGORIES_FOR_RISING).forEach(category => gameMap.set(category.id, category));
  topGames.forEach(game => { if (gameMap.size < MAX_TOP_CATEGORIES_FOR_RISING) gameMap.set(game.id, game); });
  const games = [...gameMap.values()];
  const excludedIds = new Set(followedChannels.map(channel => channel.broadcaster_id));
  excludedIds.add(currentUser.id);
  diagnostics.categories = games.length;
  if (!games.length) return [];

  const perCategory = await Promise.allSettled(games.map(async game => {
    const streams = await fetchStreamsByGameIdPages(game.id, currentToken, NEW_AFFILIATE_STREAM_PAGES);
    return streams.filter(stream => !excludedIds.has(stream.user_id)).map(stream => ({ ...stream, _sourceCategory:game.name }));
  }));
  diagnostics.failures += perCategory.filter(result => result.status === 'rejected').length;
  const categoryLists = perCategory.filter(result => result.status === 'fulfilled').map(result => result.value);
  const candidates = new Map();
  for (let row = 0; candidates.size < MAX_NEW_AFFILIATE_CANDIDATES; row++) {
    let added = false;
    categoryLists.forEach(list => {
      const stream = list[row];
      if (stream && !candidates.has(stream.user_id) && candidates.size < MAX_NEW_AFFILIATE_CANDIDATES) {
        candidates.set(stream.user_id, stream);
        added = true;
      }
    });
    if (!added) break;
  }
  const candidateList = [...candidates.values()];
  if (!candidateList.length) return [];
  const users = await fetchUsersByIds(candidateList.map(stream => stream.user_id), currentToken);
  const userById = new Map(users.map(user => [user.id, user]));
  const eligible = candidateList
    .map(stream => ({ stream, user:userById.get(stream.user_id) }))
    .filter(({ user }) => {
      if (!user || user.broadcaster_type !== 'affiliate') return false;
      const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000;
      return ageDays >= 0 && ageDays < NEW_AFFILIATE_ACCOUNT_DAYS;
    })
    .map(({ stream, user }) => {
      const ageDays = Math.max(0, (Date.now() - new Date(user.created_at).getTime()) / 86400000);
      const ageLabel = ageDays < 60 ? `${Math.round(ageDays)}d account` : `${Math.max(1, Math.round(ageDays / 30))}mo account`;
      const baseSignalScore = Math.max(0, Math.min(55, Math.round((1 - ageDays / NEW_AFFILIATE_ACCOUNT_DAYS) * 55)));
      return { ...stream, _emergingSection:'newAffiliate', _broadcasterType:'affiliate', _accountCreatedAt:user.created_at, _profileImage:user.profile_image_url || '', _newAffiliateAgeDays:ageDays, _newAffiliateScore:baseSignalScore, _newAffiliateLabel:'Newer Affiliate', _via:`Newer Affiliate · ${ageLabel}`, _why:`Current Twitch Affiliate · account created ${Math.round(ageDays)} days ago · affiliate-earned date unavailable` };
    });
  diagnostics.eligible += eligible.length;
  return eligible;
}

async function loadClips() {
  const channels = (await getFollowedChannels()).slice(0, MAX_SEED_STREAMERS_FOR_CLIPS);
  if (channels.length === 0) return [];
  const now = new Date();
  const since = new Date(now.getTime() - CLIPS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const startedAt = since.toISOString();
  const endedAt = now.toISOString();

  const perStreamer = await Promise.allSettled(channels.map(c => fetchClipsForBroadcaster(c.broadcaster_id, currentToken, startedAt, endedAt)));
  const clips = [];
  perStreamer.forEach(result => { if (result.status === 'fulfilled') clips.push(...result.value); });

  const uniqueById = new Map();
  clips.forEach(c => { if (!uniqueById.has(c.id)) uniqueById.set(c.id, c); });
  return [...uniqueById.values()];
}
