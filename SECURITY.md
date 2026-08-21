# NerdSync security model

NerdSync Alpha-0.18.0 is a read-only Twitch client designed for Cloudflare Pages or Workers Static Assets. It includes stateless Cloudflare endpoints that proxy public TwitchTracker channel and category summaries for Historical Discovery and Creator Match 2.0. It intentionally has no D1 binding, cloud user profile, or background stream tracker.

## Authentication boundaries

- The browser requests only Twitch's `user:read:follows` scope.
- The public Twitch Client ID belongs in `config.js`; a Twitch Client Secret must never be placed in this project.
- Access tokens exist only in `sessionStorage` and are cleared when the tab session ends, the user logs out, validation fails, or Twitch reports an unauthorized request.
- OAuth state is cryptographically random, single-use, and valid for no more than ten minutes.
- Tokens are validated at startup, hourly while signed in, and after returning to a visible tab when validation is overdue.

## Network boundaries

- Authenticated API requests are restricted to read-only GET calls under `https://api.twitch.tv/helix/`.
- Requests use no browser credentials, no referrer, no browser cache, and a 15-second timeout.
- API-provided links are accepted only for HTTPS Twitch destinations; API-provided images must use HTTPS.
- NerdSync does not perform raids, follows, moderation actions, chat writes, channel changes, or other Twitch mutations.
- `/api/twitchtracker-summary` accepts only a validated public Twitch channel login and `/api/twitchtracker-category-summary` accepts only a numeric Twitch category ID. Both perform server-side GET requests to TwitchTracker. The browser's Twitch OAuth token is never included.
- Historical Discovery automatically enriches at most 20 strong creator candidates and 6 categories per normal Discovery load when the setting is enabled. Explicit 30-day filters can raise the bounded creator lookup budget because those filters require historical data. Users can disable automatic Historical Discovery in Settings.
- Creator Match 2.0 can request the signed-in user's own public TwitchTracker channel summary to suggest a 30-day typical audience. If the user explicitly chooses **30D typical** candidate matching, NerdSync requests summaries only for a limited candidate set. Twitch OAuth is never forwarded.
- TwitchTracker responses are treated as supplemental third-party data. A failure does not block Twitch API discovery, filters, Creator Match, clips, VODs, or schedules.
- Successful TwitchTracker summaries are cached for six hours in the browser and at Cloudflare's edge to reduce repeated third-party requests. Unavailable lookups are suppressed for one hour in the browser session.

## Local data

- The Twitch access token is stored only for the browser tab session.
- Saved creators, preferences, accessibility choices, recommendation history, named filter presets, Creator Match history/shortlists, and bookmark labels remain in browser-local storage partitioned by Twitch user ID.
- GHOST SIGNAL ending progress and its cosmetic reward also remain local and partitioned by Twitch user ID.
- Diagnostics are stored only in the current browser session (or memory when session storage is unavailable) and are never uploaded automatically.
- Downloaded diagnostic files contain coarse browser/OS/viewport information, active-section/filter counts, scan totals, endpoint paths and parameter names, and sanitized runtime/request failures.
- Diagnostic reports omit OAuth tokens, URL parameter values, response bodies, chat content, raw user-agent strings, and creator/channel identities.

## No-D1 boundary through Alpha-0.18.x

- `wrangler.jsonc` contains no `d1_databases` binding.
- No Pages Function or Worker writes a user profile, stream history, match history, shortlist, preference, or diagnostic record to server-side storage.
- Shareable filter URLs contain serialized filter choices only; OAuth values and Twitch identity are not included.
- Creator Match VOD choices use Twitch archived-video metadata only. NerdSync does not reinterpret Twitch VOD `view_count` as concurrent live audience.
- Cloud persistence, cross-device sync, and opt-in background per-stream audience history are explicitly deferred to the planned **3.0** architecture, where they will require separate consent, export, and deletion controls.

## Cloudflare deployment

Deploy the included `_headers` file with the site. It supplies CSP, clickjacking, MIME-sniffing, referrer, permissions, transport, and cache protections. After deployment, confirm that `_headers` is present in the published output and inspect the production response headers.

Cloudflare Access is optional and dashboard-managed. Enabling it will restrict the entire site to approved users, so it should be used only for private testing or preview deployments—not the public discovery release.


## TwitchTracker boundary

The TwitchTracker basic API is an external, unofficial dependency and may change independently of NerdSync. NerdSync validates channel logins and category IDs before proxying, sends no Twitch access token or client secret, performs no write action, and keeps no server-side user profile or history. Historical values never replace Twitch as the source for live status or current live viewer count.
