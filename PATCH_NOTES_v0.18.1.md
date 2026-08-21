# NerdSync Alpha-0.18.1 — Loading Feedback Polish

Alpha-0.18.1 is a focused UX polish release. It adds consistent, lightweight loading feedback without introducing D1 or any new persistent storage.

## Added

- Text-only NerdSync wordmark across privacy, login, the signed-in header, and the Field Guide; the previous brain SVG asset has been removed.

- Reusable NerdSync loading spinner treatment for asynchronous status messages.
- Animated loading states for Discovery scans and 30-day historical enrichment.
- Button loading indicators for Scan Deeper, Retry 30D context, Twitch channel search, TwitchTracker retry, and Twitch login handoff.
- Compact loading placeholders for Creator Match audience context, creator comparison, recent broadcasts, clips, schedules, and TwitchTracker details.
- `aria-busy` states on major regions while data is being refreshed.
- Reduced-motion support: loading animation becomes a static dotted indicator when motion reduction is requested.

## Behavior

- Loaders are intentionally small and contextual rather than full-screen blockers.
- Existing partial-result behavior remains intact: Twitch results can appear before historical context finishes.
- No D1 database, cloud profile, background tracking, or new server-side user storage was added. Those remain reserved for NerdSync 3.0.
