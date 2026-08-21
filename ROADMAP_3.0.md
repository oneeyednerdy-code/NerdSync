# NerdSync 3.0 — Persistence Architecture (Deferred)

Alpha-0.18.x intentionally does **not** implement Cloudflare D1. The following features are reserved for a larger 3.0 release because they change NerdSync from browser-local tooling into an application with persistent server-side user data.

## Planned 3.0 capabilities

- Opt-in D1-backed NerdSync profile keyed to validated Twitch user ID.
- Cross-browser and cross-device synchronization for saved creators, preferences, presets, Creator Match history/shortlists, and other explicitly chosen settings.
- Opt-in background stream audience history using a scheduled Cloudflare Worker and Twitch app access token.
- Per-stream sampled average/peak audience accumulated from the date tracking is enabled; no retroactive fabricated values.
- VOD-to-stream linking by Twitch `stream_id` when an archive exists.
- Separate measured audience values from user-entered Creator Match overrides.

## Required privacy controls before 3.0 ships

- Tracking/cloud sync is clearly disclosed and opt-in where persistent behavioral data is involved.
- Twitch OAuth user tokens are not stored merely to support background polling.
- Users can disable sync/tracking without silently deleting data.
- Users get separate export and permanent-delete controls.
- Server data is minimized, documented, and retained only as long as the feature needs it.
- Diagnostics remain privacy-safe and are never automatically uploaded.

Until 3.0, NerdSync's user-specific workflow state remains browser-local.
