# NerdSync Discovery Graph

Release: **Alpha-0.19.0**

## Goal

Recommend relevant live Twitch creators without turning NerdSync into another popularity chart. The algorithm balances compatibility, creator-stage representation, novelty, category variety, and user control.

## Available signals

Twitch provides the authenticated user's followed channels, their current or configured categories, live tags, language, stream status, and current viewer counts. Twitch does not provide third-party apps with watch history, time watched, followed games, historical peak viewers, or proof that a user enjoyed a channel.

Alpha-0.19.0 can enrich a limited set of strong Discovery candidates with TwitchTracker 30-day public channel summaries and a limited set of category summaries. Twitch remains authoritative for who is live, current viewer count, tags, language, category, and archived VOD metadata. TwitchTracker supplies historical context such as typical audience, follower growth, recent activity, and category averages. Creator Match 2.0 can use either current live candidate audiences or 30-day typical audiences when explicitly selected; its own audience suggestion is always editable.

NerdSync therefore learns only from actions taken in NerdSync:

- choosing Watch on Twitch;
- saving a creator;
- choosing More Like This or Less Like This;
- following a category in NerdSync;
- hiding a creator temporarily or permanently;
- selecting categories, required/preferred/excluded tags, language, creator stages, live/typical audience ranges, historical activity/growth filters, and content labels.

An outbound Twitch click is an interest signal, not a claim about viewing duration.
Opening a detail panel is recorded only to reduce repetition; it does not teach the interest profile.

Category discovery begins with two directory pages for a faster first result. Panels that support broader scanning expose a **Scan Deeper** control. Switching panels cancels the abandoned scan.

Hidden Gems uses three current-audience lanes—1–5, 6–20, and 21–75 viewers—and rotates between them so the smallest eligible channels are not displaced by channels near the middle of the range. Historical Discovery can then describe enriched candidates as Rising gem, Steady gem, Hot right now, Quiet right now, or Near typical based on explicit 30-day numbers.

## Candidate generation

For You scans up to ten category directories. It prioritizes:

1. explicitly selected categories;
2. categories followed inside NerdSync;
3. positively learned category interests;
4. categories used by followed Twitch channels;
5. top Twitch categories to preserve exploration.

Followed channels and the logged-in creator are excluded from discovery candidates. Global tag, category, language, content-label, audience, Partner, uptime, activity, historical activity/growth, and chat filters remain authoritative. Preferred tags add only a bounded ranking preference and never become a hidden requirement.

## Discovery Fit

The score is intentionally explainable rather than machine-learning output. Positive signals include explicit category and tag matches, followed-category matches, learned category and tag affinity, overlap with followed channels, preferred audience size, language, novelty, recent activity, direct positive creator feedback, and bounded historical activity/growth context when Historical Discovery is enabled. Less Like This, repeated opens, hiding, and exclusion controls reduce or remove candidates.

When a TwitchTracker 30-day average is available, audience-fit compares the user's preferred audience size against that typical audience rather than one live moment. Historical bonuses are bounded and do not directly reward TwitchTracker rank or a larger raw average audience. Emerging can receive a bounded activity/growth adjustment after its Twitch account-age score is calculated. Scores are clamped to 0–100 and every scored card includes a plain-language "Why this" explanation. Scores rank candidates; they are not judgments of creator quality.

## Feed mixture

When sufficient candidates exist, the default For You order aims for a repeating mixture of:

- 70% strong matches;
- 20% fresh discovery picks;
- 10% exploration outside established interests.

Creator-stage balancing and category-diversity limits are applied as additional safeguards. If a lane lacks enough live candidates, another lane fills the open positions instead of leaving the feed incomplete.

## Privacy and control

The profile is stored in `localStorage`, partitioned by the authenticated Twitch user ID. OAuth tokens remain in `sessionStorage`. Public TwitchTracker summaries may also be cached locally for up to six hours to reduce duplicate third-party requests. Users can disable learning, reset learned recommendations, clear seen history, restore hidden creators, or clear the browser's site data to remove everything local.

