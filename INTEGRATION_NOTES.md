# Alpha-0.17.1 Historical Discovery integration

- Discovery enrichment runs after Twitch candidate generation, broadcaster-type enrichment, and any required chat/activity detail checks.
- Automatic TwitchTracker work is bounded to 20 strong creator candidates and 6 category IDs per Discovery load.
- Channel and category requests run concurrently through same-origin Cloudflare endpoints with no Twitch OAuth forwarding.
- Public TwitchTracker summaries are cached for six hours in-browser and at Cloudflare's edge; unavailable lookups are suppressed for one hour in the browser session.
- Twitch remains authoritative for live status and current viewers. Historical summaries add context and bounded ranking adjustments only.
- Historical Discovery can be disabled in Settings; Creator Match TwitchTracker details remain on-demand.
- Alpha-0.17.1 renames the affiliate/newer-account lane to Newer Affiliates and adds a bounded 0–100 signal: up to 55 points from account recency, 20 from 30-day activity, and 25 from follower-growth efficiency. Current Affiliate status is a required eligibility gate, not a guessed date.

# Wormhole filter integration

- Comma-separated Twitch tags use case-insensitive exact, match-any behavior.
- Eight Wormhole genre groups resolve through Twitch's IGDB-backed categories.
- Exact Twitch games and creative categories can be included or excluded.
- Manual and genre-derived categories use OR matching.
- Active filters appear as removable chips with a Clear all action.
- Included/excluded tags, stream language, audience presets, custom viewer ranges, and follow-age filters are available.
- Selected categories seed For You, Spotlight, Hidden Gems, and Emerging Live scans instead of only filtering an already-fetched list.
- Alpha-0.5.0 removes the small-stream ceiling from For You, adds five current-live-audience stages, a deliberately balanced default feed, broader audience presets, a dedicated Spotlight panel, and Creator Match networking bands based on current live viewers or a manually entered past peak.
- Alpha-0.6.0 adds Light, Dark, and System themes; three interface sizes; theme-aware high contrast; automatic and manual reduced motion; stronger keyboard, focus, screen-reader, zoom/reflow, forced-colors, and touch-target support.
- Alpha-0.7.0 added the original New Affiliates feed using verified Affiliate broadcaster status plus an account age under 365 days, without imposing a viewer ceiling or claiming access to Affiliate-earned dates.
- Alpha-0.7.1 combines Standard Emerging Live and the affiliate/newer-account lane into one stacked Emerging Live hub, with independent sorting, shared filters, shared API scanning, and duplicate suppression between sections.
- Alpha-0.7.2 aligns NerdSync with Wormhole's shared black/violet design system, typography, panel depth, control styling, and glow treatment while preserving accessible contrast and NerdSync identity.
- Alpha-0.7.3 adds a first-use privacy and necessary-storage notice before Twitch login, with a locally remembered acknowledgement and an explicit no-sale, no-advertiser-sharing data promise.
- Alpha-0.7.4 adds Wormhole-style Twitch Content Classification Labels to live discovery and match cards, filters by official labels, and adds adult-oriented creator tags to the suggested-tag controls.
- Alpha-0.7.5 splits the monolithic HTML/CSS/JavaScript bundle into versioned, cacheable static assets with deferred ordered scripts and Cloudflare Pages cache headers.
- Alpha-0.8.0 adds a phone-first responsive discovery interface with swipeable tab navigation, collapsible options, a modal filter sheet, single-column cards, safe-area support, and mobile-specific accessibility behavior.
- Alpha-0.9.0 adds the NerdSync Discovery Graph: followed-channel category/tag signals, locally followed categories, More/ Less Like This feedback, Watch-on-Twitch intent, a visible private interest profile, optional learning, explainable recommendation lanes, and a 70/20/10 strong-match/discovery/exploration target when enough live candidates exist.
- Alpha-0.10.0 consolidates navigation into Discover, Following, Match, and Saved; moves secondary feeds into contextual selectors; places comparison tools under Match; moves advanced defaults and accessibility into Settings; adds hash routing; and replaces mobile horizontal tabs with a fixed labelled bottom navigation.
- Alpha-0.4.0 added locally learned category/tag preferences, explainable Discovery Fit scores, uptime, optional archived-VOD activity and open-chat checks, direct channel search, two-channel comparison, saved/hidden creator management, accessibility modes, and downloadable privacy-safe diagnostics.

No client secret or direct IGDB credential is added.

## Alpha-0.16.3 button-control reliability

NerdSync's discovery quick choices now use native buttons with synchronized `aria-pressed` state. This covers tag presets, audience presets, language, uptime, recent activity, content classifications, open-chat filtering, genre groups, game-category include/exclude mode, and Creator Match audience source/range. The past-VOD selector remains a native select because it is a dynamic list of broadcasts rather than a short quick-choice set.


## Alpha-0.16.4 Creator Match tag cards

Creator Match cards now display the live channel's Twitch tags. Tags that exactly match the user's included Twitch-tag filters are promoted to the front of the tag list and visually highlighted with a check mark. Matching is case-insensitive and uses the same exact-match rule as the discovery filter itself. No additional Twitch or TwitchTracker request is required because tags are already included in Twitch live-stream responses.


## Alpha-0.16.6 Creator Match tag layout hotfix

Creator Match tags now render beneath a dedicated **Twitch tags** label inside a wrapping pill row. Each tag is visually separated, stays intact as a single pill, and matching tags retain the highlighted check treatment.
