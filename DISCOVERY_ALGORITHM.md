# NerdSync Discovery Graph

Release: **Alpha-0.16.3**

## Goal

Recommend relevant live Twitch creators without turning NerdSync into another popularity chart. The algorithm balances compatibility, creator-stage representation, novelty, category variety, and user control.

## Available signals

Twitch provides the authenticated user's followed channels, their current or configured categories, live tags, language, stream status, and current viewer counts. Twitch does not provide third-party apps with watch history, time watched, followed games, historical peak viewers, or proof that a user enjoyed a channel.

Alpha-0.16.3 can also request a TwitchTracker 30-day public channel summary when the user opens a Creator Match's Details. Those third-party values are display-only and do not affect Creator Match eligibility, audience-distance scoring, Discovery Fit, sorting, or recommendation learning.

NerdSync therefore learns only from actions taken in NerdSync:

- choosing Watch on Twitch;
- saving a creator;
- choosing More Like This or Less Like This;
- following a category in NerdSync;
- hiding a creator temporarily or permanently;
- selecting categories, tags, language, creator stages, audience ranges, and content labels.

An outbound Twitch click is an interest signal, not a claim about viewing duration.
Opening a detail panel is recorded only to reduce repetition; it does not teach the interest profile.

Category discovery begins with two directory pages for a faster first result. Panels that support broader scanning expose a **Scan Deeper** control. Switching panels cancels the abandoned scan.

Hidden Gems uses three current-audience lanes—1–5, 6–20, and 21–75 viewers—and rotates between them so the smallest eligible channels are not displaced by channels near the middle of the range.

## Candidate generation

For You scans up to ten category directories. It prioritizes:

1. explicitly selected categories;
2. categories followed inside NerdSync;
3. positively learned category interests;
4. categories used by followed Twitch channels;
5. top Twitch categories to preserve exploration.

Followed channels and the logged-in creator are excluded from discovery candidates. Global tag, category, language, content-label, audience, Partner, uptime, activity, and chat filters remain authoritative.

## Discovery Fit

The score is intentionally explainable rather than machine-learning output. Positive signals include explicit category and tag matches, followed-category matches, learned category and tag affinity, overlap with followed channels, preferred audience size, language, novelty, recent activity, and direct positive creator feedback. Less Like This, repeated opens, hiding, and exclusion controls reduce or remove candidates.

Scores are clamped to 0–100 and every scored card includes a plain-language "Why this" explanation. Scores rank candidates; they are not judgments of creator quality.

## Feed mixture

When sufficient candidates exist, the default For You order aims for a repeating mixture of:

- 70% strong matches;
- 20% fresh discovery picks;
- 10% exploration outside established interests.

Creator-stage balancing and category-diversity limits are applied as additional safeguards. If a lane lacks enough live candidates, another lane fills the open positions instead of leaving the feed incomplete.

## Privacy and control

The profile is stored in `localStorage`, partitioned by the authenticated Twitch user ID. OAuth tokens remain in `sessionStorage`. Users can disable learning, reset learned recommendations, clear seen history, restore hidden creators, or clear the browser's site data to remove everything local.

NerdSync does not use Twitch watch history, sell recommendation data, or share it with advertisers or data brokers.

## Future Cloudflare Worker version

An optional Worker and D1 database could synchronize preferences across devices and retain opt-in creator performance snapshots. It should preserve the same explainability, use short retention windows, store the minimum necessary data, and provide export and permanent deletion controls. Collaborative filtering should not be introduced until NerdSync has enough consented usage to avoid low-quality or privacy-invasive recommendations.
