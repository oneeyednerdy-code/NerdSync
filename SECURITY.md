# NerdSync security model

NerdSync Alpha-0.17.3 is a read-only Twitch client designed for Cloudflare Pages or Workers Static Assets. It includes stateless Cloudflare endpoints that proxy optional public TwitchTracker channel and category summaries for Historical Discovery and Creator Match details.

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
- Historical Discovery automatically enriches at most 20 strong creator candidates and 6 categories per Discovery load when the setting is enabled. Users can disable this behavior in Settings.
- TwitchTracker responses are treated as supplemental third-party data. A failure does not block Twitch API discovery, filters, Creator Match, clips, VODs, or schedules.
- Successful TwitchTracker summaries are cached for six hours in the browser and at Cloudflare's edge to reduce repeated third-party requests. Unavailable lookups are suppressed for one hour in the browser session.

## Local data

- The Twitch access token is stored only for the browser tab session.
- Saved creators, preferences, accessibility choices, and recommendation history remain in browser-local storage partitioned by Twitch user ID.
- GHOST SIGNAL ending progress and its cosmetic reward also remain local and partitioned by Twitch user ID.
- Diagnostics are stored only in the current browser session (or memory when session storage is unavailable) and are never uploaded automatically.
- Downloaded diagnostic files contain coarse browser/OS/viewport information, active-section/filter counts, scan totals, endpoint paths and parameter names, and sanitized runtime/request failures.
- Diagnostic reports omit OAuth tokens, URL parameter values, response bodies, chat content, raw user-agent strings, and creator/channel identities.

## Cloudflare deployment

Deploy the included `_headers` file with the site. It supplies CSP, clickjacking, MIME-sniffing, referrer, permissions, transport, and cache protections. After deployment, confirm that `_headers` is present in the published output and inspect the production response headers.

Cloudflare Access is optional and dashboard-managed. Enabling it will restrict the entire site to approved users, so it should be used only for private testing or preview deployments—not the public discovery release.


## TwitchTracker boundary

The TwitchTracker basic API is an external, unofficial dependency and may change independently of NerdSync. NerdSync validates channel logins and category IDs before proxying, sends no Twitch access token or client secret, performs no write action, and keeps no server-side user profile or history. Historical values never replace Twitch as the source for live status or current live viewer count.
