# NerdSync Alpha-0.16.2

## Creator Match: TwitchTracker channel summaries

- Added the same privacy-preserving TwitchTracker proxy pattern used by Wormhole.
- Creator Match now loads a creator's TwitchTracker 30-day channel summary only when you open that match's **Details** panel.
- Displays available 30-day average viewers, peak viewers, streamed hours, hours watched, followers gained, and TwitchTracker rank.
- TwitchTracker data is supplemental. If TwitchTracker is unavailable, Twitch API details, matching, VODs, clips, and schedules continue to work normally.
- Requests are cached for five minutes in both the browser-facing flow and Cloudflare edge path to reduce repeat traffic.
- Only the public Twitch channel login is sent to TwitchTracker. The user's Twitch OAuth token is never forwarded.

## Cloudflare runtime

- Added `worker.js` so `/api/twitchtracker-summary` can run alongside NerdSync's static assets.
- Updated Wrangler static assets to use the `ASSETS` binding and route `/api/*` through the Worker first.
- Added tests for TwitchTracker normalization/caching and Worker routing.
