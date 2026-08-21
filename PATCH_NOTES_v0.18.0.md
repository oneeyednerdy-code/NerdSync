# NerdSync Alpha-0.18.0 — Creator Match 2.0 + No-D1 Discovery Toolkit

## Creator Match 2.0

- Five editable audience sources: Live now, 30D typical, Last stream, Past broadcast, and Custom.
- Recent Twitch archived VODs display date, title, and duration for context. NerdSync does not use VOD play counts as concurrent viewer counts.
- Match candidates can be compared by live audience or 30-day typical audience.
- Required, Preferred, and Excluded Creator Match tags are separate from the normal Discovery tag filter.
- Match cards explain audience distance and tag/category context.
- Thin match pools can be expanded explicitly from ±50% to ±75%, ±100%, then a broader category search.
- Local recent-match history, local shortlist, four-way comparison, and TXT/CSV/JSON shortlist exports.

## Discovery toolkit

- Preferred Discovery tags provide a small bounded recommendation bonus without excluding other creators.
- Audience filters can use live viewers or 30-day typical viewers.
- New 30-day activity and growth filters use TwitchTracker when selected.
- Cards can explain historical audience stability and category viewer/channel context.
- Adds filter-exclusion summaries, TwitchTracker availability state, historical-data retry actions, staged loading, and partial Twitch results while 30-day context loads when safe.
- Adds named local filter presets and shareable filter URLs containing filter choices only.
- Adds local Maybe / Watch later / Possible raid marks and current-view TXT/CSV/JSON exports.
- Keyboard shortcuts: `/` search, `F` filters, `S` save focused card, `B` cycle bookmark.

## Privacy / architecture

- No D1 database is added.
- No cross-device cloud profile or background stream tracking is added.
- User workflow data stays in browser storage and is removed when that site storage is cleared.
- TwitchTracker requests use only public channel/category identifiers through NerdSync's stateless proxy; Twitch OAuth is never forwarded.
- D1-backed cross-device sync and opt-in per-stream audience history are reserved for the planned NerdSync 3.0 architecture.

## Release hardening

- Bumps the privacy acknowledgement key because Creator Match 2.0 changes when public TwitchTracker summaries can be requested; existing users see the updated data promise once.
- Explicitly hides non-summary children of closed `<details>` disclosures so local history, shortlist, export, and filter disclosure content cannot overlap while closed.
- Validates shared-filter URL payloads before applying them and rejects malformed category IDs/ranges/enums.
- Neutralizes spreadsheet-formula prefixes in CSV exports.

### Modularity and stability

- Split Creator Match 2.0 into `js/creator-match.js` instead of allowing the core Discovery module to grow into a monolith.
- Split historical card context and filter-explanation/status helpers into `js/discovery-context.js`.
- `discovery.js`, `creator-match.js`, `feed-rendering.js`, and `discovery-context.js` all remain below the 25 KB source-module budget.
- Added a regression test for that module-size boundary and production script ordering.
- Chromium responsive checks cover Creator Match, the full filter sheet, and the Field Guide from 1440px down to 320px with no detected viewport escapes or control overlaps.