NerdSync does not use Twitch watch history, sell recommendation data, or share it with advertisers or data brokers. When Historical Discovery is enabled, only public Twitch channel logins and category IDs are sent through NerdSync's Cloudflare proxy to TwitchTracker; Twitch OAuth is never forwarded.

## 3.0 persistence boundary

Alpha-0.19.x intentionally keeps user workflows browser-local. D1-backed cross-device profiles, cloud synchronization, and opt-in background per-stream audience history are reserved for **NerdSync 3.0**. That architecture must preserve explainability, minimize stored data, separate measured history from user overrides, and include explicit enable/disable, export, and permanent deletion controls. Collaborative filtering should not be introduced until NerdSync has enough consented usage to avoid low-quality or privacy-invasive recommendations.


## Newer Affiliate signal

NerdSync does not infer or display an Affiliate-earned date. A creator enters the Newer Affiliate lane only when Twitch currently reports `broadcaster_type=affiliate` and the Twitch account is under 365 days old. Account recency supplies up to 55 signal points. When Historical Discovery data is available, recent streaming activity can add up to 20 points and follower-growth efficiency can add up to 25 points. The bounded 0–100 signal is used only to order the Newer Affiliate lane; it is not a quality score and does not assert when Affiliate status was earned.


## Creator Match 2.0

Creator Match can suggest the user's audience from current Twitch live viewers or TwitchTracker's public 30-day average. Archived Twitch VODs provide date/title/duration context only; VOD play counts are never treated as concurrent audience. Last Stream and Past Broadcast therefore use the 30-day typical audience only as an editable suggestion in Alpha-0.19.x.

Candidate eligibility can compare the chosen target against current live viewers or, when the user selects Typical mode, TwitchTracker 30-day average viewers for a bounded set of candidates. Required Creator Match tags are hard requirements, excluded tags are hard exclusions, and preferred tags only order otherwise-eligible matches. The match explanation shows audience distance, audience basis, tag overlap, category/genre relationship, and available historical context.

When a match set is thin, the UI offers explicit widening rather than silently changing the user's criteria: ±50% → ±75% → ±100% → broader category exploration.

## Schedule Intelligence and Collaboration Fit

Collaboration Fit evaluates only a bounded set of the strongest Creator Match candidates. Published Twitch schedule segments are the preferred source for schedule overlap. NerdSync only falls back after Twitch successfully confirms there is no published schedule; a Schedule API error does not trigger inference. If either side has no published schedule, NerdSync can derive an **Observed Schedule** from recent public Twitch archived broadcasts.

Observed Schedule rules:

- inspect at most 30 archived broadcasts;
- ignore broadcasts older than 90 days;
- ignore broadcasts shorter than 30 minutes;
- weight 0–30 day broadcasts at 1.0, 31–60 days at 0.75, and 61–90 days at 0.5;
- group broadcasts by weekday and find recurring start-time clusters within a two-hour window;
- require at least two clustered broadcasts and enough weighted recurrence before emitting a window;
- calculate confidence from usable sample count, recurrence ratio, start-time consistency, and VOD/TwitchTracker activity agreement.

TwitchTracker contributes only its public 30-day streamed-time total for the completeness check. TwitchTracker does not provide the per-stream timestamps used to infer the observed windows. If the available VOD duration is substantially lower than TwitchTracker's 30-day activity total, the observed pattern cannot reach High confidence. Without a TwitchTracker cross-check, a consistent VOD pattern can still be Medium confidence but not High.

Published-vs-published overlap can earn the full 20 schedule points. High-confidence observed evidence is capped at 80% of the corresponding published weight, Medium at 60%, and Low/Insufficient observed evidence contributes zero numeric schedule points. Low-confidence overlap can still be displayed as informational context. Missing schedule evidence never counts as a negative signal.

Observed schedules are cached in memory for six hours for the current browser session. No inferred schedule is written to a NerdSync server or D1 database. All wording treats observed windows as historical patterns rather than claims of availability.
