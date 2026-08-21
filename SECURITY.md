# NerdSync security model

NerdSync Alpha-0.16.6 is a read-only Twitch client designed for Cloudflare Pages or Workers Static Assets. It includes one stateless Cloudflare endpoint that proxies optional public TwitchTracker channel summaries for Creator Match details.

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
- `/api/twitchtracker-summary` accepts only a validated public Twitch channel login and performs a server-side GET to TwitchTracker. The browser's Twitch OAuth token is never included in that request.
- TwitchTracker responses are treated as supplemental third-party data. A failure does not block Twitch API details or Creator Match itself.
- Successful TwitchTracker summaries are cached for five minutes to reduce repeated third-party requests.

## Local data

- The Twitch access token is stored only for the browser tab session.
- Saved creators, preferences, accessibility choices, and recommendation history remain in browser-local storage partitioned by Twitch user ID.
- GHOST SIGNAL ending progress and its cosmetic reward also remain local and partitioned by Twitch user ID.
- Diagnostic files contain endpoint paths and parameter names, but omit tokens, parameter values, response bodies, and browser-identifying details.

## Cloudflare deployment

Deploy the included `_headers` file with the site. It supplies CSP, clickjacking, MIME-sniffing, referrer, permissions, transport, and cache protections. After deployment, confirm that `_headers` is present in the published output and inspect the production response headers.

Cloudflare Access is optional and dashboard-managed. Enabling it will restrict the entire site to approved users, so it should be used only for private testing or preview deployments—not the public discovery release.


## TwitchTracker boundary

The TwitchTracker summary endpoint is an external, unofficial dependency and may change independently of NerdSync. NerdSync validates channel logins before proxying, sends no Twitch access token or client secret, performs no write action, and keeps no server-side user profile or history.
