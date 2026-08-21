# NerdSync Alpha-0.17.0 — Historical Discovery

This release changes Discovery from a live-only snapshot into a two-layer system: Twitch remains the source for live status and current stream data, while TwitchTracker can add optional 30-day historical context for a bounded set of candidates.

## Historical Discovery

- Added **Historical Discovery context** in Settings. It is enabled by default and can be disabled at any time.
- Discovery enriches at most 20 strong candidates after Twitch candidate generation/filter preparation.
- At most six Twitch category summaries are requested per Discovery load.
- Channel and category summaries are cached for six hours to reduce repeated TwitchTracker traffic.
- Missing or failed TwitchTracker data never prevents Twitch discovery results from rendering.

## Discovery cards

Enriched cards can show:

- Live now
- 30-day average viewers
- 30-day follower growth
- Hours streamed in the last 30 days
- Current percentage above/below the 30-day average
- 30-day category average viewers
- 30-day category average live channels

Context labels can include **Hot right now**, **Quiet right now**, **Near typical**, **Growing this month**, **Active this month**, **Rising gem**, and **Steady gem** when the underlying data supports those descriptions.

## Ranking changes

- Personalized audience fit prefers the 30-day average when available, instead of judging audience compatibility from one live viewer count.
- Historical activity and follower-growth bonuses are deliberately bounded.
- TwitchTracker rank and raw popularity do not directly increase Discovery Fit.
- Emerging scores can receive a bounded historical activity/growth adjustment after the existing account-age/status score is calculated.
- Hidden Gems still uses the 1–5, 6–20, and 21–75 current-viewer lanes; historical data adds context rather than replacing those eligibility rules.

## Cloudflare and privacy

- Added `/api/twitchtracker-category-summary` alongside `/api/twitchtracker-summary`.
- Both endpoints accept only public identifiers and never forward Twitch OAuth headers.
- The privacy acknowledgement version was bumped so returning users see the new automatic Historical Discovery behavior before continuing.
- Creator Match continues to load TwitchTracker on demand even when Historical Discovery is disabled.

## Validation

The release includes dedicated regression coverage for channel/category normalization, proxy boundaries, lookup caps, Settings opt-out, card UI, historical audience-fit, and Worker routing in addition to the existing NerdSync test suite.
