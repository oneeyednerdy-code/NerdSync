# NerdSync Alpha-0.19.0 — Plan A Complete

## Schedule Intelligence

- Creator Match Collaboration Fit now prefers published Twitch schedules but can fall back to an **Observed Schedule** for creators who do not publish one.
- Observed patterns analyze up to 30 recent public archived broadcasts from the last 90 days.
- Very short broadcasts are ignored and recent broadcasts are weighted more heavily than older history.
- Repeated weekday/start-time patterns are clustered so one-off streams do not automatically become a schedule.
- TwitchTracker's public 30-day streamed-time total is used only to cross-check whether the available VOD history appears representative. TwitchTracker does not provide the per-stream timestamps used for the pattern.
- Confidence is shown as High, Medium, Low, or Insufficient. High confidence requires strong recurrence plus reasonable VOD/TwitchTracker activity agreement.
- Published schedule overlap gets full Collaboration Fit schedule weight. High-confidence observed overlap is capped at 80% of that weight, Medium at 60%, and Low/Insufficient patterns are informational only.
- Missing schedules remain neutral rather than penalizing a creator. Twitch Schedule API errors are kept distinct from a confirmed no-schedule 404, so NerdSync does not infer a VOD pattern after a failed schedule lookup.
- Creator Match cards identify when an observed schedule contributed context. Comparison 2.0 and the Details schedule section can show the same observed evidence.
- Schedule analysis is bounded to the strongest 12 Collaboration Fit candidates and observed results are cached in memory for six hours.
- No D1 database, persistent schedule store, background tracking, or scheduled Worker is introduced.

## Privacy

- The first-use privacy acknowledgement is bumped because Schedule Intelligence can request a public TwitchTracker candidate summary even when live-viewer matching is selected, solely to cross-check public VOD activity completeness.
- Twitch OAuth tokens are never forwarded to TwitchTracker.
- Observed schedule data is generated in the browser and is not uploaded to Nerdspace Labs storage.

## Plan A foundation

- Centralized release metadata and a native ES-module production bundle.
- Shared Twitch request manager with concurrency, cancellation, rate-budget diagnostics, and bounded retries.
- Versioned same-account NerdSync backup/restore without OAuth tokens or TwitchTracker cache data.
- Browser-local Saved collections and guided Discovery Sessions.
- Find Similar, Collaboration Fit, Comparison 2.0, category opportunity context, and deeper Discovery transparency.
- Maintains the hard Alpha-0.19.x no-D1 boundary; cloud sync and background stream history remain reserved for NerdSync 3.0.
